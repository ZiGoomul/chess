import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { normalizeMoveText, findTypedMove, describeMoveForSpeech } from '../src/app/move-entry.js';

test('typed moves accept SAN, coordinates, zeros for castling and Russian piece letters', () => {
  const game = new Chess();
  assert.equal(findTypedMove(game, 'e4', Chess).san, 'e4');
  assert.equal(findTypedMove(game, 'g1f3', Chess).san, 'Nf3');
  assert.equal(findTypedMove(game, 'Кf3', Chess).san, 'Nf3');
  assert.equal(findTypedMove(game, 'e5', Chess), null);
  assert.equal(normalizeMoveText(' 0-0 '), 'O-O');
  assert.equal(normalizeMoveText('Крg1'), 'Kg1');
  assert.equal(normalizeMoveText('Лхd8+!'), 'Rxd8+');
});

test('moves are described in Russian for screen readers', () => {
  const game = new Chess('r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R b KQkq - 0 3');
  assert.equal(describeMoveForSpeech(game.move('exd4')), 'Чёрные: пешка бьёт d4');
  const castle = new Chess('4k3/8/8/8/8/8/8/4K2R w K - 0 1').move('O-O');
  assert.equal(describeMoveForSpeech(castle), 'Белые: короткая рокировка');
  const mate = new Chess('6k1/5ppp/8/8/8/8/8/4R1K1 w - - 0 1').move('Re8#');
  assert.equal(describeMoveForSpeech(mate), 'Белые: ладья e8, мат');
});
