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
    let solvedCount = 0;
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

    function updateCount() {
        if (!services.puzzleCatalog) return;
        services.puzzleCatalog.getCounts().then((counts) => {
            $('#puzzleCatalogCount').text(`Доступно: ${counts.total} · загружено: ${counts.imported}`);
        });
    }

    function recordAttempt(solved) {
        if (!current || attemptRecorded) return;
        if (!solved && step === 0 && mistakes === 0) return;
        attemptRecorded = true;
        services.repository?.attempts.add({ puzzleId: current.id, solved: solved, mistakes: mistakes, completedAt: Date.now() })
            .catch(() => { $('#puzzleCatalogStatus').text('Не удалось сохранить попытку решения.'); });
    }

    function pushPosition(game) {
        const fens = store.getState().historyFENs.slice();
        fens.push(game.fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
    }

    function completed() {
        recordAttempt(true);
        solvedCount++;
        $('#puzzlesScore').text('Решено: ' + solvedCount);
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
        const testMove = new Chess(game.fen()).move({ from: source, to: target, promotion: 'q' });

        if (!(testMove && moveToUci(testMove) === expectedMoveUci)) {
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

        step++;
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

        const moveColor = game.turn() === 'w' ? 'Белые' : 'Черные';
        setStatus('Ход: ' + moveColor + '. Ваш ход!', 'var(--text-color)');
        $('#puzzleDescText').text(current.desc || (current.themes || []).join(', '));

        moveHistoryView.updateMoveHistory();
        boardView.clearArrows();
        boardView.clearLastMoveHighlight?.();
        boardView.highlightCheck(game);
        eventBus.emit('game:move-made', { fen: game.fen(), animate: false, game: game });
    }

    function exit() {
        clearSelection();
        recordAttempt(false);
        active = false;
        current = null;
        store.setState({ mode: 'free' });
        setStatus('Нажмите "Новая задача", чтобы начать!');
        $('#puzzleDescText').text('');
        $('#startPositionBtn').click();
    }

    async function loadRandom() {
        const puzzles = services.puzzleCatalog ? await services.puzzleCatalog.list() : puzzleDatabase;
        if (!puzzles.length) {
            setStatus('Нет доступных задач.');
            return;
        }
        load(puzzles[Math.floor(Math.random() * puzzles.length)]);
    }

    $('#loadPuzzleBtn').on('click', loadRandom);

    $('#exitPuzzleBtn').on('click', function() {
        exit();
        $('.tab-btn[data-tab="tab-play"]').click();
    });

    $('#loadMorePuzzlesBtn').on('click', async function() {
        const catalog = services.puzzleCatalog;
        if (!catalog) {
            $('#puzzleCatalogStatus').text('Каталог ещё инициализируется.');
            return;
        }
        $(this).prop('disabled', true);
        $('#puzzleCatalogStatus').text('Загружаем следующий набор…');
        try {
            const theme = $('#puzzleThemeSelect').val();
            const result = await catalog.loadNextBatch({ theme: theme || undefined });
            $('#puzzleCatalogStatus').text(result.batchId ? `Добавлено: ${result.added}; обновлено: ${result.updated}.` : 'Все доступные наборы уже загружены.');
            updateCount();
        } catch (error) {
            $('#puzzleCatalogStatus').text('Не удалось загрузить набор. Встроенные задачи остаются доступны.');
        } finally {
            $(this).prop('disabled', false);
        }
    });

    $('#clearPuzzleDataBtn').on('click', async function() {
        const catalog = services.puzzleCatalog;
        if (!catalog || !window.confirm('Удалить загруженные задачи и историю их решения?')) return;
        try {
            await catalog.clearLocalData();
            $('#puzzleCatalogStatus').text('Локальные данные задач очищены. Встроенные задачи сохранены.');
            updateCount();
        } catch (error) {
            $('#puzzleCatalogStatus').text('Не удалось очистить локальные данные.');
        }
    });

    return { isActive, isCompleted, tryMove, load, exit, updateCount };
}
