export function createAnalysisCoordinator({ eventBus, store, engine }) {
    let currentHints = {};

    function autoHintIfNeeded() {
        const state = store.getState();
        const autoHint = state.settings?.autoHint;
        const isGameOver = typeof state.game?.game_over === 'function' ? state.game.game_over() : false;

        if (autoHint && !isGameOver) {
            const botLevel = state.settings?.botLevel || 0;
            if (botLevel > 0) {
                const gameTurn = typeof state.game?.turn === 'function' ? state.game.turn() : state.game?.turn;
                const isPlayerTurn = (state.orientation === 'white' && gameTurn === 'w') || 
                                     (state.orientation === 'black' && gameTurn === 'b');
                if (isPlayerTurn) {
                    requestHint();
                }
            } else {
                requestHint();
            }
        }
    }

    function requestHint() {
        const state = store.getState();
        const isGameOver = typeof state.game?.game_over === 'function' ? state.game.game_over() : false;
        if (isGameOver) return;
        
        const level = state.settings?.hintLevel || 10;
        const fen = typeof state.game?.fen === 'function' ? state.game.fen() : state.game?.fen;
        
        currentHints = {};
        eventBus.emit('engine:hints-updated', { arrows: [] });
        engine.requestHint(fen, level);
    }

    function handleHintInfo(info) {
        if (info) {
            currentHints[info.multipv] = info.move;
            if (info.multipv === 1) {
                eventBus.emit('engine:eval-updated', { cp: info.cp, mate: info.mate });
            }
            eventBus.emit('engine:hints-updated', { arrows: getArrowsData() });
        }
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
        eventBus.emit('engine:hints-updated', { arrows: getArrowsData() });
    }

    if (eventBus) {
        eventBus.on('game:move-made', () => autoHintIfNeeded());
        eventBus.on('game:ply-changed', () => autoHintIfNeeded());
    }

    return { autoHintIfNeeded, requestHint, drawHintArrows, handleHintInfo };
}
