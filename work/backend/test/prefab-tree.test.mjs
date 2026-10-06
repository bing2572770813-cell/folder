import test from 'node:test';
import assert from 'node:assert/strict';
import {PrefabRegistry} from '../dist/entities/prefab-definition.js';

const paper={id:'paper_ai',components:{surface:{height:.09,color:'white'},collision:{blocked:false}},static:{events:['enter'],walkable:true}};
test('inherits objects, replaces arrays and isolates instances from defaults',()=>{
  const registry=new PrefabRegistry([paper,{id:'fire_ai',extends:'paper_ai',components:{fire:{damage:1},surface:{color:'red'}},static:{events:['enter','leave']}}]);
  const merged=registry.resolve('fire_ai');
  assert.deepEqual(merged.components.surface,{height:.09,color:'red'});
  assert.deepEqual(merged.static.events,['enter','leave']);
  const a=registry.instantiate('fire_ai','a','ta');const b=registry.instantiate('fire_ai','b','tb');
  a.components.surface.height=2;
  assert.equal(b.components.surface.height,.09);
  assert.equal(registry.resolve('fire_ai').components.surface.height,.09);
  assert.throws(()=>{a.static.walkable=false;},TypeError);
  assert.equal(a.id,'a');assert.equal(a.transformId,'ta');
});
test('rejects cycles, missing parents, identity injection and non-JSON definitions',()=>{
  assert.throws(()=>new PrefabRegistry([{id:'a',extends:'b'},{id:'b',extends:'a'}]).resolve('a'),/cycle/);
  assert.throws(()=>new PrefabRegistry([{id:'a',extends:'missing'}]).resolve('a'),/Unknown prefab/);
  assert.throws(()=>new PrefabRegistry([{id:'a',transformId:'stolen'}]),/identity/);
  assert.throws(()=>new PrefabRegistry([{id:'a',components:{surface:{height:NaN}}}]),/JSON/);
});
test('serializing an instance preserves merged configuration but no runtime state',()=>{
  const registry=new PrefabRegistry([paper]);const entity=registry.instantiate('paper_ai','e','t');
  const persisted=JSON.parse(JSON.stringify(entity));
  assert.equal(persisted.components.surface.height,.09);
  assert.equal(persisted.state,undefined);assert.equal(persisted.extends,undefined);
});
