import test from 'node:test';
import assert from 'node:assert/strict';
import {importTreeMap,serializeTreeMap} from '../dist/entities/tree-serialization.js';

const source=()=>({version:1,width:3,height:3,name:'旧地图',spawn:{r:0,c:0,dir:0},tiles:[[{prefabId:'paper_ai',height:.09,regionTag:'A',tags:{spawn:true},properties:{values:[1,2]}},null,null],[null,null,null],[null,null,null]],foldCells:[{r:2,c:2,type:'h'}]});
test('old map import and tree save retain identities, local transforms and configuration',()=>{
  const imported=importTreeMap(source());const world=imported.world;
  world.setRuntime('entity-0-0','surface',{temporary:5});
  const saved=serializeTreeMap(world,imported.metadata,imported.cellTags);
  const restored=importTreeMap(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.world.serialize(),world.serialize());
  assert.equal(saved.legacyMetadata.name,'旧地图');
  assert.equal(saved.entities[0].state,undefined);
  assert.equal(saved.index,undefined);
  assert.deepEqual(restored.world.runtime('entity-0-0','surface'),{});
  assert.equal(restored.cellTags['0,0'].regionTag,'A');
});
test('tree load rejects missing IDs and cycles without mutating source',()=>{
  const imported=importTreeMap(source());const saved=serializeTreeMap(imported.world,imported.metadata);
  const missing=structuredClone(saved);missing.entities[0].transformId='missing';
  assert.throws(()=>importTreeMap(missing),/Unknown/);
  const cyclic=structuredClone(saved);cyclic.transforms[0].parentId=cyclic.transforms[0].id;
  assert.throws(()=>importTreeMap(cyclic),/cycle/);
  assert.equal(saved.transforms[0].parentId,null);
  assert.throws(()=>importTreeMap({...saved,version:3}),/version/);
});
test('region belongs to the cell and does not move with entity Transform',()=>{
  const imported=importTreeMap(source());
  imported.cellTags['1,1']={regionTag:'B'};
  imported.world.transforms.setLocal('transform-0-0',{r:1,c:1,dir:0});
  assert.equal(imported.cellTags['0,0'].regionTag,'A');
  assert.equal(imported.cellTags['1,1'].regionTag,'B');
  assert.equal(imported.world.at(1,1)[0].tags.region,undefined);
  const restored=importTreeMap(serializeTreeMap(imported.world,imported.metadata,imported.cellTags));
  assert.equal(restored.cellTags['1,1'].regionTag,'B');
});
