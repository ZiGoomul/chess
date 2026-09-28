const CASTLING_ROOK_SQUARES = {
  K: ['e1', 'h1'],
  Q: ['e1', 'a1'],
  k: ['e8', 'h8'],
  q: ['e8', 'a8']
};

export function retainCastlingRights(previousFen, nextPlacement) {
  const previousRights = previousFen.split(/\s+/)[2] || '-';
  if (previousRights === '-') return '-';

  const nextSquares = new Map();
  const ranks = nextPlacement.split('/');
  const files = 'abcdefgh';

  ranks.forEach((rank, rankIndex) => {
    let fileIndex = 0;
    for (const symbol of rank) {
      if (/\d/.test(symbol)) {
        fileIndex += Number(symbol);
        continue;
      }
      const square = `${files[fileIndex]}${8 - rankIndex}`;
      nextSquares.set(square, symbol);
      fileIndex += 1;
    }
  });

  const retainedRights = [...previousRights].filter(right => {
    const [kingSquare, rookSquare] = CASTLING_ROOK_SQUARES[right];
    const king = right === right.toUpperCase() ? 'K' : 'k';
    const rook = right === right.toUpperCase() ? 'R' : 'r';
    return nextSquares.get(kingSquare) === king && nextSquares.get(rookSquare) === rook;
  });

  return retainedRights.length ? retainedRights.join('') : '-';
}
