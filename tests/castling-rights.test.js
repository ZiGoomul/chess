import test from 'node:test';
import assert from 'node:assert/strict';
import { retainCastlingRights } from '../src/domain/castling-rights.js';

test('preserves rights while the corresponding king and rook stay home', () => {
  const previousFen = 'r3k2r/8/8/8/8/8/P7/R3K2R b KQkq - 0 1';
  const editedPlacement = 'r3k2r/8/8/8/8/P7/8/R3K2R';

  assert.equal(retainCastlingRights(previousFen, editedPlacement), 'KQkq');
});

test('removes only rights for a king or rook moved from its home square', () => {
  const previousFen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
  const editedPlacement = 'r3k2r/8/8/8/8/8/8/1R2K2R';

  assert.equal(retainCastlingRights(previousFen, editedPlacement), 'Kkq');
});

test('does not create castling rights from piece placement alone', () => {
  const previousFen = 'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1';

  assert.equal(retainCastlingRights(previousFen, 'r3k2r/8/8/8/8/8/8/R3K2R'), '-');
});
