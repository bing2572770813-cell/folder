import test from 'node:test';
import assert from 'node:assert/strict';
import {EntityWorld} from '../dist/entities/entity-world.js';
import {PrefabRegistry} from '../dist/entities/prefab-definition.js';
import {TransformManager} from '../dist/entities/transform-manager.js';

function fixture(){
  const m=new TransformManager(10,10);for(const id of ['t1','t2'])m.create({id,parentId:null,local:{r:2,c:2,dir:0},footprint:{width:1,height:1,occupied:[true]}});
  const registry=new PrefabRegistry([{id:'paper_ai',components:{surface:{height:.09},ice:{}}}]);
  return {m,registry,world:new EntityWorld(m)};
}
test('entity query delegates to transform index and protects identity references',()=>{
  const {m,registry,world}=fixture();world.add(registry.instantiate('paper_ai','a','t1'));world.add(registry.instantiate('paper_ai','b','t2'));
  assert.deepEqual(world.at(2,2).map(n=>n.id),['a','b']);
  assert.throws(()=>m.remove('t1'),/references/);
  m.setLocal('t1',{r:3,c:3,dir:0});assert.deepEqual(world.at(2,2).map(n=>n.id),['b']);
  world.remove('a');m.remove('t1');assert.equal(world.at(3,3).length,0);
});
test('runtime state is cloned, excluded from serialization and cleared on removal',()=>{
  const {registry,world}=fixture();world.add(registry.instantiate('paper_ai','a','t1'));world.add(registry.instantiate('paper_ai','b','t2'));
  world.setRuntime('a','ice',{frozen:true});assert.deepEqual(world.runtime('b','ice'),{});
  const state=world.runtime('a','ice');state.frozen=false;assert.equal(world.runtime('a','ice').frozen,true);
  assert.equal(world.serialize()[0].state,undefined);
  world.remove('a');assert.throws(()=>world.runtime('a','ice'),/Unknown entity/);
});
test('invalid additions and protected removal leave entities intact',()=>{
  const {m,registry,world}=fixture();world.add(registry.instantiate('paper_ai','a','t1'));
  assert.throws(()=>world.add(registry.instantiate('paper_ai','a','t2')),/Duplicate/);
  assert.throws(()=>world.add(registry.instantiate('paper_ai','b','missing')),/Unknown/);
  m.retain('t1','outside');assert.throws(()=>world.remove('a',true),/references/);
  assert.equal(world.get('a').transformId,'t1');assert.throws(()=>m.remove('t1'),/references/);
});
test('runtime snapshots restore atomically and stay separate from map configuration',()=>{
  const {registry,world}=fixture();world.add(registry.instantiate('paper_ai','a','t1'));
  world.setRuntime('a','ice',{frozen:true});const snapshot=world.snapshotRuntime();
  world.resetRuntime();world.restoreRuntime(snapshot);
  snapshot.a.ice.frozen=false;assert.equal(world.runtime('a','ice').frozen,true);
  assert.throws(()=>world.restoreRuntime({a:{surface:{height:1},missing:{}}}),/Unknown entity component/);
  assert.deepEqual(world.snapshotRuntime(),{a:{ice:{frozen:true}}});
  assert.equal(world.serialize()[0].runtime,undefined);
});
