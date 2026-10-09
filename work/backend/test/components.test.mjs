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
test('eruption decoration permits entry and preserves co-located key effects at every action count',()=>{
  const registry=defaultComponents();const state=actor();
  const nodes=[node('a',{key:{name:'K'}}),node('b',{eruption:{}})];
  for(const actions of [0,1,2,3,5,8]){
    const result=registry.dispatch({type:'enter',nodes,actor:{...state,actions},runtime:{}});
    assert.equal(result.valid,true);assert.deepEqual(result.actor.collectedKeys,['K']);assert.equal(result.actor.actions,actions);
    assert.deepEqual(registry.dispatch({type:'enter',nodes:[node('b',{eruption:{}})],actor:{...state,actions},runtime:{}}).actor,{...state,actions});
  }
});

test('fragile components consume one count from global action events',()=>{
 const registry=defaultComponents();
 const node=(id,config)=>({id,prefabId:'fragile',transformId:id,components:{fragile:config},tags:{},static:{}});
 const first=registry.dispatch({type:'action',trigger:'walk',nodes:[node('a',{count:2}),node('b',{count:1})],actor:{},runtime:{}});
 assert.deepEqual(first.runtime,{a:{fragile:{remaining:1}},b:{fragile:{remaining:0,breaking:true}}});
 const second=registry.dispatch({type:'action',trigger:'teleport',nodes:[node('a',{count:2})],actor:{},runtime:first.runtime});
 assert.deepEqual(second.runtime.a.fragile,{remaining:0,breaking:true});
});
test('ice blocks without state effects while fire retains its failure threshold',()=>{
  const registry=defaultComponents();let state=actor();state.frozen=true;
  const ice=registry.dispatch({type:'enter',nodes:[node('a',{ice:{}})],actor:state,runtime:{}});
  assert.equal(ice.valid,false);assert.deepEqual(ice.actor,state);assert.deepEqual(ice.runtime,{});
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
test('lift configuration validates range, initial height and turn count',()=>{
 const registry=defaultComponents();
 assert.doesNotThrow(()=>registry.validate(node('lift',{surface:{height:.2},lift:{minHeight:.1,maxHeight:1,initialHeight:.3,turnsPerLeg:3}})));
 for(const lift of [
  {minHeight:0,maxHeight:1,initialHeight:.3,turnsPerLeg:3},
  {minHeight:1,maxHeight:.1,initialHeight:.3,turnsPerLeg:3},
  {minHeight:.1,maxHeight:1,initialHeight:2,turnsPerLeg:3},
  {minHeight:.1,maxHeight:1,initialHeight:.3,turnsPerLeg:0},
 ]) assert.throws(()=>registry.validate(node('bad',{lift})),/Invalid lift/);
});

test('hazards run before collection regardless of IDs or component grouping',()=>{
 const registry=defaultComponents();
 for(const nodes of [[node('a-fire',{fire:{damage:1}}),node('z-key',{key:{name:'铜'}})],[node('z-fire',{fire:{damage:1}}),node('a-key',{key:{name:'铜'}})],[node('mixed',{key:{name:'铜'},fire:{damage:1}})]]){
  const result=registry.dispatch({type:'enter',nodes,actor:{...actor(),overheat:5},runtime:{}});
  assert.equal(result.actor.gameOver,true);assert.deepEqual(result.actor.collectedKeys,[]);
  assert.deepEqual(result.runtime,{});
 }
});
