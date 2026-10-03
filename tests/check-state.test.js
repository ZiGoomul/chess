import test from 'node:test';
import assert from 'node:assert/strict';
import Chess from 'chess.js';
const ChessCtor = Chess.Chess || Chess;

import { getKingSquareInCheck, determineMoveSound } from '../src/domain/check-state.js';

test('getKingSquareInCheck returns null when position is not in check', () => {
  const game = new ChessCtor();
  assert.equal(getKingSquareInCheck(game), null);
});

test('getKingSquareInCheck returns black king square when black is in check', () => {
  const game = new ChessCtor();
  game.load('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
  assert.equal(getKingSquareInCheck(game), 'e8');
});

test('getKingSquareInCheck returns white king square when white is in check', () => {
  const game = new ChessCtor();
  game.load('rnb1kbnr/pppp1ppp/8/8/4q3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 1');
  assert.equal(getKingSquareInCheck(game), 'e1');
});

test('determineMoveSound prioritizes gameEnd for checkmate', () => {
  const game = new ChessCtor('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4');
  const move = { flags: 'c', from: 'f3', to: 'f7' };
  assert.equal(determineMoveSound(game, move), 'gameEnd');
});

test('determineMoveSound prioritizes check over capture and normal moves', () => {
  const game = new ChessCtor();
  game.load('rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
  game.in_check = () => true;
  game.in_checkmate = () => false;
  game.in_draw = () => false;
  const captureMove = { flags: 'c', from: 'e4', to: 'd5' };
  assert.equal(determineMoveSound(game, captureMove), 'check');
});

test('determineMoveSound returns capture, castle, or move when not in check', () => {
  const game = new ChessCtor();
  assert.equal(determineMoveSound(game, { flags: 'c' }), 'capture');
  assert.equal(determineMoveSound(game, { flags: 'k' }), 'castle');
  assert.equal(determineMoveSound(game, { flags: 'n' }), 'move');
  assert.equal(determineMoveSound(game, null), 'move');
});
