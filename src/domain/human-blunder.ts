import { type ChessInstance } from 'chess.js';

const PIECE_VALUES: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100
};

export function getPieceCount(game: ChessInstance): number {
  const board = game.board();
  let count = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]) count++;
    }
  }
  return count;
}

export function getHumanThinkTime(
  game: ChessInstance,
  isBookMove: boolean,
  random: () => number = Math.random
): number {
  if (isBookMove) {
    // Confident, quick book move in opening
    return 450 + random() * 450;
  }

  if (game.in_check()) {
    // Reacting to check
    return 550 + random() * 650;
  }

  const pieceCount = getPieceCount(game);
  if (pieceCount > 16) {
    // Middlegame with many pieces: think longer
    return 900 + random() * 1100;
  }

  // Endgame / few pieces
  return 600 + random() * 700;
}

export function findNaturalRecapture(
  game: ChessInstance,
  level: number,
  random: () => number = Math.random
): { uci: string; san: string } | null {
  if (level > 3) return null;

  const history = game.history({ verbose: true });
  if (history.length === 0) return null;

  const lastMove = history[history.length - 1];
  if (!lastMove || !lastMove.captured) return null;

  // Probability of noticing and playing the recapture
  const recaptureProb = level <= 1 ? 0.85 : level <= 2 ? 0.92 : 0.98;
  if (random() > recaptureProb) return null;

  const targetSquare = lastMove.to;
  const legalMoves = game.moves({ verbose: true });
  const recaptures = legalMoves.filter(m => m.to === targetSquare);

  if (recaptures.length === 0) return null;

  // Sort recaptures by least valuable attacker first (pawn before bishop before queen)
  recaptures.sort((a, b) => (PIECE_VALUES[a.piece] || 1) - (PIECE_VALUES[b.piece] || 1));
  const chosen = recaptures[0];

  return {
    uci: `${chosen.from}${chosen.to}${chosen.promotion || ''}`,
    san: chosen.san
  };
}

export function refineBotMove(
  game: ChessInstance,
  rawMove: { from: string; to: string; promotion?: string } | null,
  level: number,
  random: () => number = Math.random
): { uci: string; san: string } | null {
  if (!rawMove) return null;

  const rawUci = `${rawMove.from}${rawMove.to}${rawMove.promotion || ''}`;
  const legalMoves = game.moves({ verbose: true });
  const matched = legalMoves.find(
    m => `${m.from}${m.to}${m.promotion || ''}` === rawUci || (rawUci.startsWith(`${m.from}${m.to}`) && !m.promotion)
  );
  if (!matched) return null;

  // Levels 1-3: Check for natural recapture if opponent just took our piece
  const naturalRecapture = findNaturalRecapture(game, level, random);
  if (naturalRecapture) {
    return naturalRecapture;
  }

  // Levels 1-3 early opening: avoid unforced king walks
  const plyCount = typeof game.history === 'function' ? game.history().length : 0;
  if (level <= 3 && plyCount < 16 && matched.piece === 'k' && !game.in_check()) {
    // If king move was castling, keep it!
    if (matched.flags.includes('k') || matched.flags.includes('q')) {
      return { uci: rawUci, san: matched.san };
    }

    // Try to castle if legal instead of moving king to a weird square
    const castlingMove = legalMoves.find(m => m.flags.includes('k') || m.flags.includes('q'));
    if (castlingMove) {
      return {
        uci: `${castlingMove.from}${castlingMove.to}${castlingMove.promotion || ''}`,
        san: castlingMove.san
      };
    }

    // Otherwise prefer developing a minor piece or pushing a central pawn
    const developmentMove = legalMoves.find(
      m => (m.piece === 'n' || m.piece === 'b') && (m.from.endsWith('1') || m.from.endsWith('8'))
    ) || legalMoves.find(
      m => m.piece === 'p' && (m.to === 'e4' || m.to === 'd4' || m.to === 'e5' || m.to === 'd5')
    );

    if (developmentMove) {
      return {
        uci: `${developmentMove.from}${developmentMove.to}${developmentMove.promotion || ''}`,
        san: developmentMove.san
      };
    }
  }

  return { uci: rawUci, san: matched.san };
}
