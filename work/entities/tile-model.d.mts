export interface Tile extends Record<string, unknown> {
  prefabId?: string;
  color?: string;
  height?: number;
  blocked?: boolean;
  terrain?: string;
  fold?: string | null;
  folds?: string[];
  tags?: Record<string, unknown>;
}
export interface Prefab extends Record<string, unknown> {
  id: string;
  size: { width: number; height: number };
  occupied: boolean[];
  tile?: Tile;
}
export const COLOR_KEYS: readonly string[];
export const FOLD_TYPES: readonly string[];
export const TERRAIN_TYPES: readonly string[];
export function hasColor(tile: Tile | null | undefined): boolean;
export function foldsOf(tile: Tile | null | undefined): string[];
export function blocked(tile: Tile | null | undefined): boolean;
export function tileHeight(tile: Tile | null | undefined): number;
export function tileThickness(tile: Tile | null | undefined): number;
export function tileGradualRate(tile: Tile | null | undefined): number;
export function normalizeTile(tile: Tile): Tile;
export function normalizePrefab(data: unknown): unknown;
export function columnLabel(column: number): string;
export function lineCells(map: { width: number; height: number }, row: number, column: number, type: string): Array<{ r: number; c: number }>;
export function normalizeFoldCells(data: unknown, width: number, height: number): Array<{ r: number; c: number; type: string }>;
export function foldsAt(map: { tiles: Array<Array<Tile | null>>; foldCells?: Array<{ r: number; c: number; type: string }> }, row: number, column: number): string[];
export function applyFoldLine(map: Record<string, unknown>, row: number, column: number, type: string): boolean;
