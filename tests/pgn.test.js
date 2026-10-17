import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { createHarness, playMoves } from './helpers/harness.js';
import { createGameSession } from '../src/app/game-session.js';

test('shell:get-pgn-requested writes current game PGN to input', () => {
  const h = createHarness();
  const session = createGameSession({
    $: h.$,
    Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    clock: h.clock,
    botCoordinator: h.botCoordinator,
    analysisCoordinator: h.analysisCoordinator,
    moveHistoryView: h.moveHistoryView,
    services: {},
    puzzle: { isActive: () => false, isCompleted: () => false },
    getBotLevel: () => 10,
    clearSelection: () => {},
    playSound: () => {},
    playSoundForMove: () => {},
    saveStoredSettings: () => {}
  });

  playMoves(h, ['e4', 'e5', 'Nf3', 'Nc6']);
  h.eventBus.emit('shell:get-pgn-requested');

  const pgn = h.$('#pgnInput').val();
  assert.ok(pgn.includes('1. e4 e5 2. Nf3 Nc6'));
  h.close();
});

test('shell:set-pgn-requested loads PGN and builds complete history', () => {
  const h = createHarness();
  const session = createGameSession({
    $: h.$,
    Chess,
    store: h.store,
    eventBus: h.eventBus,
    boardView: h.boardView,
    clock: h.clock,
    botCoordinator: h.botCoordinator,
    analysisCoordinator: h.analysisCoordinator,
    moveHistoryView: h.moveHistoryView,
    services: {},
    puzzle: { isActive: () => false, isCompleted: () => false },
    getBotLevel: () => 10,
    clearSelection: () => {},
    playSound: () => {},
    playSoundForMove: () => {},
    saveStoredSettings: () => {}
  });

  const pgnToLoad = '1. e4 c5 2. Nf3 d6 3. d4 cxd4';
  h.eventBus.emit('shell:set-pgn-requested', { pgn: pgnToLoad });

  const state = h.store.getState();
  // History should contain 1 start FEN + 6 moves = 7 FENs
  assert.equal(state.historyFENs.length, 7);
  assert.equal(state.currentViewPly, 6);
  assert.equal(state.game.history().length, 6);
  assert.equal(h.$('#pgnError').is(':visible'), false);

  // Invalid PGN should show error
  h.eventBus.emit('shell:set-pgn-requested', { pgn: 'not a valid chess pgn move 99. Zz9' });
  assert.equal(h.$('#pgnError').text(), 'Некорректная запись PGN.');

  h.close();
});
