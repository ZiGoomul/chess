import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { getDisplayedGame, isEditorMode, isHistoricalPosition } from '../src/domain/position.js';

function stateAfter(moves) {
  const game = new Chess();
  const historyFENs = [game.fen()];
  for (const move of moves) {
    game.move(move);
    historyFENs.push(game.fen());
  }
  return { game, historyFENs, currentViewPly: historyFENs.length - 1 };
}

test('live position returns the store game itself', () => {
  const state = stateAfter(['e4', 'e5']);
  assert.equal(isHistoricalPosition(state), false);
  assert.equal(getDisplayedGame(state, Chess), state.game);
});

test('past ply returns a separate game at that position', () => {
  const state = { ...stateAfter(['e4', 'e5']), currentViewPly: 1 };
  assert.equal(isHistoricalPosition(state), true);
  const shown = getDisplayedGame(state, Chess);
  assert.notEqual(shown, state.game);
  assert.equal(shown.fen(), state.historyFENs[1]);
});

test('editor mode is bot level 0 outside puzzles only', () => {
  assert.equal(isEditorMode({ isPuzzleMode: false, botLevel: 0 }), true);
  assert.equal(isEditorMode({ isPuzzleMode: true, botLevel: 0 }), false);
  assert.equal(isEditorMode({ isPuzzleMode: false, botLevel: 10 }), false);
});
