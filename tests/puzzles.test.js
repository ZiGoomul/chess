import test from 'node:test';
import assert from 'node:assert/strict';
import { puzzleDatabase } from '../src/data/puzzles.js';

test('bundled catalog starts empty and accepts only imported, validated tasks', () => {
  assert.equal(puzzleDatabase.length, 0);

  for (const puzzle of puzzleDatabase) {
    assert.match(puzzle.id, /^builtin-\d{3}$/);
    assert.equal(puzzle.fen.trim().split(/\s+/).length, 6);
    assert.ok(puzzle.moves.length > 0);
    assert.ok(puzzle.moves.every(move => /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)));
    assert.ok(puzzle.desc.length > 0);
  }
});
