import {jsonObject,type JsonObject,type EntityNode,type ComponentRuntime} from './entity-model.js';

export type EntityEvent='enter'|'leave'|'interact';
export interface EventContext {type:EntityEvent;nodes:EntityNode[];actor:JsonObject;runtime:ComponentRuntime}
export interface ComponentEffect {actor?:JsonObject;state?:JsonObject;messages?:string[]}
export interface ComponentHandler {
  validate?:(config:JsonObject)=>void;
  canEnter?:(context:EventContext,config:JsonObject,state:JsonObject)=>string|undefined;
  events?:Partial<Record<EntityEvent,(context:EventContext,config:JsonObject,state:JsonObject)=>ComponentEffect>>;
}
export interface EventResult {valid:boolean;reason:string;actor:JsonObject;runtime:ComponentRuntime;messages:string[]}

/** Pure component effects. Player orchestration commits results and counts actions in player.cjs. */
export class ComponentRegistry {
  private handlers=new Map<string,ComponentHandler>();
  register(id:string,handler:ComponentHandler):void {
    if(!id||this.handlers.has(id))throw new Error('Duplicate component handler');this.handlers.set(id,handler);
  }
  validate(node:EntityNode):void {
    for(const [id,config] of Object.entries(node.components)){
      const handler=this.handlers.get(id);if(!handler)throw new Error('Unregistered component: '+id);handler.validate?.(jsonObject(config));
    }
  }
  dispatch(input:EventContext):EventResult {
    if(!['enter','leave','interact'].includes(input.type))throw new Error('Unknown entity event');
    const nodes=structuredClone(input.nodes).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    for(const node of nodes)this.validate(node);
    const context:EventContext={type:input.type,nodes,actor:jsonObject(input.actor),runtime:structuredClone(input.runtime)};
    if(input.type==='enter')for(const node of nodes)for(const [id,config] of Object.entries(node.components)){
      const reason=this.handlers.get(id)!.canEnter?.(structuredClone(context),jsonObject(config),jsonObject(context.runtime[node.id]?.[id]??{}));
      if(reason)return {valid:false,reason,actor:jsonObject(input.actor),runtime:structuredClone(input.runtime),messages:[]};
    }
    const messages:string[]=[];
    for(const node of nodes)for(const [id,config] of Object.entries(node.components).sort(([a],[b])=>a<b?-1:a>b?1:0)){
      const handler=this.handlers.get(id)!.events?.[input.type];if(!handler)continue;
      const effect=handler(structuredClone(context),jsonObject(config),jsonObject(context.runtime[node.id]?.[id]??{}));
      if(effect.actor)context.actor={...context.actor,...jsonObject(effect.actor)};
      if(effect.state){context.runtime[node.id]??={};context.runtime[node.id][id]=jsonObject(effect.state);}
      if(effect.messages)messages.push(...effect.messages);
      if(context.actor.gameOver) return {valid:true,reason:'',actor:context.actor,runtime:context.runtime,messages};
    }
    return {valid:true,reason:'',actor:context.actor,runtime:context.runtime,messages};
  }
}

export function defaultComponents():ComponentRegistry {
  const registry=new ComponentRegistry();
  for(const id of ['surface','fold','tag'])registry.register(id,{});
  registry.register('collision',{canEnter:(_context,config)=>config.blocked?'目标是阻挡方块':undefined});
  registry.register('campfire',{canEnter:()=> '篝火方块不可进入'});
  registry.register('eruption',{canEnter:context=>Number(context.actor.actions)>0&&Number(context.actor.actions)%3===2?undefined:'喷发地形尚未熄火'});
  registry.register('fire',{
    validate:config=>{if(config.damage!==undefined&&(typeof config.damage!=='number'||!Number.isFinite(config.damage)||config.damage<0))throw new Error('Invalid fire damage');},
    events:{enter:(context,config)=>{
      const overheat=Number(context.actor.overheat??0)+Number(config.damage??1);
      return {actor:{overheat,...(overheat>=6?{gameOver:true}:{})},messages:overheat>=6?['过热层数达到 6 层，游戏结束']:[]};
    }},
  });
  registry.register('ice',{events:{enter:(context):ComponentEffect=>context.actor.frozen
    ?{actor:{gameOver:true},messages:['冰冻状态下再次进入冰河，游戏结束']}
    :{actor:{frozen:true,overheat:0}}}});
  registry.register('key',{
    validate:config=>{if(config.name!==undefined&&(typeof config.name!=='string'||!config.name.trim()||config.name.trim().length>80))throw new Error('Invalid key name');},
    events:{enter:(context,config,state)=>{
      const name=String(config.name??'钥匙').trim();
      const keys=(context.actor.collectedKeys??[]) as string[];
      return {actor:{collectedKeys:[...new Set([...keys,name])],hasKey:true},state:{...state,collected:true},messages:['获得钥匙：'+name]};
    }},
  });
  return registry;
}
