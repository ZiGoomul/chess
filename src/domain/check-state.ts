import type { ChessInstance, Move, Square } from 'chess.js';

export type MoveSound = 'move' | 'capture' | 'castle' | 'check' | 'gameEnd';

/** Square of the king of the side to move when that side is in check (or mated), else null. */
export function getKingSquareInCheck(game: ChessInstance | null | undefined): Square | null {
  if (!game || typeof game.in_check !== 'function') return null;
  if (!game.in_check() && !(typeof game.in_checkmate === 'function' && game.in_checkmate())) {
    return null;
  }

  const turn = game.turn();
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const board = game.board();

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r]?.[c];
      if (piece && piece.type === 'k' && piece.color === turn) {
        return `${files[c]}${8 - r}` as Square;
      }
    }
  }

  return null;
}

export function determineMoveSound(game: ChessInstance | null | undefined, move?: Pick<Move, 'flags'> | null): MoveSound {
  if (!game) return 'move';

  if ((typeof game.in_checkmate === 'function' && game.in_checkmate()) ||
      (typeof game.in_draw === 'function' && game.in_draw())) {
    return 'gameEnd';
  }

  if (typeof game.in_check === 'function' && game.in_check()) {
    return 'check';
  }

  if (move && move.flags) {
    if (move.flags.includes('c') || move.flags.includes('e')) return 'capture';
    if (move.flags.includes('k') || move.flags.includes('q')) return 'castle';
  }

  return 'move';
}
