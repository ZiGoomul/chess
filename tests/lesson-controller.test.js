import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createLessonController, toRussianSan, numberedSan } from '../src/app/lesson-controller.js';
import { findLine } from '../src/data/openings.js';
import { createHarness } from './helpers/harness.js';

const LESSON_DOM = `
  <div id="lessonCatalog"><div id="lessonCourses"></div></div>
  <div id="lessonView" hidden>
    <h2 id="lessonCourseTitle"></h2><p id="lessonLineTitle"></p>
    <div id="lessonModeSwitch"><button data-mode="learn"></button><button data-mode="quiz"></button></div>
    <span id="lessonProgressBar"></span><span id="lessonProgressText"></span>
    <div id="lessonStatus"></div><ul id="lessonComments"></ul><ol id="lessonMoves"></ol>
    <button id="lessonBackBtn"></button><button id="lessonHintBtn"></button><button id="lessonRestartBtn"></button>
    <button id="lessonQuizBtn" hidden></button><button id="lessonNextLineBtn" hidden></button><button id="lessonExitBtn"></button>
  </div>`;

function setup({ progress = {} } = {}) {
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
    initialProgress: progress, saveStoredSettings: (partial) => { saved.push(partial); }
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

test('the catalog lists every course and its lines', () => {
  const { h, done } = setup({ progress: { 'kid-classical': { learn: true } } });
  assert.equal(h.$('#lessonCourses .lesson-course').length, 3);
  assert.equal(h.$('#lessonCourses [data-line]').length, 7);
  assert.equal(h.$('[data-line="kid-classical"] .lesson-mark').length, 1);
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
  lesson.tryMove('g1', 'f3');
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
  assert.equal(h.$('#lessonNextLineBtn').prop('hidden'), false);
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
