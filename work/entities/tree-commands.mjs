import {TreeDocument} from './tree-document.mjs';
import {importTreeMap,defaultComponents} from './tree-runtime.mjs';
import {normalizeTile} from './tile-model.mjs';
import {normalizeBaseEntity,createEntityBehavior} from './behaviors.mjs';

const copy=value=>structuredClone(value);
const merge=(a={},b={})=>{const result=copy(a);for(const [key,value] of Object.entries(b))result[key]=value&&typeof value==='object'&&!Array.isArray(value)&&result[key]&&typeof result[key]==='object'&&!Array.isArray(result[key])?merge(result[key],value):copy(value);return result;};
function fork(document){
  const candidate=new TreeDocument(document.serialize());candidate.world.restoreRuntime(document.world.snapshotRuntime());
  const owners=new Set(document.world.serialize().map(node=>'entity:'+node.id));
  for(const transform of document.world.transforms.serialize())for(const owner of document.world.transforms.referenceOwners(transform.id))if(!owners.has(owner))candidate.world.transforms.retain(transform.id,owner);
  return candidate;
}
function subtree(world,id){return [id,...world.transforms.childrenOf(id).flatMap(child=>subtree(world,child))];}
function check(world,ids,isHidden=()=>false,nodeHidden=()=>false){
  const selected=new Set(ids);
  for(const node of world.serialize())if(selected.has(node.transformId)&&nodeHidden(node))throw new Error('不能修改隐藏实体');
  for(const id of ids)for(const cell of world.transforms.worldCells(id))if(isHidden(cell.r,cell.c))throw new Error('不能修改隐藏区域');
}
function validate(candidate){const registry=defaultComponents();for(const node of candidate.world.serialize())registry.validate(node);return candidate;}
export function moveNode(document,id,local,isHidden=()=>false,nodeHidden=()=>false){
  const transform=document.world.get(id).transformId,ids=subtree(document.world,transform);check(document.world,ids,isHidden,nodeHidden);
  const candidate=fork(document);candidate.world.transforms.setLocal(transform,local);check(candidate.world,ids,isHidden,nodeHidden);return validate(candidate);
}
export function reparentNode(document,id,parentId,preserveWorld=true,isHidden=()=>false,nodeHidden=()=>false){
  const transform=document.world.get(id).transformId,parent=parentId===null?null:document.world.get(parentId).transformId,ids=subtree(document.world,transform);check(document.world,ids,isHidden,nodeHidden);if(parent)check(document.world,[parent],isHidden,nodeHidden);
  const candidate=fork(document);candidate.world.transforms.setParent(transform,parent,preserveWorld);check(candidate.world,ids,isHidden,nodeHidden);return validate(candidate);
}
export function deleteNode(document,id,isHidden=()=>false,nodeHidden=()=>false){
  const node=document.world.get(id);check(document.world,[node.transformId],isHidden,nodeHidden);document.world.transforms.assertRemovable(node.transformId,['entity:'+id]);
  const candidate=fork(document);candidate.world.remove(id,true);return validate(candidate);
}
export function placeTreePrefab(document,prefab,tile,r,c,options={}){
  if(options.stack!==true)throw new Error('树实体放置需要显式启用叠层');
  const candidate=fork(document),registry=defaultComponents(),resolve=options.resolve;
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
    node.id='entity-'+uuid;node.transformId=transformId;node.components=merge(node.components,record.components);node.tags=merge(record.tags,normalized.tags);node.static=copy(record.static??{});node.configuration=copy(normalized);delete node.configuration.regionTag;registry.validate(node);
    const size=record.size??{width:1,height:1},occupied=record.occupied??Array(size.width*size.height).fill(true);
    candidate.world.transforms.create({id:transformId,parentId,local,footprint:{...size,occupied:copy(occupied)}});
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
  instantiate(prefab,tile,{r,c,dir:0});return validate(candidate);
}
