export function createEditSnapshot<T>(map: T, rect: unknown, selectedCells: unknown[]): { map: T; rect: unknown; selectedCells: unknown[] };
export function trimHistory(history: Array<{ map?: { width: number; height: number } }>): void;
