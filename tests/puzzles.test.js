import test from 'node:test';
import assert from 'node:assert/strict';
import { puzzleDatabase } from '../src/data/puzzles.js';

test('each puzzle has a FEN position and a solution line', () => {
  assert.ok(puzzleDatabase.length > 0);

  for (const puzzle of puzzleDatabase) {
    assert.equal(puzzle.fen.trim().split(/\s+/).length, 6);
    assert.ok(puzzle.moves.length > 0);
    assert.ok(puzzle.desc.length > 0);
  }
});
