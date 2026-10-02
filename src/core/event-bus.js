export function createEventBus() {
    const listeners = new Map();
    return {
        on(event, handler) {
            if (!listeners.has(event)) listeners.set(event, new Set());
            listeners.get(event).add(handler);
        },
        off(event, handler) {
            if (listeners.has(event)) listeners.get(event).delete(handler);
        },
        emit(event, payload) {
            if (listeners.has(event)) {
                listeners.get(event).forEach(handler => handler(payload));
            }
        },
        clear() {
            listeners.clear();
        }
    };
}
