type Handler<T = any> = (payload: T) => void;

export interface EventBus {
    on<T = any>(event: string, handler: Handler<T>): () => void;
    off<T = any>(event: string, handler: Handler<T>): void;
    emit<T = any>(event: string, payload?: T): void;
    clear(): void;
    getListenersMap(): Map<string, Set<Handler>>;
}

export function createEventBus(): EventBus {
    const listeners = new Map<string, Set<Handler>>();
    const bus: EventBus = {
        on(event, handler) {
            let handlers = listeners.get(event);
            if (!handlers) {
                handlers = new Set();
                listeners.set(event, handlers);
            }
            handlers.add(handler);
            return () => bus.off(event, handler);
        },
        off(event, handler) {
            const handlers = listeners.get(event);
            if (!handlers) return;
            handlers.delete(handler);
            if (handlers.size === 0) listeners.delete(event);
        },
        emit(event, payload) {
            listeners.get(event)?.forEach(handler => {
                try {
                    handler(payload);
                } catch (error) {
                    console.error(error);
                }
            });
        },
        clear() {
            listeners.clear();
        },
        getListenersMap() { return listeners; }
    };
    return bus;
}
