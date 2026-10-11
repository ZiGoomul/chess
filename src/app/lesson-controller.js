import { openingCourses, findLine } from '../data/openings.js';

const OPPONENT_DELAY_MS = 700;
// In the quiz an arrow shows the move after this many wrong tries
const QUIZ_MISTAKES_BEFORE_ARROW = 2;

const RUSSIAN_PIECES = { K: 'Кр', Q: 'Ф', R: 'Л', B: 'С', N: 'К' };

/** SAN in Russian notation: Nf3 → Кf3, O-O → 0-0. */
export function toRussianSan(san) {
    if (san.startsWith('O-O')) return san.replace(/O/g, '0');
    return san.replace(/^[KQRBN]/, letter => RUSSIAN_PIECES[letter]).replace(/=([QRBN])/, (_m, letter) => `=${RUSSIAN_PIECES[letter]}`);
}

/** "7.Лe1" for White's move at ply 12, "7…b5" for Black's at ply 13. */
export function numberedSan(ply, san) {
    const number = Math.floor(ply / 2) + 1;
    return `${number}${ply % 2 === 0 ? '.' : '…'}${toRussianSan(san)}`;
}

/**
 * Opening training: the student picks an opening line and plays their side's moves while
 * the opponent's are played for them. Every move comes with why it is played.
 * Mode 'learn' shows the next move with an arrow and its reason before it is played;
 * mode 'quiz' asks for the move and explains it afterwards.
 */
