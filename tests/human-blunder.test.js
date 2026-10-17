import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import {
  findNaturalRecapture,
  refineBotMove,
  getHumanThinkTime,
  getPieceCount
} from '../src/domain/human-blunder.ts';

test('getPieceCount returns correct count of pieces on board', () => {
  const start = new Chess();
  assert.equal(getPieceCount(start), 32);

  const bare = new Chess('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
  assert.equal(getPieceCount(bare), 2);
});

test('getHumanThinkTime varies between book, check, middlegame and endgame', () => {
  const game = new Chess();
  const bookTime = getHumanThinkTime(game, true, () => 0.5);
  assert.ok(bookTime >= 450 && bookTime <= 900);

  const checkGame = new Chess('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3');
  const checkTime = getHumanThinkTime(checkGame, false, () => 0.5);
  assert.ok(checkTime >= 550 && checkTime <= 1200);

  const midgameTime = getHumanThinkTime(game, false, () => 0.5);
  assert.ok(midgameTime >= 900 && midgameTime <= 2000);
});

test('findNaturalRecapture recaptures when opponent captures a piece', () => {
  const game = new Chess();
  game.move('e4');
  game.move('d5');
  game.move('exd5'); // White takes d5

  // Black can recapture on d5 with Qxd5 or Nf6...
  const recapture = findNaturalRecapture(game, 1, () => 0.1); // roll 0.1 < 0.85 prob
  assert.ok(recapture !== null);
  assert.equal(recapture.uci, 'd8d5');
});

test('findNaturalRecapture does not trigger for high levels (level > 3)', () => {
  const game = new Chess();
  game.move('e4');
  game.move('d5');
  game.move('exd5');

  assert.equal(findNaturalRecapture(game, 5), null);
});

test('refineBotMove prevents unforced king moves in early opening and prefers castling', () => {
  // Setup a position where Black can castle kingside, but rawMove proposes Ke7 (unforced king walk)
  const game = new Chess('r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQK2R b KQkq - 5 4');

  // Proposed bad raw move: King moves to e7
  const rawMove = { from: 'e8', to: 'e7' };
  const refined = refineBotMove(game, rawMove, 1);

  assert.ok(refined !== null);
  // King walk should be replaced by castling (O-O / e8g8) or development
  assert.notEqual(refined.uci, 'e8e7');
  assert.equal(refined.uci, 'e8g8'); // O-O
});
