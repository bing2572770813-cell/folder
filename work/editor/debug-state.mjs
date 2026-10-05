import {copyJson} from '../core/json-value.mjs';
import {updateProperty} from '../core/property-model.mjs';
export class DebugState {
  #overrides=new Map();
  values(key,baseline,schema){let result=copyJson(baseline);for(const {path,value} of this.#overrides.get(key)??[])result=updateProperty(result,schema,path,value);return result;}
  set(key,path,value){const entries=this.#overrides.get(key)??[],signature=JSON.stringify(path);const next=entries.filter(entry=>JSON.stringify(entry.path)!==signature);next.push({path:[...path],value:copyJson(value)});this.#overrides.set(key,next);}
  clear(){this.#overrides.clear();}
}
