import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { extractPiecesFromGame, computeHighlights, computeAttackCounts } from '../src/domain/attack-map.js';

test('initial board attack counts and highlights', () => {
  const game = new Chess();
  const pieces = extractPiecesFromGame(game);
  assert.equal(Object.keys(pieces).length, 32);

  const { attacks, defenders } = computeHighlights(pieces);
  // Initial position: no piece is under enemy attack
  assert.deepEqual(Object.keys(attacks), []);

  // Pawns on second rank have defenders (e.g. d2 is defended by c1, d1, e1, b1)
  assert.ok(defenders.d2 > 0);
  assert.ok(defenders.e2 > 0);
  // Knights and pawns are defended
  assert.ok(defenders.b1 > 0);
  assert.ok(defenders.g1 > 0);
});

test('pin and check do not disable attack/defense calculation', () => {
  // 1. e4 e5 2. Nf3 Nc6 3. Bb5 (Bb5 attacks c6, pins c6 to king e8)
  const game = new Chess('r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3');
  const pieces = extractPiecesFromGame(game);
  const { attacks, defenders } = computeHighlights(pieces);

  // c6 is attacked by b5 (White)
  assert.ok(attacks.c6);
  assert.equal(attacks.c6.by, 'w');
  assert.equal(attacks.c6.count, 1);

  // c6 is defended by b7, d7
  assert.ok(defenders.c6 >= 2);

  // Even if pinned, c6 still geometrically defends e5 and b4/d4
  const counts = computeAttackCounts(pieces);
  assert.ok(counts.b.e5 >= 1);
  assert.ok(counts.b.d4 >= 1);
});

test('check position still correctly highlights attacker and attacked pieces', () => {
  // Scholar's mate delivery: Qxf7# - King on e8 in check
  const game = new Chess('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
  const pieces = extractPiecesFromGame(game);
  const { attacks, defenders } = computeHighlights(pieces);

  // e8 is the king, so it is attacked by White
  assert.ok(attacks.e8);
  assert.equal(attacks.e8.by, 'w');

  // f7 is defended by c4 (Bishop)
  assert.ok(defenders.f7 >= 1);
});
