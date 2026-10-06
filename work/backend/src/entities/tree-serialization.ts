import {EntityWorld} from './entity-world.js';
import {jsonObject,type JsonObject} from './entity-model.js';
import {legacyMapToTree,loadTree,type TreeMap} from './legacy-map.js';
import {validateTerrainStacking} from './terrain-stacking.js';

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

export interface TreeSerializationOptions {
  /** Persistence boundaries supply core/property-model.mjs; omitted for complete editor snapshots. */
  projectProperties?:(values:JsonObject,schema:JsonObject,flag:'serializable')=>JsonObject;
  /** Resolve inherited/catalog permissions; defaults to the legacy configuration's propertySchema. */
  schemaFor?:(node:ReturnType<EntityWorld['serialize']>[number])=>JsonObject;
  /** Resolve cell permissions independently of movable entity configuration. */
  schemaForCell?:(r:number,c:number,tags:JsonObject)=>JsonObject;
}

export function serializeTreeMap(world:EntityWorld,metadata:JsonObject={},cellTags:Record<string,JsonObject>={},options:TreeSerializationOptions={}):TreeMap {
  validateTerrainStacking(world);
  const entities=world.serialize().map(node=>{
    const configuration=node.configuration;
    if(!options.projectProperties)return node;
    const schema=jsonObject(options.schemaFor?.(node)??configuration?.propertySchema??{});
    const project=(values:JsonObject)=>jsonObject(options.projectProperties!(values,schema,'serializable'));
    if(configuration){
      node.configuration=project(configuration);
      // These fields identify the legacy instance and its permission contract on import.
      for(const key of ['prefabId','instance','kind','terrain','propertySchema'])if(Object.hasOwn(configuration,key))node.configuration[key]=configuration[key];
      if(configuration.folds!==undefined){
        if(node.configuration.folds===undefined)delete node.configuration.fold;
        else if(Object.hasOwn(node.configuration,'fold'))node.configuration.fold=(node.configuration.folds as JsonObject['fold'][])[0]??null;
      }
    }
    const surface=node.components.surface;
    if(surface)node.components.surface=project(surface);
    const collision=node.components.collision;
    if(collision)node.components.collision=project(collision);
    const terrain=configuration?.terrain;
    if(typeof terrain==='string'&&node.components[terrain]){
      const component=node.components[terrain];
      const projected=project({terrainConfig:component});
      node.components[terrain]=projected.terrainConfig===undefined?{}:jsonObject(projected.terrainConfig);
      if(terrain==='key'&&Object.hasOwn(component,'name')){
        delete node.components.key.name;
        const name=project({keyName:component.name}).keyName;
        if(name!==undefined)node.components.key.name=name;
      }
    }
    if(node.components.fold){
      const directions=configuration?.folds===undefined&&configuration?.fold!==undefined
        ?(node.components.fold.directions as JsonObject['fold'][]).filter(direction=>project({fold:direction}).fold!==undefined)
        :project({folds:node.components.fold.directions}).folds;
      node.components.fold=directions===undefined?{}:{directions};
    }
    const tags=project({tags:node.tags}).tags;
    node.tags=tags===undefined?{}:jsonObject(tags);
    const components=project({components:node.components}).components;
    node.components=components===undefined?{}:jsonObject(components) as Record<string,JsonObject>;
    if(node.configuration){
      for(const field of ['height','thickness','gradualRate','color','edgeColor'])if(Object.hasOwn(node.configuration,field)&&!Object.hasOwn(node.components.surface??{},field))delete node.configuration[field];
      if(node.configuration.blocked!==undefined&&!Object.hasOwn(node.components.collision??{},'blocked'))delete node.configuration.blocked;
      if(typeof terrain==='string'&&node.configuration.terrainConfig!==undefined){const values=project({components:{[terrain]:node.configuration.terrainConfig}}).components;node.configuration.terrainConfig=values===undefined?{}:jsonObject(jsonObject(values)[terrain]??{});}
      if(terrain==='key'&&node.configuration.keyName!==undefined&&!Object.hasOwn(node.components.key??{},'name'))delete node.configuration.keyName;
    }
    return node;
  });
  const serializedCellTags=structuredClone(cellTags);
  if(options.projectProperties&&options.schemaForCell){
    for(const [key,tags] of Object.entries(serializedCellTags)){
      const [r,c]=key.split(',').map(Number);
      const schema=jsonObject(options.schemaForCell(r,c,structuredClone(tags)));
      serializedCellTags[key]=jsonObject(options.projectProperties(tags,schema,'serializable'));
    }
  }
  return {
    version:2,width:world.transforms.width,height:world.transforms.height,
    entities,transforms:world.transforms.serialize(),cellTags:serializedCellTags,legacyMetadata:jsonObject(metadata),
  };
}
