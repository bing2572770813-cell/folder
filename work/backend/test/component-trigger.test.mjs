import test from 'node:test';
import assert from 'node:assert/strict';
import {ComponentRegistry} from '../dist/entities/components.js';

test('arrival cause is exclusive and reaches restrictions and effects unchanged',()=>{
 const registry=new ComponentRegistry();
 registry.register('observer',{
  canEnter:context=>context.trigger==='teleport'?'禁止传送':undefined,
  events:{enter:context=>({actor:{cause:context.trigger??'initialization'}})},
 });
 const input={type:'enter',nodes:[{id:'observer',prefabId:'test',transformId:'t',components:{observer:{}},tags:{},static:{}}],actor:{},runtime:{}};
 assert.equal(registry.dispatch({...input,trigger:'walk'}).actor.cause,'walk');
 assert.equal(registry.dispatch({...input,trigger:'teleport'}).valid,false);
 assert.equal(registry.dispatch(input).actor.cause,'initialization');
 assert.throws(()=>registry.dispatch({...input,trigger:['walk','teleport']}),/trigger/i);
 assert.throws(()=>registry.dispatch({...input,trigger:'hover'}),/trigger/i);
 assert.deepEqual(input.actor,{});assert.deepEqual(input.runtime,{});
});

test('entry preflight checks restrictions without invoking arrival effects',()=>{
 const registry=new ComponentRegistry();let effects=0,checks=0;
 registry.register('observer',{
  canEnter:context=>{checks++;return context.trigger==='teleport'?'禁止传送':undefined;},
  events:{enter:()=>{effects++;return {actor:{arrived:true},state:{visits:1}};}},
 });
 const input={nodes:[{id:'observer',prefabId:'test',transformId:'t',components:{observer:{}},tags:{},static:{}}],actor:{},runtime:{},trigger:'walk'};
 assert.equal(registry.checkEntry(input).valid,true);assert.equal(checks,1);assert.equal(effects,0);
 assert.equal(registry.checkEntry({...input,trigger:'teleport'}).valid,false);assert.equal(effects,0);
 assert.equal(registry.dispatch({...input,type:'enter'}).actor.arrived,true);assert.equal(effects,1);
});
