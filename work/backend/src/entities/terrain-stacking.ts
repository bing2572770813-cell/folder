import type {EntityWorld} from './entity-world.js';
import type {EntityNode} from './entity-model.js';

export const terrainComponents = ['campfire', 'ice', 'fire', 'eruption', 'key'] as const;
export function isTerrainEntity(node:EntityNode):boolean {
  return terrainComponents.some(id => Object.hasOwn(node.components, id));
}

/** Count terrain entities on paper tiles using TransformManager's actual occupancy. */
export function validateTerrainStacking(world:EntityWorld):void {
  const checked = new Set<string>();
  for (const paper of world.serialize()) {
    if (!Object.hasOwn(paper.components, 'surface')) continue;
    for (const {r, c} of world.transforms.worldCells(paper.transformId)) {
      const key = r + ',' + c;
      if (checked.has(key)) continue;
      checked.add(key);
      if (world.at(r, c).filter(isTerrainEntity).length > 1)
        throw new Error('纸张方格上最多只能叠加一个 terrain 实体：' + key);
    }
  }
}
