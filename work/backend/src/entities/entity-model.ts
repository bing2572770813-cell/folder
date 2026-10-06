import {jsonObject, type JsonObject} from '../core/json-value.js';
export {jsonCopy, jsonObject, freezeJson, type JsonValue, type JsonObject} from '../core/json-value.js';
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
  return statics;
}
