import { isGuidedMode } from '../domain/position.js';
import { findOpeningBookMove } from '../domain/bot-openings.js';
import { refineBotMove, getHumanThinkTime } from '../domain/human-blunder.js';

export function createBotCoordinator({
    eventBus,
    store,
    engine,
    findBookMove = findOpeningBookMove,
    refineMove = refineBotMove,
    thinkTime = null,
    now = () => Date.now()
}) {
    let requestedAt = 0;
    let requestFen = null;
    let deliveryTimer = null;
    let isBookMove = false;

    function calcThinkTime(game) {
        if (typeof thinkTime === 'function') {
            return thinkTime(game, isBookMove);
        }
        return getHumanThinkTime(game, isBookMove);
    }

    function makeBotMove() {
        const state = store.getState();
        const level = state.settings?.botLevel || 0;
        
        const isGameOver = typeof state.game?.game_over === 'function' ? state.game.game_over() : false;
        if (level === 0 || isGuidedMode(state.mode) || isGameOver) {
            return;
        }

        const humanTurn = state.orientation === 'white' ? 'w' : 'b';
        const currentTurn = typeof state.game?.turn === 'function' ? state.game.turn() : state.game?.turn;
        if (currentTurn === humanTurn) {
            return;
        }

        if (deliveryTimer) {
            clearTimeout(deliveryTimer);
            deliveryTimer = null;
            store.setState({ isThinking: false });
        }

        const game = state.game;
        const bookMove = typeof findBookMove === 'function' ? findBookMove(game, level) : null;
        if (bookMove) {
            isBookMove = true;
            requestedAt = now();
            requestFen = game.fen();
            deliverBotMove({ bestmove: bookMove.uci, uci: bookMove.uci });
            return;
        }

        isBookMove = false;
        requestedAt = now();
        requestFen = game.fen();
        engine.requestBotMove(requestFen, level);
    }

    /**
     * The engine's answer, shown after the rest of the thinking time. It is dropped if the
     * position changed meanwhile (take back, new game).
     */
    function deliverBotMove(result) {
        const fen = requestFen;
        const game = store.getState().game;
        const level = store.getState().settings?.botLevel || 0;
        const wait = Math.max(0, calcThinkTime(game) - (now() - requestedAt));
        clearTimeout(deliveryTimer);
        store.setState({ isThinking: true });
        deliveryTimer = setTimeout(() => {
            deliveryTimer = null;
            store.setState({ isThinking: false });
            if (store.getState().game?.fen?.() !== fen) return;

            const state = store.getState();
            const humanTurn = state.orientation === 'white' ? 'w' : 'b';
            const currentTurn = typeof state.game?.turn === 'function' ? state.game.turn() : state.game?.turn;
            if (currentTurn === humanTurn) return;

            let finalResult = result;
            if (result && result.bestmove && typeof refineMove === 'function' && !isBookMove) {
                const refined = refineMove(
                    game,
                    { from: result.bestmove.slice(0, 2), to: result.bestmove.slice(2, 4), promotion: result.bestmove[4] },
                    level
                );
                if (refined) {
                    finalResult = { bestmove: refined.uci, uci: refined.uci };
                }
            }

            eventBus.emit('bot:move-ready', finalResult);
        }, wait);
    }

    function cancelBotSearch() {
        if (deliveryTimer) {
            clearTimeout(deliveryTimer);
            deliveryTimer = null;
            store.setState({ isThinking: false });
        }
        engine.cancelBotMove();
    }

    function updateStockfishLevel(level) {
        engine.setBotLevel(level);
    }

    if (eventBus) {
        eventBus.on('game:move-made', () => makeBotMove());
        eventBus.on('settings:changed', (settings) => {
            if (settings && settings.botLevel !== undefined) {
                updateStockfishLevel(settings.botLevel);
            }
        });
    }

    return { makeBotMove, cancelBotSearch, updateStockfishLevel, deliverBotMove };
}

