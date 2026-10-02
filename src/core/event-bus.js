export function createEventBus() {
    const listeners = new Map();
    return {
        on(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
            return () => this.off(event, handler);
        },
        off(event, handler) {
            if (listeners.has(event)) {
                const handlers = listeners.get(event);
                handlers.delete(handler);
                if (handlers.size === 0) {
                    listeners.delete(event);
                }
            }
        },
        emit(event, payload) {
            if (listeners.has(event)) {
                listeners.get(event).forEach(handler => {
                    try {
                        handler(payload);
                    } catch (error) {
                        console.error(error);
                    }
                });
            }
        },
        clear() {
            listeners.clear();
        },
        getListenersMap() { return listeners; }
    };
}
