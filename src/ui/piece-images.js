// Piece image URLs. The cburnett set ships with the app (public/pieces) and is the fallback
// whenever a set served from another site cannot be loaded.
export const LOCAL_PIECE_THEME = 'cburnett';

export function localPieceUrl(piece) {
  return `/pieces/cburnett/${piece}.svg`;
}

/** @param {string} theme @param {string} piece e.g. "wN" */
export function pieceImageUrl(theme, piece) {
  if (!theme || theme === LOCAL_PIECE_THEME) return localPieceUrl(piece);
  if (theme === 'wikipedia') return `https://chessboardjs.com/img/chesspieces/wikipedia/${piece}.png`;
  if (theme.startsWith('chesscom_')) {
    return `https://images.chesscomfiles.com/chess-themes/pieces/${theme.split('_')[1]}/150/${piece.toLowerCase()}.png`;
  }
  return `https://lichess1.org/assets/piece/${theme}/${piece}.svg`;
}

/** Swaps any piece image that fails to load (offline, blocked site) for the bundled one. */
export function installPieceImageFallback(root = document) {
  root.addEventListener('error', event => {
    const img = event.target;
    if (!(img instanceof HTMLImageElement) || img.dataset.pieceFallback) return;
    const piece = img.getAttribute('data-piece') || (img.src.match(/\/([wb][KQRBNP])\.(?:png|svg)$/i) || [])[1];
    if (!piece || !/^[wb][KQRBNP]$/i.test(piece)) return;
    img.dataset.pieceFallback = '1';
    img.src = localPieceUrl(piece[0] + piece[1].toUpperCase());
  }, true);
}
