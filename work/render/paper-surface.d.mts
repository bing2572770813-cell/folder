export function isPaper(tile: Record<string, unknown> | null | undefined): boolean;
export function hasConnectedLiftNearby(map: Record<string, unknown>, row: number, column: number, hidden?: (r: number, c: number) => boolean): boolean;
export const DEFAULT_CREASE_DEPTH: number;
export function creaseRatio(value: unknown): number;
export function createPaperSurfaceCache(options?: Record<string, unknown>): Record<string, unknown>;
export function paperSurface(map: Record<string, unknown>, row: number, column: number, hidden?: (r: number, c: number) => boolean, showFolds?: boolean, creaseDepth?: number, forceSurface?: boolean): Record<string, unknown> | null;
