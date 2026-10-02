import test from 'node:test';
import assert from 'node:assert/strict';
import { Chess } from 'chess.js';
import { getLegalMovesForSquare, mapCastlingTarget, resolveSquareClick, getSquareFromCoords } from '../src/domain/move-input.js';

test('getLegalMovesForSquare returns legal moves for active turn piece', () => {
  const game = new Chess();
  const e2Moves = getLegalMovesForSquare('e2', game, false, Chess);
  assert.equal(e2Moves.length, 2);
  assert.deepEqual(e2Moves.map(m => m.to).sort(), ['e3', 'e4']);

  // Enemy piece out of turn returns empty
  const e7Moves = getLegalMovesForSquare('e7', game, false, Chess);
  assert.equal(e7Moves.length, 0);

  // In editor mode, out of turn piece returns valid moves
  const editorE7Moves = getLegalMovesForSquare('e7', game, true, Chess);
  assert.equal(editorE7Moves.length, 2);
  assert.deepEqual(editorE7Moves.map(m => m.to).sort(), ['e5', 'e6']);
});

test('mapCastlingTarget maps king clicks on rooks to castling destination', () => {
  const game = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const legalMoves = game.moves({ square: 'e1', verbose: true });

  assert.equal(mapCastlingTarget('e1', 'h1', game, legalMoves), 'g1');
  assert.equal(mapCastlingTarget('e1', 'a1', game, legalMoves), 'c1');
  assert.equal(mapCastlingTarget('e1', 'g1', game, legalMoves), 'g1');
  assert.equal(mapCastlingTarget('e1', 'e2', game, legalMoves), 'e2');

  const blackGame = new Chess('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1');
  const blackLegalMoves = blackGame.moves({ square: 'e8', verbose: true });
  assert.equal(mapCastlingTarget('e8', 'h8', blackGame, blackLegalMoves), 'g8');
  assert.equal(mapCastlingTarget('e8', 'a8', blackGame, blackLegalMoves), 'c8');
});

test('resolveSquareClick handles initial selection, movement, deselection and switching', () => {
  const game = new Chess();

  // 1. Click empty square when nothing selected -> ignore
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: null, clickedSquare: 'e4', game }),
    { action: 'ignore' }
  );

  // 2. Click opponent piece when nothing selected -> ignore
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: null, clickedSquare: 'e7', game }),
    { action: 'ignore' }
  );

  // 3. Click own piece when nothing selected -> select
  const selectRes = resolveSquareClick({ selectedSquare: null, clickedSquare: 'e2', game });
  assert.equal(selectRes.action, 'select');
  assert.equal(selectRes.square, 'e2');
  assert.equal(selectRes.moves.length, 2);

  // 4. Click same square again -> deselect
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: 'e2', clickedSquare: 'e2', game }),
    { action: 'deselect' }
  );

  // 5. Click another friendly piece -> switch selection
  const switchRes = resolveSquareClick({ selectedSquare: 'e2', clickedSquare: 'd2', game });
  assert.equal(switchRes.action, 'switch_selection');
  assert.equal(switchRes.square, 'd2');

  // 6. Click legal destination square -> move
  const moveRes = resolveSquareClick({ selectedSquare: 'e2', clickedSquare: 'e4', game });
  assert.equal(moveRes.action, 'move');
  assert.equal(moveRes.from, 'e2');
  assert.equal(moveRes.to, 'e4');

  // 7. Click non-legal empty square -> deselect
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: 'e2', clickedSquare: 'h5', game }),
    { action: 'deselect' }
  );

  // 8. Click unreachable enemy piece -> deselect
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: 'e2', clickedSquare: 'e7', game }),
    { action: 'deselect' }
  );
});

test('resolveSquareClick supports castling by clicking rook', () => {
  const game = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  const res = resolveSquareClick({ selectedSquare: 'e1', clickedSquare: 'h1', game });
  assert.equal(res.action, 'move');
  assert.equal(res.from, 'e1');
  assert.equal(res.to, 'g1');
});

test('resolveSquareClick ignores clicks when thinking or game over', () => {
  const game = new Chess();
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: null, clickedSquare: 'e2', game, isThinking: true }),
    { action: 'ignore' }
  );
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: null, clickedSquare: 'e2', game, isGameOver: true }),
    { action: 'ignore' }
  );
  assert.deepEqual(
    resolveSquareClick({ selectedSquare: null, clickedSquare: 'e2', game, isTimedOut: true }),
    { action: 'ignore' }
  );
});

test('getSquareFromCoords calculates correct board square from client coordinates', () => {
  const rect = { left: 100, top: 100, width: 800, height: 800 };
  assert.equal(getSquareFromCoords({ clientX: 150, clientY: 150, rect, orientation: 'white' }), 'a8');
  assert.equal(getSquareFromCoords({ clientX: 850, clientY: 150, rect, orientation: 'white' }), 'h8');
  assert.equal(getSquareFromCoords({ clientX: 150, clientY: 850, rect, orientation: 'white' }), 'a1');
  assert.equal(getSquareFromCoords({ clientX: 550, clientY: 750, rect, orientation: 'white' }), 'e2');
  assert.equal(getSquareFromCoords({ clientX: 550, clientY: 550, rect, orientation: 'white' }), 'e4');

  // Black orientation
  assert.equal(getSquareFromCoords({ clientX: 150, clientY: 150, rect, orientation: 'black' }), 'h1');
  assert.equal(getSquareFromCoords({ clientX: 850, clientY: 850, rect, orientation: 'black' }), 'a8');

  // Outside rect
  assert.equal(getSquareFromCoords({ clientX: 50, clientY: 50, rect }), null);
});

