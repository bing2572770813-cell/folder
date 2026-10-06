import test from 'node:test';
import assert from 'node:assert/strict';
import {ComponentRegistry,defaultComponents} from '../dist/entities/components.js';

const node=(id,components)=>({id,prefabId:'test_ai',transformId:id+'-t',components,tags:{},static:{}});
const actor=()=>({frozen:false,overheat:0,actions:0,collectedKeys:[],gameOver:false});
test('same-cell components combine in stable order and keep input state independent',()=>{
  const registry=defaultComponents();const initial=actor();
  const nodes=[node('z',{fire:{damage:1},key:{name:'铜钥匙'}}),node('a',{surface:{},collision:{blocked:false}})];
  const result=registry.dispatch({type:'enter',nodes,actor:initial,runtime:{}});
  assert.equal(result.actor.overheat,1);assert.deepEqual(result.actor.collectedKeys,['铜钥匙']);
  assert.deepEqual(initial,actor());assert.deepEqual(nodes[0].components.key,{name:'铜钥匙'});
  assert.deepEqual(result.runtime.z.key,{collected:true});
});
test('entry rejection prevents all effects and cyclic eruption uses pre-action count',()=>{
  const registry=defaultComponents();const state=actor();
  const nodes=[node('a',{key:{name:'K'}}),node('b',{eruption:{}})];
  const denied=registry.dispatch({type:'enter',nodes,actor:state,runtime:{}});
  assert.equal(denied.valid,false);assert.deepEqual(denied.actor,state);assert.deepEqual(denied.runtime,{});
  state.actions=2;assert.equal(registry.dispatch({type:'enter',nodes,actor:state,runtime:{}}).valid,true);
});
test('ice and fire preserve existing failure thresholds',()=>{
  const registry=defaultComponents();let state=actor();state.frozen=true;
  const ice=registry.dispatch({type:'enter',nodes:[node('a',{ice:{}})],actor:state,runtime:{}});
  assert.equal(ice.actor.gameOver,true);
  state=actor();state.overheat=5;
  assert.equal(registry.dispatch({type:'enter',nodes:[node('a',{fire:{}})],actor:state,runtime:{}}).actor.gameOver,true);
});
test('registered leave/interact events work without core changes and reject unknown handlers',()=>{
  const registry=new ComponentRegistry();registry.register('counter',{
    events:{interact:(_ctx,_config,state)=>({state:{count:Number(state.count??0)+1}}),leave:()=>({messages:['left']})},
  });
  const nodes=[node('a',{counter:{}})];
  const first=registry.dispatch({type:'interact',nodes,actor:actor(),runtime:{}});
  assert.deepEqual(first.runtime.a.counter,{count:1});
  assert.deepEqual(registry.dispatch({type:'leave',nodes,actor:actor(),runtime:first.runtime}).messages,['left']);
  assert.throws(()=>registry.dispatch({type:'enter',nodes:[node('bad',{unknown:{}})],actor:actor(),runtime:{}}),/Unregistered/);
});
test('static event declarations restrict effects while entry restrictions always apply',()=>{
  const registry=defaultComponents(),initial=actor();
  const fire={...node('fire',{fire:{damage:2}}),static:{events:['leave']}};
  assert.equal(registry.dispatch({type:'enter',nodes:[fire],actor:initial,runtime:{}}).actor.overheat,0);
  const blocked={...node('blocked',{collision:{blocked:true}}),static:{events:['leave']}};
  assert.equal(registry.dispatch({type:'enter',nodes:[fire,blocked],actor:initial,runtime:{}}).valid,false);
  const staticBlocked={...node('static',{surface:{}}),static:{walkable:false}};
  assert.equal(registry.dispatch({type:'enter',nodes:[staticBlocked],actor:initial,runtime:{}}).valid,false);
});
