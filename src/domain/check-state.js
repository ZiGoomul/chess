export function getKingSquareInCheck(game) {
  if (!game || typeof game.in_check !== 'function') return null;
  if (!game.in_check() && !(typeof game.in_checkmate === 'function' && game.in_checkmate())) {
    return null;
  }

  const turn = game.turn();
  const board = game.board();
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === turn) {
        return files[c] + (8 - r);
      }
    }
  }

  return null;
}

export function determineMoveSound(game, move) {
  if (!game) return 'move';

  if ((typeof game.in_checkmate === 'function' && game.in_checkmate()) ||
      (typeof game.in_draw === 'function' && game.in_draw())) {
    return 'gameEnd';
  }

  if (typeof game.in_check === 'function' && game.in_check()) {
    return 'check';
  }

  if (move && move.flags) {
    if (move.flags.includes('c') || move.flags.includes('e')) {
      return 'capture';
    }
    if (move.flags.includes('k') || move.flags.includes('q')) {
      return 'castle';
    }
  }

  return 'move';
}
