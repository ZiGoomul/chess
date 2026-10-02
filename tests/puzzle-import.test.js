import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { parseLichessPuzzleRow } from '../scripts/import-lichess-puzzles.js';

test('normalizes the Lichess setup move exactly once', () => {
  const puzzle = parseLichessPuzzleRow({ PuzzleId: 'abc', FEN: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', Moves: 'e2e4 e7e5', Rating: '1000', Popularity: '80', Themes: 'opening' }, () => new Chess());
  assert.equal(puzzle.id, 'lichess:abc');
  assert.equal(puzzle.fen.split(' ')[1], 'b');
  assert.deepEqual(puzzle.moves, ['e7e5']);
});
