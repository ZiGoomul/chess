export function createBotCoordinator({ eventBus, store, engine }) {
    function makeBotMove() {
        const state = store.getState();
        const level = state.settings?.botLevel || 0;
        
        const isGameOver = typeof state.game?.game_over === 'function' ? state.game.game_over() : false;
        if (level === 0 || state.mode === 'puzzle' || isGameOver) {
            return;
        }

        const humanTurn = state.orientation === 'white' ? 'w' : 'b';
        const currentTurn = typeof state.game?.turn === 'function' ? state.game.turn() : state.game?.turn;
        if (currentTurn === humanTurn) {
            return;
        }

        engine.requestBotMove(state.game.fen(), level);
    }

    function cancelBotSearch() {
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

    return { makeBotMove, cancelBotSearch, updateStockfishLevel };
}
