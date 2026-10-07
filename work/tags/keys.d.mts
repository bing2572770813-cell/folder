export function keyNameOf(tile: Record<string, unknown> | null | undefined): string;
export function legalKeyNames(map: Record<string, unknown>, world?: unknown): string[];
export function renameKeyCells(map: Record<string, unknown>, cells: Array<{ r: number; c: number }>, name: string, isHidden?: (r: number, c: number) => boolean): Record<string, unknown>;
