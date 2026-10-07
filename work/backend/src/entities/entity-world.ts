import {TransformManager} from './transform-manager.js';
import {jsonObject,freezeJson,validateEntityTags,validateStaticFields,type EntityNode,type JsonObject,type ComponentRuntime} from './entity-model.js';

/** Entity identity and state registry. Spatial lookup belongs exclusively to TransformManager. */
export class EntityWorld {
  private entities=new Map<string,EntityNode>();
  private states=new Map<string,Map<string,JsonObject>>();
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
    if(components.physics?.followFold!==undefined&&typeof components.physics.followFold!=='boolean')throw new Error('Invalid physics followFold');
    return {id:node.id,prefabId:node.prefabId,transformId:node.transformId,components,tags:validateEntityTags(node.tags),static:freezeJson(validateStaticFields(node.static)),...(node.configuration?{configuration:jsonObject(node.configuration)}:{})};
  }
  get(id:string):EntityNode {
    const node=this.entities.get(id);if(!node)throw new Error('Unknown entity: '+id);
    const cloned=structuredClone(node);freezeJson(cloned.static);return cloned;
  }
  add(node:EntityNode):void {
    if(this.entities.has(node.id))throw new Error('Duplicate entity ID');
    const validated=this.validate(node);this.transforms.retain(node.transformId,'entity:'+node.id);this.entities.set(node.id,validated);
  }
  at(r:number,c:number):EntityNode[] {
    const transforms=new Set(this.transforms.at(r,c));
    return [...this.entities.values()].filter(node=>transforms.has(node.transformId)).map(node=>this.get(node.id));
  }
  remove(id:string,removeTransform=false):void {
    const node=this.get(id);const owner='entity:'+id;
    if(removeTransform){
      this.transforms.release(node.transformId,owner);
      try{this.transforms.remove(node.transformId);}catch(error){this.transforms.retain(node.transformId,owner);throw error;}
    }else this.transforms.release(node.transformId,owner);
    this.entities.delete(id);this.states.delete(id);
  }
  runtime(id:string,component:string):JsonObject {
    this.get(id);return structuredClone(this.states.get(id)?.get(component)??{});
  }
  setRuntime(id:string,component:string,state:JsonObject):void {
    const node=this.get(id);if(!Object.hasOwn(node.components,component))throw new Error('Unknown entity component');
    const cloned=jsonObject(state);const states=this.states.get(id)??new Map<string,JsonObject>();states.set(component,cloned);this.states.set(id,states);
  }
  resetRuntime():void{this.states.clear();}
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
