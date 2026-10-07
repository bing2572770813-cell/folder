export interface RenderCell { nodeId: string; r: number; c: number; [key: string]: unknown; }
export function renderTreeCells(document: unknown, options?: Record<string, unknown>): { surfaceCells: RenderCell[]; terrainCells: RenderCell[]; tagCells: RenderCell[]; tokenCells: RenderCell[] };
export function mapForSurface(document: unknown, nodeId: string, runtime?: boolean, baseMap?: Record<string, unknown> | null): Record<string, unknown>;
