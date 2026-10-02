export function createBotCoordinator({ eventBus, store, engineWorker }) {
    function makeBotMove() {
        const state = store.getState();
        const level = state.settings?.botLevel || 0;
        
        if (level === 0 || state.game?.isPuzzleMode || state.game?.isGameOver) {
            return;
        }

        if (state.mode === 'bot') {
            const humanTurn = state.orientation === 'white' ? 'w' : 'b';
            const currentTurn = typeof state.game?.turn === 'function' ? state.game.turn() : state.game?.turn;
            if (currentTurn === humanTurn) {
                return;
            }
        }

        // Invoke engineWorker and emit the move when ready
        engineWorker.requestBotMove(state.game.fen, level).then(result => {
            if (result) {
                eventBus.emit('bot:move-ready', {
                    uci: result.bestmove || result.uci,
                    bestmove: result.bestmove || result.uci,
                    ponder: result.ponder
                });
            }
        }).catch(err => console.error('Error requesting bot move:', err));
    }

    function cancelBotSearch() {
        if (engineWorker.cancelBotMove) {
            engineWorker.cancelBotMove();
        } else if (engineWorker.cancelSearch) {
            engineWorker.cancelSearch();
        }
    }

    function updateStockfishLevel(level) {
        if (engineWorker.setBotLevel) {
            engineWorker.setBotLevel(level);
        }
    }

    // Listen to events
    if (eventBus) {
        eventBus.on('game:move-made', () => {
            makeBotMove();
        });

        eventBus.on('settings:changed', (settings) => {
            if (settings && settings.botLevel !== undefined) {
                updateStockfishLevel(settings.botLevel);
            }
        });
    }

    return {
        makeBotMove,
        cancelBotSearch,
        updateStockfishLevel
    };
}
