import {TreeDocument} from './tree-document.mjs';
import {importTreeMap,defaultComponents,validateTerrainStacking} from './tree-runtime.mjs';
import {normalizeTile} from './tile-model.mjs';
import {normalizeBaseEntity,createEntityBehavior} from './behaviors.mjs';
import {placeEntity} from './placement-model.mjs';
import {projectProperties,updateProperty,mergeSerializableProperties} from '../core/property-model.mjs';
import {legalKeyNames} from '../tags/keys.mjs';

const copy=value=>structuredClone(value);
const merge=(a={},b={})=>{const result=copy(a);for(const [key,value] of Object.entries(b))result[key]=value&&typeof value==='object'&&!Array.isArray(value)&&result[key]&&typeof result[key]==='object'&&!Array.isArray(result[key])?merge(result[key],value):copy(value);return result;};
export function forkTreeDocument(document){
  const candidate=new TreeDocument(document.serialize());candidate.world.restoreRuntime(document.world.snapshotRuntime());
  const owners=new Set(document.world.serialize().map(node=>'entity:'+node.id));
  for(const transform of document.world.transforms.serialize())for(const owner of document.world.transforms.referenceOwners(transform.id))if(!owners.has(owner))candidate.world.transforms.retain(transform.id,owner);
  return candidate;
}

