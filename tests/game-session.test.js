import test from 'node:test';
import assert from 'node:assert/strict';
import { createGameSession } from '../src/app/game-session.js';
import { createHarness, playMoves } from './helpers/harness.js';

function setup(options) {
  const h = createHarness(options);
  const puzzle = { isActive: () => false, exit() {} };
  const session = createGameSession({
    $: h.$, Chess: h.Chess, store: h.store, eventBus: h.eventBus, boardView: h.boardView, clock: h.clock,
    botCoordinator: h.botCoordinator, analysisCoordinator: h.analysisCoordinator, moveHistoryView: h.moveHistoryView,
    services: h.services, puzzle, getBotLevel: h.getBotLevel, clearSelection: h.clearSelection,
    playSound: h.playSound, playSoundForMove: h.playSoundForMove, saveStoredSettings: h.saveStoredSettings
  });
  return { h, session };
}

const state = h => h.store.getState();

test('a legal move updates the game, history and status', () => {
  const { h, session } = setup();
  assert.equal(session.makeMove('e2', 'e4'), true);

  assert.equal(state(h).game.history().join(' '), 'e4');
  assert.equal(state(h).historyFENs.length, 2);
  assert.equal(state(h).currentViewPly, 1);
  assert.equal(h.$('#gameStatus').text(), 'Ход: Черные');
  h.close();
});

test('an illegal move is rejected and leaves the position alone', () => {
  const { h, session } = setup();
  assert.equal(session.makeMove('e2', 'e5'), false);
  assert.equal(state(h).historyFENs.length, 1);
  h.close();
});

test('a bot reply is applied to the game', () => {
  const { h, session } = setup();
  session.makeMove('e2', 'e4');
  h.eventBus.emit('bot:move-ready', { bestmove: 'e7e5' });

  assert.equal(state(h).game.history().join(' '), 'e4 e5');
  assert.equal(state(h).currentViewPly, 2);
  h.close();
});

test('moving from a past position replaces the later moves', () => {
  const { h, session } = setup();
  playMoves(h, ['e4', 'e5', 'Nf3', 'Nc6']);
  h.store.setState({ currentViewPly: 2 });

  assert.equal(session.makeMove('d2', 'd4'), true);
  assert.equal(state(h).game.history().join(' '), 'e4 e5 d4');
  assert.equal(state(h).historyFENs.length, 4);
  assert.equal(state(h).currentViewPly, 3);
  assert.equal(state(h).historyFENs.at(-1), state(h).game.fen());
  h.close();
});

test('checkmate shows the game-over overlay', () => {
  const { h, session } = setup();
  state(h).game.load('6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1');
  h.store.setState({ historyFENs: [state(h).game.fen()], currentViewPly: 0 });

  assert.equal(session.makeMove('e1', 'e8'), true);
  assert.match(h.$('#gameStatus').text(), /^Мат!/);
  assert.equal(h.$('#gameOverOverlay').css('display'), 'flex');
  h.close();
});

test('editor mode lets the side not on move make a move', () => {
  const { h, session } = setup({ botLevel: 0 });
  assert.equal(session.makeMove('e7', 'e5', 'bP'), true);

  assert.equal(state(h).game.get('e5').type, 'p');
  assert.equal(state(h).game.get('e5').color, 'b');
  h.close();
});

test('a FEN request replaces the position and rejects invalid input', () => {
  const { h } = setup();
  h.$('body').append('<div id="fenError"></div>');
  h.eventBus.emit('shell:set-fen-requested', { fen: '8/8/8/8/8/8/8/K6k w - - 0 1' });
  assert.equal(state(h).game.fen(), '8/8/8/8/8/8/8/K6k w - - 0 1');
  assert.deepEqual(state(h).historyFENs, [state(h).game.fen()]);

  h.eventBus.emit('shell:set-fen-requested', { fen: 'not a fen' });
  assert.equal(state(h).game.fen(), '8/8/8/8/8/8/8/K6k w - - 0 1');
  assert.equal(h.$('#fenError').text(), 'Некорректная позиция FEN.');
  h.close();
});
