import { describePuzzleThemes } from '../ui/puzzle-themes.js';

/**
 * Puzzle mode: loading, validating the solver's moves, playing the opponent's replies,
 * attempt bookkeeping and the puzzle tab controls.
 */
export function createPuzzleController({
    $, Chess, store, eventBus, boardView, clock, botCoordinator, moveHistoryView, services,
    puzzleDatabase, applyUciMove, moveToUci, clearSelection, playSound, playSoundForMove
}) {
    let active = false;
    let current = null;
    let step = 0;
    let mistakes = 0;
    let attemptRecorded = false;

    function setStatus(text, color) {
        $('#puzzleStatusText').text(text);
        if (color) $('#puzzleStatusText').css('color', color);
    }

    function isActive() {
        return active;
    }

    function isCompleted() {
        return Boolean(active && current && step >= current.moves.length);
    }

    let sessionSolved = 0;

    function updateCount() {
        if (!services.puzzleCatalog) {
            $('#puzzlesScore').text('Решено: ' + sessionSolved);
            return Promise.resolve();
        }
        return services.puzzleCatalog.getCounts().then((counts) => {
            $('#puzzleCatalogCount').text(`Сохранено: ${counts.imported}`);
            $('#puzzlesScore').text('Решено: ' + counts.solved);
        });
    }

    function showPuzzleMeta(puzzle) {
        $('#puzzleDescText').text(describePuzzleThemes(puzzle.themes) || puzzle.desc || '');
        $('#puzzleRatingChip').text(puzzle.rating ? `Рейтинг ${puzzle.rating}` : '').prop('hidden', !puzzle.rating);
        $('#puzzleSourceLink').attr('href', puzzle.sourceUrl || '#').prop('hidden', !puzzle.sourceUrl);
    }

    function recordAttempt(solved) {
        if (!current || attemptRecorded) return;
        if (!solved && step === 0 && mistakes === 0) return;
        attemptRecorded = true;
        const saving = services.repository?.attempts.add({ puzzleId: current.id, solved: solved, mistakes: mistakes, completedAt: Date.now() });
        saving?.then(() => updateCount())
            .catch(() => { $('#puzzleCatalogStatus').text('Не удалось сохранить попытку решения.'); });
    }

    function pushPosition(game) {
        const fens = store.getState().historyFENs.slice();
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
    }

    function completed() {
        sessionSolved++;
        recordAttempt(true);
        if (!services.repository) updateCount();
        setStatus('ЗАДАЧА РЕШЕНА!', '#2ecc71');
        playSound('gameEnd');
    }

    function playOpponentMove(puzzle) {
        clearSelection();
        if (!active || puzzle !== current || step >= current.moves.length) return;

        const game = store.getState().game;
        const moveObj = applyUciMove(game, current.moves[step]);
        if (!moveObj) {
            setStatus('Не удалось воспроизвести решение задачи.');
            return;
        }
        playSoundForMove(moveObj);
        pushPosition(game);
        moveHistoryView.updateMoveHistory();
        eventBus.emit('game:move-made', { fen: game.fen(), move: moveObj, game: game });

        step++;
        if (step >= current.moves.length) {
            completed();
        } else {
            setStatus('Ваш ход!', 'var(--text-color)');
        }
    }

    /** Validates the solver's move. Returns true when it is the expected solution move. */
    function tryMove(source, target) {
        const game = store.getState().game;
        const expectedMoveUci = current.moves[step];
        const trial = new Chess(game.fen());
        const testMove = trial.move({ from: source, to: target, promotion: 'q' });
        // Like Lichess, any move that mates solves the puzzle
        const matesNow = Boolean(testMove && trial.in_checkmate());

        if (!(testMove && (moveToUci(testMove) === expectedMoveUci || matesNow))) {
            mistakes++;
            setStatus('Неверный ход! Попробуйте еще раз.', '#e74c3c');
            playSound('check');
            return false;
        }

        const move = game.move({ from: source, to: target, promotion: 'q' });
        pushPosition(game);
        playSoundForMove(move);
        moveHistoryView.updateMoveHistory();
        eventBus.emit('game:move-made', { fen: game.fen(), move: move, game: game });

        step = matesNow ? current.moves.length : step + 1;
        if (step >= current.moves.length) {
            completed();
        } else {
            setStatus('Верно! Ожидание хода противника...', '#3498db');
            const puzzle = current;
            setTimeout(() => playOpponentMove(puzzle), 600);
        }
        return true;
    }

    function load(puzzle) {
        recordAttempt(false);
        botCoordinator.cancelBotSearch();
        clearSelection();
        services.gameCompletion?.reset();
        current = puzzle;
        step = 0;
        mistakes = 0;
        attemptRecorded = false;
        active = true;
        clock.stopClock();

        const game = store.getState().game;
        game.load(current.fen);
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0, mode: 'puzzle' });

        const newOrientation = game.turn() === 'w' ? 'white' : 'black';
        boardView.orientation(newOrientation);
        eventBus.emit('board:orientation-changed', { orientation: newOrientation });

        const moveColor = game.turn() === 'w' ? 'белых' : 'чёрных';
        setStatus('Ход ' + moveColor + '. Найдите лучшее продолжение', 'var(--text-primary)');
        showPuzzleMeta(current);

        moveHistoryView.updateMoveHistory();
        boardView.clearArrows();
        boardView.clearLastMoveHighlight?.();
        boardView.highlightCheck(game);
        eventBus.emit('game:move-made', { fen: game.fen(), animate: false, game: game });
        if (current.lastMove) boardView.highlightLastMove?.(current.lastMove.from, current.lastMove.to);
    }

    function exit() {
        clearSelection();
        recordAttempt(false);
        active = false;
        current = null;
        store.setState({ mode: 'free' });
        setStatus('Нажмите «Следующая задача», чтобы начать');
        showPuzzleMeta({ themes: [] });
        $('#startPositionBtn').click();
    }

    let loading = false;

    async function loadNext() {
        if (loading) return;
        const options = {
            theme: $('#puzzleThemeSelect').val() || undefined,
            difficulty: $('#puzzleDifficultySelect').val() || 'normal',
            exclude: current?.id
        };
        const button = $('#loadPuzzleBtn');
        loading = true;
        button.prop('disabled', true).text('Загружаем…');
        $('#puzzleCatalogStatus').text('');
        try {
            const result = services.puzzleCatalog
                ? await services.puzzleCatalog.next(options)
                : await nextWithoutCatalog(options);
            if (!result.puzzle) {
                setStatus('Нет доступных задач', 'var(--text-primary)');
                $('#puzzleCatalogStatus').text('Нет связи с Lichess, а сохранённых задач по этой теме нет.');
                return;
            }
            if (result.source === 'offline' && result.error) {
                $('#puzzleCatalogStatus').text('Нет связи с Lichess — задача из сохранённых.');
            }
            load(result.puzzle);
            updateCount();
        } finally {
            loading = false;
            button.prop('disabled', false).text('Следующая задача');
        }
    }

    // Without local storage: straight from the online source, else the bundled list.
    async function nextWithoutCatalog(options) {
        try {
            if (services.puzzleSource) return { puzzle: await services.puzzleSource.next(options), source: 'online', error: null };
        } catch (error) {
            const puzzle = puzzleDatabase.length ? puzzleDatabase[Math.floor(Math.random() * puzzleDatabase.length)] : null;
            return { puzzle, source: puzzle ? 'offline' : 'none', error };
        }
        const puzzle = puzzleDatabase.length ? puzzleDatabase[Math.floor(Math.random() * puzzleDatabase.length)] : null;
        return { puzzle, source: puzzle ? 'offline' : 'none', error: null };
    }

    $('#loadPuzzleBtn').on('click', loadNext);

    $('#exitPuzzleBtn').on('click', function() {
        exit();
        $('.tab-btn[data-tab="tab-play"]').click();
    });

    $('#clearPuzzleDataBtn').on('click', async function() {
        const catalog = services.puzzleCatalog;
        if (!catalog || !window.confirm('Удалить сохранённые задачи, историю решений, партии и разборы?')) return;
        try {
            await catalog.clearLocalData();
            $('#puzzleCatalogStatus').text('Локальные данные очищены.');
            updateCount();
        } catch (error) {
            $('#puzzleCatalogStatus').text('Не удалось очистить локальные данные.');
        }
    });

    return { isActive, isCompleted, tryMove, load, loadNext, exit, updateCount };
}
