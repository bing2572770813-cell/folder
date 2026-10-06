import type {EntityWorld} from './entity-world.js';
import type {EntityNode} from './entity-model.js';

export const terrainComponents = ['campfire', 'ice', 'fire', 'eruption'] as const;
export function isTerrainEntity(node:EntityNode):boolean {
  return terrainComponents.some(id => Object.hasOwn(node.components, id));
}

/** Physical tile rules are independent of parenting, visibility and collection items. */
export function validateTerrainStacking(world:EntityWorld):void {
  const checked = new Set<string>();
  for (const node of world.serialize()) {
    if(Object.hasOwn(node.components,'lift')&&!Object.hasOwn(node.components,'surface'))throw new Error('升降组件必须属于纸张实体：'+node.id);
    const footprint=world.transforms.get(node.transformId).footprint;
    if(Object.hasOwn(node.components,'surface')&&(footprint.width!==1||footprint.height!==1))throw new Error('纸张实体只能占一个方格：'+node.id);
    if (terrainComponents.filter(id => Object.hasOwn(node.components, id)).length > 1)
      throw new Error('同一实体不能同时包含多种地形：' + node.id);
    for (const {r, c} of world.transforms.worldCells(node.transformId)) {
      const key = r + ',' + c;
      if (checked.has(key)) continue;
      checked.add(key);
      const nodes = world.at(r, c);
      const papers = nodes.filter(item => Object.hasOwn(item.components, 'surface')).length;
      const terrains = nodes.filter(isTerrainEntity).length;
      if (papers > 1) throw new Error('同一方格不能叠加多个纸张实体：' + key);
      if (terrains && !papers) throw new Error('地形必须由纸张方格承载：' + key);
      if (terrains > 1)
        throw new Error('纸张方格上最多只能叠加一个 terrain 实体：' + key);
    }
  }
}
