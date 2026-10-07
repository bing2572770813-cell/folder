import type { Prefab, Tile } from './tile-model.mjs';
export function footprint(prefab: Prefab, r: number, c: number): Array<{ r: number; c: number }>;
export function placeEntity(map: Record<string, unknown>, prefab: Prefab, tile: Tile, r: number, c: number, isHidden?: (r: number, c: number) => boolean): { map: Record<string, unknown>; cells: Array<{ r: number; c: number }> };
export function removeEntity(map: { tiles: Array<Array<Record<string, unknown> | null>> }, r: number, c: number, isHidden?: (r: number, c: number) => boolean): Array<{ r: number; c: number }>;
