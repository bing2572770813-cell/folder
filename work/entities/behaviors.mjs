import {copyJson} from '../core/json-value.mjs';
export function normalizeBehavior(value={scriptId:'replace-cell',parameters:{},state:{}}){
  if(!value||typeof value.scriptId!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(value.scriptId))throw new Error('实体行为脚本 ID 无效');
  const parameters=copyJson(value.parameters??{}),state=copyJson(value.state??{});
  if(!parameters||Array.isArray(parameters)||typeof parameters!=='object'||!state||Array.isArray(state)||typeof state!=='object')throw new Error('行为参数与状态须为 JSON 对象');
  return {scriptId:value.scriptId,parameters,state};
}
export function normalizeBaseEntity(value){
  if(value===undefined)return undefined; // Legacy definitions retain their existing unrestricted replacement rule.
  if(!Array.isArray(value)||value.some(id=>typeof id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(id)))throw new Error('BaseEntity 须为实体 prefab ID 列表');
  return [...new Set(value)];
}
export class ReplaceCellBehavior {
  constructor(descriptor){this.descriptor=normalizeBehavior(descriptor);}
  placement(){return {operation:'replace'};}
  toJSON(){return copyJson(this.descriptor);}
}
// Script identity is resolved through code, never through JSON-provided import paths.
// Placed player prefabs are passive tokens; only player.cjs creates the controlled runtime instance.
const factories=new Map([['replace-cell',descriptor=>new ReplaceCellBehavior(descriptor)],['player-controller',descriptor=>new ReplaceCellBehavior(descriptor)]]);
export function createEntityBehavior(value){const descriptor=normalizeBehavior(value),factory=factories.get(descriptor.scriptId);if(!factory)throw new Error('未注册的实体行为：'+descriptor.scriptId);return factory(descriptor);}
