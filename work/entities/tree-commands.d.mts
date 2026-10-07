import type { EntityNode, GridTransform } from './tree-runtime.mjs';
import type { TreeDocument, TreeProjection } from './tree-document.mjs';
export interface PrefabRecord extends Record<string, unknown> {
  id: string;
  size: { width: number; height: number };
  occupied: boolean[];
}
export interface TreeCommandOptions extends Record<string, unknown> {
  isHidden?: (r: number, c: number) => boolean;
  nodeHidden?: (node: EntityNode) => boolean;
  resolve?: (id: string) => PrefabRecord | undefined;
  validate?: boolean;
  stack?: boolean;
}
export function forkTreeDocument(document: TreeDocument): TreeDocument;
export function renameTreeKeys(document: TreeDocument, cells: Array<{ r: number; c: number }>, name: string, options?: TreeCommandOptions): TreeDocument;
export function validateTreeDocument(candidate: TreeDocument): TreeDocument;
export function configureNode(document: TreeDocument, id: string, components: Record<string, unknown>, tags: Record<string, unknown>, isHidden?: (r: number, c: number) => boolean, nodeHidden?: (node: EntityNode) => boolean, schema?: unknown): TreeDocument;
export function moveNode(document: TreeDocument, id: string, local: GridTransform, isHidden?: (r: number, c: number) => boolean, nodeHidden?: (node: EntityNode) => boolean): TreeDocument;
export function reparentNode(document: TreeDocument, id: string, parentId: string | null, preserveWorld?: boolean, isHidden?: (r: number, c: number) => boolean, nodeHidden?: (node: EntityNode) => boolean): TreeDocument;
export function deleteNode(document: TreeDocument, id: string, isHidden?: (r: number, c: number) => boolean, nodeHidden?: (node: EntityNode) => boolean): TreeDocument;
export function replaceTreePrefab(document: TreeDocument, prefab: PrefabRecord, tile: Record<string, unknown>, r: number, c: number, options?: TreeCommandOptions): TreeDocument;
export function placeTreePrefab(document: TreeDocument, prefab: PrefabRecord, tile: Record<string, unknown>, r: number, c: number, options?: TreeCommandOptions): TreeDocument;
export function placeCategorizedPrefab(document: TreeDocument, prefab: PrefabRecord, tile: Record<string, unknown>, r: number, c: number, options?: TreeCommandOptions): TreeDocument;
