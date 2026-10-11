import { isGuidedMode } from '../domain/position.js';

const MIN_THINK_MS = 400;
const THINK_SPREAD_MS = 700;

/** How long the bot appears to think at least, so instant engine answers do not feel mechanical. */
function defaultThinkTime() {
    return MIN_THINK_MS + Math.random() * THINK_SPREAD_MS;
}

export function createBotCoordinator({ eventBus, store, engine, thinkTime = defaultThinkTime, now = () => Date.now() }) {
    let requestedAt = 0;
    let requestFen = null;
    let deliveryTimer = null;

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

        requestedAt = now();
        requestFen = state.game.fen();
        engine.requestBotMove(requestFen, level);
    }

    /**
     * The engine's answer, shown after the rest of the thinking time. It is dropped if the
     * position changed meanwhile (take back, new game).
     */
    function deliverBotMove(result) {
        const fen = requestFen;
        const wait = Math.max(0, thinkTime() - (now() - requestedAt));
        clearTimeout(deliveryTimer);
        store.setState({ isThinking: true });
        deliveryTimer = setTimeout(() => {
            deliveryTimer = null;
            store.setState({ isThinking: false });
            if (store.getState().game?.fen?.() !== fen) return;
            eventBus.emit('bot:move-ready', result);
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
