export interface Cell { r: number; c: number; }
export function inspectionCells(map: { tiles: unknown[][]; height: number; width: number }, selected: Cell[]): Cell[];
export function selectionDetails(map: { tiles: unknown[][]; height: number; width: number }, direct: Cell[], isHidden?: (r: number, c: number) => boolean): { direct: Cell[]; cells: Cell[]; linked: Cell[] };
export function batchProperties(entries: unknown[]): { values: Record<string, unknown>; schema: Record<string, unknown>; mixed: Set<string> };
