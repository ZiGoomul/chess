import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createLessonController, toRussianSan, numberedSan } from '../src/app/lesson-controller.js';
import { findLine } from '../src/data/openings.js';
import { createHarness } from './helpers/harness.js';

const LESSON_DOM = `
  <div id="lessonCatalog"><select id="lessonCourseSelect"></select><div id="lessonCourses"></div></div>
  <div id="lessonView" hidden>
    <h2 id="lessonCourseTitle"></h2><p id="lessonLineTitle"></p>
    <div id="lessonModeSwitch"><button data-mode="learn"></button><button data-mode="quiz"></button></div>
    <span id="lessonProgressBar"></span><span id="lessonProgressText"></span>
    <div id="lessonStatus"></div><ul id="lessonComments"></ul><ol id="lessonMoves"></ol>
    <button id="lessonBackBtn"></button><button id="lessonHintBtn"></button><button id="lessonRestartBtn"></button>
    <button id="lessonQuizBtn" hidden></button><button id="lessonNextLineBtn" hidden></button><button id="lessonExitBtn"></button>
  </div>`;

function setup({ progress = {}, course = '' } = {}) {
  mock.timers.enable({ apis: ['setTimeout'] });
  const h = createHarness();
  h.$('body').append(LESSON_DOM);
  const arrows = [];
  h.boardView.showGuideArrow = (from, to) => { arrows.push(`${from}${to}`); };
  const saved = [];
  const lesson = createLessonController({
    $: h.$, Chess: h.Chess, store: h.store, eventBus: h.eventBus, boardView: h.boardView, clock: h.clock,
    botCoordinator: h.botCoordinator, moveHistoryView: h.moveHistoryView, clearSelection: h.clearSelection,
    playSound: h.playSound, playSoundForMove: h.playSoundForMove,
    initialProgress: progress, initialCourse: course, saveStoredSettings: (partial) => { saved.push(partial); }
  });
  const done = () => { mock.timers.reset(); h.close(); };
  return { h, lesson, arrows, saved, done };
}

/** Plays the student's side of a line, letting the opponent reply after each move. */
function playStudentMoves(h, lesson, count) {
  for (let i = 0; i < count; i++) {
    const game = h.store.getState().game;
    const step = findLine('kia-french').line.moves[game.history().length];
    const move = new h.Chess(game.fen()).move(step.san);
    assert.equal(lesson.tryMove(move.from, move.to), true);
    mock.timers.tick(1000);
  }
}

test('Russian notation for the lesson texts', () => {
  assert.equal(toRussianSan('Nf3'), 'Кf3');
  assert.equal(toRussianSan('Kxe2'), 'Крxe2');
  assert.equal(toRussianSan('O-O-O'), '0-0-0');
  assert.equal(toRussianSan('e8=Q+'), 'e8=Ф+');
  assert.equal(numberedSan(0, 'e4'), '1.e4');
  assert.equal(numberedSan(13, 'b5'), '7…b5');
});

test('the dropdown lists every opening and the catalog shows the chosen one', () => {
  const { h, saved, done } = setup({ progress: { 'kid-classical': { learn: true } }, course: 'kid' });
  assert.equal(h.$('#lessonCourseSelect option').length, 3);
  assert.equal(h.$('#lessonCourseSelect').val(), 'kid');
  assert.equal(h.$('#lessonCourses .lesson-course').length, 1);
  assert.equal(h.$('#lessonCourses [data-line]').length, 15);
  assert.equal(h.$('[data-line="kid-classical"] .lesson-mark').length, 1);
  assert.match(h.$('.lesson-course-count').text(), /пройдено: 1/);

  h.$('#lessonCourseSelect').val('dragon').trigger('change');
  assert.equal(h.$('#lessonCourses .lesson-course-title').text(), 'Вариант дракона');
  assert.equal(h.$('#lessonCourses [data-line]').length, 16);
  assert.deepEqual(saved.at(-1), { lessonCourse: 'dragon' });
  done();
});

test('the catalog starts on the first opening when the saved one is unknown', () => {
  const { h, done } = setup({ course: 'missing' });
  assert.equal(h.$('#lessonCourseSelect').val(), 'kia');
  assert.equal(h.$('#lessonCourses [data-line="kia-french"]').length, 1);
  done();
});

test('learning a white line: the arrow shows the move and the opponent replies', () => {
  const { h, lesson, arrows, done } = setup();
  h.$('[data-line="kia-french"]').trigger('click');

  assert.equal(lesson.isActive(), true);
  assert.equal(h.store.getState().mode, 'lesson');
  assert.equal(h.$('#lessonView').prop('hidden'), false);
  assert.equal(h.$('#lessonStatus').text(), 'Ваш ход: 1.e4');
  assert.deepEqual(arrows, ['e2e4']);

  assert.equal(lesson.tryMove('e2', 'e4'), true);
  assert.equal(h.$('#lessonStatus').text(), 'Соперник отвечает…');
  mock.timers.tick(700);
  assert.equal(h.store.getState().game.history().join(' '), 'e4 e6');
  assert.equal(h.$('#lessonStatus').text(), 'Ваш ход: 2.d3');
  assert.match(h.$('#lessonComments').text(), /Соперник: 1…e6/);
  assert.equal(arrows.at(-1), 'd2d3');
  done();
});

test('a black line starts with the opponent move', () => {
  const { h, lesson, done } = setup();
  lesson.start('dragon-yugoslav', 'learn');
  assert.equal(h.store.getState().game.history().length, 0);
  mock.timers.tick(1400);
  assert.equal(h.store.getState().game.history().join(' '), 'e4');
  assert.equal(h.$('#lessonStatus').text(), 'Ваш ход: 1…c5');
  done();
});

