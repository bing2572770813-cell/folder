import test from 'node:test';
import assert from 'node:assert/strict';
import {importTreeMap,serializeTreeMap} from '../dist/entities/tree-serialization.js';
import {projectProperties} from '../../core/property-model.mjs';

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

test('permission projection removes legacy properties and their component/tag duplicates',()=>{
  const map=source();
  Object.assign(map.tiles[0][0],{
    terrain:'fire',blocked:true,folds:['h'],fold:'h',
    terrainConfig:{damage:8,secret:9,public:3},
    tags:{spawn:true,secret:'hidden'},
    properties:{values:[{public:1,secret:2}]},
    propertySchema:{
      height:{serializable:false},blocked:{serializable:false},folds:{serializable:false},
      terrainConfig:{children:{damage:{serializable:false},secret:{serializable:false}}},
      tags:{children:{secret:{serializable:false}}},
      properties:{children:{values:{items:{children:{secret:{serializable:false}}}}}},
    },
  });
  const imported=importTreeMap(map);
  imported.world.setRuntime('entity-0-0','surface',{secret:'runtime'});
  const before=imported.world.serialize();
  const saved=serializeTreeMap(imported.world,imported.metadata,imported.cellTags,{projectProperties});
  const node=saved.entities[0];
  assert.equal(node.configuration.height,undefined);
  assert.equal(node.components.surface.height,undefined);
  assert.equal(node.components.collision.blocked,undefined);
  assert.deepEqual(node.components.fire,{public:3});
  assert.deepEqual(node.components.fold,{});
  assert.equal(node.configuration.fold,undefined);
  assert.deepEqual(node.tags,{spawn:true});
  assert.deepEqual(node.configuration.properties,{values:[{public:1}]});
  assert.equal(node.id,before[0].id);
  assert.equal(node.prefabId,before[0].prefabId);
  assert.equal(node.transformId,before[0].transformId);
  assert.deepEqual(saved.transforms,imported.world.transforms.serialize());
  assert.deepEqual(imported.world.serialize(),before);
  assert.deepEqual(serializeTreeMap(imported.world).entities,before);
  const restored=importTreeMap(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored.world.serialize(),saved.entities);
  assert.deepEqual(restored.world.runtime(node.id,'surface'),{});
  assert.deepEqual(serializeTreeMap(restored.world).entities,saved.entities);
});

test('dynamic permission schema filters key name and terrain config without changing cell region',()=>{
  const map=source();
  Object.assign(map.tiles[0][0],{terrain:'key',keyName:'secret',terrainConfig:{nested:{secret:2,public:3}},fold:'v'});
  const imported=importTreeMap(map);
  const saved=serializeTreeMap(imported.world,imported.metadata,imported.cellTags,{
    projectProperties,
    schemaFor:()=>({keyName:{serializable:false},fold:{serializable:false},terrainConfig:{children:{nested:{children:{secret:{serializable:false}}}}}}),
  });
  assert.deepEqual(saved.entities[0].components.key,{nested:{public:3}});
  assert.equal(saved.entities[0].configuration.keyName,undefined);
  assert.deepEqual(saved.entities[0].components.fold,{directions:[]});
  assert.deepEqual(saved.cellTags,imported.cellTags);
});

test('virtual void fold permissions remove directions while preserving structural nodes',()=>{
  const imported=importTreeMap(source());
  const before=imported.world.serialize();
  const virtual=before.find(node=>node.prefabId==='void_ai');
  assert.equal(virtual.configuration,undefined);
  const saved=serializeTreeMap(imported.world,imported.metadata,imported.cellTags,{
    projectProperties,
    schemaFor:node=>node.prefabId==='void_ai'?{folds:{serializable:false}}:{},
  });
  const filtered=saved.entities.find(node=>node.id===virtual.id);
  assert.deepEqual(filtered.components.fold,{});
  assert.equal(filtered.configuration,undefined);
  assert.equal(filtered.transformId,virtual.transformId);
  assert.deepEqual(filtered.static,virtual.static);
  assert.deepEqual(saved.transforms,imported.world.transforms.serialize());
  assert.deepEqual(imported.world.serialize(),before);
  assert.deepEqual(importTreeMap(saved).world.get(virtual.id),filtered);
});

test('cell permission projection filters regions independently and preserves raw snapshots',()=>{
  const imported=importTreeMap(source());
  imported.cellTags['0,0'].public='keep';
  imported.cellTags['1,1']={regionTag:'empty-cell-region',public:'also keep'};
  const before=structuredClone(imported.cellTags);
  const entities=imported.world.serialize();
  const calls=[];
  const saved=serializeTreeMap(imported.world,imported.metadata,imported.cellTags,{
    projectProperties,
    schemaForCell:(r,c,tags)=>{
      calls.push([r,c,tags.regionTag]);
      return {regionTag:{serializable:false}};
    },
  });
  assert.deepEqual(saved.cellTags,{'0,0':{public:'keep'},'1,1':{public:'also keep'}});
  assert.deepEqual(calls,[[0,0,'A'],[1,1,'empty-cell-region']]);
  assert.deepEqual(imported.cellTags,before);
  assert.deepEqual(imported.world.serialize(),entities);
  assert.deepEqual(serializeTreeMap(imported.world,imported.metadata,imported.cellTags).cellTags,before);
  assert.deepEqual(importTreeMap(saved).cellTags,saved.cellTags);
});
