import {jsonObject,type JsonObject,type EntityNode,type ComponentRuntime} from './entity-model.js';
import rayEmitter from '../../../entities/ray-emitter-config.cjs';

export type EntityEvent='enter'|'leave'|'interact';
/** Exclusive cause of an arrival/departure; omitted for initialization or interaction. */
export type ArrivalTrigger='walk'|'teleport';
export interface EventContext {type:EntityEvent;trigger?:ArrivalTrigger;nodes:EntityNode[];actor:JsonObject;runtime:ComponentRuntime}
export interface ComponentEffect {actor?:JsonObject;state?:JsonObject;messages?:string[]}
export interface ComponentHandler {
  /** Lower values run first; default 0, hazards 10, collection 20. */
  effectOrder?:number;
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
    return this.evaluate(input,true);
  }
  /** Validate an arrival without evaluating any event effects. */
  checkEntry(input:Omit<EventContext,'type'>):EventResult {
    return this.evaluate({...input,type:'enter'},false);
  }
  private evaluate(input:EventContext,applyEffects:boolean):EventResult {
    if(!['enter','leave','interact'].includes(input.type))throw new Error('Unknown entity event');
    if(input.trigger!==undefined&&!['walk','teleport'].includes(input.trigger))throw new Error('Unknown arrival trigger');
    const nodes=structuredClone(input.nodes).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
    for(const node of nodes)this.validate(node);
    const context:EventContext={type:input.type,...(input.trigger===undefined?{}:{trigger:input.trigger}),nodes,actor:jsonObject(input.actor),runtime:structuredClone(input.runtime)};
    if(input.type==='enter')for(const node of nodes){
      if(node.static.walkable===false)return {valid:false,reason:'目标是阻挡方块',actor:jsonObject(input.actor),runtime:structuredClone(input.runtime),messages:[]};
      for(const [id,config] of Object.entries(node.components)){
      const reason=this.handlers.get(id)!.canEnter?.(structuredClone(context),jsonObject(config),jsonObject(context.runtime[node.id]?.[id]??{}));
      if(reason)return {valid:false,reason,actor:jsonObject(input.actor),runtime:structuredClone(input.runtime),messages:[]};
      }
    }
    if(!applyEffects)return {valid:true,reason:'',actor:context.actor,runtime:context.runtime,messages:[]};
    const messages:string[]=[];
    const effects=nodes.flatMap(node=>Object.entries(node.components).map(([id,config])=>({node,id,config})));
    effects.sort((a,b)=>(this.handlers.get(a.id)!.effectOrder??0)-(this.handlers.get(b.id)!.effectOrder??0)||(a.id<b.id?-1:a.id>b.id?1:0)||(a.node.id<b.node.id?-1:a.node.id>b.node.id?1:0));
    for(const {node,id,config} of effects){
      if(Array.isArray(node.static.events)&&!node.static.events.includes(input.type))continue;
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
  registry.register('physics',{validate:config=>{
    for(const field of ['followFold','canDropOnFold'])if(config[field]!==undefined&&typeof config[field]!=='boolean')throw new Error('Invalid physics '+field);
  }});
  registry.register('surface',{validate:config=>{
    if(config.connected!==undefined&&typeof config.connected!=='boolean')throw new Error('Invalid surface connected');
    for(const [key,min,max] of [['height',.01,16],['thickness',.001,16],['gradualRate',0,100]] as const){const value=config[key];if(value!==undefined&&(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max))throw new Error('Invalid surface '+key);}
    if(config.color!==undefined&&!['white','red','yellow','blue','green','purple','black'].includes(String(config.color)))throw new Error('Invalid surface color');
  }});
  registry.register('lift',{validate:config=>{
    const values=['minHeight','maxHeight','initialHeight'];
    for(const key of values){const value=config[key];if(typeof value!=='number'||!Number.isFinite(value))throw new Error('Invalid lift '+key);}
    const min=Number(config.minHeight),max=Number(config.maxHeight),initial=Number(config.initialHeight);
    if(min<.01||max>16||min>max)throw new Error('Invalid lift height range');
    if(initial<min||initial>max)throw new Error('Invalid lift initialHeight');
    if(Object.hasOwn(config,'durationMs'))throw new Error('durationMs is unsupported; use turnsPerLeg');
    const turns=config.turnsPerLeg;
    if(typeof turns!=='number'||!Number.isSafeInteger(turns)||turns<1||turns>100)throw new Error('Invalid lift turnsPerLeg');
  }});
  registry.register('fold',{validate:config=>{if(config.directions!==undefined&&(!Array.isArray(config.directions)||config.directions.some(value=>!['h','v','d1','d2'].includes(String(value)))))throw new Error('Invalid fold directions');}});
  registry.register('tag',{});
  registry.register('collision',{validate:config=>{if(config.blocked!==undefined&&typeof config.blocked!=='boolean')throw new Error('Invalid collision blocked');},canEnter:(_context,config)=>config.blocked?'目标是阻挡方块':undefined});
  registry.register('campfire',{canEnter:()=> '篝火方块不可进入'});
  registry.register('rayEmitter',{validate:rayEmitter.validate,canEnter:()=> '冰冻射线机关不可进入'});
  registry.register('foldSwitch',{validate:config=>{if(config.initialState!==0&&config.initialState!==1)throw new Error('折线开关初始状态只能为 0 或 1');},canEnter:()=> '折线开关方块不可进入'});
  registry.register('firebird',{validate:config=>{if(!['north','east','south','west'].includes(String(config.direction)))throw new Error('火焰鸟方向无效');},canEnter:()=> '火焰鸟方块不可进入'});
  registry.register('flame',{validate:config=>{if(config.source!==undefined&&typeof config.source!=='boolean')throw new Error('火焰来源标记无效');},canEnter:()=> '火焰覆盖的方格不可进入'});
  registry.register('fragile',{canEnter:(_context,_config,state)=>state.broken?'易碎方块已破碎':undefined,events:{leave:context=>context.trigger==='walk'||context.trigger==='teleport'?{state:{broken:true}}:{}}});
  registry.register('eruption',{canEnter:context=>Number(context.actor.actions)>0&&Number(context.actor.actions)%3===2?undefined:'喷发地形尚未熄火'});
  registry.register('fire',{
    effectOrder:10,
    validate:config=>{if(config.damage!==undefined&&(typeof config.damage!=='number'||!Number.isFinite(config.damage)||config.damage<0))throw new Error('Invalid fire damage');},
    events:{enter:(context,config)=>{
      const overheat=Number(context.actor.overheat??0)+Number(config.damage??1);
      return {actor:{overheat,...(overheat>=6?{gameOver:true}:{})},messages:overheat>=6?['过热层数达到 6 层，游戏结束']:[]};
    }},
  });
  registry.register('ice',{canEnter:()=> '冰块是阻挡方块'});
  registry.register('key',{
    effectOrder:20,
    validate:config=>{if(config.name!==undefined&&(typeof config.name!=='string'||!config.name.trim()||config.name.trim().length>80))throw new Error('Invalid key name');},
    events:{enter:(context,config,state)=>{
      const name=String(config.name??'钥匙').trim();
      const keys=(context.actor.collectedKeys??[]) as string[];
      return {actor:{collectedKeys:[...new Set([...keys,name])],hasKey:true},state:{...state,collected:true},messages:['获得钥匙：'+name]};
    }},
  });
  return registry;
}
