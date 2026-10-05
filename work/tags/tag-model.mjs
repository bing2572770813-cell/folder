import {normalizeBaseEntity,normalizeBehavior} from '../entities/behaviors.mjs';
import {entityType} from '../entity-visibility.mjs';
import {normalizePropertySchema} from '../core/property-model.mjs';
export const TAG_SCRIPTS=['tag-region','tag-fold','tag-spawn','tag-entry','tag-exit'];
export function normalizeTagPrefab(data){
  if(!data||data.version!==1||typeof data.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(data.id)||typeof data.name!=='string'||!data.name.trim())throw new Error('标签 prefab 的版本、ID 或名称无效');
  const BaseEntity=normalizeBaseEntity(data.BaseEntity);if(!BaseEntity)throw new Error('标签必须声明 BaseEntity');
  const behavior=normalizeBehavior(data.behavior);if(!TAG_SCRIPTS.includes(behavior.scriptId))throw new Error('未注册的标签行为');
  return {version:1,id:data.id,name:data.name.trim().slice(0,80),BaseEntity,behavior,properties:normalizePropertySchema(data.properties??{})};
}
function combine(a={},b={}){
  const result={...a,...b};for(const flag of ['readable','serializable','tempEditable'])if(a[flag]!==undefined||b[flag]!==undefined)result[flag]=(a[flag]??true)&&(b[flag]??true);
  if(a.children||b.children)result.children=Object.fromEntries([...new Set([...Object.keys(a.children??{}),...Object.keys(b.children??{})])].map(key=>[key,combine(a.children?.[key],b.children?.[key])]));
  if(a.items||b.items)result.items=combine(a.items,b.items);return result;
}
export function entityPropertySchema(tile,catalog){
  const result=normalizePropertySchema(tile.propertySchema??{});
  for(const definition of catalog){for(const [key,descriptor] of Object.entries(definition.properties)){
    if(key==='regionTag')result.regionTag=combine(result.regionTag,descriptor);
    else if(key==='direction'){result.folds=combine(result.folds,descriptor);result.fold={...combine(result.fold,descriptor),tempEditable:false};}
    else if(['spawn','entry','exitTo','requiredKeys'].includes(key)){result.tags??={};result.tags.children??={};result.tags.children[key]=combine(result.tags.children[key],descriptor);}
  }}return result;
}
export function assertTagAttachment(catalog,scriptId,map,r,c){
  const definition=catalog.find(tag=>tag.behavior.scriptId===scriptId);if(!definition)throw new Error('未加载标签定义：'+scriptId);
  const base=map.tiles[r]?.[c]?entityType(map.tiles[r][c]):'void_ai';
  if(!definition.BaseEntity.includes(base))throw new Error('标签 '+definition.name+' 不能附着在 '+base+' 上');
  return definition;
}
