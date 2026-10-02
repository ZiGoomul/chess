/**
 * Pure domain logic for resolving square clicks and move selection.
 */

export function getLegalMovesForSquare(square, game, isEditor = false, ChessCtor = null) {
  if (!game || !square) return [];
  const piece = game.get(square);
  if (!piece) return [];

  if (isEditor) {
    if (game.turn() !== piece.color && ChessCtor) {
      const fenParts = game.fen().split(' ');
      fenParts[1] = piece.color;
      const editorGame = new ChessCtor(fenParts.join(' '));
      return editorGame.moves({ square, verbose: true });
    }
  } else if (game.turn() !== piece.color) {
    return [];
  }

  return game.moves({ square, verbose: true });
}

export function mapCastlingTarget(fromSquare, toSquare, game, legalMoves = []) {
  if (!game || !fromSquare || !toSquare) return toSquare;
  const piece = game.get(fromSquare);
  if (!piece || piece.type !== 'k') return toSquare;

  if (fromSquare === 'e1' && piece.color === 'w') {
    if (toSquare === 'h1' && legalMoves.some(m => m.to === 'g1' && m.flags && m.flags.includes('k'))) {
      return 'g1';
    }
    if (toSquare === 'a1' && legalMoves.some(m => m.to === 'c1' && m.flags && m.flags.includes('q'))) {
      return 'c1';
    }
  } else if (fromSquare === 'e8' && piece.color === 'b') {
    if (toSquare === 'h8' && legalMoves.some(m => m.to === 'g8' && m.flags && m.flags.includes('k'))) {
      return 'g8';
    }
    if (toSquare === 'a8' && legalMoves.some(m => m.to === 'c8' && m.flags && m.flags.includes('q'))) {
      return 'c8';
    }
  }

  return toSquare;
}

export function resolveSquareClick({
  selectedSquare = null,
  clickedSquare,
  game,
  isEditor = false,
  isPuzzleMode = false,
  isPuzzleCompleted = false,
  isThinking = false,
  isGameOver = false,
  isTimedOut = false,
  ChessCtor = null
}) {
  if (isThinking || isPuzzleCompleted || (!isEditor && !isPuzzleMode && (isGameOver || isTimedOut))) {
    return { action: 'ignore' };
  }
  if (!clickedSquare || !game) {
    return { action: 'ignore' };
  }

  const clickedPiece = game.get(clickedSquare);

  // If no square was previously selected
  if (!selectedSquare) {
    if (!clickedPiece) {
      return { action: 'ignore' };
    }
    if (!isEditor && clickedPiece.color !== game.turn()) {
      return { action: 'ignore' };
    }
    const moves = getLegalMovesForSquare(clickedSquare, game, isEditor, ChessCtor);
    return { action: 'select', square: clickedSquare, moves };
  }

  // If clicking the same square that is currently selected -> deselect
  if (clickedSquare === selectedSquare) {
    return { action: 'deselect' };
  }

  const legalMoves = getLegalMovesForSquare(selectedSquare, game, isEditor, ChessCtor);
  const targetSquare = mapCastlingTarget(selectedSquare, clickedSquare, game, legalMoves);
  const matchedMove = legalMoves.find(m => m.to === targetSquare);

  if (matchedMove) {
    return {
      action: 'move',
      from: selectedSquare,
      to: targetSquare,
      moveObj: matchedMove
    };
  }

  // Not a legal move from selected square:
  // If clicking another piece belonging to the player whose turn it is (or any piece in editor mode) -> switch selection
  if (clickedPiece && (isEditor || clickedPiece.color === game.turn())) {
    const moves = getLegalMovesForSquare(clickedSquare, game, isEditor, ChessCtor);
    return { action: 'switch_selection', square: clickedSquare, moves };
  }

  // Otherwise, deselect
  return { action: 'deselect' };
}

export function getSquareFromCoords({ clientX, clientY, rect, orientation = 'white' }) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || x >= rect.width || y < 0 || y >= rect.height) return null;

  const col = Math.floor(x / (rect.width / 8));
  const row = Math.floor(y / (rect.height / 8));
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;

  const isWhite = orientation === 'white';
  const file = isWhite ? 'abcdefgh'[col] : 'abcdefgh'[7 - col];
  const rank = isWhite ? (8 - row) : (row + 1);
  return `${file}${rank}`;
}
