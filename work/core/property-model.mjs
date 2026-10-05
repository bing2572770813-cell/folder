import {copyJson} from './json-value.mjs';
const flags=['readable','serializable','tempEditable'];
export const identityFields=new Set(['prefabId','instance','kind','terrain','propertySchema']);
export function normalizePropertySchema(schema={},depth=0){
  if(depth>16||!schema||typeof schema!=='object'||Array.isArray(schema))throw new Error('属性描述须为嵌套对象');
  const result={};
  for(const [name,definition] of Object.entries(schema)){
    if(['__proto__','constructor','prototype'].includes(name)||!definition||typeof definition!=='object'||Array.isArray(definition))throw new Error('属性描述无效');
    const value={};for(const flag of flags)if(definition[flag]!==undefined){if(typeof definition[flag]!=='boolean')throw new Error('属性权限须为布尔值');value[flag]=definition[flag];}
    if(definition.label!==undefined){if(typeof definition.label!=='string')throw new Error('属性标签无效');value.label=definition.label;}
    if(definition.children!==undefined)value.children=normalizePropertySchema(definition.children,depth+1);
    if(definition.items!==undefined)value.items=normalizePropertySchema({item:definition.items},depth+1).item;
    Object.defineProperty(result,name,{value,enumerable:true,writable:true,configurable:true});
  }
  return result;
}
export function fieldPermissions(definition={},parent={readable:true,serializable:true,tempEditable:true},identity=false){
  return Object.fromEntries(flags.map(flag=>[flag,!!parent[flag]&&(definition[flag]??true)&&!(identity&&flag==='tempEditable')]));
}
export function projectProperties(values,schema={},flag='serializable'){
  if(!flags.includes(flag))throw new Error('未知属性投影');
  const walk=(value,definition,parent,identity=false)=>{
    const permissions=fieldPermissions(definition,parent,identity);if(!permissions[flag])return undefined;
    if(Array.isArray(value))return value.map(item=>walk(item,definition.items??{},permissions)).filter(item=>item!==undefined);
    if(value&&typeof value==='object'){const result={};for(const [name,item] of Object.entries(value)){const next=walk(item,definition.children?.[name]??{},permissions);if(next!==undefined)Object.defineProperty(result,name,{value:next,enumerable:true,writable:true,configurable:true});}return result;}
    return copyJson(value);
  };
  const result={};for(const [name,value] of Object.entries(values)){const next=walk(value,schema[name]??{}, {readable:true,serializable:true,tempEditable:true},identityFields.has(name));if(next!==undefined)Object.defineProperty(result,name,{value:next,enumerable:true,writable:true,configurable:true});}return result;
}
export function propertyAt(values,schema,path){
  let value=values,definition={children:schema},permissions={readable:true,serializable:true,tempEditable:true};
  path.forEach((key,index)=>{if(['__proto__','constructor','prototype'].includes(String(key))||value===null||typeof value!=='object'||!Object.hasOwn(value,key))throw new Error('属性路径不存在');definition=Array.isArray(value)?definition.items??{}:definition.children?.[key]??{};permissions=fieldPermissions(definition,permissions,index===0&&identityFields.has(key));value=value[key];});
  return {value,definition,permissions};
}
export function updateProperty(values,schema,path,nextValue){
  if(!path.length)throw new Error('属性路径不可为空');
  const original=propertyAt(values,schema,path);if(!original.permissions.readable||!original.permissions.tempEditable)throw new Error('属性不可编辑');
  const value=copyJson(nextValue);
  const check=(before,after,definition,parent)=>{
    const permissions=fieldPermissions(definition,parent);
    if(JSON.stringify(before)===JSON.stringify(after))return;
    if(!permissions.readable||!permissions.tempEditable)throw new Error('嵌套属性不可编辑');
    if(Array.isArray(before)){if(!Array.isArray(after))throw new Error('属性类型不匹配');for(let i=0;i<Math.max(before.length,after.length);i++)check(before[i],after[i],definition.items??{},permissions);}
    else if(before&&typeof before==='object'){if(!after||typeof after!=='object'||Array.isArray(after))throw new Error('属性类型不匹配');for(const key of new Set([...Object.keys(before),...Object.keys(after)]))check(before[key],after[key],definition.children?.[key]??{},permissions);}
    else if(before!==undefined&&after!==undefined&&before!==null&&typeof before!==typeof after)throw new Error('属性类型不匹配');
  };
  check(original.value,value,original.definition,original.permissions);
  const next=copyJson(values);let target=next;for(const key of path.slice(0,-1))target=target[key];target[path.at(-1)]=value;return next;
}
export function serializeMapConfiguration(map){
  const next=copyJson(map);next.tiles=map.tiles.map(row=>row.map(tile=>{
    if(!tile)return null;const result=projectProperties(tile,tile.propertySchema??{});
    // Structural identity is not an editable property and is required for import.
    for(const key of identityFields)if(Object.hasOwn(tile,key))result[key]=copyJson(tile[key]);
    return result;
  }));return next;
}
