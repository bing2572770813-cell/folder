import {EntityWorld} from './entity-world.js';
import {jsonObject,type JsonObject} from './entity-model.js';
import {legacyMapToTree,loadTree,type TreeMap} from './legacy-map.js';

export interface ImportedTree {world:EntityWorld;metadata:JsonObject;cellTags:Record<string,JsonObject>}

/** JSON boundary shared by future browser import/export adapters and backend tooling. */
export function importTreeMap(input:unknown):ImportedTree {
  const data=jsonObject(input);
  if(!Number.isInteger(data.width)||!Number.isInteger(data.height)||Number(data.width)<3||Number(data.width)>128||Number(data.height)<3||Number(data.height)>128)throw new Error('Map dimensions must be 3–128');
  let tree:TreeMap;
  if(data.version===1){
    // Legacy conversion validates grid shape; browser normalization remains responsible for old field semantics.
    tree=legacyMapToTree(data as unknown as Parameters<typeof legacyMapToTree>[0]);
  }else if(data.version===2){
    if(!Array.isArray(data.entities)||!Array.isArray(data.transforms))throw new Error('Tree map requires entity and transform arrays');
    tree=data as unknown as TreeMap;
    tree.legacyMetadata=jsonObject(tree.legacyMetadata??{});
  }else throw new Error('Unsupported map version');
  const world=loadTree(tree);
  const cellTags:Record<string,JsonObject>={};
  for(const [key,value] of Object.entries(jsonObject(tree.cellTags??{}))){
    const match=/^(\d+),(\d+)$/.exec(key);
    if(!match||Number(match[1])>=tree.height||Number(match[2])>=tree.width)throw new Error('Invalid cell tag coordinates');
    const tags=jsonObject(value);
    if(tags.regionTag!==undefined&&(typeof tags.regionTag!=='string'||!tags.regionTag.trim()||tags.regionTag.length>80))throw new Error('Invalid cell regionTag');
    cellTags[key]=tags;
  }
  return {world,metadata:jsonObject(tree.legacyMetadata),cellTags};
}

export function serializeTreeMap(world:EntityWorld,metadata:JsonObject={},cellTags:Record<string,JsonObject>={}):TreeMap {
  return {
    version:2,width:world.transforms.width,height:world.transforms.height,
    entities:world.serialize(),transforms:world.transforms.serialize(),cellTags:structuredClone(cellTags),legacyMetadata:jsonObject(metadata),
  };
}
