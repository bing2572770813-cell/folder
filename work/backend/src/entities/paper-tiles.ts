import {TransformManager,type GridTransform} from './transform-manager.js';
import type {TreeMap} from './legacy-map.js';

/** Import-only conversion. Explicit hierarchy and non-paper footprints retain their world positions. */
export function migratePaperTiles(input:TreeMap):TreeMap {
 const tree=structuredClone(input),original=new TransformManager(tree.width,tree.height,tree.transforms);
 const desired=new Map<string,GridTransform>(tree.transforms.map(node=>[node.id,original.world(node.id)]));
 const ids=new Set(tree.transforms.map(node=>node.id)),entityIds=new Set(tree.entities.map(node=>node.id));
 const fresh=(base:string,set:Set<string>)=>{let i=1,id='';do{id=base.slice(0,70)+'-tile-'+i++;}while(set.has(id));set.add(id);return id;};
 const papers=tree.entities.filter(node=>Object.hasOwn(node.components,'surface'));
 const groups=new Map(papers.map(node=>[node.transformId,node.configuration?.instance]));
 const overlayTransforms=new Map<string,string>();
 for(const node of papers){
  const transform=tree.transforms.find(item=>item.id===node.transformId)!;
  const previous=original.get(node.transformId),cells=original.worldCells(node.transformId),world=original.world(node.transformId);
  const group=node.configuration?.instance,parentGroup=previous.parentId?groups.get(previous.parentId):undefined;
  if(group&&typeof group==='object'&&!Array.isArray(group)&&parentGroup&&typeof parentGroup==='object'&&!Array.isArray(parentGroup)&&group.id===parentGroup.id)transform.parentId=null;
  if(node.configuration)delete node.configuration.instance;
  if(node.prefabId==='large_paper_ai'){node.prefabId='paper_ai';if(node.configuration)node.configuration.prefabId='paper_ai';}
  if(previous.footprint.width===1&&previous.footprint.height===1)continue;
  const others=tree.entities.filter(other=>other.transformId===node.transformId&&!Object.hasOwn(other.components,'surface'));
  if(others.length){
   let id=overlayTransforms.get(node.transformId);
   if(!id){id=fresh(node.transformId+'-overlay',ids);overlayTransforms.set(node.transformId,id);tree.transforms.push({...structuredClone(previous),id});desired.set(id,world);}
   for(const other of others)other.transformId=id;
  }
  transform.footprint={width:1,height:1,occupied:[true]};desired.set(transform.id,{...world,...cells[0]});
  for(const cell of cells.slice(1)){
   const copy=structuredClone(node),id=fresh(node.transformId,ids);copy.id=fresh(node.id,entityIds);copy.transformId=id;
   tree.entities.push(copy);tree.transforms.push({id,parentId:null,local:{...world,...cell},footprint:{width:1,height:1,occupied:[true]}});desired.set(id,{...world,...cell});
  }
 }
 for(const transform of tree.transforms){
  const world=desired.get(transform.id)!,parent=transform.parentId?desired.get(transform.parentId)!:{r:0,c:0,dir:0};
  transform.local={r:world.r-parent.r,c:world.c-parent.c,dir:(world.dir-parent.dir+8)%8};
 }
 return tree;
}