export function createLessonController({
    $, Chess, store, eventBus, boardView, clock, botCoordinator, moveHistoryView, clearSelection,
    playSound, playSoundForMove, onStart = () => {},
    initialProgress = {}, saveStoredSettings = (_partial) => {}
}) {
    let active = false;
    let course = null;
    let line = null;
    let mode = 'learn';
    let mistakes = 0;
    let lineMistakes = 0;
    let opponentTimer = null;
    // Lines finished per mode: { [lineId]: { learn: true, quiz: true } }
    let progress = { ...initialProgress };

    function game() {
        return store.getState().game;
    }

    // Moves played so far in the line; navigation back in history undoes moves in the live game
    function ply() {
        return game().history().length;
    }

    function isStudentTurn() {
        return game().turn() === course.color;
    }

    function isActive() {
        return active;
    }

    function isCompleted() {
        return Boolean(active && line && ply() >= line.moves.length);
    }

    function isAtLivePosition() {
        const state = store.getState();
        return state.currentViewPly === state.historyFENs.length - 1;
    }

    // ---- view -------------------------------------------------------------------

    function setStatus(text, tone) {
        $('#lessonStatus').text(text).attr('data-tone', tone || null);
    }

    /** Comments shown under the status: [{ label, text, tone }] */
    function setComments(items) {
        const list = $('#lessonComments').empty();
        items.filter(Boolean).forEach(item => {
            const entry = $('<li class="lesson-comment"></li>').attr('data-tone', item.tone || null);
            if (item.label) entry.append($('<strong class="lesson-comment-move"></strong>').text(item.label));
            entry.append($('<span class="lesson-comment-text"></span>').text(item.text));
            list.append(entry);
        });
    }

    function renderMoves() {
        const list = $('#lessonMoves').empty();
        const played = ply();
        line.moves.forEach((step, index) => {
            // The quiz does not show what is coming
            if (mode === 'quiz' && index > played) return;
            const isNext = index === played;
            const hidden = index > played || (isNext && mode === 'quiz');
            const item = $('<li class="lesson-move"></li>')
                .toggleClass('is-played', index < played)
                .toggleClass('is-next', isNext)
                .toggleClass('is-student', (index % 2 === 0 ? 'w' : 'b') === course.color)
                .attr('aria-current', isNext ? 'step' : null);
            const number = index % 2 === 0 ? `${index / 2 + 1}.` : '';
            if (number) item.append($('<span class="lesson-move-number"></span>').text(number));
            item.append($('<span class="lesson-move-san"></span>').text(hidden && mode === 'quiz' ? '?' : toRussianSan(step.san)));
            if (hidden && mode === 'learn' && !isNext) item.addClass('is-upcoming');
            list.append(item);
        });
        $('#lessonProgressText').text(`${Math.min(played, line.moves.length)} / ${line.moves.length}`);
        $('#lessonProgressBar').css('width', `${Math.round(100 * Math.min(played, line.moves.length) / line.moves.length)}%`);
    }

    function renderModeSwitch() {
        $('#lessonModeSwitch [data-mode]').each(function() {
            const selected = $(this).data('mode') === mode;
            $(this).toggleClass('active', selected).attr('aria-checked', String(selected));
        });
    }

    function lineBadges(lineId) {
        const done = progress[lineId] || {};
        return { learn: Boolean(done.learn), quiz: Boolean(done.quiz) };
    }

    function renderCatalog() {
        const container = $('#lessonCourses').empty();
        openingCourses.forEach(item => {
            const card = $('<section class="lesson-course"></section>').attr('aria-label', item.name);
            const header = $('<div class="lesson-course-header"></div>');
            header.append($('<h3 class="lesson-course-title"></h3>').text(item.name));
            header.append($('<span class="panel-chip lesson-side-chip"></span>')
                .attr('data-side', item.color)
                .text(item.color === 'w' ? 'за белых' : 'за чёрных'));
            card.append(header);
            card.append($('<p class="lesson-course-summary"></p>').text(item.summary));
            const lines = $('<ul class="lesson-lines"></ul>');
            item.lines.forEach(entry => {
                const badges = lineBadges(entry.id);
                const button = $('<button type="button" class="lesson-line-btn"></button>').attr('data-line', entry.id);
                const text = $('<span class="lesson-line-text"></span>');
                text.append($('<span class="lesson-line-name"></span>').text(entry.name));
                text.append($('<span class="lesson-line-summary"></span>').text(entry.summary));
                button.append(text);
                const marks = $('<span class="lesson-line-marks"></span>');
                if (badges.learn) marks.append($('<span class="lesson-mark" title="Изучено">✓</span>'));
                if (badges.quiz) marks.append($('<span class="lesson-mark lesson-mark--quiz" title="Проверка пройдена">★</span>'));
                button.append(marks);
                button.attr('aria-label', `${item.name}: ${entry.name}${badges.quiz ? ', проверка пройдена' : badges.learn ? ', изучено' : ''}`);
                lines.append($('<li></li>').append(button));
            });
            card.append(lines);
            container.append(card);
        });
    }

    function showCatalog() {
        $('#lessonCatalog').prop('hidden', false);
        $('#lessonView').prop('hidden', true);
        renderCatalog();
    }

    function showLessonView() {
        $('#lessonCatalog').prop('hidden', true);
        $('#lessonView').prop('hidden', false);
        $('#lessonCourseTitle').text(course.name);
        $('#lessonLineTitle').text(line.name);
    }

    // ---- board ------------------------------------------------------------------

    function nextStep() {
        return line && ply() < line.moves.length ? line.moves[ply()] : null;
    }

    /** The next move as chess.js reports it, for its squares. */
    function nextMoveDetails() {
        const step = nextStep();
        if (!step) return null;
        return new Chess(game().fen()).move(step.san);
    }

    function showArrow() {
        boardView.clearArrows();
        if (!active || !isAtLivePosition() || !isStudentTurn()) return;
        const showsMove = mode === 'learn' || mistakes >= QUIZ_MISTAKES_BEFORE_ARROW;
        const move = showsMove ? nextMoveDetails() : null;
        if (move) boardView.showGuideArrow?.(move.from, move.to, game());
    }

    function pushPosition() {
        const fens = store.getState().historyFENs.slice();
        fens.push(game().fen());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
    }

    function announceMove(moveObj) {
        playSoundForMove(moveObj);
        pushPosition();
        moveHistoryView.updateMoveHistory();
        eventBus.emit('game:move-made', { fen: game().fen(), move: moveObj, game: game() });
    }

    // ---- flow -------------------------------------------------------------------

    function commentFor(index, tone, prefix = '') {
        const step = line.moves[index];
        return { label: `${prefix}${numberedSan(index, step.san)}`, text: step.why, tone };
    }

    /** Explains the position for the student's next move. `previous` are comments on the moves just played. */
    function promptStudent(previous = []) {
        const step = nextStep();
        const index = ply();
        if (mode === 'learn') {
            setStatus(`Ваш ход: ${numberedSan(index, step.san)}`, 'info');
            setComments([...previous, commentFor(index, 'next', 'Почему ')]);
        } else {
            setStatus(mistakes >= QUIZ_MISTAKES_BEFORE_ARROW ? 'Подсказка на доске — сыграйте этот ход' : 'Ваш ход. Какой ход по плану?');
            setComments(previous);
        }
        renderMoves();
        showArrow();
    }

    function finish() {
        boardView.clearArrows();
        renderMoves();
        const done = { ...(progress[line.id] || {}) };
        const clean = mode === 'learn' || lineMistakes === 0;
        if (clean) done[mode] = true;
        progress = { ...progress, [line.id]: done };
        saveStoredSettings({ lessonProgress: progress });

        const lastIndex = line.moves.length - 1;
        if (mode === 'quiz') {
            setStatus(lineMistakes === 0 ? 'Вариант сыгран без ошибок!' : `Вариант пройден. Ошибок: ${lineMistakes}`, lineMistakes === 0 ? 'success' : 'info');
        } else {
            setStatus('Вариант изучен! Теперь попробуйте режим «Проверка».', 'success');
        }
        setComments([commentFor(lastIndex, 'success'), { label: 'Что дальше', text: line.outro, tone: 'plan' }]);
        $('#lessonQuizBtn').prop('hidden', mode === 'quiz');
        $('#lessonNextLineBtn').prop('hidden', !followingLine());
        playSound('gameEnd');
    }

    function playOpponentMove(previous) {
        opponentTimer = null;
        if (!active || isStudentTurn() || isCompleted()) return;
        const index = ply();
        const moveObj = game().move(line.moves[index].san);
        if (!moveObj) {
            setStatus('Не удалось воспроизвести ход соперника.', 'error');
            return;
        }
        announceMove(moveObj);
        const comments = [...previous, commentFor(index, 'opponent', 'Соперник: ')];
        if (isCompleted()) finish();
        else promptStudent(comments);
    }

    function scheduleOpponent(previous, delay = OPPONENT_DELAY_MS) {
        clearTimeout(opponentTimer);
        setStatus('Соперник отвечает…');
        setComments(previous);
        renderMoves();
        boardView.clearArrows();
        opponentTimer = setTimeout(() => playOpponentMove(previous), delay);
    }

    /** Continues from the current position: the opponent moves or the student is asked to. */
    function resume(previous = []) {
        clearTimeout(opponentTimer);
        opponentTimer = null;
        mistakes = 0;
        if (isCompleted()) finish();
        else if (isStudentTurn()) promptStudent(previous);
        else scheduleOpponent(previous);
    }

    /** Validates the student's move. Returns true when it is the move of the line. */
    function tryMove(source, target, promotion = 'q') {
        if (!active || isCompleted() || opponentTimer) return false;
        const step = nextStep();
        const trial = new Chess(game().fen());
        const attempt = trial.move({ from: source, to: target, promotion });
        if (!attempt) return false;

        if (attempt.san !== step.san) {
            mistakes++;
            lineMistakes++;
            boardView.showSquareFeedback?.(target, 'wrong');
            setTimeout(() => boardView.clearSquareFeedback?.(), 900);
            playSound('check');
            const hint = mode === 'learn'
                ? `${toRussianSan(attempt.san)} — не по плану. Сыграйте ${toRussianSan(step.san)} (стрелка на доске).`
                : mistakes >= QUIZ_MISTAKES_BEFORE_ARROW
                    ? `${toRussianSan(attempt.san)} — не тот ход. Подсказка на доске.`
                    : `${toRussianSan(attempt.san)} — не тот ход. Подумайте, какой план у этой системы.`;
            setStatus(hint, 'error');
            showArrow();
            return false;
        }

        const index = ply();
        const moveObj = game().move({ from: source, to: target, promotion });
        boardView.clearArrows();
        boardView.showSquareFeedback?.(target, 'correct');
        announceMove(moveObj);
        const comment = commentFor(index, 'success', mode === 'quiz' ? 'Верно! ' : '');
        mistakes = 0;
        if (isCompleted()) finish();
        else scheduleOpponent([comment]);
        return true;
    }

    function hint() {
        if (!active || isCompleted() || !isStudentTurn()) return;
        mistakes = Math.max(mistakes, QUIZ_MISTAKES_BEFORE_ARROW);
        if (mode === 'quiz') lineMistakes++;
        const step = nextStep();
        setStatus(`Нужный ход: ${numberedSan(ply(), step.san)}`, 'info');
        setComments([commentFor(ply(), 'next', 'Почему ')]);
        showArrow();
    }

    /** Takes back the student's last move (and the opponent's reply to it). */
    function stepBack() {
        if (!active || ply() === 0) return;
        clearTimeout(opponentTimer);
        opponentTimer = null;
        clearSelection();
        const fens = store.getState().historyFENs.slice();
        do {
            game().undo();
            fens.pop();
        } while (ply() > 0 && !isStudentTurn());
        store.setState({ historyFENs: fens, currentViewPly: fens.length - 1 });
        boardView.clearSquareFeedback?.();
        boardView.clearLastMoveHighlight?.();
        moveHistoryView.updateMoveHistory();
        eventBus.emit('game:move-made', { fen: game().fen(), animate: true, game: game() });
        $('#lessonQuizBtn, #lessonNextLineBtn').prop('hidden', true);
        resume();
    }

    function start(lineId, startMode = mode) {
        const found = findLine(lineId);
        if (!found) return;
        onStart();
        clearTimeout(opponentTimer);
        opponentTimer = null;
        botCoordinator.cancelBotSearch();
        clearSelection();
        clock.stopClock();
        course = found.course;
        line = found.line;
        mode = startMode;
        mistakes = 0;
        lineMistakes = 0;
        active = true;
        $('body').addClass('is-lesson-mode');

        const current = game();
        current.reset();
        store.setState({ historyFENs: [current.fen()], currentViewPly: 0, mode: 'lesson' });
        const orientation = course.color === 'w' ? 'white' : 'black';
        boardView.orientation(orientation);
        eventBus.emit('board:orientation-changed', { orientation });
        boardView.clearArrows();
        boardView.clearSquareFeedback?.();
        boardView.clearLastMoveHighlight?.();
        moveHistoryView.updateMoveHistory();
        eventBus.emit('game:move-made', { fen: current.fen(), animate: false, game: current });

        showLessonView();
        renderModeSwitch();
        $('#lessonQuizBtn, #lessonNextLineBtn').prop('hidden', true);
        const intro = { label: course.name, text: course.intro, tone: 'plan' };
        if (isStudentTurn()) promptStudent([intro]);
        else scheduleOpponent([intro], OPPONENT_DELAY_MS * 2);
    }

    function setMode(nextMode) {
        if (nextMode !== 'learn' && nextMode !== 'quiz') return;
        mode = nextMode;
        renderModeSwitch();
        if (active) start(line.id, mode);
    }

    function followingLine() {
        const lines = openingCourses.flatMap(item => item.lines);
        const index = lines.findIndex(item => item.id === line.id);
        return lines[index + 1] || null;
    }

    /** Leaves the lesson; the editor keeps the position on the board. */
    function exit({ keepPosition = false } = {}) {
        if (!active) return;
        clearTimeout(opponentTimer);
        opponentTimer = null;
        clearSelection();
        active = false;
        boardView.clearArrows();
        boardView.clearSquareFeedback?.();
        $('body').removeClass('is-lesson-mode');
        store.setState({ mode: 'free' });
        showCatalog();
        if (!keepPosition) $('#startPositionBtn').click();
    }

    // History navigation moves away from the live position: the arrow belongs to the live one
    eventBus.on('game:ply-changed', () => { if (active) showArrow(); });
    eventBus.on('board:resized', () => { if (active) showArrow(); });

    $('#lessonCourses').on('click', '[data-line]', function() {
        start($(this).data('line'), 'learn');
    });
    $('#lessonModeSwitch').on('click', '[data-mode]', function() {
        setMode($(this).data('mode'));
    });
    $('#lessonHintBtn').on('click', hint);
    $('#lessonBackBtn').on('click', stepBack);
    $('#lessonRestartBtn').on('click', () => { if (line) start(line.id, mode); });
    $('#lessonQuizBtn').on('click', () => { if (line) start(line.id, 'quiz'); });
    $('#lessonNextLineBtn').on('click', () => {
        const next = followingLine();
        if (next) start(next.id, 'learn');
    });
    $('#lessonExitBtn').on('click', () => exit());

    showCatalog();

    return {
        isActive, isCompleted, tryMove, start, exit, hint, stepBack, setMode,
        getProgress: () => progress
    };
}
