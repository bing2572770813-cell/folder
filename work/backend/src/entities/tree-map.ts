import {TransformManager,type TransformNode} from './transform-manager.js';
import {EntityWorld} from './entity-world.js';
import {validateTerrainStacking} from './terrain-stacking.js';
import type {EntityNode,JsonObject} from './entity-model.js';

export interface TreeMap {version:2;width:number;height:number;entities:EntityNode[];transforms:TransformNode[];cellTags:Record<string,JsonObject>;legacyMetadata:JsonObject}
export function loadTree(tree:TreeMap):EntityWorld {
  if(tree.version!==2)throw new Error('Unsupported tree map version');
  const world=new EntityWorld(new TransformManager(tree.width,tree.height,tree.transforms),tree.entities);
  validateTerrainStacking(world);
  return world;
}