test('a move off the line is refused with an explanation', () => {
  const { h, lesson, done } = setup();
  lesson.start('kia-french', 'learn');
  assert.equal(lesson.tryMove('d2', 'd4'), false);
  assert.equal(h.store.getState().game.history().length, 0);
  assert.match(h.$('#lessonStatus').text(), /d4 — не по плану\. Сыграйте e4/);
  assert.equal(h.$('#lessonStatus').attr('data-tone'), 'error');
  done();
});

test('the quiz hides the move until two mistakes or a hint', () => {
  const { h, lesson, arrows, done } = setup();
  lesson.start('kia-french', 'quiz');
  assert.equal(h.$('#lessonStatus').text(), 'Ваш ход. Какой ход по плану?');
  assert.deepEqual(arrows, []);
  assert.equal(h.$('#lessonMoves .is-next').text(), '1.?');

  lesson.tryMove('d2', 'd4');
  assert.deepEqual(arrows, []);
  lesson.tryMove('a2', 'a3');
  assert.deepEqual(arrows, ['e2e4']);
  done();
});

test('finishing a quiz without mistakes is saved as progress', () => {
  const { h, lesson, saved, done } = setup();
  lesson.start('kia-french', 'quiz');
  playStudentMoves(h, lesson, 11);

  assert.equal(lesson.isCompleted(), true);
  assert.equal(h.$('#lessonStatus').text(), 'Вариант сыгран без ошибок!');
  assert.deepEqual(saved.at(-1), { lessonProgress: { 'kia-french': { quiz: true } } });
  // The next line is the next one of the same opening
  assert.equal(h.$('#lessonNextLineBtn').prop('hidden'), false);
  h.$('#lessonNextLineBtn').trigger('click');
  assert.equal(h.$('#lessonLineTitle').text(), '1.e4: против сицилианской с …e6');
  done();
});

test('stepping back takes back the student move and the reply', () => {
  const { h, lesson, done } = setup();
  lesson.start('kia-french', 'learn');
  playStudentMoves(h, lesson, 2);
  assert.equal(h.store.getState().game.history().length, 4);

  lesson.stepBack();
  assert.equal(h.store.getState().game.history().join(' '), 'e4 e6');
  assert.equal(h.store.getState().historyFENs.length, 3);
  assert.equal(h.$('#lessonStatus').text(), 'Ваш ход: 2.d3');
  done();
});

test('exiting a lesson returns to the catalog and free mode', () => {
  const { h, lesson, done } = setup();
  let reset = 0;
  h.$('#startPositionBtn').on('click', () => { reset += 1; });
  lesson.start('kid-classical', 'learn');
  lesson.exit();
  assert.equal(lesson.isActive(), false);
  assert.equal(h.store.getState().mode, 'free');
  assert.equal(h.$('#lessonCatalog').prop('hidden'), false);
  assert.equal(reset, 1);
  done();
});

test('a move of another line of the opening switches to that line', () => {
  const { h, lesson, done } = setup();
  lesson.start('kia-french', 'learn');
  assert.equal(lesson.tryMove('g1', 'f3'), true);
  assert.equal(h.$('#lessonLineTitle').text(), '1.Кf3: против …d5 и …e6');
  assert.match(h.$('#lessonComments').text(), /Этот ход ведёт в вариант «1\.Кf3: против …d5 и …e6»/);
  mock.timers.tick(700);
  assert.equal(h.store.getState().game.history().join(' '), 'Nf3 d5');
  done();
});

test('learning shows the other replies the opponent may choose', () => {
  const { h, lesson, done } = setup();
  lesson.start('dragon-yugoslav', 'learn');
  // Play the student's moves up to White's sixth move, where the lines part
  mock.timers.tick(1400);
  for (const san of ['c5', 'd6', 'cxd4', 'Nf6', 'g6']) {
    const move = new h.Chess(h.store.getState().game.fen()).move(san);
    assert.equal(lesson.tryMove(move.from, move.to), true);
    mock.timers.tick(700);
  }
  assert.equal(h.store.getState().game.history().at(-1), 'Be3');
  const text = h.$('#lessonComments').text();
  assert.match(text, /Соперник может ответить и иначе/);
  assert.match(text, /6\.Сe2 — «Классический вариант \(6\.Сe2\)»/);
  assert.match(text, /6\.f4 — «Атака Левенфиша \(6\.f4\)»/);
  assert.match(text, /6\.g3 — «Фианкетто \(6\.g3\)»/);
  done();
});

test('the whole-opening quiz lets the opponent pick a reply at each fork', (t) => {
  const { h, lesson, done } = setup({ course: 'dragon' });
  const random = t.mock.method(Math, 'random', () => 0);
  h.$('[data-course-quiz="dragon"]').trigger('click');
  assert.equal(lesson.isActive(), true);
  assert.equal(h.$('#lessonLineTitle').text(), 'Весь дебют · соперник отвечает по-разному');

  // The first line of the opening: the open Sicilian
  mock.timers.tick(1400);
  for (const san of ['c5', 'd6', 'cxd4', 'Nf6', 'g6']) {
    const move = new h.Chess(h.store.getState().game.fen()).move(san);
    assert.equal(lesson.tryMove(move.from, move.to), true);
    mock.timers.tick(700);
  }
  assert.equal(h.store.getState().game.history().at(-1), 'Be3');

  // Another pick leaves the open Sicilian on White's second move
  random.mock.mockImplementation(() => 0.99);
  h.$('#lessonRestartBtn').trigger('click');
  mock.timers.tick(1400);
  const c5 = new h.Chess(h.store.getState().game.fen()).move('c5');
  assert.equal(lesson.tryMove(c5.from, c5.to), true);
  mock.timers.tick(700);
  assert.equal(h.store.getState().game.history().join(' '), 'e4 c5 b3');
  done();
});
