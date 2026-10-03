const CASTLING_ROOK_SQUARES: Record<string, [string, string]> = {
  K: ['e1', 'h1'],
  Q: ['e1', 'a1'],
  k: ['e8', 'h8'],
  q: ['e8', 'a8']
};

/** Keeps only the castling rights of the previous FEN that still hold on the edited board. */
export function retainCastlingRights(previousFen: string, nextPlacement: string): string {
  const previousRights = previousFen.split(/\s+/)[2] || '-';
  if (previousRights === '-') return '-';

  const nextSquares = new Map<string, string>();
  const files = 'abcdefgh';

  nextPlacement.split('/').forEach((rank, rankIndex) => {
    let fileIndex = 0;
    for (const symbol of rank) {
      if (/\d/.test(symbol)) {
        fileIndex += Number(symbol);
        continue;
      }
      nextSquares.set(`${files[fileIndex]}${8 - rankIndex}`, symbol);
      fileIndex += 1;
    }
  });

  const retainedRights = [...previousRights].filter(right => {
    const squares = CASTLING_ROOK_SQUARES[right];
    if (!squares) return false;
    const [kingSquare, rookSquare] = squares;
    const isWhite = right === right.toUpperCase();
    return nextSquares.get(kingSquare) === (isWhite ? 'K' : 'k') &&
      nextSquares.get(rookSquare) === (isWhite ? 'R' : 'r');
  });

  return retainedRights.length ? retainedRights.join('') : '-';
}
