export const TERRAIN_TYPES: readonly string[];
export interface TerrainState { collectedKeys: string[]; hasKey: boolean; frozen: boolean; overheat: number; actions: number; gameOver: boolean; won: boolean; message: string; flames: unknown[]; [key: string]: unknown; }
export function createTerrainState(): TerrainState;
export function canEnterTerrain(map: Record<string, unknown>, position: { r: number; c: number }, state?: TerrainState): { valid: boolean; reason: string };
export function enterTerrain(map: Record<string, unknown>, position: { r: number; c: number }, state?: TerrainState): { state: TerrainState; valid: boolean; gameOver: boolean; won: boolean };
export function finishAction(state?: TerrainState): TerrainState;
export function validateTerrains(map: Record<string, unknown>): string[];
