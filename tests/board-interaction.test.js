import test from 'node:test';
import assert from 'node:assert/strict';
import { createBoardInteraction } from '../src/app/board-interaction.js';
import { createHarness, playMoves } from './helpers/harness.js';

function setup(options) {
  const h = createHarness(options);
  const makeMoveCalls = [];
  const edits = [];
  let truncations = 0;
  const puzzle = { isActive: () => false, isCompleted: () => false };
  const session = {
    makeMove: (...args) => { makeMoveCalls.push(args); return true; },
    truncateToViewedPly: () => { truncations += 1; },
    applyEditedPosition: event => { edits.push(event); }
  };
  const interaction = createBoardInteraction({
    $: h.$, Chess: h.Chess, store: h.store, eventBus: h.eventBus, boardView: h.boardView, clock: h.clock,
    puzzle, session, getBotLevel: h.getBotLevel, clearSelection: h.clearSelection
  });
  return { h, makeMoveCalls, edits, getTruncations: () => truncations, interaction };
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

test('clicking to move from a historical position is allowed even after game over and timeout', async () => {
  const { h, makeMoveCalls } = setup();
  // Play Scholar's mate so game.game_over() is true
  playMoves(h, ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#']);
  assert.equal(h.store.getState().game.game_over(), true);
  h.clock.timedOut = true;

  // Navigate back to ply 4 (position before 3. Bc4)
  h.store.setState({ currentViewPly: 4 });

  h.eventBus.emit('board:square-clicked', { square: 'f1' });
  assert.equal(h.store.getState().selectedSquare, 'f1');

  await new Promise(resolve => setTimeout(resolve, 150)); // click debounce
  h.eventBus.emit('board:square-clicked', { square: 'c4' });

  assert.deepEqual(makeMoveCalls, [['f1', 'c4']]);
  h.close();
});

test('dragging from a historical position is allowed when clock is timed out', () => {
  const { h, getTruncations } = setup();
  playMoves(h, ['e4', 'e5', 'Nf3', 'Nc6']);
  h.clock.timedOut = true;
  h.store.setState({ currentViewPly: 2 });

  const event = { source: 'd2', piece: 'wP', cancel: false };
  h.eventBus.emit('board:drag-start', event);

  assert.equal(event.cancel, false);
  assert.equal(getTruncations(), 1);
  h.close();
});


test('the editor places a spare piece and removes a piece dragged off the board', () => {
  const { h, edits, makeMoveCalls } = setup({ botLevel: 0 });
  const place = { source: 'spare', target: 'd4', piece: 'wQ', newPos: { d4: 'wQ' }, action: null };
  h.eventBus.emit('board:drop', place);
  assert.equal(place.action, null);
  assert.equal(makeMoveCalls.length, 0);

  const remove = { source: 'e2', target: 'offboard', piece: 'wP', newPos: {}, action: null };
  h.eventBus.emit('board:drop', remove);
  assert.equal(remove.action, null);
  assert.deepEqual(edits.map(edit => edit.target), ['d4', 'offboard']);
  h.close();
});

test('outside the editor a piece dragged off the board snaps back', () => {
  const { h, edits } = setup();
  const event = { source: 'e2', target: 'offboard', piece: 'wP', newPos: {}, action: null };
  h.eventBus.emit('board:drop', event);
  assert.equal(event.action, 'snapback');
  assert.equal(edits.length, 0);
  h.close();
});

test('a promoting pawn asks for the piece and passes the choice on', async () => {
  const { h, makeMoveCalls } = setup();
  h.store.getState().game.load('8/4P3/8/8/8/8/8/k6K w - - 0 1');
  h.store.setState({ historyFENs: [h.store.getState().game.fen()], currentViewPly: 0 });
  const asked = [];
  h.boardView.choosePromotion = async (square, color) => { asked.push({ square, color }); return 'n'; };

  const drop = { source: 'e7', target: 'e8', piece: 'wP', newPos: {}, action: null };
  h.eventBus.emit('board:drop', drop);
  await new Promise(resolve => setTimeout(resolve, 0));

  assert.equal(drop.action, 'snapback', 'the pawn waits on its square for the choice');
  assert.deepEqual(asked, [{ square: 'e8', color: 'w' }]);
  assert.deepEqual(makeMoveCalls.at(-1), ['e7', 'e8', 'wP', 'n']);
  h.close();
});

test('cancelling the promotion choice makes no move', async () => {
  const { h, makeMoveCalls } = setup();
  h.store.getState().game.load('8/4P3/8/8/8/8/8/k6K w - - 0 1');
  h.store.setState({ historyFENs: [h.store.getState().game.fen()], currentViewPly: 0 });
  h.boardView.choosePromotion = async () => null;

  h.eventBus.emit('board:drop', { source: 'e7', target: 'e8', piece: 'wP', newPos: {}, action: null });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(makeMoveCalls.length, 0);
  h.close();
});
