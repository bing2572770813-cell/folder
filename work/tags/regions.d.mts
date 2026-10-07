export const DEFAULT_REGION: string;
export function regionOf(tile: Record<string, unknown> | null | undefined): string;
export function regionNames(map: { tiles: unknown[][]; cellTags?: Record<string, unknown> }, cellTags?: Record<string, unknown>): string[];
export function taggedCells(map: { tiles: Array<Array<Record<string, unknown> | null>> }, tag: string): Array<{ r: number; c: number; tile: Record<string, unknown> }>;
export function validateRegions(map: Record<string, unknown>, world?: unknown): string[];
export function assignRegion(map: Record<string, unknown>, cells: Array<{ r: number; c: number }>, name: string, existing?: boolean, cellTags?: Record<string, unknown>): Record<string, unknown>;
export function tagCell(map: Record<string, unknown>, r: number, c: number, tag: string, value: unknown): void;
