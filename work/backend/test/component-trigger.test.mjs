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
