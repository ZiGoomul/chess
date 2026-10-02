export function createAnalysisCoordinator({ eventBus, store, engineWorker }) {
    let currentHints = {};

    function autoHintIfNeeded() {
        const state = store.getState();
        const autoHint = state.settings?.autoHint;
        const isGameOver = state.game?.isGameOver;

        if (autoHint && !isGameOver) {
            const botLevel = state.settings?.botLevel || 0;
            if (botLevel > 0) {
                const isPlayerTurn = (state.board?.orientation === 'white' && state.game?.turn === 'w') || 
                                     (state.board?.orientation === 'black' && state.game?.turn === 'b');
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
        if (state.game?.isGameOver) return;
        
        const level = state.settings?.hintLevel || 10;
        const fen = state.game?.fen;
        
        currentHints = {};
        
        // Let's invoke requestAnalysis. It may take a callback or return a promise.
        // We'll pass a callback as third argument just in case it expects onUpdate.
        const result = engineWorker.requestAnalysis(fen, level, (info) => {
            if (info) {
                currentHints[info.multipv] = info.move;
                if (info.multipv === 1) {
                    eventBus.emit('engine:eval-updated', { cp: info.cp, mate: info.mate });
                }
                eventBus.emit('engine:hints-updated', { arrows: getArrowsData() });
            }
        });

        // If it returns a promise, we handle the resolution
        if (result && typeof result.then === 'function') {
            result.then(res => {
                if (res && res.hints) {
                    res.hints.forEach(info => {
                        currentHints[info.multipv] = info.move;
                        if (info.multipv === 1) {
                            eventBus.emit('engine:eval-updated', { cp: info.cp, mate: info.mate });
                        }
                    });
                }
                eventBus.emit('engine:hints-updated', { arrows: getArrowsData() });
            }).catch(err => console.error('Error in requestAnalysis:', err));
        } else {
            // Emit initially if it's an event-based streaming approach that finishes later,
            // though actual arrow emission would be handled when we get data.
            // For now just clear the hints:
            eventBus.emit('engine:hints-updated', { arrows: [] });
        }
    }

    function getArrowsData() {
        const arrows = [];
        // Draw reverse order so best move is drawn last (on top)
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
        // The original logic just uses the computed hints to draw arrows.
        // We emit the computed arrows so the view can draw them.
        eventBus.emit('engine:hints-updated', { arrows: getArrowsData() });
    }

    if (eventBus) {
        eventBus.on('game:move-made', () => {
            autoHintIfNeeded();
        });

        eventBus.on('game:ply-changed', () => {
            autoHintIfNeeded();
        });
    }

    return {
        autoHintIfNeeded,
        requestHint,
        drawHintArrows
    };
}
