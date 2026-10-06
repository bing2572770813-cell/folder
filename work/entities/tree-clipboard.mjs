import {validateTreeDocument} from './tree-commands.mjs';
import {TreeDocument} from './tree-document.mjs';
import {defaultComponents} from './tree-runtime.mjs';
export function copyTree(document,cells,{isHidden=()=>false,nodeHidden=()=>false}={}){
 if(!cells.length)throw new Error('先选择方格');const world=document.world;
 const transformIds=new Set(cells.flatMap(p=>world.transforms.at(p.r,p.c)));
 function children(id){for(const child of world.transforms.childrenOf(id))if(!transformIds.has(child)){transformIds.add(child);children(child);}}for(const id of [...transformIds])children(id);
 const nodes=world.serialize().filter(node=>transformIds.has(node.transformId));if(!nodes.length)throw new Error('选区没有实体');
 for(const node of nodes)if(nodeHidden(node))throw new Error('不能复制隐藏实体');
 const allCells=[...transformIds].flatMap(id=>world.transforms.worldCells(id));for(const p of allCells)if(isHidden(p.r,p.c))throw new Error('不能复制隐藏子树');
 const r=Math.min(...allCells.map(p=>p.r)),c=Math.min(...allCells.map(p=>p.c));
 const transforms=[...transformIds].map(id=>{const transform=world.transforms.get(id);if(!transformIds.has(transform.parentId)){transform.parentId=null;const point=world.transforms.world(id);transform.local={...point,r:point.r-r,c:point.c-c};}return transform;});
 const regions={};for(const p of allCells){const key=p.r+','+p.c;if(document.cellTags[key])regions[(p.r-r)+','+(p.c-c)]=structuredClone(document.cellTags[key]);}
 return {kind:'tree',entities:structuredClone(nodes),transforms,cellTags:regions,width:Math.max(...allCells.map(p=>p.c))-c+1,height:Math.max(...allCells.map(p=>p.r))-r+1};
}
export function pasteTree(document,clipboard,r,c,{isHidden=()=>false,nodeHidden=()=>false}={}){
 const snapshot=structuredClone(document.serialize()),ids=new Map(clipboard.transforms.map(node=>[node.id,'transform-'+globalThis.crypto.randomUUID()]));
 const transforms=clipboard.transforms.map(node=>({...structuredClone(node),id:ids.get(node.id),parentId:node.parentId?ids.get(node.parentId):null,local:node.parentId?node.local:{...node.local,r:node.local.r+r,c:node.local.c+c}}));
 const instances=new Map();const entities=clipboard.entities.map(node=>{const next={...structuredClone(node),id:'entity-'+globalThis.crypto.randomUUID(),transformId:ids.get(node.transformId)};delete next.tags.spawn;delete next.tags.entry;if(next.configuration?.instance){const instance=next.configuration.instance;if(!instances.has(instance.id))instances.set(instance.id,globalThis.crypto.randomUUID());instance.id=instances.get(instance.id);instance.anchorR=r;instance.anchorC=c;}return next;});
 snapshot.transforms.push(...transforms);snapshot.entities.push(...entities);const candidate=new TreeDocument(snapshot),registry=defaultComponents();
 for(const node of entities){registry.validate(node);if(nodeHidden(node))throw new Error('不能粘贴隐藏实体');for(const p of candidate.world.transforms.worldCells(node.transformId)){if(isHidden(p.r,p.c)||document.world.at(p.r,p.c).some(nodeHidden))throw new Error('不能粘贴到隐藏区域');const key=p.r+','+p.c;candidate.cellTags[key]??={regionTag:'默认区域'};}}
 validateTreeDocument(candidate);candidate.world.restoreRuntime(document.world.snapshotRuntime());const owners=new Set(document.world.serialize().map(node=>'entity:'+node.id));for(const node of document.world.transforms.serialize())for(const owner of document.world.transforms.referenceOwners(node.id))if(!owners.has(owner))candidate.world.transforms.retain(node.id,owner);
 return candidate;
}
