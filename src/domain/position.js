/**
 * Helpers for the position currently shown on the board (live game or a past ply).
 */

export function isHistoricalPosition(state) {
  return state.currentViewPly < state.historyFENs.length - 1;
}

export function getDisplayedGame(state, ChessCtor) {
  return isHistoricalPosition(state) ? new ChessCtor(state.historyFENs[state.currentViewPly]) : state.game;
}

export function isEditorMode({ isPuzzleMode, botLevel }) {
  return !isPuzzleMode && botLevel === 0;
}
