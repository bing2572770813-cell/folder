export interface GridTransform { r: number; c: number; dir: number; }
export interface Footprint { width: number; height: number; occupied: boolean[]; }
export interface TransformNode { id: string; parentId: string | null; local: GridTransform; footprint: Footprint; }
export interface EntityNode {
  id: string;
  prefabId: string;
  transformId: string;
  components: Record<string, Record<string, unknown>>;
  tags: Record<string, unknown>;
  static: Record<string, unknown>;
  configuration?: Record<string, unknown>;
}
export interface TransformManager {
  readonly width: number;
  readonly height: number;
  get(id: string): TransformNode;
  clone(): TransformManager;
  serialize(): TransformNode[];
  childrenOf(id: string): string[];
  world(id: string): GridTransform;
  worldCells(id: string): Array<{ r: number; c: number }>;
  at(r: number, c: number): string[];
  referenceOwners(id: string): string[];
  retain(id: string, owner: string): void;
  release(id: string, owner: string): void;
  create(node: TransformNode): void;
  setLocal(id: string, local: GridTransform): void;
  setParent(id: string, parentId: string | null, preserveWorld?: boolean): void;
  remove(id: string): void;
}
export interface EntityWorld {
  readonly transforms: TransformManager;
  clone(): EntityWorld;
  has(id: string): boolean;
  get(id: string): EntityNode;
  serialize(): EntityNode[];
  definitions(): EntityNode[];
  setSpawnedEntities(ids: Set<string> | null): void;
  replaceRuntimeEntities(nodes: EntityNode[]): void;
  snapshotReplacements(): EntityNode[];
  at(r: number, c: number): EntityNode[];
  cells(id: string): Array<{ r: number; c: number }>;
  forTransform(id: string): EntityNode[];
  add(node: EntityNode): void;
  remove(id: string, removeTransform?: boolean): void;
  runtime(id: string, component: string): Record<string, unknown>;
  setRuntime(id: string, component: string, state: Record<string, unknown>): void;
  snapshotRuntime(): Record<string, Record<string, Record<string, unknown>>>;
  restoreRuntime(snapshot: Record<string, Record<string, Record<string, unknown>>>): void;
}
export function importTreeMap(input: Record<string, unknown>): { world: EntityWorld; metadata: Record<string, unknown>; cellTags: Record<string, Record<string, unknown>> };
export function serializeTreeMap(world: EntityWorld, metadata: Record<string, unknown>, cellTags: Record<string, Record<string, unknown>>, options?: Record<string, unknown>): Record<string, unknown>;
export function defaultComponents(): unknown;
export function validateTerrainStacking(world: EntityWorld, nodes: EntityNode[]): void;
