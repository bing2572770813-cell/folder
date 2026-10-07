import type { EntityNode, EntityWorld, GridTransform } from './tree-runtime.mjs';
export interface TreeProjection {
  version: number;
  width: number;
  height: number;
  tiles: Array<Array<Record<string, unknown> | null>>;
  foldCells: Array<{ r: number; c: number; type: string }>;
  [key: string]: unknown;
}
export class TreeDocument {
  world: EntityWorld;
  metadata: Record<string, unknown>;
  cellTags: Record<string, Record<string, unknown>>;
  constructor(input: Record<string, unknown>);
  clone(): TreeDocument;
  cleanMetadata(map: Record<string, unknown>): Record<string, unknown>;
  cellNodes(nodes?: EntityNode[]): Map<string, EntityNode[]>;
  primaryAt(r: number, c: number): EntityNode | null;
  viewCells(cells: Array<{ r: number; c: number }>): Map<string, Record<string, unknown> | null>;
  view(options?: { runtime?: boolean }): TreeProjection;
  serialize(options?: Record<string, unknown>): Record<string, unknown>;
  applyProjection(input: TreeProjection): TreeProjection;
}
