import { createEventBus } from '../core/event-bus.js';
import { createGameStore } from '../core/game-store.js';
import { createChessEngine } from '../services/chess-engine.js';

import { createBotCoordinator } from '../services/bot-coordinator.js';
import { createAnalysisCoordinator } from '../services/analysis-coordinator.js';
import { createBoardView } from '../ui/board-view.js';
import { createShellView } from '../ui/shell-view.js';
import { createEvalBarView } from '../ui/eval-bar-view.js';
import { createMaterialView } from '../ui/material-view.js';
import { Chess } from 'chess.js';

import { createAudio } from '../services/audio.js';
import { createClock } from '../services/clock.js';
import { createEngineWorkers } from '../services/engine-workers.js';
import { puzzleDatabase } from '../data/puzzles.js';
import { openLocalDatabase } from '../storage/local-database.js';
import { createPuzzleCatalog } from '../services/puzzle-catalog.js';
import { applyUciMove, moveToUci } from '../services/puzzle-runner.js';
import { createGameCompletionCoordinator } from '../services/game-completion.js';
import { createGameReviewService } from '../services/game-review.js';
import { createPostGameReviewCoordinator } from '../services/post-game-review.js';
import { createMoveHistoryView } from '../ui/move-history.js';
import { createPostGameReviewView } from '../ui/post-game-review.js';
import { retainCastlingRights } from '../domain/castling-rights.js';
import { resolveSquareClick, getLegalMovesForSquare, getSquareFromCoords } from '../domain/move-input.js';

