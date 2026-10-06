import {importTreeMap,serializeTreeMap} from './tree-runtime.mjs';
import {validateMap} from '../core/map-model.mjs';
import {normalizeTile,foldsAt} from './tile-model.mjs';

const copy=value=>structuredClone(value);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const terrainIds=['campfire','ice','fire','eruption','key'];
const visible=node=>!!node.components.surface&&!node.static.transparent;
function mergedTags(nodes){
  const tags={};
  for(const node of nodes)for(const [key,value] of Object.entries(node.tags)){
    if(key==='requiredKeys'){tags[key]=[...new Set([...(tags[key]??[]),...value])].sort();continue;}
    if(Object.hasOwn(tags,key)&&!equal(tags[key],value))throw new Error('Conflicting entity tag: '+key);
    tags[key]=copy(value);
  }
  return tags;
}
function tileOf(node){
  const tile={...copy(node.configuration??{}),...copy(node.components.surface??{}),prefabId:node.configuration?.prefabId??node.prefabId,tags:copy(node.tags)};
  if(node.components.lift){tile.lift=copy(node.components.lift);tile.height=node.components.lift.initialHeight;}
  delete tile.regionTag;
  tile.blocked=node.components.collision?.blocked??false;
  delete tile.terrain;delete tile.terrainConfig;delete tile.keyName;
  for(const id of terrainIds)if(node.components[id]){tile.terrain=id;tile.terrainConfig=copy(node.components[id]);if(id==='key')tile.keyName=node.components[id].name??'钥匙';break;}
  tile.folds=copy(node.components.fold?.directions??[]);tile.fold=tile.folds[0]??null;
  tile.surfaceConnected=node.components.surface?.connected??(!tile.blocked&&!tile.terrain&&tile.kind!=='player-token');
  return normalizeTile(tile);
}
function configure(node,tile,folds,previous){
  const {regionTag,...configuration}=copy(tile);
  node.configuration=configuration;node.tags=copy(tile.tags??{});
  // Preserve absent native defaults when only unrelated legacy fields changed.
  for(const field of ['height','thickness','gradualRate','color','edgeColor'])if(!equal(previous[field],tile[field])){delete node.components.surface[field];if(tile[field]!==undefined)node.components.surface[field]=tile[field];}
  if(!equal(previous.surfaceConnected,tile.surfaceConnected))node.components.surface.connected=tile.surfaceConnected;
  if(!equal(previous.lift,tile.lift)){if(tile.lift)node.components.lift=copy(tile.lift);else delete node.components.lift;}
  if(!equal(previous.blocked,tile.blocked))node.components.collision={...node.components.collision,blocked:tile.blocked};
  const represented=terrainIds.find(id=>node.components[id]);if(represented&&represented!==tile.terrain)delete node.components[represented];
  if(tile.terrain&&(!equal(previous.terrain,tile.terrain)||!equal(previous.terrainConfig,tile.terrainConfig)||!equal(previous.keyName,tile.keyName)))node.components[tile.terrain]={...copy(tile.terrainConfig??{}),...(tile.terrain==='key'?{name:tile.keyName}:{} )};
  if(!equal(node.components.fold?.directions??[],folds)){if(folds.length)node.components.fold={...node.components.fold,directions:copy(folds)};else delete node.components.fold;}
}

