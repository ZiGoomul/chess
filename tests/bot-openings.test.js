import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  findOpeningBookMove,
  getMaxBookPly,
  normalizeFen,
  getOpeningTree
} from '../src/domain/bot-openings.ts';

test('normalizeFen strips halfmove and fullmove clocks', () => {
  const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
  assert.equal(normalizeFen(fen), 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3');
});

test('getMaxBookPly scales with bot level', () => {
  assert.equal(getMaxBookPly(1), 4);
  assert.equal(getMaxBookPly(2), 6);
  assert.equal(getMaxBookPly(3), 6);
  assert.equal(getMaxBookPly(5), 8);
  assert.equal(getMaxBookPly(10), 12);
  assert.equal(getMaxBookPly(15), 16);
  assert.equal(getMaxBookPly(20), 24);
});

test('opening tree contains standard moves from starting position', () => {
  const tree = getOpeningTree();
  const startKey = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';
  const candidates = tree.get(startKey);

  assert.ok(candidates && candidates.length > 0);
  const ucis = candidates.map(c => c.uci);
  assert.ok(ucis.includes('e2e4'), 'Contains 1.e4');
  assert.ok(ucis.includes('d2d4'), 'Contains 1.d4');
  assert.ok(ucis.includes('c2c4'), 'Contains 1.c4');
  assert.ok(ucis.includes('g1f3'), 'Contains 1.Nf3');
});

test('findOpeningBookMove returns standard reply for Black after 1.e4', () => {
  const game = new Chess();
  game.move('e4');

  const move = findOpeningBookMove(game, 5, () => 0.0);
  assert.ok(move !== null);
  // With random = 0, first weighted candidate is selected (e5)
  assert.ok(['e7e5', 'c7c5', 'e7e6', 'c7c6', 'd7d5'].includes(move.uci));
});

test('findOpeningBookMove respects maximum book ply for low levels', () => {
  const game = new Chess();
  game.move('e4');
  game.move('e5');
  game.move('Nf3');
  game.move('Nc6');
  // 4 plies have elapsed. Level 1 maxBookPly is 4.
  const level1Move = findOpeningBookMove(game, 1);
  assert.equal(level1Move, null, 'Level 1 stops book after 4 plies');

  // But Level 5 continues (max 8 plies)
  const level5Move = findOpeningBookMove(game, 5);
  assert.ok(level5Move !== null, 'Level 5 continues book');
});

test('findOpeningBookMove returns null for bot level 0 (editor/human)', () => {
  const game = new Chess();
  assert.equal(findOpeningBookMove(game, 0), null);
});
