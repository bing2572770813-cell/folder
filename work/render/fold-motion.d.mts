export function tabletopHeight(map: unknown, hidden?: (r: number, c: number) => boolean): number;
export function createFoldMotionView(options: Record<string, unknown>): Record<string, unknown>;
export function clipFoldPolygon(vertices: unknown, distance: number, positive: boolean): unknown;
export function hingeFor(map: unknown, group: unknown, wx: (c: number) => number, wz: (r: number) => number, tableHeight?: number): unknown;