$(document).ready(function() {
    const eventBus = createEventBus();
    const store = createGameStore({ game: new Chess() });
    const engineWorkers = createEngineWorkers();
    
    const boardView = createBoardView({ $, eventBus, store });
    const shellView = createShellView({ $, eventBus, store });
    const evalBarView = createEvalBarView({ $, eventBus });
    const materialView = createMaterialView({ $, eventBus, Chess });
    
    // Provide the engine wrapper that was missing
    let analysisCoordinator;
    const engine = createChessEngine({
        gameWorker: engineWorkers.game,
        hintWorker: engineWorkers.hints,
        getCurrentFen: () => store.getState().game.fen(),
        onBotMove: (botMove) => {
            if (botMove) {
                const uciStr = botMove.from + botMove.to + (botMove.promotion && botMove.promotion !== 'q' ? botMove.promotion : '');
                eventBus.emit('bot:move-ready', { bestmove: uciStr, uci: uciStr });
            } else {
                eventBus.emit('bot:move-ready', null);
            }
        },
        onBotThinkingChange: (thinking) => {
            store.setState({ isThinking: thinking });
        },
        onHint: (info) => {
            if (analysisCoordinator) analysisCoordinator.handleHintInfo(info);
        },
        onHintComplete: () => {
            if (analysisCoordinator) analysisCoordinator.handleHintComplete();
        }
    });

    const botCoordinator = createBotCoordinator({ eventBus, store, engine });
    analysisCoordinator = createAnalysisCoordinator({ eventBus, store, engine });

    let localRepository = null;
    let puzzleCatalog = null;
    let gameCompletion = null;
    let postGameReview = null;

    let isPuzzleMode = false;
    let currentPuzzle = null;
    let currentPuzzleStep = 0;
    let solvedPuzzlesCount = 0;
    let puzzleMistakes = 0;
    let puzzleAttemptRecorded = false;

    let dragJustEnded = false;
    let lastSquareClickTime = 0;

    const audio = createAudio(store.getState().game);
    const playSound = audio.playSound;
    const playSoundForMove = audio.playSoundForMove;

    const clock = createClock({
        $: $,
        game: store.getState().game,
        getBoard: () => boardView,
        getIsPuzzleMode: () => isPuzzleMode,
        getCurrentViewPly: () => store.getState().currentViewPly,
        getHistoryLength: () => store.getState().historyFENs.length,
        playSound,
        onTimeout: (result) => { completeCurrentGame(result.winnerColor === 'w' ? '1-0' : '0-1', 'timeout'); }
    });

    const moveHistoryView = createMoveHistoryView({
        $: $,
        game: store.getState().game,
        getBoard: () => boardView,
        getHistoryFENs: () => store.getState().historyFENs,
        getCurrentViewPly: () => store.getState().currentViewPly,
        setCurrentViewPly: (ply) => { 
            store.setState({ currentViewPly: ply });
            eventBus.emit('game:ply-changed', { positionGame: new Chess(store.getState().historyFENs[ply]) });
        },
        clearArrows: () => boardView.clearArrows(),
        onPositionChange: () => {
            clearSelection();
            updateStatus(false);
        }
    });

    function uciToSan(fen, uci) {
        if (!fen || !uci) return null;
        var move = applyUciMove(new Chess(fen), uci);
        return move ? move.san : null;
    }

    const reviewView = createPostGameReviewView({
        $: $,
        toSan: uciToSan,
        onSelectMoment: showReviewMoment,
        onCancel: () => { postGameReview?.cancel(); },
        onRetry: (gameId) => {
            postGameReview?.retry(gameId).catch(() => { reviewView.showError('Не удалось повторить разбор.'); });
        },
        onSolvePuzzle: (puzzle) => {
            $('.tab-btn[data-tab="tab-puzzles"]').trigger('click');
            loadPuzzle(puzzle);
        }
    });

    openLocalDatabase().then(async function(repository) {
        localRepository = repository;
        puzzleCatalog = createPuzzleCatalog({ builtIns: puzzleDatabase, repository });
        await puzzleCatalog.removePuzzles(['curated:mate-f8', 'curated:castle', 'curated:rook-mate', 'curated:avoid-stalemate']);
        postGameReview = createPostGameReviewCoordinator({
            repository: repository,
            reviewService: createGameReviewService({ worker: engineWorkers.review }),
            getPuzzleCatalog: () => puzzleCatalog,
            onProgress: (progress) => { reviewView.showProgress(progress); },
            onReport: async (report, record) => {
                var puzzle = report.recommendation ? await repository.puzzles.get(report.recommendation.puzzleId) : null;
                if (!puzzle && report.recommendation) puzzle = puzzleDatabase.find(item => item.id === report.recommendation.puzzleId) || null;
                reviewView.showReport(report, record, puzzle);
            }
        });
        gameCompletion = createGameCompletionCoordinator({ 
            repository: repository, 
            onStartReview: (record) => {
                postGameReview.start(record).catch(() => { reviewView.showError('Не удалось сохранить разбор партии.'); });
            } 
        });
        $('#puzzleCatalogStatus').text('Локальный каталог готов.');
        updatePuzzleCount();
    }).catch(function() {
        $('#puzzleCatalogStatus').text('Локальное хранилище недоступно: доступны встроенные задачи.');
        $('#reviewStatus').text('Локальное хранилище недоступно: разбор партий отключён.');
    });

    function updatePuzzleCount() {
        if (!puzzleCatalog) return;
        puzzleCatalog.getCounts().then((counts) => {
            $('#puzzleCatalogCount').text(`Доступно: ${counts.total} · загружено: ${counts.imported}`);
        });
    }

    function showReviewMoment(record, moment) {
        const state = store.getState();
        const sameGame = state.historyFENs.length === record.fens.length &&
            state.historyFENs[state.historyFENs.length - 1] === record.fens[record.fens.length - 1];
        if (!sameGame) restoreSavedGame(record);
        moveHistoryView.goToPly(moment.ply);
        if (moment.bestMove) {
            eventBus.emit('engine:hints-updated', { hints: { 1: moment.bestMove }, game: store.getState().game });
        }
    }

    function restoreSavedGame(record) {
        if (isPuzzleMode) exitPuzzleMode();
        gameCompletion?.reset();
        botCoordinator.cancelBotSearch();
        clock.stopClock();
        
        const game = store.getState().game;
        game.load(record.fens[0]);
        record.moves.forEach(move => game.move({ from: move.from, to: move.to, promotion: move.promotion }));
        
        store.setState({ historyFENs: record.fens.slice(), currentViewPly: record.fens.length - 1 });
        
        boardView.orientation(record.humanColor === 'b' ? 'black' : 'white');
        $('#gameOverOverlay').data('dismissed', true);
        $('.tab-btn[data-tab="tab-play"]').trigger('click');
        updateStatus();
    }

    function isBotGameFinished() {
        return store.getState().game.game_over() || clock.timedOut;
    }

    function beginCurrentGame(startingFen) {
        if (!gameCompletion || gameCompletion.currentGameId || isPuzzleMode || parseInt($('#botLevel').val(), 10) === 0) return;
        gameCompletion.beginGame({ 
            startingFen: startingFen, 
            humanColor: boardView.orientation() === 'white' ? 'w' : 'b', 
            botLevel: parseInt($('#botLevel').val(), 10), 
            timeControl: { enabled: clock.enabled, baseMinutes: Number($('#timerBase').val()), incrementSeconds: Number($('#timerInc').val()) } 
        });
    }

    function completeCurrentGame(result, endReason) {
        if (!gameCompletion || !gameCompletion.currentGameId || isPuzzleMode) return;
        const game = store.getState().game;
        gameCompletion.completeGame({ 
            result: result, 
            endReason: endReason, 
            pgn: game.pgn(), 
            fens: store.getState().historyFENs.slice(), 
            moves: game.history({ verbose: true }) 
        }).catch(() => { $('#reviewStatus').text('Не удалось сохранить завершённую партию.'); });
    }

    // --- Interaction event handlers ---
    eventBus.on('board:drag-start', (event) => {
        const state = store.getState();
        const game = state.game;
        if (state.isThinking) { event.cancel = true; return; }
        
        if (isPuzzleMode && currentPuzzle && currentPuzzleStep >= currentPuzzle.moves.length) {
            event.cancel = true; return;
        }
        const isEditor = !isPuzzleMode && parseInt($('#botLevel').val(), 10) === 0;
        if (!isEditor) {
            if (game.turn() === 'w' && event.piece.search(/^b/) !== -1) { event.cancel = true; return; }
            if (game.turn() === 'b' && event.piece.search(/^w/) !== -1) { event.cancel = true; return; }
        }
        if (!isPuzzleMode && !isEditor && clock.timedOut) { event.cancel = true; return; }

        boardView.clearArrows();

        if (state.currentViewPly < state.historyFENs.length - 1) {
            let fens = state.historyFENs.slice();
            while (fens.length - 1 > state.currentViewPly) {
                game.undo();
                fens.pop();
            }
            store.setState({ historyFENs: fens });
            moveHistoryView.updateMoveHistory();
            updateStatus();
        }
        
        const botLevel = parseInt($('#botLevel').val(), 10);
        if (botLevel > 0) {
            if (game.game_over() || (!isPuzzleMode && clock.timedOut)) { event.cancel = true; return; }
            if (event.source === 'spare') { event.cancel = true; return; }
            if ((game.turn() === 'w' && event.piece.search(/^b/) !== -1) ||
                (game.turn() === 'b' && event.piece.search(/^w/) !== -1)) {
                event.cancel = true; return;
            }
        }

        if (event.source !== 'spare') {
            if (event.source !== state.selectedSquare) {
                clearSelection();
            }
            boardView.showMoveHints(event.source, null, game);
        }
    });

    eventBus.on('board:drop', (event) => {
        if (event.source === event.target) {
            handleSquareClick(event.source);
            event.action = 'snapback';
            return;
        }
        if (event.target === 'offboard') {
            event.action = 'snapback';
            return;
        }

        dragJustEnded = true;
        clearSelection();
        setTimeout(() => { dragJustEnded = false; }, 120);

        const botLevel = parseInt($('#botLevel').val(), 10);
        
        if (isPuzzleMode && currentPuzzle) {
            var ok = makeMove(event.source, event.target, event.piece);
            if (!ok) event.action = 'snapback';
            return;
        }

        if (botLevel === 0) {
            if (event.source !== 'spare') {
                var ok = makeMove(event.source, event.target, event.piece);
                if (ok) {
                    return;
                }
            }

            const game = store.getState().game;
            var nextTurn = event.piece.charAt(0) === 'w' ? 'b' : 'w';
            var editedPlacement = window.Chessboard.objToFen(event.newPos);
            var castlingRights = retainCastlingRights(game.fen(), editedPlacement);
            var newFen = editedPlacement + " " + nextTurn + " " + castlingRights + " - 0 1";
            game.load(newFen);
            store.setState({ historyFENs: [game.fen()], currentViewPly: 0 });
            playSoundForMove(null);
            updateStatus();
            eventBus.emit('game:move-made', { fen: game.fen() });
            return;
        }

        var ok = makeMove(event.source, event.target, event.piece);
        if (!ok) event.action = 'snapback';
    });

    eventBus.on('board:square-clicked', (event) => {
        handleSquareClick(event.square);
    });

    eventBus.on('board:mouseover-square', (event) => {
        if (store.getState().selectedSquare) return;
        const highlight = $('#highlightMovesCb').is(':checked');
        if (!highlight) return;

        const state = store.getState();
        const isHistoricalPosition = state.currentViewPly < state.historyFENs.length - 1;
        const positionGame = isHistoricalPosition ? new Chess(state.historyFENs[state.currentViewPly]) : state.game;
        const isEditor = !isPuzzleMode && parseInt($('#botLevel').val(), 10) === 0;
        const moves = getLegalMovesForSquare(event.square, positionGame, isEditor, Chess);

        if (!moves || moves.length === 0) return;
        boardView.showMoveHints(event.square, moves, positionGame);
    });

    eventBus.on('board:mouseout-square', (event) => {
        if (store.getState().selectedSquare) return;
        boardView.removeHighlights();
    });

    eventBus.on('board:pointer-down-outside', (event) => {
        if (!event.isPiece && store.getState().selectedSquare) {
            clearSelection();
        }
    });

    eventBus.on('bot:move-ready', (result) => {
        clearSelection();
        if (!result || clock.timedOut) {
            updateStatus();
            return;
        }

        const state = store.getState();
        const game = state.game;
        var botMove = game.move(result.bestmove, {sloppy: true});
        if (!botMove) {
            updateStatus();
            return;
        }

        const fens = state.historyFENs.slice();
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });

        playSoundForMove(botMove);
        clock.addIncrement(botMove.color);
        clock.startClock();
        eventBus.emit('game:move-made', { fen: game.fen(), move: botMove });
        updateStatus();
    });

    eventBus.on('shell:get-fen-requested', () => {
        $('#fenInput').val(boardView.getFen());
    });

    eventBus.on('shell:set-fen-requested', (event) => {
        var fen = event.fen;
        var fullFen = fen;
        if (fullFen.split(' ').length === 1) {
             fullFen += " w - - 0 1";
        }
        var candidateGame = new Chess();
        try {
            if (!candidateGame.load(fullFen)) throw new Error('Invalid FEN');
        } catch (error) {
            $('#fenError').text('Некорректная позиция FEN.').show();
            return;
        }

        clearSelection();
        botCoordinator.cancelBotSearch();
        boardView.clearArrows();
        $('#fenError').hide();
        
        const state = store.getState();
        state.game.load(candidateGame.fen());
        store.setState({ historyFENs: [state.game.fen()], currentViewPly: 0 });
        eventBus.emit('game:move-made', { fen: state.game.fen() });
        updateStatus();
    });

    function makeMove(source, target, piece) {
        const state = store.getState();
        const game = state.game;

        if (isPuzzleMode && currentPuzzle) {
            var expectedMoveUci = currentPuzzle.moves[currentPuzzleStep];
            var tempGame = new Chess(game.fen());
            var testMove = tempGame.move({ from: source, to: target, promotion: 'q' });
            
            if (testMove && moveToUci(testMove) === expectedMoveUci) {
                var move = game.move({ from: source, to: target, promotion: 'q' });
                const fens = state.historyFENs.slice();
                fens.push(game.fen());
                store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
                playSoundForMove(move);
                moveHistoryView.updateMoveHistory();
                eventBus.emit('game:move-made', { fen: game.fen(), move: move });
                
                currentPuzzleStep++;
                if (currentPuzzleStep >= currentPuzzle.moves.length) {
                    puzzleCompleted();
                } else {
                    $('#puzzleStatusText').text('Верно! Ожидание хода противника...');
                    $('#puzzleStatusText').css('color', '#3498db');
                    setTimeout(() => playOpponentPuzzleMove(currentPuzzle), 600);
                }
                return true;
            } else {
                puzzleMistakes++;
                $('#puzzleStatusText').text('Неверный ход! Попробуйте еще раз.');
                $('#puzzleStatusText').css('color', '#e74c3c');
                playSound('check'); 
                return false;
            }
        }

        var botLevel = parseInt($('#botLevel').val(), 10);
        boardView.clearArrows();
        
        if (botLevel === 0) {
            if (source !== 'spare' && target !== 'offboard' && source !== target) {
                if (!piece) {
                    var p = game.get(source);
                    if (p) piece = p.color + p.type.toUpperCase();
                }
                var editorColor = piece ? piece.charAt(0) : game.turn();
                var isEditorOutOfTurn = game.turn() !== editorColor;
                var editorBaseFen = game.fen();
                var editorMove = null;
                let fens = state.historyFENs.slice();

                if (isEditorOutOfTurn) {
                    var editorFenParts = editorBaseFen.split(' ');
                    editorFenParts[1] = editorColor;
                    var editorPosition = new Chess(editorFenParts.join(' '));
                    editorMove = editorPosition.move({ from: source, to: target, promotion: 'q' });

                    if (editorMove) {
                        game.load(editorFenParts.join(' '));
                        editorMove = game.move({ from: source, to: target, promotion: 'q' });
                        fens = [editorFenParts.join(' ')];
                    }
                } else {
                    editorMove = game.move({ from: source, to: target, promotion: 'q' });
                }

                if (editorMove) {
                    fens.push(game.fen());
                    store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
                    playSoundForMove(editorMove);
                    updateStatus();
                    eventBus.emit('game:move-made', { fen: game.fen(), move: editorMove });
                    return true;
                }
            }
            return false;
        }

        if (state.currentViewPly < state.historyFENs.length - 1) {
            let fens = state.historyFENs.slice();
            while (fens.length - 1 > state.currentViewPly) {
                game.undo();
                fens.pop();
            }
            store.setState({ historyFENs: fens });
            moveHistoryView.updateMoveHistory();
            updateStatus();
        }

        boardView.removeHighlights();

        var startingFen = game.fen();
        var move = game.move({ from: source, to: target, promotion: 'q' });
        if (move === null) return false;

        beginCurrentGame(startingFen);
        
        const fens = state.historyFENs.slice();
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
        
        playSoundForMove(move);
        clock.addIncrement(move.color);
        clock.startClock();
        updateStatus();
        eventBus.emit('game:move-made', { fen: game.fen(), move: move });

        return true;
    }

    function handleSquareClick(square) {
        var now = Date.now();
        if (now - lastSquareClickTime < 120) return;
        lastSquareClickTime = now;
        if (dragJustEnded) return;

        const state = store.getState();
        const game = state.game;
        var isHistoricalPosition = state.currentViewPly < state.historyFENs.length - 1;
        var positionGame = isHistoricalPosition ? new Chess(state.historyFENs[state.currentViewPly]) : game;
        var isEditor = !isPuzzleMode && parseInt($('#botLevel').val(), 10) === 0;
        var isPuzzleCompleted = Boolean(isPuzzleMode && currentPuzzle && currentPuzzleStep >= currentPuzzle.moves.length);

        var resolution = resolveSquareClick({
            selectedSquare: state.selectedSquare,
            clickedSquare: square,
            game: positionGame,
            isEditor: isEditor,
            isPuzzleMode: isPuzzleMode,
            isPuzzleCompleted: isPuzzleCompleted,
            isThinking: state.isThinking,
            isGameOver: game.game_over(),
            isTimedOut: clock.timedOut,
            ChessCtor: Chess
        });

        if (resolution.action === 'select' || resolution.action === 'switch_selection') {
            store.setState({ selectedSquare: resolution.square });
            boardView.clearArrows();
            boardView.showMoveHints(resolution.square, resolution.moves, positionGame);
        } else if (resolution.action === 'deselect') {
            clearSelection();
        } else if (resolution.action === 'move') {
            var fromSquare = resolution.from;
            var toSquare = resolution.to;
            clearSelection();
            makeMove(fromSquare, toSquare);
        }
    }

    function clearSelection() {
        store.setState({ selectedSquare: null });
        boardView.removeHighlights();
    }

    // --- Puzzles ---
    function recordPuzzleAttempt(solved) {
        if (!currentPuzzle || puzzleAttemptRecorded) return;
        if (!solved && currentPuzzleStep === 0 && puzzleMistakes === 0) return;
        puzzleAttemptRecorded = true;
        localRepository?.attempts.add({ puzzleId: currentPuzzle.id, solved: solved, mistakes: puzzleMistakes, completedAt: Date.now() })
            .catch(() => { $('#puzzleCatalogStatus').text('Не удалось сохранить попытку решения.'); });
    }

    async function loadRandomPuzzle() {
        var puzzles = puzzleCatalog ? await puzzleCatalog.list() : puzzleDatabase;
        if (!puzzles.length) {
            $('#puzzleStatusText').text('Нет доступных задач.');
            return;
        }
        loadPuzzle(puzzles[Math.floor(Math.random() * puzzles.length)]);
    }

    function loadPuzzle(puzzle) {
        recordPuzzleAttempt(false);
        botCoordinator.cancelBotSearch();
        clearSelection();
        gameCompletion?.reset();
        currentPuzzle = puzzle;
        currentPuzzleStep = 0;
        puzzleMistakes = 0;
        puzzleAttemptRecorded = false;
        isPuzzleMode = true;
        clock.stopClock();
        
        const state = store.getState();
        const game = state.game;
        game.load(currentPuzzle.fen);
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0, mode: 'puzzle' });
        
        const newOrientation = game.turn() === 'w' ? 'white' : 'black';
        boardView.orientation(newOrientation);
        eventBus.emit('board:orientation-changed', { orientation: newOrientation });
        
        var moveColor = (game.turn() === 'w') ? 'Белые' : 'Черные';
        $('#puzzleStatusText').text('Ход: ' + moveColor + '. Ваш ход!');
        $('#puzzleStatusText').css('color', 'var(--text-color)');
        $('#puzzleDescText').text(currentPuzzle.desc || (currentPuzzle.themes || []).join(', '));
        
        moveHistoryView.updateMoveHistory();
        boardView.clearArrows();
        eventBus.emit('game:move-made', { fen: game.fen() });
    }

    function exitPuzzleMode() {
        clearSelection();
        recordPuzzleAttempt(false);
        isPuzzleMode = false;
        currentPuzzle = null;
        store.setState({ mode: 'free' });
        $('#puzzleStatusText').text('Нажмите "Новая задача", чтобы начать!');
        $('#puzzleDescText').text('');
        $('#startPositionBtn').click(); 
    }

    function playOpponentPuzzleMove(puzzle) {
        clearSelection();
        if (!isPuzzleMode || puzzle !== currentPuzzle || currentPuzzleStep >= currentPuzzle.moves.length) return;
        
        const state = store.getState();
        const game = state.game;
        var moveObj = applyUciMove(game, currentPuzzle.moves[currentPuzzleStep]);
        if (!moveObj) {
            $('#puzzleStatusText').text('Не удалось воспроизвести решение задачи.');
            return;
        }
        playSoundForMove(moveObj);
        
        const fens = state.historyFENs.slice();
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
        
        moveHistoryView.updateMoveHistory();
        eventBus.emit('game:move-made', { fen: game.fen(), move: moveObj });
        
        currentPuzzleStep++;
        
        if (currentPuzzleStep >= currentPuzzle.moves.length) {
            puzzleCompleted();
        } else {
            $('#puzzleStatusText').text('Ваш ход!');
            $('#puzzleStatusText').css('color', 'var(--text-color)');
        }
    }

    function puzzleCompleted() {
        recordPuzzleAttempt(true);
        solvedPuzzlesCount++;
        $('#puzzlesScore').text('Решено: ' + solvedPuzzlesCount);
        $('#puzzleStatusText').text('ЗАДАЧА РЕШЕНА! 🎉');
        $('#puzzleStatusText').css('color', '#2ecc71');
        playSound('gameEnd');
    }

    function updateStatus(updateHistory) {
        const state = store.getState();
        const game = state.game;
        var isHistoricalPosition = state.currentViewPly < state.historyFENs.length - 1;
        var displayedGame = isHistoricalPosition ? new Chess(state.historyFENs[state.currentViewPly]) : game;
        var status = '';
        var moveColor = (displayedGame.turn() === 'w') ? 'Белые' : 'Черные';
        var isGameOver = false;
        var overlayText = '';

        if (displayedGame.in_checkmate()) {
            status = 'Мат! ' + moveColor + ' проиграли.';
            isGameOver = true;
            overlayText = 'МАТ!<br><span style="font-size: 20px">' + moveColor + ' проиграли</span>';
            if (!isHistoricalPosition) {
                clock.stopClock();
                completeCurrentGame(displayedGame.turn() === 'w' ? '0-1' : '1-0', 'checkmate');
            }
        } else if (displayedGame.in_draw()) {
            status = 'Ничья!';
            isGameOver = true;
            overlayText = 'НИЧЬЯ';
            if (!isHistoricalPosition) {
                clock.stopClock();
                completeCurrentGame('1/2-1/2', 'draw');
            }
        } else if (isHistoricalPosition) {
            status = (displayedGame.in_check() ? 'Шах! ' : '') + (state.currentViewPly === 0 ? 'Начальная позиция' : 'Просмотр позиции после хода ' + state.currentViewPly) + '. Ход: ' + moveColor;
        } else {
            if (state.isThinking) {
                status = 'Бот думает...';
            } else if (parseInt($('#botLevel').val(), 10) > 0) {
                if (game.in_check()) {
                    status = 'Шах! Ход: ' + moveColor;
                } else {
                    status = 'Ход: ' + moveColor;
                }
            } else {
                status = 'Редактор позиций';
            }
        }
        
        $('#gameStatus').text(status);
        boardView.highlightCheck(displayedGame);
        boardView.highlightAttackedPieces(displayedGame);
        if (updateHistory !== false) moveHistoryView.updateMoveHistory();
        
        if (!isHistoricalPosition && isGameOver && !$('#gameOverOverlay').data('dismissed')) {
            $('#gameOverText').html(overlayText);
            $('#gameOverOverlay').css('display', 'flex');
        } else if (isHistoricalPosition || !isGameOver) {
            $('#gameOverOverlay').hide();
            if (!isHistoricalPosition) $('#gameOverOverlay').data('dismissed', false);
        }
    }

    // --- Wire buttons ---
    $('#hintBtn').on('click', function() {
        $(this).text('Анализ...').prop('disabled', true);
        analysisCoordinator.requestHint();
    });

    eventBus.on('engine:hint-completed', function() {
        $('#hintBtn').text('Подсказать лучший ход').prop('disabled', false);
    });

    $('#highlightAttacksCb, #highlightDefensesCb').on('change', function() {
        const state = store.getState();
        var isHistoricalPosition = state.currentViewPly < state.historyFENs.length - 1;
        var displayedGame = isHistoricalPosition ? new Chess(state.historyFENs[state.currentViewPly]) : state.game;
        boardView.highlightAttackedPieces(displayedGame);
    });

    $('#highlightMovesCb').on('change', function() {
        if (store.getState().selectedSquare) {
            const state = store.getState();
            var isHistoricalPosition = state.currentViewPly < state.historyFENs.length - 1;
            var positionGame = isHistoricalPosition ? new Chess(state.historyFENs[state.currentViewPly]) : state.game;
            var isEditor = !isPuzzleMode && parseInt($('#botLevel').val(), 10) === 0;
            var moves = getLegalMovesForSquare(state.selectedSquare, positionGame, isEditor, Chess);
            boardView.showMoveHints(state.selectedSquare, moves, positionGame);
        } else {
            boardView.removeHighlights();
        }
    });

    $('#flipOrientationBtn').on('click', function() {
        clearSelection();
        boardView.flip();
        const orientation = boardView.orientation();
        eventBus.emit('board:orientation-changed', { orientation });
        analysisCoordinator.drawHintArrows();
        clock.updateClockUI();
    });

    $('#startPositionBtn').on('click', function() {
        clearSelection();
        gameCompletion?.reset();
        botCoordinator.cancelBotSearch();
        boardView.clearArrows();
        const game = store.getState().game;
        game.reset();
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0 });
        playSound('gameStart');
        clock.applySettings();
        updateStatus();
        eventBus.emit('game:move-made', { fen: game.fen() });
    });

    $('#clearBoardBtn').on('click', function() {
        gameCompletion?.reset();
        botCoordinator.cancelBotSearch();
        boardView.clearArrows();
        const game = store.getState().game;
        game.clear();
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0 });
        playSound('gameStart');
        clock.applySettings();
        updateStatus();
        eventBus.emit('game:move-made', { fen: game.fen() });
    });

    $('#botLevel').on('change', function() {
        clearSelection();
        botCoordinator.cancelBotSearch();
        const level = parseInt($(this).val(), 10);
        store.setState({ settings: { ...store.getState().settings, botLevel: level } });
        eventBus.emit('settings:changed', { botLevel: level });
        updateStatus();
    });

    $('#autoHintCb').on('change', function() {
        store.setState({ settings: { ...store.getState().settings, autoHint: $(this).is(':checked') } });
        analysisCoordinator.autoHintIfNeeded();
    });

    $('#closeOverlayBtn').on('click', function() {
        $('#gameOverOverlay').hide();
        $('#gameOverOverlay').data('dismissed', true);
    });

    // Puzzles UI
    $('#loadPuzzleBtn').on('click', loadRandomPuzzle);
    $('#exitPuzzleBtn').on('click', function() {
        exitPuzzleMode();
        $('.tab-btn[data-tab="tab-play"]').click();
    });
    $('#loadMorePuzzlesBtn').on('click', async function() {
        if (!puzzleCatalog) {
            $('#puzzleCatalogStatus').text('Каталог ещё инициализируется.');
            return;
        }
        $(this).prop('disabled', true);
        $('#puzzleCatalogStatus').text('Загружаем следующий набор…');
        try {
            var theme = $('#puzzleThemeSelect').val();
            var result = await puzzleCatalog.loadNextBatch({ theme: theme || undefined });
            $('#puzzleCatalogStatus').text(result.batchId ? `Добавлено: ${result.added}; обновлено: ${result.updated}.` : 'Все доступные наборы уже загружены.');
            updatePuzzleCount();
        } catch (error) {
            $('#puzzleCatalogStatus').text('Не удалось загрузить набор. Встроенные задачи остаются доступны.');
        } finally {
            $(this).prop('disabled', false);
        }
    });

    $('#clearPuzzleDataBtn').on('click', async function() {
        if (!puzzleCatalog || !window.confirm('Удалить загруженные задачи и историю их решения?')) return;
        try {
            await puzzleCatalog.clearLocalData();
            $('#puzzleCatalogStatus').text('Локальные данные задач очищены. Встроенные задачи сохранены.');
            updatePuzzleCount();
        } catch (error) {
            $('#puzzleCatalogStatus').text('Не удалось очистить локальные данные.');
        }
    });

    $('#navFirstBtn').on('click', function() { moveHistoryView.goToPly(0); });
    $('#navPrevBtn').on('click', function() { moveHistoryView.goToPly(store.getState().currentViewPly - 1); });
    $('#navNextBtn').on('click', function() { moveHistoryView.goToPly(store.getState().currentViewPly + 1); });
    $('#navLastBtn').on('click', function() { moveHistoryView.goToPly(store.getState().historyFENs.length - 1); });

    $('#moveHistoryList').on('click', '.move-text', function() {
        var ply = parseInt($(this).data('ply'), 10);
        moveHistoryView.goToPly(ply + 1);
    });

    $('#moveHistoryList').on('keydown', '.move-text', function(event) {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        moveHistoryView.goToPly(parseInt($(this).data('ply'), 10) + 1);
    });

    // Time Control Dialog Buttons inside Orchestrator
    function startNewGameWithTime(enabled, baseMinutes, incrementSeconds) {
        const game = store.getState().game;
        var isNonInitialPosition = game.history().length > 0 || game.fen() !== new Chess().fen();
        if (isNonInitialPosition && !window.confirm('Начать новую партию? Текущая позиция будет сброшена.')) return;

        $('#timerEnableCb').prop('checked', enabled);
        $('#timerBase').val(baseMinutes);
        $('#timerInc').val(incrementSeconds);
        if (isPuzzleMode) exitPuzzleMode();
        else $('#startPositionBtn').trigger('click');
        $('#timeControlDialog')[0].close();
        $('.tab-btn[data-tab="tab-play"]').trigger('click');
        updateTimePresetSelection();
        updateSelectedTimePill();
    }

    $('.time-control-option').on('click', function() {
        startNewGameWithTime(true, Number($(this).data('base')), Number($(this).data('inc')));
    });

    $('#startCustomTimeBtn').on('click', function() {
        var baseInput = $('#customTimerBase')[0];
        var incrementInput = $('#customTimerInc')[0];
        if (!baseInput.reportValidity() || !incrementInput.reportValidity()) return;
        startNewGameWithTime(true, Number(baseInput.value), Number(incrementInput.value));
    });

    $('#startUntimedGameBtn').on('click', function() {
        startNewGameWithTime(false, Number($('#timerBase').val()), Number($('#timerInc').val()));
    });

    $('#timerEnableCb, #timerBase, #timerInc').on('change', function() {
        clock.applySettings(true);
        updateTimePresetSelection();
        updateSelectedTimePill();
    });

    function getTimeCategory(baseMinutes) {
        if (baseMinutes <= 2) return 'Пуля';
        if (baseMinutes <= 5) return 'Блиц';
        if (baseMinutes <= 30) return 'Рапид';
        return 'Классика';
    }

    function updateSelectedTimePill() {
        var base = Number($('#timerBase').val());
        var inc = Number($('#timerInc').val());
        var enabled = $('#timerEnableCb').is(':checked');
        var category = getTimeCategory(base);
        var icon = '⏱';
        if (category === 'Пуля') icon = '⚡';
        else if (category === 'Блиц') icon = '⚡';

        var text;
        if (!enabled) {
            text = 'Без часов';
            icon = '♾️';
        } else if (inc > 0) {
            text = base + ' + ' + inc + ' (' + category + ')';
        } else {
            text = base + ' + 0 (' + category + ')';
        }

        $('#selectedTimeText').text(text);
        $('.cc-pill-icon').text(icon);
    }

    function updateTimePresetSelection() {
        var baseMinutes = Number($('#timerBase').val());
        var incrementSeconds = Number($('#timerInc').val());
        $('.cc-time-btn').each(function() {
            var selected = Number($(this).data('base')) === baseMinutes && Number($(this).data('inc')) === incrementSeconds;
            $(this).toggleClass('cc-time-btn-selected', selected);
        });
    }

    $('.cc-time-btn').on('click', function() {
        var base = Number($(this).data('base'));
        var inc = Number($(this).data('inc'));
        if (base >= 1440) {
            $('#timerEnableCb').prop('checked', false);
        } else {
            $('#timerEnableCb').prop('checked', true);
        }
        $('#timerBase').val(base >= 1440 ? 10 : base);
        $('#timerInc').val(inc);
        clock.applySettings(true);
        updateTimePresetSelection();
        updateSelectedTimePill();

        if (base >= 1440) {
            var days = Math.round(base / 1440);
            $('#selectedTimeText').text(days + ' ' + (days === 1 ? 'день' : days < 5 ? 'дня' : 'дней') + ' (Заочная)');
            $('.cc-pill-icon').text('⚙️');
        }
    });

    $('#ccCustomTimeToggle').on('click', function() {
        var panel = $('#ccCustomTimePanel');
        $(this).toggleClass('cc-expanded');
        panel.slideToggle(150);
    });

    $('#ccAdvancedSettingsToggle').on('click', function() {
        var panel = $('#ccAdvancedSettings');
        $(this).toggleClass('cc-expanded');
        panel.slideToggle(150);
    });

    // Color selection buttons
    $('.color-btn').on('click', function() {
        $('.color-btn').removeClass('active').css('border-color', 'transparent');
        $(this).addClass('active').css('border-color', '#27ae60');

        var color = $(this).data('color');
        if (color === 'white' || color === 'black') {
            boardView.orientation(color);
            store.setState({ orientation: color });
            eventBus.emit('board:orientation-changed', { orientation: color });
            clock.updateClockUI();
        }
    });

    $('#ccStartGameBtn').on('click', function() {
        if (isPuzzleMode) exitPuzzleMode();
        else $('#startPositionBtn').trigger('click');
        clock.applySettings(true);
        clock.startClock();

        var chosen = $('.color-btn.active').data('color') || 'white';
        if (chosen === 'random') {
            chosen = Math.random() < 0.5 ? 'white' : 'black';
        }

        boardView.orientation(chosen);
        store.setState({ orientation: chosen });
        eventBus.emit('board:orientation-changed', { orientation: chosen });
        clock.updateClockUI();

        // If playing as black, bot (white) makes the opening move
        if (chosen === 'black') {
            window.setTimeout(function() {
                botCoordinator.makeBotMove();
            }, 300);
        }
    });

    // History height sync
    function syncHistoryHeight() {
        var historyEl = $('.history-column');
        var boardEl = $('#myBoard .board-b72b1');
        if (!historyEl.length || !boardEl.length) return;
        historyEl.css({ height: '', marginTop: '' });
        var historyTop = historyEl.offset().top;
        var boardBottom = boardEl.offset().top + boardEl.outerHeight();
        if (historyTop > boardBottom) return;
        historyEl.css({
            height: boardBottom - historyTop,
            marginTop: 0
        });
    }
    syncHistoryHeight();
    $(window).resize(syncHistoryHeight);

    // Initial state
    updateStatus();
    clock.applySettings();
    updateTimePresetSelection();
    updateSelectedTimePill();
});
