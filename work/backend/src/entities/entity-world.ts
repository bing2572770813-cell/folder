import {TransformManager,type GridTransform} from './transform-manager.js';
import {jsonObject,freezeJson,validateEntityTags,validateStaticFields,type EntityNode,type JsonObject,type ComponentRuntime} from './entity-model.js';

/** Entity identity and state registry with a gameplay-only position overlay on static transforms. */
export class EntityWorld {
  private entities=new Map<string,EntityNode>();
  private entitiesByTransform=new Map<string,Set<string>>();
  private states=new Map<string,Map<string,JsonObject>>();
  private order=new Map<string,number>();
  private nextOrder=0;
  private positions=new Map<string,GridTransform>();
  private displaced=new Set<string>();
  private positionIndex=new Map<string,Set<string>>();
  constructor(readonly transforms:TransformManager,entities:EntityNode[]=[]) {
    const validated=entities.map(node=>this.validate(node));
    if(new Set(validated.map(node=>node.id)).size!==validated.length)throw new Error('Duplicate entity ID');
    for(const node of validated)this.add(node);
  }
  private validate(node:EntityNode):EntityNode {
    if(typeof node.id!=='string'||!node.id||typeof node.prefabId!=='string'||!node.prefabId)throw new Error('Invalid entity identity');
    this.transforms.get(node.transformId);
    const components:Record<string,JsonObject>={};
    for(const [id,config] of Object.entries(jsonObject(node.components)))components[id]=jsonObject(config);
    for(const field of ['followFold','canDropOnFold'])if(components.physics?.[field]!==undefined&&typeof components.physics[field]!=='boolean')throw new Error('Invalid physics '+field);
    return {id:node.id,prefabId:node.prefabId,transformId:node.transformId,components,tags:validateEntityTags(node.tags),static:freezeJson(validateStaticFields(node.static)),...(node.configuration?{configuration:jsonObject(node.configuration)}:{})};
  }
  get(id:string):EntityNode {
    const node=this.entities.get(id);if(!node)throw new Error('Unknown entity: '+id);
    const cloned=structuredClone(node);freezeJson(cloned.static);return cloned;
  }
  clone():EntityWorld {
    const result=new EntityWorld(this.transforms.clone());
    result.entities=new Map(structuredClone([...this.entities]));
    result.entitiesByTransform=new Map([...this.entitiesByTransform].map(([id,entities])=>[id,new Set(entities)]));
    result.states=new Map([...this.states].map(([id,states])=>[id,new Map(structuredClone([...states]))]));
    result.order=new Map(this.order);result.nextOrder=this.nextOrder;
    result.positions=new Map(structuredClone([...this.positions]));
    result.rebuildPositionIndex();
    return result;
  }
  add(node:EntityNode):void {
    if(this.entities.has(node.id))throw new Error('Duplicate entity ID');
    const validated=this.validate(node);this.transforms.retain(node.transformId,'entity:'+node.id);this.entities.set(node.id,validated);
    const ids=this.entitiesByTransform.get(node.transformId)??new Set<string>();ids.add(node.id);this.entitiesByTransform.set(node.transformId,ids);
    this.order.set(node.id,this.nextOrder++);
    if(this.positions.size)this.rebuildPositionIndex();
  }
  at(r:number,c:number):EntityNode[] {
    const ids=new Set<string>();
    for(const transform of this.transforms.at(r,c))for(const id of this.entitiesByTransform.get(transform)??[])if(!this.displaced.has(id))ids.add(id);
    for(const id of this.positionIndex.get(r+','+c)??[])ids.add(id);
    return [...ids].sort((a,b)=>this.order.get(a)!-this.order.get(b)!).map(id=>this.get(id));
  }
  /** Gameplay-only positions never change the serialized transform tree. */
  position(id:string):GridTransform{return structuredClone(this.positionOf(id));}
  cells(id:string):Array<{r:number;c:number}>{
    const node=this.get(id),anchor=this.positionOf(id),footprint=this.transforms.get(node.transformId).footprint;
    return footprint.occupied.flatMap((occupied,index)=>occupied?[{r:anchor.r+Math.floor(index/footprint.width),c:anchor.c+index%footprint.width}]:[]);
  }
  setRuntimePosition(id:string,position:GridTransform):void {
    this.setRuntimePositions([{id,position}]);
  }
  setRuntimePositions(changes:Array<{id:string;position:GridTransform}>):void {
    const previous=this.positions,next=new Map(previous);
    for(const {id,position} of changes){this.get(id);this.assertPosition(position);next.set(id,structuredClone(position));}
    this.positions=next;
    try{this.rebuildPositionIndex();}catch(error){this.positions=previous;this.rebuildPositionIndex();throw error;}
  }
  snapshotPositions():Record<string,GridTransform>{return Object.fromEntries([...this.positions].map(([id,position])=>[id,structuredClone(position)]));}
  restorePositions(snapshot:Record<string,GridTransform>):void {
    const previous=this.positions;this.positions=new Map();
    try{for(const [id,position] of Object.entries(snapshot)){this.get(id);this.assertPosition(position);this.positions.set(id,structuredClone(position));}this.rebuildPositionIndex();}
    catch(error){this.positions=previous;this.rebuildPositionIndex();throw error;}
  }
  private assertPosition(position:GridTransform):void {
    if(!position||![position.r,position.c,position.dir].every(Number.isInteger)||position.dir<0||position.dir>7)throw new Error('Invalid runtime position');
  }
  private positionOf(id:string):GridTransform {
    const node=this.entities.get(id);if(!node)throw new Error('Unknown entity: '+id);
    const base=this.transforms.world(node.transformId),direct=this.positions.get(id);
    if(direct)return direct;
    let parent=this.transforms.get(node.transformId).parentId;
    while(parent){
      for(const owner of this.entitiesByTransform.get(parent)??[]){
        const override=this.positions.get(owner);
        if(override){const origin=this.transforms.world(parent);return {r:base.r+override.r-origin.r,c:base.c+override.c-origin.c,dir:(base.dir+override.dir-origin.dir+8)%8};}
      }
      parent=this.transforms.get(parent).parentId;
    }
    return base;
  }
  private rebuildPositionIndex():void {
    const displaced=new Set<string>(),index=new Map<string,Set<string>>();
    for(const node of this.entities.values()){
      const baseline=this.transforms.world(node.transformId),position=this.positionOf(node.id);
      if(position.r===baseline.r&&position.c===baseline.c&&position.dir===baseline.dir)continue;
      displaced.add(node.id);
      for(const cell of this.cells(node.id)){
        if(cell.r<0||cell.c<0||cell.r>=this.transforms.height||cell.c>=this.transforms.width)throw new Error('Runtime position outside map bounds');
        const key=cell.r+','+cell.c,ids=index.get(key)??new Set<string>();ids.add(node.id);index.set(key,ids);
      }
    }
    this.displaced=displaced;this.positionIndex=index;
  }
  remove(id:string,removeTransform=false):void {
    const node=this.get(id);const owner='entity:'+id;
    if(removeTransform){
      this.transforms.release(node.transformId,owner);
      try{this.transforms.remove(node.transformId);}catch(error){this.transforms.retain(node.transformId,owner);throw error;}
    }else this.transforms.release(node.transformId,owner);
    this.entities.delete(id);this.states.delete(id);this.positions.delete(id);this.order.delete(id);
    const owners=this.entitiesByTransform.get(node.transformId);owners?.delete(id);if(!owners?.size)this.entitiesByTransform.delete(node.transformId);
    if(this.positions.size)this.rebuildPositionIndex();else{this.displaced.clear();this.positionIndex.clear();}
  }
  runtime(id:string,component:string):JsonObject {
    this.get(id);return structuredClone(this.states.get(id)?.get(component)??{});
  }
  setRuntime(id:string,component:string,state:JsonObject):void {
    const node=this.get(id);if(!Object.hasOwn(node.components,component))throw new Error('Unknown entity component');
    const cloned=jsonObject(state);const states=this.states.get(id)??new Map<string,JsonObject>();states.set(component,cloned);this.states.set(id,states);
  }
  resetRuntime():void{this.states.clear();this.positions.clear();this.displaced.clear();this.positionIndex.clear();}
  snapshotRuntime():ComponentRuntime {
    return Object.fromEntries([...this.states].map(([id,states])=>[id,Object.fromEntries([...states].map(([component,state])=>[component,jsonObject(state)]))]));
  }
  restoreRuntime(snapshot:ComponentRuntime):void {
    const states=new Map<string,Map<string,JsonObject>>();
    for(const [id,components] of Object.entries(jsonObject(snapshot))){
      const node=this.get(id),entries=new Map<string,JsonObject>();
      for(const [component,state] of Object.entries(jsonObject(components))){
        if(!Object.hasOwn(node.components,component))throw new Error('Unknown entity component');
        entries.set(component,jsonObject(state));
      }
      states.set(id,entries);
    }
    this.states=states;
  }
  serialize():EntityNode[]{return [...this.entities.keys()].map(id=>this.get(id));}
}
