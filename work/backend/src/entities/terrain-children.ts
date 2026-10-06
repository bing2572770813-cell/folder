import type {EntityWorld} from './entity-world.js';
import type {EntityNode} from './entity-model.js';

export const terrainComponents = ['campfire', 'ice', 'fire', 'eruption', 'key'] as const;
export function isTerrainEntity(node:EntityNode):boolean {
  return terrainComponents.some(id => Object.hasOwn(node.components, id));
}

/** Derived from the canonical Transform tree, never from same-cell occupancy. */
export function validateTerrainChildren(world:EntityWorld):void {
  const nodes = world.serialize();
  const paperTransforms = new Set(nodes.filter(node => Object.hasOwn(node.components, 'surface')).map(node => node.transformId));
  const counts = new Map<string, number>();
  for (const node of nodes) {
    if (!isTerrainEntity(node)) continue;
    const parent = world.transforms.get(node.transformId).parentId;
    if (parent === null || !paperTransforms.has(parent)) continue;
    const count = (counts.get(parent) ?? 0) + 1;
    if (count > 1) throw new Error('纸张实体最多只能有一个 terrain 子实体：' + parent);
    counts.set(parent, count);
  }
}

export function canAttachTerrain(world:EntityWorld, transformId:string, parentId:string|null):boolean {
  if (parentId === null) return true;
  const nodes = world.serialize();
  if (!nodes.some(node => node.transformId === parentId && Object.hasOwn(node.components, 'surface'))) return true;
  const moving = nodes.filter(node => node.transformId === transformId && isTerrainEntity(node)).length;
  const existing = nodes.filter(node => node.transformId !== transformId && isTerrainEntity(node)
    && world.transforms.get(node.transformId).parentId === parentId).length;
  return moving + existing <= 1;
}
