import { CLASSES_WITH_BETTER_MOVE } from './move-classes.js';

/**
 * Keeps the finished review of the game on the board: the class of each move for the
 * move history, and for the viewed move a badge on its square plus the engine's
 * better move as an arrow. Applies only while the displayed game is the reviewed one.
 */
export function createReviewAnnotations({ Chess, boardView, eventBus, getHistoryFENs }) {
  let review = null;

  function matches() {
    if (!review) return false;
    const fens = getHistoryFENs();
    return fens.length === review.fens.length && fens[fens.length - 1] === review.fens[review.fens.length - 1];
  }

  function classForPly(ply) {
    return matches() ? review.byPly.get(ply)?.cls || null : null;
  }

  function showForViewPly(viewPly) {
    boardView.clearMoveClass?.();
    if (!matches() || viewPly <= 0) return;
    const entry = review.byPly.get(viewPly - 1);
    if (!entry) return;
    if (entry.to) boardView.showMoveClass?.(entry.to, entry.cls);
    if (entry.bestMove && entry.bestMove !== entry.played && CLASSES_WITH_BETTER_MOVE.has(entry.cls)) {
      eventBus.emit('engine:hints-updated', { hints: { 1: entry.bestMove }, game: new Chess(review.fens[viewPly - 1]) });
    }
  }

  function set(record, summary, evaluations) {
    const byPly = new Map();
    summary.moves.forEach(({ ply, cls }) => {
      const move = record.moves[ply] || {};
      byPly.set(ply, {
        cls,
        to: move.to || null,
        played: move.from && move.to ? `${move.from}${move.to}${move.promotion || ''}` : null,
        bestMove: evaluations[ply]?.evaluation?.pv || null
      });
    });
    review = { fens: record.fens || [], byPly };
  }

  eventBus.on('game:move-made', () => boardView.clearMoveClass?.());

  return { set, classForPly, showForViewPly, clear() { review = null; boardView.clearMoveClass?.(); } };
}
