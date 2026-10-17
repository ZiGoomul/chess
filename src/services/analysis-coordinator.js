import { Chess } from 'chess.js';
import { isGuidedMode } from '../domain/position.js';

/**
 * Engine hints for the displayed position. Hints belong to the position they were
 * computed for (hintFen) and are never shown for another one, nor in puzzle mode,
 * where arrows would give the solution away.
 */
export function createAnalysisCoordinator({ eventBus, store, engine }) {
    let currentHints = {};
    let hintFen = null;

    // No hints in puzzles and lessons, nor in a rated game played with the help switched off
    function hintsBlocked() {
        const state = store.getState();
        return isGuidedMode(state.mode) || Boolean(state.assistsOff);
    }

    function hintsMatchDisplayed() {
        return hintFen !== null && hintFen === getDisplayedFen();
    }

    function dropStaleHints() {
        if (!hintsMatchDisplayed()) {
            currentHints = {};
            hintFen = null;
        }
    }

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
        if (!autoHint || hintsBlocked()) return;

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
        // Nothing to analyse: still report completion so the hint button is released
        if (hintsBlocked() || !fen || new Chess(fen).game_over()) {
            eventBus.emit('engine:hint-completed');
            return;
        }
        
        const state = store.getState();
        const level = state.settings?.hintLevel ?? 10;
        
        currentHints = {};
        hintFen = fen;
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
        if (hintsBlocked() || !hintsMatchDisplayed()) return;
        if (info) {
            currentHints[info.multipv] = info.move;
            if (info.multipv === 1) {
                eventBus.emit('engine:eval-updated', { cp: info.cp, mate: info.mate, isWhiteTurn: hintFen.split(' ')[1] === 'w' });
            }
            emitHints();
        }
    }

    function handleHintComplete() {
        if (!hintsBlocked() && hintsMatchDisplayed()) emitHints();
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

    // Redraw after a resize or flip, only when the hints are for the position on the board
    function drawHintArrows() {
        if (hintsBlocked() || !hintsMatchDisplayed() || !Object.keys(currentHints).length) return;
        emitHints();
    }

    if (eventBus) {
        eventBus.on('game:move-made', () => { dropStaleHints(); autoHintIfNeeded(); });
        eventBus.on('game:ply-changed', () => { dropStaleHints(); autoHintIfNeeded(); });
        eventBus.on('board:resized', () => drawHintArrows());
        eventBus.on('board:orientation-changed', () => {
            setTimeout(() => drawHintArrows(), 100);
        });
    }

    return { autoHintIfNeeded, requestHint, drawHintArrows, handleHintInfo, handleHintComplete };
}
