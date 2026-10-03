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
import { loadStoredSettings, saveStoredSettings } from '../storage/settings-storage.js';
import { createPuzzleController } from './puzzle-controller.js';
import { createGameSession } from './game-session.js';
import { createBoardInteraction } from './board-interaction.js';
import { createTimeControlController } from './time-control-controller.js';
import { createControls } from './controls.js';

$(document).ready(function() {
    const storedSettings = loadStoredSettings();
    const eventBus = createEventBus();
    const store = createGameStore({
        game: new Chess(),
        orientation: storedSettings.playerColor === 'black' ? 'black' : 'white',
        settings: {
            highlightMoves: storedSettings.highlightMoves,
            highlightAttacks: storedSettings.highlightAttacks,
            highlightDefenses: storedSettings.highlightDefenses,
            autoHint: storedSettings.autoHint,
            botLevel: storedSettings.botLevel,
            hintLevel: storedSettings.hintLevel
        }
    });
    const engineWorkers = createEngineWorkers();
    
    const boardView = createBoardView({ $, eventBus, store });
    createShellView({ $, eventBus });
    createEvalBarView({ $, eventBus });
    createMaterialView({ $, eventBus, Chess });

    // Sync UI inputs with stored settings
    $('#botLevel').val(storedSettings.botLevel);
    $('#hintLevel').val(storedSettings.hintLevel);
    $('#autoHintCb').prop('checked', storedSettings.autoHint);
    $('#highlightMovesCb').prop('checked', storedSettings.highlightMoves);
    $('#highlightAttacksCb').prop('checked', storedSettings.highlightAttacks);
    $('#highlightDefensesCb').prop('checked', storedSettings.highlightDefenses);
    $('#timerEnableCb').prop('checked', storedSettings.timerEnabled);
    $('#timerBase').val(storedSettings.timerBase);
    $('#timerInc').val(storedSettings.timerInc);

    $('.color-btn').removeClass('active');
    $(`.color-btn[data-color="${storedSettings.playerColor || 'white'}"]`).addClass('active');
    if (storedSettings.playerColor === 'black') {
        boardView.orientation('black');
        eventBus.emit('board:orientation-changed', { orientation: 'black' });
    }
    
    // Provide the engine wrapper that was missing
    let analysisCoordinator;
    const engine = createChessEngine({
        gameWorker: engineWorkers.game,
        hintWorker: engineWorkers.hints,
        getCurrentFen: () => {
            const s = store.getState();
            if (s.historyFENs && typeof s.currentViewPly === 'number' && s.historyFENs[s.currentViewPly]) {
                return s.historyFENs[s.currentViewPly];
            }
            return s.game.fen();
        },
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

    // Services that become available once IndexedDB has opened.
    const services = { repository: null, puzzleCatalog: null, gameCompletion: null, postGameReview: null };

    const getBotLevel = () => parseInt(String($('#botLevel').val()), 10);
    const clearSelection = () => {
        store.setState({ selectedSquare: null });
        boardView.removeHighlights();
    };

    const audio = createAudio(store.getState().game);
    const { playSound, playSoundForMove } = audio;

    // Controllers reference each other; these are assigned below, before any event can fire.
    let puzzle;
    let session;

    const clock = createClock({
        $: $,
        game: store.getState().game,
        getBoard: () => boardView,
        getIsPuzzleMode: () => puzzle.isActive(),
        getCurrentViewPly: () => store.getState().currentViewPly,
        getHistoryLength: () => store.getState().historyFENs.length,
        playSound,
        onTimeout: (result) => { session.completeCurrentGame(result.winnerColor === 'w' ? '1-0' : '0-1', 'timeout'); }
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
            session.updateStatus(false);
        }
    });

    eventBus.on('game:ply-changed', (event) => {
        if (event?.positionGame) boardView.highlightCheck(event.positionGame);
    });

    puzzle = createPuzzleController({
        $, Chess, store, eventBus, boardView, clock, botCoordinator, moveHistoryView, services,
        puzzleDatabase, applyUciMove, moveToUci, clearSelection, playSound, playSoundForMove
    });

    session = createGameSession({
        $, Chess, store, eventBus, boardView, clock, botCoordinator, analysisCoordinator, moveHistoryView,
        services, puzzle, getBotLevel, clearSelection, playSound, playSoundForMove, saveStoredSettings
    });

    function uciToSan(fen, uci) {
        if (!fen || !uci) return null;
        const move = applyUciMove(new Chess(fen), uci);
        return move ? move.san : null;
    }

    const reviewView = createPostGameReviewView({
        $: $,
        toSan: uciToSan,
        onSelectMoment: session.showReviewMoment,
        onCancel: () => { services.postGameReview?.cancel(); },
        onRetry: (gameId) => {
            services.postGameReview?.retry(gameId).catch(() => { reviewView.showError('Не удалось повторить разбор.'); });
        },
        onSolvePuzzle: (puzzleToSolve) => {
            $('.tab-btn[data-tab="tab-puzzles"]').trigger('click');
            puzzle.load(puzzleToSolve);
        }
    });

    openLocalDatabase().then(async function(repository) {
        services.repository = repository;
        services.puzzleCatalog = createPuzzleCatalog({ builtIns: puzzleDatabase, repository });
        await services.puzzleCatalog.removePuzzles(['curated:mate-f8', 'curated:castle', 'curated:rook-mate', 'curated:avoid-stalemate']);
        services.postGameReview = createPostGameReviewCoordinator({
            repository: repository,
            reviewService: createGameReviewService({ worker: engineWorkers.review }),
            getPuzzleCatalog: () => services.puzzleCatalog,
            onProgress: (progress) => { reviewView.showProgress(progress); },
            onReport: async (report, record) => {
                let recommended = report.recommendation ? await repository.puzzles.get(report.recommendation.puzzleId) : null;
                if (!recommended && report.recommendation) recommended = puzzleDatabase.find(item => item.id === report.recommendation.puzzleId) || null;
                reviewView.showReport(report, record, recommended);
            }
        });
        services.gameCompletion = createGameCompletionCoordinator({
            repository: repository,
            onStartReview: (record) => {
                services.postGameReview.start(record).catch(() => { reviewView.showError('Не удалось сохранить разбор партии.'); });
            }
        });
        $('#puzzleCatalogStatus').text('Локальный каталог готов.');
        puzzle.updateCount();
    }).catch(function() {
        $('#puzzleCatalogStatus').text('Локальное хранилище недоступно: доступны встроенные задачи.');
        $('#reviewStatus').text('Локальное хранилище недоступно: разбор партий отключён.');
    });

    const interaction = createBoardInteraction({
        $, Chess, store, eventBus, boardView, clock, puzzle, session, getBotLevel, clearSelection
    });
    const timeControl = createTimeControlController({ $, Chess, store, clock, puzzle, saveStoredSettings });
    createControls({
        $, Chess, store, eventBus, boardView, clock, botCoordinator, analysisCoordinator, moveHistoryView,
        interaction, session, clearSelection, saveStoredSettings
    });

    // Initial state
    session.updateStatus();
    clock.applySettings();
    timeControl.refresh();
    analysisCoordinator.autoHintIfNeeded();
});
