import { Chess } from 'chess.js';

export function createAnalysisCoordinator({ eventBus, store, engine }) {
    let currentHints = {};

    function getDisplayedFen() {
        const state = store.getState();
        if (state.historyFENs && typeof state.currentViewPly === 'number' && state.historyFENs[state.currentViewPly]) {
            return state.historyFENs[state.currentViewPly];
        }
        return typeof state.game?.fen === 'function' ? state.game.fen() : state.game?.fen;
    }

    function autoHintIfNeeded() {
        const state = store.getState();
        const autoHint = state.settings?.autoHint;
        if (!autoHint) return;

        const fen = getDisplayedFen();
        if (!fen) return;
        const displayedGame = new Chess(fen);
        if (displayedGame.game_over()) return;

        const botLevel = state.settings?.botLevel || 0;
        if (botLevel > 0) {
            const isHistoricalPosition = state.currentViewPly < state.historyFENs.length - 1;
            const gameTurn = displayedGame.turn();
            const isPlayerTurn = (state.orientation === 'white' && gameTurn === 'w') || 
                                 (state.orientation === 'black' && gameTurn === 'b');
            if (isHistoricalPosition || isPlayerTurn) {
                requestHint();
            }
        } else {
            requestHint();
        }
    }

    function requestHint() {
        const fen = getDisplayedFen();
        if (!fen) return;
        const displayedGame = new Chess(fen);
        if (displayedGame.game_over()) return;
        
        const state = store.getState();
        const domLevel = (typeof window !== 'undefined' && window.$ && window.$('#hintLevel').length) ? parseInt(window.$('#hintLevel').val(), 10) : 10;
        const level = state.settings?.hintLevel || domLevel || 10;
        
        currentHints = {};
        eventBus.emit('engine:hints-updated', { arrows: [] });
        engine.requestHint(fen, level);
    }

    function emitHints() {
        const fen = getDisplayedFen();
        const game = fen ? new Chess(fen) : store.getState().game;
        eventBus.emit('engine:hints-updated', {
            arrows: getArrowsData(),
            hints: currentHints,
            game: game
        });
    }

    function handleHintInfo(info) {
        if (info) {
            currentHints[info.multipv] = info.move;
            if (info.multipv === 1) {
                eventBus.emit('engine:eval-updated', { cp: info.cp, mate: info.mate });
            }
            emitHints();
        }
    }

    function handleHintComplete() {
        emitHints();
        eventBus.emit('engine:hint-completed');
    }

    function getArrowsData() {
        const arrows = [];
        for (let i = 3; i >= 1; i--) {
            if (currentHints[i]) {
                const move = currentHints[i];
                arrows.push({
                    from: move.substring(0, 2),
                    to: move.substring(2, 4),
                    rank: i
                });
            }
        }
        return arrows;
    }

    function drawHintArrows() {
        emitHints();
    }

    if (eventBus) {
        eventBus.on('game:move-made', () => autoHintIfNeeded());
        eventBus.on('game:ply-changed', () => autoHintIfNeeded());
        eventBus.on('board:resized', () => drawHintArrows());
        eventBus.on('board:orientation-changed', () => {
            setTimeout(() => drawHintArrows(), 100);
        });
    }

    return { autoHintIfNeeded, requestHint, drawHintArrows, handleHintInfo, handleHintComplete };
}
