import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createEventBus } from '../src/core/event-bus.js';
import { createGameStore } from '../src/core/game-store.js';
import { createAnalysisCoordinator } from '../src/services/analysis-coordinator.js';

const START = new Chess().fen();
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

function setup(settings = {}) {
  const eventBus = createEventBus();
  const store = createGameStore({ game: new Chess() });
  store.setState({ historyFENs: [START], currentViewPly: 0, settings: { ...store.getState().settings, hintLevel: 10, ...settings } });
  const requests = [];
  const engine = { requestHint: (fen, level) => requests.push({ fen, level }) };
  const coordinator = createAnalysisCoordinator({ eventBus, store, engine });
  const drawn = [];
  const completed = [];
  eventBus.on('engine:hints-updated', data => drawn.push((data.arrows || []).map(arrow => `${arrow.from}${arrow.to}`)));
  eventBus.on('engine:hint-completed', () => completed.push(true));
  return { eventBus, store, coordinator, requests, drawn, completed };
}

test('hints are not redrawn after the position changes', () => {
  const { eventBus, store, coordinator, drawn } = setup();
  coordinator.requestHint();
  coordinator.handleHintInfo({ multipv: 1, move: 'e2e4' });
  assert.deepEqual(drawn.at(-1), ['e2e4']);

  store.setState({ historyFENs: [START, AFTER_E4], currentViewPly: 1 });
  eventBus.emit('game:move-made', {});
  const before = drawn.length;
  eventBus.emit('board:resized');
  coordinator.drawHintArrows();
  assert.equal(drawn.length, before, 'stale arrows must not come back on resize');

  coordinator.handleHintInfo({ multipv: 1, move: 'd2d4' });
  assert.equal(drawn.length, before, 'a late engine answer for the old position is ignored');
});

test('puzzle mode never asks for or draws hints, and releases the hint button', () => {
  const { store, coordinator, requests, drawn, completed } = setup({ autoHint: true });
  store.setState({ mode: 'puzzle' });

  coordinator.autoHintIfNeeded();
  coordinator.requestHint();
  coordinator.handleHintInfo({ multipv: 1, move: 'e2e4' });

  assert.equal(requests.length, 0);
  assert.deepEqual(drawn, []);
  assert.equal(completed.length, 1);
});

test('the evaluation says whose turn its sign is relative to', () => {
  const { eventBus, store, coordinator } = setup();
  const evals = [];
  eventBus.on('engine:eval-updated', payload => evals.push(payload));
  store.setState({ historyFENs: [AFTER_E4], currentViewPly: 0 });
  coordinator.requestHint();
  coordinator.handleHintInfo({ multipv: 1, move: 'e7e5', cp: -30 });
  assert.deepEqual(evals.at(-1), { cp: -30, mate: undefined, isWhiteTurn: false });
});

test('with the help switched off for a rated game there are no hints, not even late ones', () => {
  const { store, coordinator, requests, drawn, completed } = setup({ autoHint: true, botLevel: 0 });
  coordinator.requestHint();
  assert.equal(requests.length, 1);

  store.setState({ assistsOff: true });
  const before = drawn.length;
  coordinator.handleHintInfo({ multipv: 1, move: 'e2e4' });
  assert.equal(drawn.length, before, 'an answer that arrives after the game started is not drawn');

  coordinator.requestHint();
  coordinator.autoHintIfNeeded();
  assert.equal(requests.length, 1, 'no new analysis');
  assert.ok(completed.length >= 1, 'the hint button is released');

  store.setState({ assistsOff: false });
  coordinator.autoHintIfNeeded();
  assert.equal(requests.length, 2, 'auto-hint comes back after the game');
});
