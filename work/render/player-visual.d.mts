export function createPlayerVisualView(options: Record<string, unknown>): {update(prefab: unknown): void; status(): {model: string | null; ready: boolean; fallback: boolean}; dispose(): void};
