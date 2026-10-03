import test from 'node:test';
import assert from 'node:assert/strict';
import { createPuzzleController } from '../src/app/puzzle-controller.js';
import { applyUciMove, moveToUci } from '../src/services/puzzle-runner.js';
import { createHarness } from './helpers/harness.js';

const MATE_IN_ONE = { id: 'test:mate', fen: '6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1', moves: ['e1e8'], desc: 'Mate in one', themes: ['mate'] };
const TWO_STEP = { id: 'test:two', fen: '7k/5pp1/7p/8/8/8/5PPP/3R2K1 w - - 0 1', moves: ['d1d8', 'h8h7', 'd8d7'], themes: [] };

function setup() {
  const h = createHarness();
  const puzzle = createPuzzleController({
    $: h.$, Chess: h.Chess, store: h.store, eventBus: h.eventBus, boardView: h.boardView, clock: h.clock,
    botCoordinator: h.botCoordinator, moveHistoryView: h.moveHistoryView, services: h.services,
    puzzleDatabase: [], applyUciMove, moveToUci, clearSelection: h.clearSelection,
    playSound: h.playSound, playSoundForMove: h.playSoundForMove
  });
  return { h, puzzle };
}

test('loading a puzzle sets the position and enters puzzle mode', () => {
  const { h, puzzle } = setup();
  puzzle.load(MATE_IN_ONE);

  assert.equal(puzzle.isActive(), true);
  assert.equal(puzzle.isCompleted(), false);
  assert.equal(h.store.getState().game.fen(), MATE_IN_ONE.fen);
  assert.equal(h.store.getState().mode, 'puzzle');
  assert.equal(h.$('#puzzleDescText').text(), 'Mate in one');
  h.close();
});

test('a wrong move is refused and reported', () => {
  const { h, puzzle } = setup();
  puzzle.load(MATE_IN_ONE);

  assert.equal(puzzle.tryMove('e1', 'e2'), false);
  assert.equal(h.$('#puzzleStatusText').text(), 'Неверный ход! Попробуйте еще раз.');
  assert.equal(h.store.getState().historyFENs.length, 1);
  assert.equal(puzzle.isCompleted(), false);
  h.close();
});

test('the expected move solves a one-move puzzle', () => {
  const { h, puzzle } = setup();
  puzzle.load(MATE_IN_ONE);

  assert.equal(puzzle.tryMove('e1', 'e8'), true);
  assert.equal(puzzle.isCompleted(), true);
  assert.equal(h.$('#puzzleStatusText').text(), 'ЗАДАЧА РЕШЕНА!');
  assert.equal(h.$('#puzzlesScore').text(), 'Решено: 1');
  h.close();
});

test('a multi-move puzzle plays the opponent reply after a correct move', async () => {
  const { h, puzzle } = setup();
  puzzle.load(TWO_STEP);

  assert.equal(puzzle.tryMove('d1', 'd8'), true);
  assert.equal(h.$('#puzzleStatusText').text(), 'Верно! Ожидание хода противника...');
  await new Promise(resolve => setTimeout(resolve, 800));

  assert.equal(h.store.getState().game.history().join(' '), 'Rd8+ Kh7');
  assert.equal(h.$('#puzzleStatusText').text(), 'Ваш ход!');
  assert.equal(puzzle.tryMove('d8', 'd7'), true);
  assert.equal(puzzle.isCompleted(), true);
  h.close();
});

test('exiting puzzle mode leaves puzzle state and asks for a fresh position', () => {
  const { h, puzzle } = setup();
  let reset = 0;
  h.$('#startPositionBtn').on('click', () => { reset += 1; });
  puzzle.load(MATE_IN_ONE);
  puzzle.exit();

  assert.equal(puzzle.isActive(), false);
  assert.equal(h.store.getState().mode, 'free');
  assert.equal(reset, 1);
  h.close();
});
