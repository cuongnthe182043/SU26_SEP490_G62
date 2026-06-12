type Listener<T = unknown> = (payload: T) => void;

const registry = new Map<string, Set<Listener>>();

export const appEvents = {
    on<T = unknown>(event: string, cb: Listener<T>): () => void {
        if (!registry.has(event)) registry.set(event, new Set());
        registry.get(event)!.add(cb as Listener);
        return () => registry.get(event)?.delete(cb as Listener);
    },

    emit(event: string, payload?: unknown): void {
        registry.get(event)?.forEach((cb) => cb(payload));
    },
};
