import {TransformManager,type TransformNode} from './transform-manager.js';
import {EntityWorld} from './entity-world.js';
import {validateTerrainStacking} from './terrain-stacking.js';
import {jsonObject,type EntityNode,type JsonObject} from './entity-model.js';

export interface TreeMap {version:2;width:number;height:number;entities:EntityNode[];transforms:TransformNode[];cellTags:Record<string,JsonObject>;legacyMetadata:JsonObject}
interface LegacyTile {
  prefabId?:string;instance?:{id:string};height?:number;thickness?:number;gradualRate?:number;color?:string;edgeColor?:string;
  blocked?:boolean;terrain?:string;terrainConfig?:JsonObject;keyName?:string;regionTag?:string;tags?:JsonObject;folds?:string[];fold?:string|null;
}
interface LegacyMap {width:number;height:number;tiles:(LegacyTile|null)[][];foldCells?:{r:number;c:number;type:string}[];[key:string]:unknown}

/** Compatibility import. Each surviving legacy instance cell retains its own property snapshot. */
export function legacyMapToTree(map:LegacyMap):TreeMap {
  if(!Array.isArray(map.tiles)||map.tiles.length!==map.height||map.tiles.some(row=>row.length!==map.width))throw new Error('Invalid legacy grid');
  const entities:EntityNode[]=[];const transforms:TransformNode[]=[];
  const cellTags:Record<string,JsonObject>={};
  const footprint={width:1,height:1,occupied:[true]};
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){
    const tile=map.tiles[r][c];if(!tile)continue;
    const id=`entity-${r}-${c}`,transformId=`transform-${r}-${c}`;
    transforms.push({id:transformId,parentId:null,local:{r,c,dir:0},footprint:structuredClone(footprint)});
    const surface:JsonObject={height:tile.height??.09,thickness:tile.thickness??tile.height??.09,gradualRate:tile.gradualRate??2/3};
    if(tile.color!==undefined)surface.color=tile.color;if(tile.edgeColor!==undefined)surface.edgeColor=tile.edgeColor;
    const components:Record<string,JsonObject>={surface,collision:{blocked:tile.blocked??tile.color==='black'}};
    if(tile.terrain==='fire')components.fire={...tile.terrainConfig,damage:tile.terrainConfig?.damage??1};
    else if(tile.terrain==='key')components.key={...tile.terrainConfig,name:tile.keyName??'钥匙'};
    else if(tile.terrain)components[tile.terrain]={...tile.terrainConfig};
    const directions=tile.folds??(tile.fold?[tile.fold]:[]);if(directions.length)components.fold={directions:[...directions]};
    cellTags[r+','+c]={regionTag:tile.regionTag??'默认区域'};
    const {regionTag:ignoredRegion,instance:ignoredInstance,...configuration}=tile;
    const prefabId=tile.prefabId==='large_paper_ai'?'paper_ai':tile.prefabId??'paper_ai';
    if(configuration.prefabId==='large_paper_ai')configuration.prefabId='paper_ai';
    entities.push({id,prefabId,transformId,components,tags:{...tile.tags},static:{},configuration:jsonObject(configuration)});
  }
  const virtual=new Map<string,EntityNode>();
  for(const fold of map.foldCells??[]){
    const existing=entities.find(node=>node.id===`entity-${fold.r}-${fold.c}`);
    if(existing){const directions=(existing.components.fold?.directions??[]) as string[];existing.components.fold={directions:[...new Set([...directions,fold.type])]};continue;}
    const key=fold.r+','+fold.c;let node=virtual.get(key);
    if(!node){
      const id=`void-fold-${fold.r}-${fold.c}`;node={id,prefabId:'void_ai',transformId:id+'-transform',components:{collision:{blocked:true},fold:{directions:[]}},tags:{},static:{placeable:false,transparent:true}};
      virtual.set(key,node);entities.push(node);transforms.push({id:node.transformId,parentId:null,local:{r:fold.r,c:fold.c,dir:0},footprint:structuredClone(footprint)});
    }
    node.components.fold.directions=[...new Set([...(node.components.fold.directions as string[]),fold.type])];
  }
  const {tiles:ignoredTiles,foldCells:ignoredFolds,...metadata}=map;
  const tree:TreeMap={version:2,width:map.width,height:map.height,entities,transforms,cellTags,legacyMetadata:jsonObject(metadata)};
  loadTree(tree);return tree;
}
export function loadTree(tree:TreeMap):EntityWorld {
  if(tree.version!==2)throw new Error('Unsupported tree map version');
  const world=new EntityWorld(new TransformManager(tree.width,tree.height,tree.transforms),tree.entities);
  validateTerrainStacking(world);
  return world;
}
