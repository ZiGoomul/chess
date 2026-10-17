import type { ChessInstance } from 'chess.js';

export interface PieceCounts {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
}

export interface MaterialBalance {
  diff: number; // positive = White leads, negative = Black leads
  capturedByWhite: Array<{ type: 'q' | 'r' | 'b' | 'n' | 'p'; count: number }>;
  capturedByBlack: Array<{ type: 'q' | 'r' | 'b' | 'n' | 'p'; count: number }>;
}

export const START_PIECES: Record<'q' | 'r' | 'b' | 'n' | 'p', number> = {
  q: 1,
  r: 2,
  b: 2,
  n: 2,
  p: 8
};

export const PIECE_VALUES: Record<'q' | 'r' | 'b' | 'n' | 'p', number> = {
  q: 9,
  r: 5,
  b: 3,
  n: 3,
  p: 1
};

export const PIECE_ORDER: ReadonlyArray<'q' | 'r' | 'b' | 'n' | 'p'> = ['q', 'r', 'b', 'n', 'p'];

export function countPiecesFromFen(fen: string): { w: PieceCounts; b: PieceCounts } {
  const counts: { w: PieceCounts; b: PieceCounts } = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
  };
  const boardStr = fen.split(' ')[0] || '';
  for (let i = 0; i < boardStr.length; i++) {
    const char = boardStr[i];
    if (/[pnbrq]/.test(char)) {
      counts.b[char as keyof PieceCounts]++;
    } else if (/[PNBRQ]/.test(char)) {
      counts.w[char.toLowerCase() as keyof PieceCounts]++;
    }
  }
  return counts;
}

export function calculateMaterialBalance(game: ChessInstance | null | undefined): MaterialBalance {
  if (!game || typeof game.fen !== 'function') {
    return { diff: 0, capturedByWhite: [], capturedByBlack: [] };
  }

  const counts = countPiecesFromFen(game.fen());

  // Promoted officers for each side
  let whitePromoted = 0;
  let blackPromoted = 0;
  const officerTypes: ReadonlyArray<'q' | 'r' | 'b' | 'n'> = ['q', 'r', 'b', 'n'];
  for (const t of officerTypes) {
    if (counts.w[t] > START_PIECES[t]) whitePromoted += counts.w[t] - START_PIECES[t];
    if (counts.b[t] > START_PIECES[t]) blackPromoted += counts.b[t] - START_PIECES[t];
  }

  const capturedByWhite: Array<{ type: 'q' | 'r' | 'b' | 'n' | 'p'; count: number }> = [];
  const capturedByBlack: Array<{ type: 'q' | 'r' | 'b' | 'n' | 'p'; count: number }> = [];

  let whiteTotal = 0;
  let blackTotal = 0;

  for (const type of PIECE_ORDER) {
    whiteTotal += counts.w[type] * PIECE_VALUES[type];
    blackTotal += counts.b[type] * PIECE_VALUES[type];

    if (type === 'p') {
      const missingBlackPawns = Math.max(0, START_PIECES.p - counts.b.p - blackPromoted);
      const missingWhitePawns = Math.max(0, START_PIECES.p - counts.w.p - whitePromoted);
      if (missingBlackPawns > 0) capturedByWhite.push({ type: 'p', count: missingBlackPawns });
      if (missingWhitePawns > 0) capturedByBlack.push({ type: 'p', count: missingWhitePawns });
    } else {
      const missingBlack = Math.max(0, START_PIECES[type] - counts.b[type]);
      const missingWhite = Math.max(0, START_PIECES[type] - counts.w[type]);
      if (missingBlack > 0) capturedByWhite.push({ type, count: missingBlack });
      if (missingWhite > 0) capturedByBlack.push({ type, count: missingWhite });
    }
  }

  return {
    diff: whiteTotal - blackTotal,
    capturedByWhite,
    capturedByBlack
  };
}
