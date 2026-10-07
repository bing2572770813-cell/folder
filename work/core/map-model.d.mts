import type { Tile } from '../entities/tile-model.mjs';
export interface MapModel { version: number; width: number; height: number; tiles: Array<Array<Tile | null>>; [key: string]: unknown; }
export function validateMap(data: unknown, allowDraft?: boolean): MapModel;
