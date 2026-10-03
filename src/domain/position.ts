/**
 * Helpers for the position currently shown on the board (live game or a past ply).
 */
import type { ChessInstance } from 'chess.js';

interface ViewState {
  game: ChessInstance;
  historyFENs: string[];
  currentViewPly: number;
}

export function isHistoricalPosition(state: Pick<ViewState, 'historyFENs' | 'currentViewPly'>): boolean {
  return state.currentViewPly < state.historyFENs.length - 1;
}

export function getDisplayedGame(state: ViewState, ChessCtor: new (fen?: string) => ChessInstance): ChessInstance {
  return isHistoricalPosition(state) ? new ChessCtor(state.historyFENs[state.currentViewPly]) : state.game;
}

export function isEditorMode({ isPuzzleMode, botLevel }: { isPuzzleMode: boolean; botLevel: number }): boolean {
  return !isPuzzleMode && botLevel === 0;
}
