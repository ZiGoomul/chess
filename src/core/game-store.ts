import { Chess } from 'chess.js';
import type { ChessInstance, Square } from 'chess.js';

export interface GameSettings {
    highlightMoves: boolean;
    highlightAttacks: boolean;
    highlightDefenses: boolean;
    autoHint: boolean;
    botLevel: number;
    hintLevel?: number;
}

export interface GameState {
    game: ChessInstance;
    historyFENs: string[];
    currentViewPly: number;
    selectedSquare: Square | null;
    mode: 'free' | 'bot' | 'puzzle' | 'lesson';
    orientation: 'white' | 'black';
    isThinking: boolean;
    /** A rated game is being played with every help switched off; the settings stay as they are */
    assistsOff: boolean;
    settings: GameSettings;
    eval: { cp: number | null; mate: number | null };
}

export interface GameStore {
    getState(): GameState;
    setState(partial: Partial<GameState> | ((state: GameState) => Partial<GameState>)): void;
    subscribe(listener: (state: GameState) => void): () => void;
}

export function createGameStore(initialState: Partial<GameState> = {}): GameStore {
    const game = initialState.game || new Chess();
    const historyFENs = initialState.historyFENs || [game.fen()];

    let state: GameState = {
        game,
        historyFENs,
        currentViewPly: 0,
        selectedSquare: null,
        mode: 'free',
        orientation: 'white',
        isThinking: false,
        assistsOff: false,
        settings: {
            highlightMoves: true,
            highlightAttacks: false,
            highlightDefenses: false,
            autoHint: false,
            botLevel: 10
        },
        eval: { cp: null, mate: null },
        ...initialState
    };

    const listeners = new Set<(state: GameState) => void>();

    return {
        getState() {
            return state;
        },
        setState(partial) {
            const nextPartial = typeof partial === 'function' ? partial(state) : partial;
            state = { ...state, ...nextPartial };
            listeners.forEach(listener => listener(state));
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        }
    };
}
