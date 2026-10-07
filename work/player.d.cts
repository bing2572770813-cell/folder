export interface PlayerState {
  mode: 'edit' | 'play';
  player: { r: number; c: number; dir: number };
  steps: number;
  teleports: number;
  moving: boolean;
  turn: number;
  [key: string]: unknown;
}
export interface TurnManager {
  [key: string]: unknown;
}
export interface PlayerController {
  [key: string]: unknown;
}
export const Trigger: Record<string, string>;
export const TurnPhase: Record<string, string>;
export function playerPrefabDefaults(prefab?: unknown): Record<string, unknown>;
export function createTurnManager(options?: Record<string, unknown>): TurnManager;
export function createPlayerState(spawn: { r: number; c: number; dir: number }, mode: 'edit' | 'play'): PlayerState;
export function createPlayerController(options: Record<string, unknown>): PlayerController;
export function advanceLift(state: Record<string, unknown>, turns: number): Record<string, unknown>;
export function rayCells(origin: { r: number; c: number }, direction: number, width: number, height: number): Array<{ r: number; c: number }>;
export const initialLiftState: unknown;
