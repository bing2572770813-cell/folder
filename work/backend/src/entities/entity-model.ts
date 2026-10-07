export type JsonValue=null|boolean|number|string|JsonValue[]|JsonObject;
export interface JsonObject {[key:string]:JsonValue}
export interface EntityNode {
  id:string;
  prefabId:string;
  transformId:string;
  components:Record<string,JsonObject>;
  tags:JsonObject;
  static:Readonly<JsonObject>;
  configuration?:JsonObject;
}
export interface ComponentRuntime { [entityId:string]:Record<string,JsonObject> }

export function jsonCopy(value:unknown,depth=0):JsonValue {
  if(depth>32)throw new Error('JSON nesting exceeds 32');
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return value.map(v=>jsonCopy(v,depth+1));
  if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)){
    const result:JsonObject={};
    for(const [key,item] of Object.entries(value)){
      if(['__proto__','constructor','prototype'].includes(key))throw new Error('Unsafe JSON property');
      result[key]=jsonCopy(item,depth+1);
    }
    return result;
  }
  throw new Error('Configuration must contain finite JSON values');
}
export function jsonObject(value:unknown):JsonObject {
  const copied=jsonCopy(value);
  if(!copied||typeof copied!=='object'||Array.isArray(copied))throw new Error('Expected JSON object');
  return copied;
}
/** Entity tag semantics apply to every node, including nodes without a surface. */
export function validateEntityTags(value:unknown):JsonObject {
  const tags=jsonObject(value);
  if(Object.hasOwn(tags,'regionTag'))throw new Error('区域标签只能属于地图格');
  for(const key of ['spawn','entry'])if(tags[key]!==undefined&&typeof tags[key]!=='boolean')throw new Error('方块标签无效');
  if(tags.exitTo!==undefined&&(typeof tags.exitTo!=='string'||!tags.exitTo.trim()||tags.exitTo.length>80))throw new Error('跳转区域名称无效');
  if(tags.requiredKeys!==undefined&&(!Array.isArray(tags.requiredKeys)||tags.requiredKeys.some(key=>typeof key!=='string'||!key.trim()||key.length>80)))throw new Error('所需钥匙必须是名称列表');
  return tags;
}
/** Catalog and world boundaries share the same static field contract. */
export function validateStaticFields(value:unknown):JsonObject {
  const statics=jsonObject(value);
  for(const flag of ['render','transparent','walkable','placeable'])if(statics[flag]!==undefined&&typeof statics[flag]!=='boolean')throw new Error('Invalid static '+flag);
  if(statics.events!==undefined&&(!Array.isArray(statics.events)||statics.events.some(event=>typeof event!=='string'||!['enter','leave','interact'].includes(event))))throw new Error('Invalid static events');
  if(statics.entityType!==undefined&&!['terrain','item','creature'].includes(String(statics.entityType)))throw new Error('Invalid static entityType');
  return statics;
}
export function freezeJson<T extends JsonValue>(value:T):T {
  if(value&&typeof value==='object'){for(const item of Object.values(value))freezeJson(item);Object.freeze(value);}
  return value;
}
