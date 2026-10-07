import type {EntityWorld} from './entity-world.js';
import type {EntityNode} from './entity-model.js';

export const terrainComponents = ['campfire', 'ice', 'fire', 'eruption', 'rayEmitter', 'foldSwitch'] as const;
export function isTerrainEntity(node:EntityNode):boolean {
  return terrainComponents.some(id => Object.hasOwn(node.components, id));
}

/** Physical tile rules are independent of parenting, visibility and collection items. */
export function validateTerrainStacking(world:EntityWorld,nodes:EntityNode[]=world.serialize()):void {
  const byCell=new Map<string,EntityNode[]>();
  for (const node of nodes) {
    if(Object.hasOwn(node.components,'lift')&&!Object.hasOwn(node.components,'surface'))throw new Error('升降组件必须属于纸张实体：'+node.id);
    const footprint=world.transforms.get(node.transformId).footprint;
    if(node.components.fragile&&!node.components.surface)throw new Error('易碎组件必须属于单格纸张本体');
    if((node.components.rayEmitter||node.components.foldSwitch)&&(footprint.width!==1||footprint.height!==1||footprint.occupied.filter(Boolean).length!==1))throw new Error('方向喷射和折线开关方块只能占一个方格');
    if(node.components.foldSwitch){
      for(const {r,c} of world.transforms.worldCells(node.transformId)){const folds=new Set(world.at(r,c).flatMap(owner=>(owner.components.fold?.directions??[]) as string[]));if(folds.size!==1)throw new Error('折线开关方块必须位于恰好一条折线上');}
    }
    if(Object.hasOwn(node.components,'surface')&&(footprint.width!==1||footprint.height!==1))throw new Error('纸张实体只能占一个方格：'+node.id);
    if (terrainComponents.filter(id => Object.hasOwn(node.components, id)).length > 1)
      throw new Error('同一实体不能同时包含多种地形：' + node.id);
    for (const {r, c} of world.transforms.worldCells(node.transformId)) {
      const key = r + ',' + c, nodes=byCell.get(key)??[];
      nodes.push(node);byCell.set(key,nodes);
    }
  }
  for (const [key,nodes] of byCell) {
      if(nodes.some(item=>item.static.entityType==='terrain')){
        const terrainCount=nodes.filter(item=>item.static.entityType==='terrain'||(item.static.entityType===undefined&&(Object.hasOwn(item.components,'surface')||isTerrainEntity(item)))).length;
        if(terrainCount>1)throw new Error('所有地形（包括纸张）互斥：'+key);
      }
      const papers = nodes.filter(item => Object.hasOwn(item.components, 'surface')).length;
      const terrains = nodes.filter(isTerrainEntity).length;
      if (papers > 1) throw new Error('同一方格不能叠加多个纸张实体：' + key);
      if (terrains && !papers) throw new Error('地形必须由纸张方格承载：' + key);
      if (terrains > 1)
        throw new Error('纸张方格上最多只能叠加一个 terrain 实体：' + key);
  }
  return {nodes:snapshot,byCell};
}
