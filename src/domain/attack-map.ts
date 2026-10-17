import type { ChessInstance, Square } from 'chess.js';

export interface BoardPiece {
  color: 'w' | 'b';
  type: string;
}

export type PieceMap = Record<string, BoardPiece>;

export interface SquareAttackInfo {
  by: 'w' | 'b';
  count: number;
}

export interface AttackHighlights {
  attacks: Record<string, SquareAttackInfo>;
  defenders: Record<string, number>;
}

const KNIGHT_STEPS: ReadonlyArray<readonly [number, number]> = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2]
];

const KING_STEPS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1]
];

const ROOK_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1]
];

const BISHOP_DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 1], [1, -1], [-1, 1], [-1, -1]
];

const FILES = 'abcdefgh';

export function squareName(file: number, rank: number): Square {
  return `${FILES[file]}${rank + 1}` as Square;
}

export function onBoard(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

/**
 * Returns all squares attacked or controlled by a piece on a given square,
 * including friendly pieces defended by it.
 */
export function attackedSquares(pieces: PieceMap, square: string, piece: BoardPiece): Square[] {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]) - 1;
  const result: Square[] = [];

  function step(offsets: ReadonlyArray<readonly [number, number]>): void {
    for (let i = 0; i < offsets.length; i++) {
      const f = file + offsets[i][0];
      const r = rank + offsets[i][1];
      if (onBoard(f, r)) result.push(squareName(f, r));
    }
  }

  function slide(dirs: ReadonlyArray<readonly [number, number]>): void {
    for (let i = 0; i < dirs.length; i++) {
      let f = file + dirs[i][0];
      let r = rank + dirs[i][1];
      while (onBoard(f, r)) {
        const sq = squareName(f, r);
        result.push(sq);
        if (pieces[sq]) break;
        f += dirs[i][0];
        r += dirs[i][1];
      }
    }
  }

  switch (piece.type) {
    case 'p': {
      const dir = piece.color === 'w' ? 1 : -1;
      step([[-1, dir], [1, dir]]);
      break;
    }
    case 'n':
      step(KNIGHT_STEPS);
      break;
    case 'k':
      step(KING_STEPS);
      break;
    case 'b':
      slide(BISHOP_DIRS);
      break;
    case 'r':
      slide(ROOK_DIRS);
      break;
    case 'q':
      slide(ROOK_DIRS);
      slide(BISHOP_DIRS);
      break;
  }
  return result;
}

export function computeAttackCounts(pieces: PieceMap): { w: Record<string, number>; b: Record<string, number> } {
  const counts: { w: Record<string, number>; b: Record<string, number> } = { w: {}, b: {} };
  for (const square in pieces) {
    const piece = pieces[square];
    const targets = attackedSquares(pieces, square, piece);
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      counts[piece.color][target] = (counts[piece.color][target] || 0) + 1;
    }
  }
  return counts;
}

export function computeHighlights(pieces: PieceMap): AttackHighlights {
  const counts = computeAttackCounts(pieces);
  const attacks: Record<string, SquareAttackInfo> = {};
  const defenders: Record<string, number> = {};

  for (const square in pieces) {
    const piece = pieces[square];
    const enemy: 'w' | 'b' = piece.color === 'w' ? 'b' : 'w';
    if (counts[enemy][square]) {
      attacks[square] = { by: enemy, count: counts[enemy][square] };
    }
    if (piece.type !== 'k' && counts[piece.color][square]) {
      defenders[square] = counts[piece.color][square];
    }
  }
  return { attacks, defenders };
}

export function extractPiecesFromGame(game: ChessInstance | null | undefined): PieceMap {
  if (!game || typeof game.board !== 'function') return {};
  const pieces: PieceMap = {};
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c];
      if (piece) {
        pieces[`${FILES[c]}${8 - r}`] = { color: piece.color, type: piece.type };
      }
    }
  }
  return pieces;
}