/** Rename every selected key owner, then update references only when its old name disappears. */
export function renameTreeKeys(document,cells,name,{isHidden=()=>false,nodeHidden=()=>false,schemaFor=()=>({})}={}){
 name=name.trim();if(!name||name.length>80)throw new Error('钥匙名须为 1–80 字');
 const nodes=[...new Map(cells.flatMap(({r,c})=>document.world.at(r,c)).filter(node=>node.components.key).map(node=>[node.id,node])).values()];
 if(!nodes.length)throw new Error('先选择钥匙实体');
 let candidate=forkTreeDocument(document);const oldNames=new Set();
 for(const node of nodes){
  oldNames.add(String(node.components.key.name??'钥匙').trim());
  const components=copy(node.components);components.key.name=name;
  candidate=configureNode(candidate,node.id,components,node.tags,isHidden,nodeHidden,schemaFor(node));
 }
 const remaining=new Set(legalKeyNames(candidate.view(),candidate.world));
 for(const node of candidate.world.serialize())if(node.tags.requiredKeys){
  const keys=[...new Set(node.tags.requiredKeys.map(key=>oldNames.has(key)&&!remaining.has(key)?name:key))];
  if(JSON.stringify(keys)!==JSON.stringify(node.tags.requiredKeys))candidate=configureNode(candidate,node.id,node.components,{...node.tags,requiredKeys:keys},isHidden,nodeHidden,schemaFor(node));
 }
 return candidate;
}
function subtree(world,id){return [id,...world.transforms.childrenOf(id).flatMap(child=>subtree(world,child))];}
function check(world,ids,isHidden=()=>false,nodeHidden=()=>false){
  const selected=new Set(ids);
  for(const node of world.serialize())if(selected.has(node.transformId)&&nodeHidden(node))throw new Error('不能修改隐藏实体');
  for(const id of ids)for(const cell of world.transforms.worldCells(id))if(isHidden(cell.r,cell.c))throw new Error('不能修改隐藏区域');
}
export function validateTreeDocument(candidate){validateTerrainStacking(candidate.world);const registry=defaultComponents();for(const node of candidate.world.serialize()){registry.validate(node);if(Object.hasOwn(node.tags,'regionTag'))throw new Error('区域标签只能属于地图格');}const map=candidate.view(),spawns=[],entries=new Map();for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){const tags={};for(const node of candidate.world.at(r,c))for(const [key,value] of Object.entries(node.tags)){if(key!=='requiredKeys'&&Object.hasOwn(tags,key)&&JSON.stringify(tags[key])!==JSON.stringify(value))throw new Error('Conflicting entity tag: '+key);tags[key]=value;}if(tags.spawn)spawns.push(r+','+c);if(tags.entry){const region=candidate.cellTags[r+','+c]?.regionTag??'默认区域';if(entries.has(region))throw new Error('区域只能有一个入口：'+region);entries.set(region,true);}}if(spawns.length>1)throw new Error('只能有一个玩家起点');for(const key of spawns)if(entries.has(candidate.cellTags[key]?.regionTag??'默认区域'))throw new Error('同一区域不能同时包含玩家起点与区域入口');return candidate;}
export function configureNode(document,id,components,tags,isHidden=()=>false,nodeHidden=()=>false,schema){
 const original=document.world.get(id);check(document.world,[original.transformId],isHidden,nodeHidden);
 const footprint=document.world.transforms.get(original.transformId).footprint;
 if(Object.hasOwn(components,'surface')&&(footprint.width!==1||footprint.height!==1))throw new Error('纸张实体只能占一个方格');
 if(schema){
  const before={components:original.components,tags:original.tags},readable=projectProperties(before,schema,'readable');
  const preserve=(raw,shown,edited)=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))return edited;const next=copy(edited??{});for(const key of Object.keys(raw)){if(!Object.hasOwn(shown??{},key))next[key]=copy(raw[key]);else if(raw[key]&&typeof raw[key]==='object'&&!Array.isArray(raw[key])&&Object.hasOwn(next,key))next[key]=preserve(raw[key],shown[key],next[key]);}return next;};
  let edited=updateProperty(before,schema,['components'],preserve(before.components,readable.components,components));edited=updateProperty(edited,schema,['tags'],preserve(before.tags,readable.tags,tags));const stable=mergeSerializableProperties(before,edited,schema);components=stable.components;tags=stable.tags;
 }
 const snapshot=document.serialize(),node=snapshot.entities.find(item=>item.id===id);node.components=copy(components);node.tags=copy(tags);const candidate=new TreeDocument(snapshot);const runtime=document.world.snapshotRuntime();for(const key of Object.keys(runtime[id]??{}))if(!Object.hasOwn(components,key))delete runtime[id][key];candidate.world.restoreRuntime(runtime);const owners=new Set(document.world.serialize().map(item=>'entity:'+item.id));for(const transform of document.world.transforms.serialize())for(const owner of document.world.transforms.referenceOwners(transform.id))if(!owners.has(owner))candidate.world.transforms.retain(transform.id,owner);return validateTreeDocument(candidate);
}
export function moveNode(document,id,local,isHidden=()=>false,nodeHidden=()=>false){
  const transform=document.world.get(id).transformId,ids=subtree(document.world,transform);check(document.world,ids,isHidden,nodeHidden);
  const candidate=forkTreeDocument(document);candidate.world.transforms.setLocal(transform,local);check(candidate.world,ids,isHidden,nodeHidden);return validateTreeDocument(candidate);
}
export function reparentNode(document,id,parentId,preserveWorld=true,isHidden=()=>false,nodeHidden=()=>false){
  const transform=document.world.get(id).transformId,parent=parentId===null?null:document.world.get(parentId).transformId,ids=subtree(document.world,transform);check(document.world,ids,isHidden,nodeHidden);if(parent)check(document.world,[parent],isHidden,nodeHidden);
  const candidate=forkTreeDocument(document);candidate.world.transforms.setParent(transform,parent,preserveWorld);check(candidate.world,ids,isHidden,nodeHidden);return validateTreeDocument(candidate);
}
export function deleteNode(document,id,isHidden=()=>false,nodeHidden=()=>false){
  const node=document.world.get(id);check(document.world,[node.transformId],isHidden,nodeHidden);document.world.transforms.assertRemovable(node.transformId,['entity:'+id]);
  const candidate=forkTreeDocument(document);candidate.world.remove(id,true);return validateTreeDocument(candidate);
}
/** Replacement changes the paper and its terrain, while collectible/tag overlays retain ownership. */
export function replaceTreePrefab(document,prefab,tile,r,c,options={}){
 const result=placeEntity(document.view(),prefab,tile,r,c,options.isHidden);
 const cells=new Set(result.cells.map(cell=>cell.r+','+cell.c));
 const targets=new Map(result.cells.flatMap(cell=>document.world.at(cell.r,cell.c)).map(node=>[node.id,node]));
 if([...targets.values()].some(node=>options.nodeHidden?.(node)))throw new Error('不能覆盖隐藏实体');
 const candidate=forkTreeDocument(document);
 for(const node of targets.values()){
  if(Object.hasOwn(node.components,'surface'))continue;
  const terrains=['campfire','ice','fire','eruption'].filter(type=>Object.hasOwn(node.components,type));
  if(!terrains.length)continue;
  const occupied=candidate.world.transforms.worldCells(node.transformId);
  if(occupied.some(cell=>!cells.has(cell.r+','+cell.c)))throw new Error('不能部分替换多格地形，请选择完整占格');
  check(candidate.world,[node.transformId],options.isHidden,options.nodeHidden);
  for(const type of terrains)delete node.components[type];
  // Legacy terrain prefabs carry a default nonblocking collision alongside their marker.
  if(terrains.includes(node.configuration?.terrain)&&node.components.collision?.blocked===false&&Object.keys(node.components.collision).length===1)delete node.components.collision;
  if(node.configuration){delete node.configuration.terrain;delete node.configuration.terrainConfig;}
  if(!Object.keys(node.components).length&&!Object.keys(node.tags).length)candidate.world.remove(node.id,true);
  else{candidate.world.remove(node.id);candidate.world.add(node);}
 }
 candidate.applyLegacy(result.map);
 return validateTreeDocument(candidate);
}
export function placeTreePrefab(document,prefab,tile,r,c,options={}){
  if(options.stack!==true)throw new Error('树实体放置需要显式启用叠层');
  const candidate=forkTreeDocument(document),registry=defaultComponents(),resolve=options.resolve;
  const resolveRecord=(record,seen=new Set())=>{
    if(seen.has(record.id))throw new Error('Prefab inheritance cycle');seen.add(record.id);
    if(!record.extends)return copy(record);if(!resolve)throw new Error('Prefab inheritance requires catalog resolver');
    const parent=resolve(record.extends);if(!parent)throw new Error('Unknown prefab: '+record.extends);const result=merge(resolveRecord(parent,seen),record);delete result.extends;return result;
  };
  function instantiate(raw,configuration,local,parentId=null,ancestry=new Set()){
    const record=resolveRecord(raw);if(ancestry.has(record.id))throw new Error('Prefab child cycle');const chain=new Set(ancestry).add(record.id);
    if(record.static?.placeable===false||record.id==='void_ai')throw new Error('实体不可放置');
    const normalized=normalizeTile({...record.tile,...configuration,prefabId:record.id});delete normalized.instance;
    const seed={version:1,width:candidate.world.transforms.width,height:candidate.world.transforms.height,tiles:Array.from({length:candidate.world.transforms.height},()=>Array(candidate.world.transforms.width).fill(null))};seed.tiles[0][0]=normalized;
    const node=importTreeMap(seed).world.serialize()[0],uuid=globalThis.crypto.randomUUID(),transformId='transform-'+uuid;
    node.id='entity-'+uuid;node.transformId=transformId;node.components=merge(record.tile?node.components:{},record.components);node.tags=merge(record.tags,normalized.tags);node.static=copy(record.static??{});node.configuration=record.tile?copy(normalized):{prefabId:record.id,...(record.propertySchema?{propertySchema:copy(record.propertySchema)}:{})};delete node.configuration.regionTag;registry.validate(node);
    const size=record.size??{width:1,height:1},occupied=record.occupied??Array(size.width*size.height).fill(true);
    candidate.world.transforms.create({id:transformId,parentId,local,footprint:{...size,occupied:copy(occupied)}});
    // Legacy terrain/item prefabs include a paper surface; stacking reuses the destination paper.
    if(record.tile?.terrain&&candidate.world.transforms.worldCells(transformId).some(cell=>candidate.world.at(cell.r,cell.c).some(other=>Object.hasOwn(other.components,'surface'))))delete node.components.surface;
    check(candidate.world,[transformId],options.isHidden,options.nodeHidden);
    const bases=normalizeBaseEntity(record.BaseEntity);createEntityBehavior(record.behavior);
    for(const cell of candidate.world.transforms.worldCells(transformId)){
      const existing=candidate.world.at(cell.r,cell.c);
      if(existing.some(other=>options.nodeHidden?.(other)))throw new Error('不能覆盖隐藏实体');
      if(bases&&!(existing.length?existing.some(other=>bases.includes(other.prefabId)):bases.includes('void_ai')))throw new Error('实体不允许放置在目标实体上');
      const key=cell.r+','+cell.c;candidate.cellTags[key]??={regionTag:normalized.regionTag??'默认区域'};
    }
    candidate.world.add(node);check(candidate.world,[transformId],options.isHidden,options.nodeHidden);
    for(const child of record.children??[]){
      const childRecord=child.prefabId?(resolve?.(child.prefabId)):child.prefab??child;if(!childRecord)throw new Error('Unknown child prefab: '+child.prefabId);
      instantiate(merge(childRecord,child.overrides??{}),child.tile??{},child.local??{r:0,c:0,dir:0},transformId,chain);
    }
    return node.id;
  }
  instantiate(prefab,tile,{r,c,dir:0});return validateTreeDocument(candidate);
}
