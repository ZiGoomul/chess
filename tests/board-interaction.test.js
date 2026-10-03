import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardInteraction } from '../src/app/board-interaction.js';
import { createHarness, playMoves } from './helpers/harness.js';

function setup(options) {
  const h = createHarness(options);
  const makeMoveCalls = [];
  let truncations = 0;
  const puzzle = { isActive: () => false, isCompleted: () => false };
  const session = {
    makeMove: (...args) => { makeMoveCalls.push(args); return true; },
    truncateToViewedPly: () => { truncations += 1; },
    applyEditedPosition() {}
  };
  const interaction = createBoardInteraction({
    $: h.$, Chess: h.Chess, store: h.store, eventBus: h.eventBus, boardView: h.boardView, clock: h.clock,
    puzzle, session, getBotLevel: h.getBotLevel, clearSelection: h.clearSelection
  });
  return { h, makeMoveCalls, getTruncations: () => truncations, interaction };
}

const squares = hints => hints.destinations.map(d => d.square).sort();

test('clicking a pawn selects it and marks its legal destinations', () => {
  const { h } = setup();
  h.eventBus.emit('board:square-clicked', { square: 'e2' });

  assert.equal(h.store.getState().selectedSquare, 'e2');
  const shown = h.boardView.calls.showMoveHints.at(-1);
  assert.equal(shown.square, 'e2');
  assert.deepEqual(squares(shown), ['e3', 'e4']);
  h.close();
});

test('clicking a legal destination makes the move and clears the selection', async () => {
  const { h, makeMoveCalls } = setup();
  h.eventBus.emit('board:square-clicked', { square: 'e2' });
  await new Promise(resolve => setTimeout(resolve, 150)); // click debounce
  h.eventBus.emit('board:square-clicked', { square: 'e4' });

  assert.deepEqual(makeMoveCalls, [['e2', 'e4']]);
  assert.equal(h.store.getState().selectedSquare, null);
  h.close();
});

test('starting a drag shows the same hints as a click', () => {
  const { h } = setup();
  const event = { source: 'g1', piece: 'wN', cancel: false };
  h.eventBus.emit('board:drag-start', event);

  assert.notEqual(event.cancel, true);
  const shown = h.boardView.calls.showMoveHints.at(-1);
  assert.equal(shown.square, 'g1');
  assert.deepEqual(squares(shown), ['f3', 'h3']);
  h.close();
});

test('dragging the opponent piece is cancelled', () => {
  const { h } = setup();
  const event = { source: 'e7', piece: 'bP', cancel: false };
  h.eventBus.emit('board:drag-start', event);

  assert.equal(event.cancel, true);
  assert.equal(h.boardView.calls.showMoveHints.length, 0);
  h.close();
});

test('captures are flagged so they render as rings', () => {
  const { h } = setup();
  playMoves(h, ['e4', 'd5']);
  h.eventBus.emit('board:square-clicked', { square: 'e4' });

  const shown = h.boardView.calls.showMoveHints.at(-1);
  assert.deepEqual(shown.destinations.find(d => d.square === 'd5'), { square: 'd5', isCapture: true });
  assert.deepEqual(shown.destinations.find(d => d.square === 'e5'), { square: 'e5', isCapture: false });
  h.close();
});

test('hover previews hints only while highlighting is enabled', () => {
  const { h } = setup();
  h.eventBus.emit('board:mouseover-square', { square: 'e2' });
  assert.equal(h.boardView.calls.showMoveHints.length, 1);

  h.boardView.calls.showMoveHints.length = 0;
  h.$('#highlightMovesCb').prop('checked', false);
  h.eventBus.emit('board:mouseover-square', { square: 'e2' });
  assert.equal(h.boardView.calls.showMoveHints.length, 0);
  h.close();
});

test('dragging from a past position asks the session to drop the later moves', () => {
  const { h, getTruncations } = setup();
  playMoves(h, ['e4', 'e5', 'Nf3', 'Nc6']);
  h.store.setState({ currentViewPly: 2 });
  h.eventBus.emit('board:drag-start', { source: 'd2', piece: 'wP', cancel: false });

  assert.equal(getTruncations(), 1);
  h.close();
});

test('editor mode lets either colour be picked up', () => {
  const { h } = setup({ botLevel: 0 });
  const event = { source: 'e7', piece: 'bP', cancel: false };
  h.eventBus.emit('board:drag-start', event);

  assert.notEqual(event.cancel, true);
  assert.deepEqual(squares(h.boardView.calls.showMoveHints.at(-1)), ['e5', 'e6']);
  h.close();
});
