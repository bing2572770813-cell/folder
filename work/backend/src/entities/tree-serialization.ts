import {EntityWorld} from './entity-world.js';
import {jsonObject,type JsonObject} from './entity-model.js';
import {legacyMapToTree,loadTree,type TreeMap} from './legacy-map.js';

export interface ImportedTree {world:EntityWorld;metadata:JsonObject}

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
  return {world,metadata:jsonObject(tree.legacyMetadata)};
}

export function serializeTreeMap(world:EntityWorld,metadata:JsonObject={}):TreeMap {
  return {
    version:2,width:world.transforms.width,height:world.transforms.height,
    entities:world.serialize(),transforms:world.transforms.serialize(),legacyMetadata:jsonObject(metadata),
  };
}
