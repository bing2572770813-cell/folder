export type EventListener<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown> = Record<string, unknown>> {
  on<K extends keyof Events & string>(name: K, listener: EventListener<Events[K]>): () => void;
  emit<K extends keyof Events & string>(name: K, payload: Events[K]): unknown[];
  clear(): void;
}
