/**
 * The live game: making moves (human, bot, editor), status line and game-over overlay,
 * persistence of finished games, position resets, FEN import and new-game controls.
 */
import { getDisplayedGame, isHistoricalPosition } from '../domain/position.js';
import { retainCastlingRights } from '../domain/castling-rights.js';
import { parseUciMove } from '../services/puzzle-runner.js';

export function createGameSession({
    $, Chess, store, eventBus, boardView, clock, botCoordinator, analysisCoordinator, moveHistoryView,
    services, puzzle, getBotLevel, clearSelection, playSound, playSoundForMove, saveStoredSettings
}) {
    // The play panel shows the new-game form, the live game or the finished game.
    let lastResultKey = null;
    function setPanelPhase(phase) {
        $('#tab-play').attr('data-phase', phase);
    }

    const END_REASONS = { checkmate: 'мат', draw: 'ничья', timeout: 'время вышло' };

    function showGameResult(result, endReason) {
        const fens = store.getState().historyFENs;
        const key = `${fens.length}:${fens[fens.length - 1]}`;
        if (key === lastResultKey) return;
        lastResultKey = key;
        const human = boardView.orientation() === 'black' ? 'b' : 'w';
        const winner = result === '1-0' ? 'w' : result === '0-1' ? 'b' : null;
        const outcome = winner === null ? 'Ничья' : winner === human ? 'Победа' : 'Поражение';
        const reason = END_REASONS[endReason];
        $('#gameResultTitle').text(reason && reason !== 'ничья' ? `${outcome} · ${reason}` : outcome);
        $('#gameResultMeta').text(`Вы против: ${$('#botLevel option:selected').text()} · ${$('#selectedTimeText').text()}`);
        setPanelPhase('review');
    }

    function pushPosition(game) {
        const fens = store.getState().historyFENs.slice();
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
    }

    /** Drops every ply after the one being viewed so a new move continues from it. */
    function truncateToViewedPly() {
        const state = store.getState();
        if (!isHistoricalPosition(state)) return;
        const game = state.game;
        const fens = state.historyFENs.slice();
        while (fens.length - 1 > state.currentViewPly) {
            game.undo();
            fens.pop();
        }
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1, isThinking: false, selectedSquare: null });
        gameCompletionReset();
        clock.applySettings();
        $('#gameOverOverlay').hide().data('dismissed', true);
        boardView.clearArrows();
        botCoordinator.cancelBotSearch();
        if (typeof boardView.position === 'function') {
            boardView.position(game.fen(), false);
        }
        moveHistoryView.updateMoveHistory();
        updateStatus();
    }

    function beginCurrentGame(startingFen) {
        const completion = services.gameCompletion;
        if (!completion || completion.currentGameId || puzzle.isActive() || getBotLevel() === 0) return;
        completion.beginGame({
            startingFen: startingFen,
            humanColor: boardView.orientation() === 'white' ? 'w' : 'b',
            botLevel: getBotLevel(),
            timeControl: { enabled: clock.enabled, baseMinutes: Number($('#timerBase').val()), incrementSeconds: Number($('#timerInc').val()) }
        });
    }

    function completeCurrentGame(result, endReason) {
        if (!puzzle.isActive() && getBotLevel() > 0) showGameResult(result, endReason);
        const completion = services.gameCompletion;
        if (!completion || !completion.currentGameId || puzzle.isActive()) return;
        const game = store.getState().game;
        completion.completeGame({
            result: result,
            endReason: endReason,
            pgn: game.pgn(),
            fens: store.getState().historyFENs.slice(),
            moves: game.history({ verbose: true })
        }).catch(() => { $('#reviewStatus').text('Не удалось сохранить завершённую партию.'); });
    }

    function updateStatus(updateHistory) {
        const state = store.getState();
        const game = state.game;
        const historical = isHistoricalPosition(state);
        const displayedGame = getDisplayedGame(state, Chess);
        const moveColor = displayedGame.turn() === 'w' ? 'Белые' : 'Черные';
        let status;
        let isGameOver = false;
        let overlayText = '';

        if (displayedGame.in_checkmate()) {
            status = 'Мат! ' + moveColor + ' проиграли.';
            isGameOver = true;
            overlayText = 'МАТ!<br><span style="font-size: 20px">' + moveColor + ' проиграли</span>';
            if (!historical) {
                clock.stopClock();
                completeCurrentGame(displayedGame.turn() === 'w' ? '0-1' : '1-0', 'checkmate');
            }
        } else if (displayedGame.in_draw()) {
            status = 'Ничья!';
            isGameOver = true;
            overlayText = 'НИЧЬЯ';
            if (!historical) {
                clock.stopClock();
                completeCurrentGame('1/2-1/2', 'draw');
            }
        } else if (historical) {
            status = (displayedGame.in_check() ? 'Шах! ' : '') + (state.currentViewPly === 0 ? 'Начальная позиция' : 'Просмотр позиции после хода ' + state.currentViewPly) + '. Ход: ' + moveColor;
        } else if (state.isThinking) {
            status = 'Бот думает...';
        } else if (getBotLevel() > 0) {
            status = (game.in_check() ? 'Шах! ' : '') + 'Ход: ' + moveColor;
        } else {
            status = 'Редактор позиций';
        }

        $('#gameStatus').text(status);
        boardView.highlightCheck(displayedGame);
        boardView.highlightAttackedPieces(displayedGame);
        if (updateHistory !== false) moveHistoryView.updateMoveHistory();

        const overlay = $('#gameOverOverlay');
        if (!historical && isGameOver && !overlay.data('dismissed')) {
            $('#gameOverText').html(overlayText);
            overlay.css('display', 'flex');
        } else if (historical || !isGameOver) {
            overlay.hide();
            if (!historical) overlay.data('dismissed', false);
        }
    }

    function makeEditorMove(source, target, piece) {
        if (source === 'spare' || target === 'offboard' || source === target) return false;
        const game = store.getState().game;
        if (!piece) {
            const p = game.get(source);
            if (p) piece = p.color + p.type.toUpperCase();
        }
        const editorColor = piece ? piece.charAt(0) : game.turn();
        let fens = store.getState().historyFENs.slice();
        let editorMove;

        if (game.turn() !== editorColor) {
            const fenParts = game.fen().split(' ');
            fenParts[1] = editorColor;
            const flippedFen = fenParts.join(' ');
            editorMove = new Chess(flippedFen).move({ from: source, to: target, promotion: 'q' });
            if (editorMove) {
                game.load(flippedFen);
                editorMove = game.move({ from: source, to: target, promotion: 'q' });
                fens = [flippedFen];
            }
        } else {
            editorMove = game.move({ from: source, to: target, promotion: 'q' });
        }

        if (!editorMove) return false;
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
        playSoundForMove(editorMove);
        updateStatus();
        eventBus.emit('game:move-made', { fen: game.fen(), move: editorMove, game: game });
        return true;
    }

    /** Returns true when the move was accepted. */
    function makeMove(source, target, piece) {
        if (puzzle.isActive()) return puzzle.tryMove(source, target);

        const game = store.getState().game;
        boardView.clearArrows();

        if (getBotLevel() === 0) return makeEditorMove(source, target, piece);

        truncateToViewedPly();
        boardView.removeHighlights();

        const startingFen = game.fen();
        const promotion = (typeof piece === 'string' && piece.length === 1) ? piece.toLowerCase() : 'q';
        const move = game.move({ from: source, to: target, promotion });
        if (move === null) return false;

        beginCurrentGame(startingFen);
        if ($('#tab-play').attr('data-phase') === 'setup') setPanelPhase('game');
        pushPosition(game);
        playSoundForMove(move);
        clock.addIncrement(move.color);
        clock.startClock();
        updateStatus();
        eventBus.emit('game:move-made', { fen: game.fen(), move: move, game: game });
        return true;
    }

    /** A piece was dragged in editor mode and the move was not legal: take the board as drawn. */
    function applyEditedPosition({ piece, newPos }) {
        const game = store.getState().game;
        const nextTurn = piece.charAt(0) === 'w' ? 'b' : 'w';
        const editedPlacement = window.Chessboard.objToFen(newPos);
        const castlingRights = retainCastlingRights(game.fen(), editedPlacement);
        game.load(editedPlacement + ' ' + nextTurn + ' ' + castlingRights + ' - 0 1');
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0 });
        playSoundForMove(null);
        updateStatus();
        eventBus.emit('game:move-made', { fen: game.fen(), game: game });
    }

    function resetPosition(mutate) {
        gameCompletionReset();
        botCoordinator.cancelBotSearch();
        boardView.clearArrows();
        boardView.clearLastMoveHighlight?.();
        const game = store.getState().game;
        mutate(game);
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0 });
        playSound('gameStart');
        clock.applySettings();
        updateStatus();
        boardView.highlightCheck(game);
        eventBus.emit('game:move-made', { fen: game.fen(), animate: false, game: game });
    }

    function gameCompletionReset() {
        services.gameCompletion?.reset();
    }

    function restoreSavedGame(record) {
        if (puzzle.isActive()) puzzle.exit();
        gameCompletionReset();
        botCoordinator.cancelBotSearch();
        clock.stopClock();

        const game = store.getState().game;
        game.load(record.fens[0]);
        record.moves.forEach(move => game.move({ from: move.from, to: move.to, promotion: move.promotion }));
        store.setState({ historyFENs: record.fens.slice(), currentViewPly: record.fens.length - 1 });

        if (record.botLevel != null) {
            $('#botLevel').val(record.botLevel);
            store.setState({ settings: { ...store.getState().settings, botLevel: record.botLevel } });
            botCoordinator.updateStockfishLevel(record.botLevel);
        }

        boardView.orientation(record.humanColor === 'b' ? 'black' : 'white');
        $('#gameOverOverlay').data('dismissed', true);
        $('.tab-btn[data-tab="tab-play"]').trigger('click');
        setPanelPhase('review');
        updateStatus();
    }

    function showReviewMoment(record, moment) {
        const state = store.getState();
        const sameGame = state.historyFENs.length === record.fens.length &&
            state.historyFENs[state.historyFENs.length - 1] === record.fens[record.fens.length - 1];
        if (!sameGame) restoreSavedGame(record);
        store.setState({ currentViewPly: moment.ply });
        moveHistoryView.goToPly(moment.ply);
        if (moment.bestMove) {
            const displayedGame = getDisplayedGame(store.getState(), Chess);
            eventBus.emit('engine:hints-updated', { hints: { 1: moment.bestMove }, game: displayedGame });
        }
    }

    function playFromReviewMoment(record, moment) {
        if (puzzle.isActive()) puzzle.exit();
        const state = store.getState();
        const sameGame = state.historyFENs.length === record.fens.length &&
            state.historyFENs[state.historyFENs.length - 1] === record.fens[record.fens.length - 1];
        if (!sameGame) restoreSavedGame(record);
        store.setState({ currentViewPly: moment.ply });
        moveHistoryView.goToPly(moment.ply);
        truncateToViewedPly();
        $('.tab-btn[data-tab="tab-play"]').trigger('click');
    }

    function playBestMoveFromMoment(record, moment) {
        playFromReviewMoment(record, moment);
        if (moment.bestMove) {
            const parsed = parseUciMove(moment.bestMove);
            if (parsed) {
                makeMove(parsed.from, parsed.to, parsed.promotion);
            }
        }
    }

    function setOrientation(orientation) {
        boardView.orientation(orientation);
        store.setState({ orientation });
        eventBus.emit('board:orientation-changed', { orientation });
        clock.updateClockUI();
    }

    eventBus.on('bot:move-ready', (result) => {
        clearSelection();
        if (!result || clock.timedOut) {
            updateStatus();
            return;
        }

        const game = store.getState().game;
        const botMove = game.move(result.bestmove, { sloppy: true });
        if (!botMove) {
            updateStatus();
            return;
        }

        pushPosition(game);
        playSoundForMove(botMove);
        clock.addIncrement(botMove.color);
        clock.startClock();
        eventBus.emit('game:move-made', { fen: game.fen(), move: botMove, game: game });
        updateStatus();
    });

    eventBus.on('shell:get-fen-requested', () => {
        $('#fenInput').val(boardView.getFen());
    });

    eventBus.on('shell:set-fen-requested', (event) => {
        let fullFen = event.fen;
        if (fullFen.split(' ').length === 1) fullFen += ' w - - 0 1';
        const candidateGame = new Chess();
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

        const game = store.getState().game;
        game.load(candidateGame.fen());
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0 });
        eventBus.emit('game:move-made', { fen: game.fen(), game: game });
        updateStatus();
    });

    $('#startPositionBtn').on('click', function() {
        clearSelection();
        resetPosition(game => game.reset());
    });

    $('#clearBoardBtn').on('click', function() {
        resetPosition(game => game.clear());
    });

    $('.color-btn').on('click', function() {
        $('.color-btn').removeClass('active');
        $(this).addClass('active');

        const color = $(this).data('color');
        saveStoredSettings({ playerColor: color });
        if (color === 'white' || color === 'black') setOrientation(color);
    });

    $('#ccStartGameBtn').on('click', function() {
        if (puzzle.isActive()) puzzle.exit();
        else $('#startPositionBtn').trigger('click');
        lastResultKey = null;
        setPanelPhase('game');
        clock.applySettings(true);
        clock.startClock();

        let chosen = $('.color-btn.active').data('color') || 'white';
        if (chosen === 'random') chosen = Math.random() < 0.5 ? 'white' : 'black';
        setOrientation(chosen);

        // If playing as black, the bot (white) makes the opening move
        window.setTimeout(function() {
            if (chosen === 'black') botCoordinator.makeBotMove();
            else analysisCoordinator.autoHintIfNeeded();
        }, 300);
    });

    $('.new-game-setup-btn').on('click', function() {
        setPanelPhase('setup');
        $('#ccStartGameBtn').trigger('focus');
    });

    $('#openLastReviewBtn').on('click', function() {
        setPanelPhase('review');
    });

    $('#closeOverlayBtn').on('click', function() {
        $('#gameOverOverlay').hide().data('dismissed', true);
    });

    return {
        makeMove, applyEditedPosition, updateStatus, completeCurrentGame,
        showReviewMoment, restoreSavedGame, truncateToViewedPly, setPanelPhase,
        playFromReviewMoment, playBestMoveFromMoment
    };
}
