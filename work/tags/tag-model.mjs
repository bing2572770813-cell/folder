import {normalizeBaseEntity,normalizeBehavior} from '../entities/behaviors.mjs';
import {copyJson} from '../core/json-value.mjs';
import {entityType} from '../entity-visibility.mjs';
export const TAG_SCRIPTS=['tag-region','tag-fold','tag-spawn','tag-entry','tag-exit'];
export function normalizeTagPrefab(data){
  if(!data||data.version!==1||typeof data.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(data.id)||typeof data.name!=='string'||!data.name.trim())throw new Error('标签 prefab 的版本、ID 或名称无效');
  const BaseEntity=normalizeBaseEntity(data.BaseEntity);if(!BaseEntity)throw new Error('标签必须声明 BaseEntity');
  const behavior=normalizeBehavior(data.behavior);if(!TAG_SCRIPTS.includes(behavior.scriptId))throw new Error('未注册的标签行为');
  return {version:1,id:data.id,name:data.name.trim().slice(0,80),BaseEntity,behavior,properties:copyJson(data.properties??{})};
}
export function assertTagAttachment(catalog,scriptId,map,r,c){
  const definition=catalog.find(tag=>tag.behavior.scriptId===scriptId);if(!definition)throw new Error('未加载标签定义：'+scriptId);
  const base=map.tiles[r]?.[c]?entityType(map.tiles[r][c]):'void_ai';
  if(!definition.BaseEntity.includes(base))throw new Error('标签 '+definition.name+' 不能附着在 '+base+' 上');
  return definition;
}
