import test from 'node:test';
import assert from 'node:assert/strict';
import '../extension/src/attack-map.js';
import '../extension/src/chesscom-board.js';

const { computeHighlights, attackedSquares, parsePieceClass, isAllowedPage, isHighlightAllowed } = globalThis.ChessHighlighter;

test('sliding pieces stop at the first blocker', () => {
  const pieces = { a1: { color: 'w', type: 'r' }, a4: { color: 'b', type: 'p' } };
  assert.deepEqual(attackedSquares(pieces, 'a1', pieces.a1).sort(),
    ['a2', 'a3', 'a4', 'b1', 'c1', 'd1', 'e1', 'f1', 'g1', 'h1']);
});

test('pawns attack diagonally forward only', () => {
  assert.deepEqual(attackedSquares({}, 'e2', { color: 'w', type: 'p' }), ['d3', 'f3']);
  assert.deepEqual(attackedSquares({}, 'a7', { color: 'b', type: 'p' }), ['b6']);
});

test('counts attackers and defenders per piece', () => {
  const pieces = {
    e4: { color: 'w', type: 'p' },
    f2: { color: 'w', type: 'n' },
    e2: { color: 'w', type: 'q' },
    d5: { color: 'b', type: 'p' },
    c6: { color: 'b', type: 'n' },
    e8: { color: 'b', type: 'k' },
    e1: { color: 'w', type: 'k' }
  };
  const { attacks, defenders } = computeHighlights(pieces);
  assert.deepEqual(attacks.d5, { by: 'w', count: 1 });
  assert.deepEqual(attacks.e4, { by: 'b', count: 1 });
  assert.equal(defenders.e4, 2);
  assert.equal(defenders.d5, undefined);
  assert.equal(defenders.e1, undefined, 'kings have no defender counts');
});

test('parses chess.com piece classes', () => {
  assert.deepEqual(parsePieceClass('piece wp square-52'), { square: 'e2', piece: { color: 'w', type: 'p' } });
  assert.deepEqual(parsePieceClass('piece square-88 bk'), { square: 'h8', piece: { color: 'b', type: 'k' } });
  assert.equal(parsePieceClass('highlight square-52'), null);
});

test('only analysis-style pages are allowed', () => {
  assert.equal(isAllowedPage('/analysis'), true);
  assert.equal(isAllowedPage('/play/computer'), true);
  assert.equal(isAllowedPage('/game/live/123456/review'), true);
  assert.equal(isAllowedPage('/play/online'), false);
  assert.equal(isAllowedPage('/game/live/123456'), false);
  assert.equal(isAllowedPage('/puzzles/rated'), false);
  assert.equal(isAllowedPage('/home'), false);
});

test('game pages are allowed only after the game is over', () => {
  const docWith = selector => ({ querySelector: query => (selector && query.includes(selector) ? {} : null) });
  const ongoing = docWith(null);
  const finished = docWith('.game-review-buttons-component');
  assert.equal(isHighlightAllowed('/game/live/184609849334', ongoing), false);
  assert.equal(isHighlightAllowed('/game/live/184609849334', finished), true);
  assert.equal(isHighlightAllowed('/game/daily/123/', finished), true);
  assert.equal(isHighlightAllowed('/play/online', finished), false);
  assert.equal(isHighlightAllowed('/analysis', ongoing), true);
});
