import type { Tile, Prefab } from './tile-model.mjs';
export function entityType(tile: Tile | null | undefined): string;
export function entityChoices(prefabs: Prefab[], map: { tiles: Array<Array<Tile | null>> }): Prefab[];
export function entityHidden(tile: Tile | null | undefined, hidden: Set<string>): boolean;
