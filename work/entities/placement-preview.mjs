import {TreeDocument} from './tree-document.mjs';
import {TransformManager,EntityWorld} from './tree-runtime.mjs';
import {placeCategorizedPrefab} from './tree-commands.mjs';
import {entityCategory} from './entity-category.mjs';

const copy=value=>structuredClone(value);
const merge=(a={},b={})=>{const result=copy(a);for(const [key,value] of Object.entries(b))result[key]=value&&typeof value==='object'&&!Array.isArray(value)&&result[key]&&typeof result[key]==='object'&&!Array.isArray(result[key])?merge(result[key],value):copy(value);return result;};
function resolveRecord(record,resolve,seen=new Set()){
 if(seen.has(record.id))throw new Error('Prefab inheritance cycle');seen.add(record.id);
 if(!record.extends)return record;
 const parent=resolve?.(record.extends);if(!parent)throw new Error('Unknown prefab: '+record.extends);
 const result=merge(resolveRecord(parent,resolve,seen),record);delete result.extends;return result;
}

/** Include every child footprint before executing the shared placement rules locally. */
export function previewFootprint(prefab,r,c,resolve){
 const cells=new Map();
 function visit(raw,r,c,ancestry=new Set()){
  const record=resolveRecord(raw,resolve);if(ancestry.has(record.id))throw new Error('Prefab child cycle');
  const chain=new Set(ancestry).add(record.id),size=record.size??{width:1,height:1},occupied=record.occupied??Array(size.width*size.height).fill(true);
  occupied.forEach((on,i)=>{if(on){const cell={r:r+Math.floor(i/size.width),c:c+i%size.width};cells.set(cell.r+','+cell.c,cell);}});
  for(const child of record.children??[]){const childRecord=child.prefabId?resolve?.(child.prefabId):child.prefab??child;if(!childRecord)throw new Error('Unknown child prefab: '+child.prefabId);const local=child.local??{r:0,c:0};visit(merge(childRecord,child.overrides??{}),r+local.r,c+local.c,chain);}
 }
 visit(prefab,r,c);return [...cells.values()];
}

/** Snapshot only placement cells, removal descendants and unique-tag owners. */
export function previewPlacement(document,prefab,tile,r,c,options={}){
 const source=document.world,transforms=source.transforms,cells=previewFootprint(prefab,r,c,options.resolve);
 const nodes=new Map(),selected=new Set(),records=new Map(),cellTags={};
 function select(id,descendants=false){
  if(!selected.has(id)){
   selected.add(id);
   for(const cell of transforms.worldCells(id))for(const node of source.at(cell.r,cell.c))if(node.transformId===id)nodes.set(node.id,node);
  }
  if(descendants)for(const child of transforms.childrenOf(id))select(child,true);
 }
 for(const cell of [...cells,...(options.tagCells??[])])for(const node of source.at(cell.r,cell.c))select(node.transformId);
 if(entityCategory(prefab)==='terrain')for(const cell of cells)for(const node of source.at(cell.r,cell.c))select(node.transformId,true);
 function include(id){if(records.has(id))return;const record=transforms.get(id);records.set(id,record);if(record.parentId!==null)include(record.parentId);}
 for(const id of selected)include(id);
 const localTransforms=new TransformManager(transforms.width,transforms.height,[...records.values()]),world=new EntityWorld(localTransforms,[...nodes.values()]);
 for(const id of records.keys())for(const owner of transforms.referenceOwners(id))localTransforms.retain(id,owner);
 for(const node of nodes.values())for(const cell of transforms.worldCells(node.transformId)){
  const key=cell.r+','+cell.c;if(document.cellTags[key])cellTags[key]=copy(document.cellTags[key]);
 }
 for(const cell of cells){const key=cell.r+','+cell.c;if(document.cellTags[key])cellTags[key]=copy(document.cellTags[key]);}
 const local=Object.create(TreeDocument.prototype);local.world=world;local.metadata=copy(document.metadata);local.cellTags=cellTags;
 return {source:local,candidate:placeCategorizedPrefab(local,prefab,tile,r,c,options),cells};
}