/** Canonical tree storage with detached compatibility projections for legacy tools. */
export class TreeDocument {
  constructor(input){
    const source=input.version===1?{...copy(input),...validateMap(input,true)}:copy(input);
    const imported=importTreeMap(source);
    this.world=imported.world;this.metadata=imported.metadata;this.cellTags=imported.cellTags;
    const checked=validateMap(this.view(),true);
    this.metadata=this.cleanMetadata({...this.metadata,...checked});
  }
  cleanMetadata(map){const {version,width,height,tiles,foldCells,...metadata}=map;return copy(metadata);}
  primaryAt(r,c){return this.world.at(r,c).sort((a,b)=>a.id.localeCompare(b.id)).find(visible)??null;}
  view(){
    const {width,height}=this.world.transforms;
    const tiles=Array.from({length:height},()=>Array(width).fill(null)),foldCells=[];
    for(let r=0;r<height;r++)for(let c=0;c<width;c++){
      const nodes=this.world.at(r,c).sort((a,b)=>a.id.localeCompare(b.id));
      const primary=nodes.find(visible);
      const folds=[...new Set(nodes.flatMap(node=>node.components.fold?.directions??[]))];
      if(primary){const tile=tileOf(primary);tile.tags=mergedTags(nodes);tile.regionTag=this.cellTags[r+','+c]?.regionTag??'默认区域';tile.folds=folds;tile.fold=folds[0]??null;tiles[r][c]=normalizeTile(tile);}
      else foldCells.push(...folds.map(type=>({r,c,type})));
    }
    const metadata=copy(this.metadata),spawns=[];for(let r=0;r<height;r++)for(let c=0;c<width;c++)if(this.world.at(r,c).some(node=>node.tags.spawn))spawns.push({r,c});if(spawns.length===1)metadata.spawn={...metadata.spawn,...spawns[0]};
    return {...metadata,version:1,width,height,tiles,foldCells};
  }
  serialize(options){return serializeTreeMap(this.world,{...this.metadata,spawn:this.view().spawn},this.cellTags,options);}
  applyLegacy(input){
    const next={...copy(input),...validateMap(input,true)},before=this.view(),snapshot=this.serialize();
    snapshot.width=next.width;snapshot.height=next.height;
    const removed=new Set(),updated=new Map(),added=[],transforms=copy(snapshot.transforms),cellTags=copy(this.cellTags);
    const erase=node=>{removed.add(node.id);};
    for(let r=0;r<Math.max(before.height,next.height);r++)for(let c=0;c<Math.max(before.width,next.width);c++){
      const old=before.tiles[r]?.[c]??null,tile=next.tiles[r]?.[c]??null;
      const oldFolds=r<before.height&&c<before.width?foldsAt(before,r,c):[];
      const folds=r<next.height&&c<next.width?foldsAt(next,r,c):[];
      if(equal(old,tile)&&equal(oldFolds,folds))continue;
      const nodes=this.world.at(r,c).sort((a,b)=>a.id.localeCompare(b.id)),primary=nodes.find(visible);
      if(r>=next.height||c>=next.width||(!tile&&old)){for(const node of nodes)erase(node);if(r>=next.height||c>=next.width)delete cellTags[r+','+c];}
      else if(tile){
        cellTags[r+','+c]={...cellTags[r+','+c],regionTag:old===null?(cellTags[r+','+c]?.regionTag??tile.regionTag??'默认区域'):(tile.regionTag??'默认区域')};
        const replace=primary&&(old.prefabId!==tile.prefabId||old.instance?.id!==tile.instance?.id);
        if(replace)erase(primary);
        if(primary&&!replace){
          const node=updated.get(primary.id)??copy(primary),ownTags=copy(node.tags);
          const priorTags=old.tags??{},nextTags=tile.tags??{};
          for(const key of new Set([...Object.keys(priorTags),...Object.keys(nextTags)]))if(!equal(priorTags[key],nextTags[key])){
            const owners=nodes.filter(member=>Object.hasOwn(member.tags,key));
            for(const owner of owners.length?owners:[primary]){
              const edited=owner.id===primary.id?node:(updated.get(owner.id)??copy(owner));
              if(nextTags[key]===undefined)delete edited.tags[key];else edited.tags[key]=copy(nextTags[key]);
              if(owner.id===primary.id){if(nextTags[key]===undefined)delete ownTags[key];else ownTags[key]=copy(nextTags[key]);}
              else updated.set(owner.id,edited);
            }
          }
          configure(node,{...tile,tags:ownTags},equal(oldFolds,folds)?node.components.fold?.directions??[]:folds,old);updated.set(node.id,node);
        }
        else {
          const seed={version:1,width:next.width,height:next.height,tiles:Array.from({length:next.height},()=>Array(next.width).fill(null)),foldCells:[]};seed.tiles[r][c]=tile;
          const tree=importTreeMap(seed).world;const node=tree.serialize()[0],transform=tree.transforms.serialize()[0];
          const id=globalThis.crypto.randomUUID();node.id='entity-'+id;node.transformId=transform.id='transform-'+id;added.push(node);transforms.push(transform);
        }
      }
      if(!tile&&folds.length){
        const owners=nodes.filter(node=>node.components.fold&&!removed.has(node.id));
        const existing=owners[0]??nodes.find(node=>!visible(node)&&!removed.has(node.id));
        if(existing){
          for(const owner of owners.length?owners:[existing]){
            const node=updated.get(owner.id)??copy(owner);
            const retained=(node.components.fold?.directions??[]).filter(direction=>folds.includes(direction));
            const added=owner.id===existing.id?folds.filter(direction=>!oldFolds.includes(direction)):[];
            const directions=[...new Set([...retained,...added])];
            if(directions.length)node.components.fold={...node.components.fold,directions};else delete node.components.fold;
            updated.set(node.id,node);
          }
        }
        else {const id='void-'+globalThis.crypto.randomUUID();added.push({id,prefabId:'void_ai',transformId:id+'-transform',components:{collision:{blocked:true},fold:{directions:folds}},tags:{},static:{placeable:false,transparent:true}});transforms.push({id:id+'-transform',parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});}
      }else if(!tile&&!folds.length)for(const node of nodes)if(!visible(node)){const edited=copy(node);delete edited.components.fold;updated.set(node.id,edited);}
      if(tile&&!equal(oldFolds,folds))for(const node of nodes)if(node.id!==primary?.id&&!removed.has(node.id)){const edited=updated.get(node.id)??copy(node);delete edited.components.fold;updated.set(node.id,edited);}
    }
    const deletedTransforms=new Set(snapshot.entities.filter(node=>removed.has(node.id)).map(node=>node.transformId));
    for(const id of deletedTransforms){
      if(this.world.transforms.childrenOf(id).some(child=>!deletedTransforms.has(child)))throw new Error('Transform has children');
      const ownOwners=new Set(snapshot.entities.filter(node=>removed.has(node.id)&&node.transformId===id).map(node=>'entity:'+node.id));
      if(this.world.transforms.referenceOwners(id).some(owner=>!ownOwners.has(owner)))throw new Error('Transform has external references');
    }
    snapshot.entities=snapshot.entities.filter(node=>!removed.has(node.id)).map(node=>updated.get(node.id)??node).concat(added);
    snapshot.transforms=transforms.filter(node=>!deletedTransforms.has(node.id));
    // New instance cells join a surviving member's tree, or the first new cell.
    // Existing transforms stay intact, including their parents and local offsets.
    const instanceRoots=new Map();
    const surviving=snapshot.entities.filter(node=>!added.includes(node));
    for(const node of surviving){
      const instanceId=node.configuration?.instance?.id;if(!instanceId)continue;
      const groupTransforms=new Set(surviving.filter(member=>member.configuration?.instance?.id===instanceId).map(member=>member.transformId));
      const transform=this.world.transforms.get(node.transformId);
      if(!instanceRoots.has(instanceId)||!groupTransforms.has(transform.parentId))instanceRoots.set(instanceId,{id:transform.id,...this.world.transforms.world(transform.id)});
    }
    for(const node of added){
      const instanceId=node.configuration?.instance?.id;if(!instanceId)continue;
      const transform=snapshot.transforms.find(item=>item.id===node.transformId),root=instanceRoots.get(instanceId);
      if(root){transform.parentId=root.id;transform.local={r:transform.local.r-root.r,c:transform.local.c-root.c,dir:(transform.local.dir-root.dir+8)%8};}
      else instanceRoots.set(instanceId,{id:transform.id,...transform.local});
    }
    for(const key of Object.keys(cellTags)){const [r,c]=key.split(',').map(Number);if(r>=next.height||c>=next.width)delete cellTags[key];}
    snapshot.cellTags=cellTags;snapshot.legacyMetadata=this.cleanMetadata({...this.metadata,...next});
    const committed=importTreeMap(snapshot);
    const oldTransformIds=new Set(this.world.transforms.serialize().map(node=>node.id));
    const entityOwners=new Set(this.world.serialize().map(node=>'entity:'+node.id));
    for(const transform of snapshot.transforms)if(oldTransformIds.has(transform.id))for(const owner of this.world.transforms.referenceOwners(transform.id))if(!entityOwners.has(owner))committed.world.transforms.retain(transform.id,owner);
    const runtime=this.world.snapshotRuntime();
    for(const id of Object.keys(runtime)){const node=snapshot.entities.find(node=>node.id===id);if(!node){delete runtime[id];continue;}for(const component of Object.keys(runtime[id]))if(!Object.hasOwn(node.components,component))delete runtime[id][component];}
    committed.world.restoreRuntime(runtime);
    this.world=committed.world;this.metadata=committed.metadata;this.cellTags=committed.cellTags;
    return this.view();
  }
}
