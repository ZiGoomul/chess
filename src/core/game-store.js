// src/core/game-store.js
import { Chess } from 'chess.js';

export function createGameStore(initialState = {}) {
    let state = {
        game: new Chess(),
        historyFENs: [new Chess().fen()],
        currentViewPly: 0,
        selectedSquare: null,
        mode: 'free', // 'free' | 'bot' | 'puzzle'
        orientation: 'white',
        isThinking: false,
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
    
    const listeners = new Set();
    
    return {
        getState() {
            return state;
        },
        setState(partial) {
            state = { ...state, ...partial };
            listeners.forEach(listener => listener(state));
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}
