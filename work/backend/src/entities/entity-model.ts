export type JsonValue=null|boolean|number|string|JsonValue[]|JsonObject;
export interface JsonObject {[key:string]:JsonValue}
export interface EntityNode {
  id:string;
  prefabId:string;
  transformId:string;
  components:Record<string,JsonObject>;
  tags:JsonObject;
  static:Readonly<JsonObject>;
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
export function freezeJson<T extends JsonValue>(value:T):T {
  if(value&&typeof value==='object'){for(const item of Object.values(value))freezeJson(item);Object.freeze(value);}
  return value;
}
