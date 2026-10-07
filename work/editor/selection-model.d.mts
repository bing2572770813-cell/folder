export interface Cell { r: number; c: number; [key: string]: unknown; }
export interface Rect { r: number; c: number; h: number; w: number; }
export function copy<T>(value: T): T;
export function contains(rect: Rect | null, cell: Cell): boolean;
export function rectangle(a: Cell, b: Cell): Rect;
export function region(map: { tiles: unknown[][]; foldCells?: Cell[] }, rect: Rect): unknown[][];
export function pasteRegion(map: Record<string, unknown>, tiles: unknown[][], r: number, c: number, isHidden?: (r: number, c: number) => boolean): { map: Record<string, unknown>; rect: Rect };
export function unionCells(base: Cell[], rect: Rect, isVisible?: (r: number, c: number) => boolean): Cell[];
export function cellBounds(cells: Cell[]): Rect | null;
export function selectionRegion(map: { tiles: unknown[][]; foldCells?: Cell[] }, cells: Cell[]): unknown[][];
