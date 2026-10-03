/**
 * Pure domain logic for resolving square clicks and move selection.
 */
import type { ChessInstance, Move, Square } from 'chess.js';

export type ChessConstructor = new (fen?: string) => ChessInstance;

export interface MoveDestination {
  square: Square;
  isCapture: boolean;
}

export type SquareClickResolution =
  | { action: 'ignore' }
  | { action: 'deselect' }
  | { action: 'select'; square: Square; moves: Move[] }
  | { action: 'switch_selection'; square: Square; moves: Move[] }
  | { action: 'move'; from: Square; to: Square; moveObj: Move };

export function getLegalMovesForSquare(
  square: Square | null | undefined,
  game: ChessInstance | null | undefined,
  isEditor = false,
  ChessCtor: ChessConstructor | null = null
): Move[] {
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

/** Clicking a king on its own rook means "castle": map it to the king's destination square. */
export function mapCastlingTarget(
  fromSquare: Square,
  toSquare: Square,
  game: ChessInstance | null | undefined,
  legalMoves: Move[] = []
): Square {
  if (!game || !fromSquare || !toSquare) return toSquare;
  const piece = game.get(fromSquare);
  if (!piece || piece.type !== 'k') return toSquare;

  const castles = (to: Square, side: 'k' | 'q') =>
    legalMoves.some(m => m.to === to && m.flags && m.flags.includes(side));

  if (fromSquare === 'e1' && piece.color === 'w') {
    if (toSquare === 'h1' && castles('g1', 'k')) return 'g1';
    if (toSquare === 'a1' && castles('c1', 'q')) return 'c1';
  } else if (fromSquare === 'e8' && piece.color === 'b') {
    if (toSquare === 'h8' && castles('g8', 'k')) return 'g8';
    if (toSquare === 'a8' && castles('c8', 'q')) return 'c8';
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
}: {
  selectedSquare?: Square | null;
  clickedSquare: Square | null | undefined;
  game: ChessInstance | null | undefined;
  isEditor?: boolean;
  isPuzzleMode?: boolean;
  isPuzzleCompleted?: boolean;
  isThinking?: boolean;
  isGameOver?: boolean;
  isTimedOut?: boolean;
  ChessCtor?: ChessConstructor | null;
}): SquareClickResolution {
  if (isThinking || isPuzzleCompleted || (!isEditor && !isPuzzleMode && (isGameOver || isTimedOut))) {
    return { action: 'ignore' };
  }
  if (!clickedSquare || !game) {
    return { action: 'ignore' };
  }

  const clickedPiece = game.get(clickedSquare);

  // Nothing selected yet: select an own piece (any piece in editor mode)
  if (!selectedSquare) {
    if (!clickedPiece) return { action: 'ignore' };
    if (!isEditor && clickedPiece.color !== game.turn()) return { action: 'ignore' };
    const moves = getLegalMovesForSquare(clickedSquare, game, isEditor, ChessCtor);
    return { action: 'select', square: clickedSquare, moves };
  }

  if (clickedSquare === selectedSquare) {
    return { action: 'deselect' };
  }

  const legalMoves = getLegalMovesForSquare(selectedSquare, game, isEditor, ChessCtor);
  const targetSquare = mapCastlingTarget(selectedSquare, clickedSquare, game, legalMoves);
  const matchedMove = legalMoves.find(m => m.to === targetSquare);

  if (matchedMove) {
    return { action: 'move', from: selectedSquare, to: targetSquare, moveObj: matchedMove };
  }

  // Another own piece (or any piece in editor mode): switch the selection
  if (clickedPiece && (isEditor || clickedPiece.color === game.turn())) {
    const moves = getLegalMovesForSquare(clickedSquare, game, isEditor, ChessCtor);
    return { action: 'switch_selection', square: clickedSquare, moves };
  }

  return { action: 'deselect' };
}

export function getSquareFromCoords({ clientX, clientY, rect, orientation = 'white' }: {
  clientX: number;
  clientY: number;
  rect: { left: number; top: number; width: number; height: number } | null | undefined;
  orientation?: 'white' | 'black';
}): Square | null {
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
  return `${file}${rank}` as Square;
}

/**
 * Collapses legal moves into the unique destination squares to mark on the board.
 * Single source for every hint path (click, hover, drag), so they cannot drift apart.
 */
export function getMoveDestinations(moves: Move[] | null | undefined, game: ChessInstance | null | undefined): MoveDestination[] {
  const seen = new Set<Square>();
  const destinations: MoveDestination[] = [];
  for (const move of moves || []) {
    if (seen.has(move.to)) continue;
    seen.add(move.to);
    const isEnPassant = Boolean(move.flags && move.flags.includes('e'));
    const isCapture = Boolean(game && game.get(move.to)) || isEnPassant;
    destinations.push({ square: move.to, isCapture });
  }
  return destinations;
}
