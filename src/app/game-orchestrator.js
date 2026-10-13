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
import { createLichessPuzzleSource } from '../services/lichess-puzzles.js';
import { applyUciMove, moveToUci } from '../services/puzzle-runner.js';
import { createGameCompletionCoordinator } from '../services/game-completion.js';
import { createGameReviewService } from '../services/game-review.js';
import { createPostGameReviewCoordinator } from '../services/post-game-review.js';
import { createMoveHistoryView } from '../ui/move-history.js';
import { createPostGameReviewView } from '../ui/post-game-review.js';
import { createReviewAnnotations } from '../ui/review-annotations.js';
import { loadStoredSettings, saveStoredSettings } from '../storage/settings-storage.js';
import { createPuzzleController } from './puzzle-controller.js';
import { createLessonController } from './lesson-controller.js';
import { createRatedGame } from './rated-game.js';
import { getDisplayedGame } from '../domain/position.js';
import { botLevelToRating } from '../services/game-review.js';
import { createGameSession } from './game-session.js';
import { createPositionEditor } from './position-editor.js';
import { createMoveAnnouncer } from './move-announcer.js';
import { showBotOpponent } from '../ui/player-badges.js';
import { createGamesList } from '../ui/games-list.js';
import { installPieceImageFallback } from '../ui/piece-images.js';
import { createBoardInteraction } from './board-interaction.js';
import { createTimeControlController } from './time-control-controller.js';
import { createControls } from './controls.js';

