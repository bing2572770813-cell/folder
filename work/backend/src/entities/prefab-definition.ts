import {jsonObject,freezeJson,type JsonObject,type EntityNode} from './entity-model.js';

export interface TreePrefab {
  id:string;
  extends?:string;
  components?:Record<string,JsonObject>;
  tags?:JsonObject;
  static?:JsonObject;
}
function merge(base:JsonObject,next:JsonObject):JsonObject {
  const result=jsonObject(base);
  for(const [key,value] of Object.entries(next)){
    const previous=result[key];
    result[key]=value&&typeof value==='object'&&!Array.isArray(value)&&previous&&typeof previous==='object'&&!Array.isArray(previous)
      ?merge(previous as JsonObject,value as JsonObject):structuredClone(value);
  }
  return result;
}

/** Resolves disk prefab records using the same merge contract, preserving legacy tile fields. */
export function resolvePrefabRecord(id:string,definitions:Map<string,JsonObject>,visited=new Set<string>()):JsonObject {
  if(visited.has(id))throw new Error('Prefab inheritance cycle');visited.add(id);
  const raw=definitions.get(id);if(!raw)throw new Error('Unknown prefab: '+id);
  if(['transformId','parentId','state'].some(key=>Object.hasOwn(raw,key)))throw new Error('Prefab cannot override instance identity');
  const tile=raw.tile;
  if(tile&&typeof tile==='object'&&!Array.isArray(tile)&&Object.hasOwn(tile,'instance'))throw new Error('Prefab cannot define instance identity');
  if(raw.extends!==undefined&&(typeof raw.extends!=='string'||!raw.extends))throw new Error('Invalid prefab parent');
  const base=raw.extends?resolvePrefabRecord(raw.extends as string,definitions,visited):{};
  const resolved=merge(base,raw);delete resolved.extends;resolved.id=id;
  return resolved;
}

/** Resolves JSON inheritance; instance identity and runtime state never come from defaults. */
export class PrefabRegistry {
  private definitions=new Map<string,TreePrefab>();
  constructor(definitions:TreePrefab[]) {
    for(const definition of definitions){
      const raw=jsonObject(definition);
      if(['transformId','parentId','state'].some(field=>Object.hasOwn(raw,field)))throw new Error('Prefab cannot override instance identity or runtime state');
      if(typeof raw.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(raw.id)||this.definitions.has(raw.id))throw new Error('Invalid or duplicate prefab ID');
      if(raw.extends!==undefined&&(typeof raw.extends!=='string'||!raw.extends))throw new Error('Invalid prefab parent');
      const components:Record<string,JsonObject>={};
      for(const [id,config] of Object.entries(jsonObject(raw.components??{})))components[id]=jsonObject(config);
      this.definitions.set(raw.id,{id:raw.id,...(raw.extends?{extends:raw.extends as string}:{}),components,tags:jsonObject(raw.tags??{}),static:jsonObject(raw.static??{})});
    }
  }
  resolve(id:string):Required<Pick<TreePrefab,'id'|'components'|'tags'|'static'>> {
    return this.resolveChain(id,new Set());
  }
  private resolveChain(id:string,visited:Set<string>):Required<Pick<TreePrefab,'id'|'components'|'tags'|'static'>> {
    if(visited.has(id))throw new Error('Prefab inheritance cycle');visited.add(id);
    const definition=this.definitions.get(id);if(!definition)throw new Error('Unknown prefab: '+id);
    const base=definition.extends?this.resolveChain(definition.extends,visited):{components:{},tags:{},static:{}};
    return {id,components:merge(base.components,definition.components??{}) as Record<string,JsonObject>,tags:merge(base.tags,definition.tags??{}),static:merge(base.static,definition.static??{})};
  }
  instantiate(prefabId:string,id:string,transformId:string):EntityNode {
    if(!id||!transformId)throw new Error('Instance identity is required');
    const definition=this.resolve(prefabId);
    return {id,prefabId,transformId,components:definition.components,tags:definition.tags,static:freezeJson(definition.static)};
  }
}
