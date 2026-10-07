export const directions: Readonly<Record<string, { r: number; c: number }>>;
export function axisKey(axis: { type: string; r: number; c: number }): string;
export function uniqueFoldAxes(map: Record<string, unknown>): Array<Record<string, unknown>>;
export function foldGroupAt(groups: Array<Record<string, unknown>>, row: number, column: number, type: string): Record<string, unknown> | undefined;
export function foldDistance(group: Record<string, unknown> | undefined, point: { r: number; c: number }): number;
export function inFoldRange(group: Record<string, unknown> | undefined, point: { r: number; c: number }): boolean;
export function foldStrokes(group: Record<string, unknown>): Array<Array<{ r: number; c: number }>>;
