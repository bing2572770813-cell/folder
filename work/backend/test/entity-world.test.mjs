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
test('static events reject non-string values without registering entities',()=>{
  for(const event of [['enter'],{type:'enter'},1]){
    const {m,registry,world}=fixture(),node=registry.instantiate('paper_ai','a','t1');
    node.static={events:[event]};
    assert.throws(()=>world.add(node),/Invalid static events/);
    assert.deepEqual(world.serialize(),[]);
    assert.deepEqual(m.referenceOwners('t1'),[]);
  }
});
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
test('runtime positions move lookup and rendering cells without changing serialized transforms',()=>{
  const {m,registry,world}=fixture();world.add(registry.instantiate('paper_ai','a','t1'));world.add(registry.instantiate('paper_ai','b','t2'));
  const staticTransforms=m.serialize();world.setRuntimePosition('a',{r:3,c:4,dir:0});
  assert.deepEqual(world.at(2,2).map(node=>node.id),['b']);
  assert.deepEqual(world.at(3,4).map(node=>node.id),['a']);
  assert.deepEqual(world.cells('a'),[{r:3,c:4}]);
  assert.deepEqual(m.serialize(),staticTransforms);
  const snapshot=world.snapshotPositions();
  assert.throws(()=>world.setRuntimePosition('a',{r:10,c:0,dir:0}),/bounds/);
  assert.deepEqual(world.snapshotPositions(),snapshot);
  world.resetRuntime();assert.deepEqual(world.at(2,2).map(node=>node.id),['a','b']);
  world.restorePositions(snapshot);assert.deepEqual(world.at(3,4).map(node=>node.id),['a']);
  assert.throws(()=>world.restorePositions({a:{r:-1,c:0,dir:0}}),/bounds/);
  assert.deepEqual(world.snapshotPositions(),snapshot);
  assert.throws(()=>world.setRuntimePositions([{id:'a',position:{r:4,c:4,dir:0}},{id:'b',position:{r:10,c:0,dir:0}}]),/bounds/);
  assert.deepEqual(world.snapshotPositions(),snapshot,'a failed group move leaves all positions intact');
  world.setRuntimePositions([{id:'a',position:{r:4,c:4,dir:0}},{id:'b',position:{r:3,c:4,dir:0}}]);
  assert.deepEqual(world.at(3,4).map(node=>node.id),['b']);
  assert.deepEqual(world.at(4,4).map(node=>node.id),['a']);
  const clone=world.clone();
  assert.deepEqual(clone.at(3,4).map(node=>node.id),['b']);
  clone.resetRuntime();
  assert.deepEqual(world.at(3,4).map(node=>node.id),['b'],'cloned runtime positions stay independent');
});