$(document).ready(function() {
    installPieceImageFallback();
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
            botLevel: storedSettings.botLevel > 0 ? storedSettings.botLevel : 10,
            hintLevel: storedSettings.hintLevel
        }
    });
    const engineWorkers = createEngineWorkers();
    
    const boardView = createBoardView({ $, eventBus, store });
    createShellView({ $, eventBus });
    createEvalBarView({ $, eventBus });
    createMaterialView({ $, eventBus, Chess });

    // Sync UI inputs with stored settings
    // Older versions saved the editor (level 0) as the opponent; start against the bot instead
    $('#botLevel').val(storedSettings.botLevel > 0 ? storedSettings.botLevel : 10);
    showBotOpponent($, storedSettings.botLevel > 0 ? storedSettings.botLevel : 10);
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
            const uciStr = botMove ? botMove.from + botMove.to + (botMove.promotion && botMove.promotion !== 'q' ? botMove.promotion : '') : null;
            botCoordinator.deliverBotMove(uciStr ? { bestmove: uciStr, uci: uciStr } : null);
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

    // "думает…" on the bot's badge while it is choosing a move
    store.subscribe(state => {
        $('.top-player').toggleClass('is-thinking', Boolean(state.isThinking) && state.mode !== 'puzzle');
    });
    analysisCoordinator = createAnalysisCoordinator({ eventBus, store, engine });

    // Services that become available once IndexedDB has opened.
    const services = {
        repository: null, puzzleCatalog: null, gameCompletion: null, postGameReview: null,
        puzzleSource: createLichessPuzzleSource({ chessFactory: () => new Chess() })
    };

    const getBotLevel = () => parseInt(String($('#botLevel').val()), 10);
    const clearSelection = () => {
        store.setState({ selectedSquare: null });
        boardView.removeHighlights();
    };

    const audio = createAudio(store.getState().game);
    const { playSound, playSoundForMove } = audio;

    // Sound settings live in the style tab
    function applySoundSettings() {
        const enabled = $('#soundEnabledCb').is(':checked');
        const volume = Number($('#soundVolume').val());
        audio.configure({ enabled, volume: volume / 100 });
        $('#soundVolume').prop('disabled', !enabled);
        $('#soundVolumeValue').text(`${volume}%`);
    }
    $('#soundEnabledCb').prop('checked', storedSettings.soundEnabled !== false);
    $('#soundVolume').val(storedSettings.soundVolume ?? 70);
    applySoundSettings();
    $('#soundEnabledCb, #soundVolume').on('input change', function() {
        applySoundSettings();
        saveStoredSettings({ soundEnabled: $('#soundEnabledCb').is(':checked'), soundVolume: Number($('#soundVolume').val()) });
    });
    $('#soundVolume').on('change', () => playSound('move'));

    // Controllers reference each other; these are assigned below, before any event can fire.
    let puzzle;
    let lesson;
    let session;

    // Puzzles and opening lessons both script the moves; the game session sees them as one mode
    const guided = {
        isActive: () => puzzle.isActive() || lesson.isActive(),
        isCompleted: () => (lesson.isActive() ? lesson.isCompleted() : puzzle.isCompleted()),
        tryMove: (source, target, promotion) => (lesson.isActive()
            ? lesson.tryMove(source, target, promotion)
            : puzzle.tryMove(source, target, promotion)),
        exit: (options) => {
            if (lesson.isActive()) lesson.exit(options);
            if (puzzle.isActive()) puzzle.exit(options);
        }
    };

    const clock = createClock({
        $: $,
        game: store.getState().game,
        getBoard: () => boardView,
        getIsPuzzleMode: () => guided.isActive(),
        getCurrentViewPly: () => store.getState().currentViewPly,
        getHistoryLength: () => store.getState().historyFENs.length,
        playSound,
        onTimeout: (result) => { session.completeCurrentGame(result.winnerColor === 'w' ? '1-0' : '0-1', 'timeout'); }
    });

    const reviewAnnotations = createReviewAnnotations({
        Chess, boardView, eventBus, getHistoryFENs: () => store.getState().historyFENs
    });
    const showReviewAnnotations = () => reviewAnnotations.showForViewPly(store.getState().currentViewPly);
    eventBus.on('board:resized', showReviewAnnotations);

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
            showReviewAnnotations();
        },
        getMoveClass: (ply) => reviewAnnotations.classForPly(ply),
        onHistoryChange: showReviewAnnotations
    });

    eventBus.on('game:ply-changed', (event) => {
        if (event?.positionGame) boardView.highlightCheck(event.positionGame);
    });

    puzzle = createPuzzleController({
        $, Chess, store, eventBus, boardView, clock, botCoordinator, moveHistoryView, services,
        puzzleDatabase, applyUciMove, moveToUci, clearSelection, playSound, playSoundForMove,
        initialBestStreak: storedSettings.puzzleBestStreak, saveStoredSettings,
        initialRating: { rating: storedSettings.puzzleRating, games: storedSettings.puzzleRatingGames }
    });

    lesson = createLessonController({
        $, Chess, store, eventBus, boardView, clock, botCoordinator, moveHistoryView, clearSelection,
        playSound, playSoundForMove, saveStoredSettings,
        initialProgress: storedSettings.lessonProgress,
        initialCourse: storedSettings.lessonCourse,
        onStart: () => { if (puzzle.isActive()) puzzle.exit({ keepPosition: true }); }
    });

    const rating = createRatedGame({
        $, botLevelToRating,
        initialRatings: storedSettings.ratings,
        saveRatings: (ratings) => saveStoredSettings({ ratings }),
        initialRatedMode: storedSettings.ratedMode !== false,
        saveRatedMode: (ratedMode) => saveStoredSettings({ ratedMode }),
        // «Играть на рейтинг»: hints and highlights are off for the game, the settings are untouched
        onAssistsChange: (off) => {
            store.setState({ assistsOff: off });
            $('#hintBtn').prop('disabled', off).attr('title', off ? 'В рейтинговой партии подсказки выключены' : null);
            boardView.clearArrows();
            boardView.highlightAttackedPieces(getDisplayedGame(store.getState(), Chess));
            if (!off) analysisCoordinator.autoHintIfNeeded();
        }
    });

    session = createGameSession({
        $, Chess, store, eventBus, boardView, clock, botCoordinator, analysisCoordinator, moveHistoryView,
        rating, services, puzzle: guided, getBotLevel, clearSelection, playSound, playSoundForMove, saveStoredSettings
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
        onPlayFromMoment: session.playFromReviewMoment,
        onPlayBestMove: session.playBestMoveFromMoment,
        onSummary: (record, summary, report) => {
            const accuracy = summary.accuracy[record.humanColor === 'b' ? 'b' : 'w'];
            if (accuracy != null) $('#gameOverReviewNote').text(`Ваша точность: ${accuracy.toFixed(1)}. Подробности — в разборе.`);
            reviewAnnotations.set(record, summary, report.evaluations || []);
            moveHistoryView.updateMoveHistory();
        },
        onCancel: () => { services.postGameReview?.cancel(); },
        onRetry: (gameId) => {
            services.postGameReview?.retry(gameId).catch(() => { reviewView.showError('Не удалось повторить разбор.'); });
        },
        onSolvePuzzle: (puzzleToSolve) => {
            $('.tab-btn[data-tab="tab-puzzles"]').trigger('click');
            if (lesson.isActive()) lesson.exit({ keepPosition: true });
            puzzle.load(puzzleToSolve);
        }
    });

    openLocalDatabase().then(async function(repository) {
        services.repository = repository;
        services.puzzleCatalog = createPuzzleCatalog({ builtIns: puzzleDatabase, repository, onlineSource: services.puzzleSource });
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
        puzzle.updateCount();
    }).catch(function() {
        $('#puzzleCatalogStatus').text('Хранилище недоступно: задачи и прогресс не сохраняются между сессиями.');
        $('#reviewStatus').text('Локальное хранилище недоступно: разбор партий отключён.');
    });

    createPositionEditor({ $, Chess, store, eventBus, session });
    createMoveAnnouncer({ $, eventBus });

    // Opening the editor leaves puzzle or lesson mode but keeps the position to edit
    $('.tab-btn[data-tab="tab-setup"]').on('click', function() {
        guided.exit({ keepPosition: true });
        session.updateStatus();
    });

    // Puzzles take over the board: a lesson in progress ends
    $('#loadPuzzleBtn, #dailyPuzzleBtn').on('click', function() {
        if (lesson.isActive()) lesson.exit({ keepPosition: true });
    });

    const interaction = createBoardInteraction({
        $, Chess, store, eventBus, boardView, clock, puzzle: guided, session, getBotLevel, clearSelection
    });
    const timeControl = createTimeControlController({ $, clock, saveStoredSettings, onChange: () => rating.render() });

    // Finished games: reopen one with its review
    const gamesList = createGamesList({
        $,
        getRepository: () => services.repository,
        onOpen: (record, review) => {
            session.presentFinishedGame(record);
            if (review && review.status === 'complete') reviewView.showReport(review, record, null);
            else reviewView.showError('Разбор этой партии не сохранён.');
        }
    });
    $('.tab-btn[data-tab="tab-games"]').on('click', () => { gamesList.render(); });

    $('#resumeGameBtn').on('click', function() {
        if (session.resumeLiveGame()) timeControl.refresh();
    });
    session.refreshResumeCard();
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
