import { describePuzzleThemes } from '../ui/puzzle-themes.js';

const SOLUTION_STEP_MS = 700;

/**
 * Puzzle mode: loading, validating the solver's moves, playing the opponent's replies,
 * attempt bookkeeping and the puzzle tab controls.
 */
export function createPuzzleController({
    $, Chess, store, eventBus, boardView, clock, botCoordinator, moveHistoryView, services,
    puzzleDatabase, applyUciMove, moveToUci, clearSelection, playSound, playSoundForMove,
    initialBestStreak = 0, saveStoredSettings = (_partial) => {}
}) {
    let active = false;
    let current = null;
    let step = 0;
    let mistakes = 0;
    let attemptRecorded = false;
    let revealed = false;

    // Puzzles solved in a row with no wrong move and no revealed solution
    let streak = 0;
    let bestStreak = initialBestStreak;

    function showStreak() {
        $('#puzzleStreakCount').text(streak);
        $('#puzzleStreak').attr('aria-label', `Серия: ${streak}, рекорд: ${bestStreak}`).attr('title', `Рекорд: ${bestStreak}`);
        $('#puzzleBestStreak').text(`Рекорд серии: ${bestStreak}`);
    }

    function breakStreak() {
        if (streak === 0) return;
        streak = 0;
        showStreak();
    }

    function extendStreak() {
        streak++;
        if (streak > bestStreak) {
            bestStreak = streak;
            saveStoredSettings({ puzzleBestStreak: bestStreak });
        }
        showStreak();
    }

    function showSolutionButton(visible) {
        $('#showSolutionBtn').prop('hidden', !visible);
    }

    // tone: 'success' | 'error' | 'info' | undefined (neutral); colours come from the theme
    function setStatus(text, tone) {
        $('#puzzleStatusText').text(text).attr('data-tone', tone || null);
    }

    let wrongFeedbackTimer = null;
    function flashWrongMove(square) {
        boardView.showSquareFeedback?.(square, 'wrong');
        clearTimeout(wrongFeedbackTimer);
        wrongFeedbackTimer = setTimeout(() => boardView.clearSquareFeedback?.(), 900);
    }

    function isActive() {
        return active;
    }

    // A revealed puzzle counts as finished: the board no longer takes the solver's moves
    function isCompleted() {
        return Boolean(active && current && (step >= current.moves.length || revealed));
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
        if (mistakes === 0) extendStreak();
        showSolutionButton(false);
        setStatus(mistakes === 0 && streak > 1 ? `Задача решена! Серия: ${streak}` : 'Задача решена!', 'success');
        playSound('gameEnd');
    }

    function playOpponentMove(puzzle) {
        clearSelection();
        if (!active || puzzle !== current || revealed || step >= current.moves.length) return;

        const game = store.getState().game;
        boardView.clearSquareFeedback?.();
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
            setStatus('Ваш ход!');
        }
    }

    /** Validates the solver's move. Returns true when it is the expected solution move. */
    function tryMove(source, target, promotion = 'q') {
        if (revealed) return false;
        const game = store.getState().game;
        const expectedMoveUci = current.moves[step];
        const trial = new Chess(game.fen());
        const testMove = trial.move({ from: source, to: target, promotion });
        // Like Lichess, any move that mates solves the puzzle
        const matesNow = Boolean(testMove && trial.in_checkmate());

        if (!(testMove && (moveToUci(testMove) === expectedMoveUci || matesNow))) {
            mistakes++;
            breakStreak();
            setStatus('Неверный ход. Попробуйте ещё раз.', 'error');
            flashWrongMove(target);
            playSound('check');
            return false;
        }

        const move = game.move({ from: source, to: target, promotion });
        clearTimeout(wrongFeedbackTimer);
        boardView.showSquareFeedback?.(target, 'correct');
        pushPosition(game);
        playSoundForMove(move);
        moveHistoryView.updateMoveHistory();
        eventBus.emit('game:move-made', { fen: game.fen(), move: move, game: game });

        step = matesNow ? current.moves.length : step + 1;
        if (step >= current.moves.length) {
            completed();
        } else {
            setStatus('Верно! Ждём ответ соперника…', 'success');
            const puzzle = current;
            setTimeout(() => playOpponentMove(puzzle), 600);
        }
        return true;
    }

    function load(puzzle) {
        // Skipping a puzzle that was not solved ends the streak
        if (current && !isCompleted()) breakStreak();
        recordAttempt(false);
        botCoordinator.cancelBotSearch();
        clearSelection();
        services.gameCompletion?.reset();
        current = puzzle;
        step = 0;
        clearTimeout(wrongFeedbackTimer);
        boardView.clearSquareFeedback?.();
        $('body').addClass('is-puzzle-mode');
        mistakes = 0;
        attemptRecorded = false;
        revealed = false;
        active = true;
        showSolutionButton(true);
        clock.stopClock();

        const game = store.getState().game;
        game.load(current.fen);
        store.setState({ historyFENs: [game.fen()], currentViewPly: 0, mode: 'puzzle' });

        const newOrientation = game.turn() === 'w' ? 'white' : 'black';
        boardView.orientation(newOrientation);
        eventBus.emit('board:orientation-changed', { orientation: newOrientation });

        const moveColor = game.turn() === 'w' ? 'белых' : 'чёрных';
        setStatus('Ход ' + moveColor + '. Найдите лучшее продолжение');
        showPuzzleMeta(current);

        moveHistoryView.updateMoveHistory();
        boardView.clearArrows();
        boardView.clearLastMoveHighlight?.();
        boardView.highlightCheck(game);
        eventBus.emit('game:move-made', { fen: game.fen(), animate: false, game: game });
        if (current.lastMove) boardView.highlightLastMove?.(current.lastMove.from, current.lastMove.to);
    }

    /** Leaves puzzle mode; the editor keeps the puzzle position on the board. */
    function exit({ keepPosition = false } = {}) {
        clearSelection();
        recordAttempt(false);
        active = false;
        current = null;
        revealed = false;
        showSolutionButton(false);
        clearTimeout(wrongFeedbackTimer);
        boardView.clearSquareFeedback?.();
        $('body').removeClass('is-puzzle-mode');
        store.setState({ mode: 'free' });
        setStatus('Нажмите «Следующая задача», чтобы начать');
        showPuzzleMeta({ themes: [] });
        if (!keepPosition) $('#startPositionBtn').click();
    }

    /** Plays the rest of the solution on the board; the puzzle counts as not solved. */
    function showSolution() {
        if (!active || !current || isCompleted()) return Promise.resolve();
        const puzzle = current;
        revealed = true;
        mistakes++;
        breakStreak();
        recordAttempt(false);
        showSolutionButton(false);
        clearSelection();
        clearTimeout(wrongFeedbackTimer);
        boardView.clearSquareFeedback?.();
        setStatus('Показываем решение…', 'info');

        return /** @type {Promise<void>} */ (new Promise(resolve => {
            function playNext() {
                if (puzzle !== current) return resolve();
                if (step >= puzzle.moves.length) {
                    setStatus('Решение показано. Попробуйте следующую задачу.', 'info');
                    return resolve();
                }
                const game = store.getState().game;
                const moveObj = applyUciMove(game, puzzle.moves[step]);
                if (!moveObj) {
                    setStatus('Не удалось воспроизвести решение задачи.');
                    return resolve();
                }
                playSoundForMove(moveObj);
                pushPosition(game);
                moveHistoryView.updateMoveHistory();
                eventBus.emit('game:move-made', { fen: game.fen(), move: moveObj, game: game });
                step++;
                setTimeout(playNext, SOLUTION_STEP_MS);
            }
            playNext();
        }));
    }

    $('#showSolutionBtn').on('click', () => { showSolution(); });

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
                setStatus('Нет доступных задач');
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

    showStreak();

    return { isActive, isCompleted, tryMove, load, loadNext, exit, updateCount, showSolution };
}
