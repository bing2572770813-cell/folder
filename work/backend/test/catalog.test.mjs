import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readCatalog, savePrefab, saveTagPrefab} from '../dist/resources/catalog.js';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fold-catalog-'));
  await fs.mkdir(path.join(root, 'entity'), {recursive: true});
  await fs.mkdir(path.join(root, 'tag'), {recursive: true});
  await fs.writeFile(path.join(root, 'entity', 'paper_ai.json'), JSON.stringify({
    version: 1, id: 'paper_ai', name: '纸张',
    tile: {color: 'white', height: 0.09, blocked: false, folds: []},
  }));
  await fs.writeFile(path.join(root, 'tag', 'region_ai.json'), JSON.stringify({
    version: 1, id: 'region_ai', name: '区域', BaseEntity: ['paper_ai'],
    behavior: {scriptId: 'tag-region', parameters: {}, state: {}},
  }));
  await fs.writeFile(path.join(root, 'entity', 'broken.json'), '{');
  return root;
}

test('reads valid definitions and isolates malformed files', async () => {
  const root = await fixture();
  const result = await readCatalog(root);
  assert.equal(result.prefabs.length, 1);
  assert.equal(result.tags.length, 1);
  assert.deepEqual(result.errors.map(error => error.file), ['entity/broken.json']);
});

test('writes new definitions without overwriting an existing id', async () => {
  const root = await fixture();
  await assert.rejects(() => savePrefab(root, {
    version: 1, id: 'paper_ai', name: '重复', tile: {color: 'white', height: 0.09, blocked: false, folds: []},
  }), /已存在/);
  await savePrefab(root, {
    version: 1, id: 'stone_ai', name: '石块', tile: {color: 'black', height: 0.09, blocked: true, folds: []},
  });
  assert.equal(JSON.parse(await fs.readFile(path.join(root, 'entity', 'stone_ai.json'), 'utf8')).id, 'stone_ai');
});

test('writes tags only with generated ids', async () => {
  const root = await fixture();
  await assert.rejects(() => saveTagPrefab(root, {
    version: 1, id: 'region', name: '区域', BaseEntity: ['paper_ai'],
    behavior: {scriptId: 'tag-region', parameters: {}, state: {}},
  }), /_ai/);
});
test('disk catalog resolves inheritance before normalization and isolates broken chains',async()=>{
  const root=await fixture();
  try{
    await fs.writeFile(path.join(root,'entity','a-child.json'),JSON.stringify({version:1,id:'fire_ai',name:'火焰',extends:'paper_ai',tile:{color:'red'},components:{fire:{damage:1}},static:{events:['enter']}}));
    await fs.writeFile(path.join(root,'entity','missing.json'),JSON.stringify({version:1,id:'missing_ai',name:'坏模板',extends:'absent_ai'}));
    const catalog=await readCatalog(root);const child=catalog.prefabs.find(p=>p.id==='fire_ai');
    assert.equal(child.tile.height,.09);assert.equal(child.tile.color,'red');
    assert.deepEqual(child.components,{fire:{damage:1}});assert.deepEqual(child.static.events,['enter']);
    assert.equal(catalog.prefabs.length,2);assert.ok(catalog.errors.some(e=>e.file==='entity/missing.json'));
    await savePrefab(root,{version:1,id:'child_ai',name:'继承写入',extends:'paper_ai',tile:{height:.5},components:{ice:{}}});
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'entity','child_ai.json'),'utf8')).extends,'paper_ai');
    const reread=await readCatalog(root);assert.equal(reread.prefabs.find(p=>p.id==='child_ai').tile.color,'white');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('native disk prefabs inherit component and child defaults without fabricating a tile',async()=>{
 const root=await fixture();try{await savePrefab(root,{version:1,id:'native_ai',name:'原生',components:{key:{name:'铜'}},children:[{prefabId:'paper_ai',local:{r:0,c:1,dir:0}}]});await savePrefab(root,{version:1,id:'native_child_ai',name:'继承',extends:'native_ai',components:{fire:{damage:2}}});const catalog=await readCatalog(root),child=catalog.prefabs.find(p=>p.id==='native_child_ai');assert.equal(child.tile,undefined);assert.deepEqual(child.components,{key:{name:'铜'},fire:{damage:2}});assert.equal(child.children[0].prefabId,'paper_ai');assert.equal(JSON.parse(await fs.readFile(path.join(root,'entity','native_ai.json'),'utf8')).tile,undefined);}finally{await fs.rm(root,{recursive:true,force:true});}
 });
test('catalog rejects invalid static fields on save and reports their source files on read',async()=>{
 const root=await fixture();
 try{
  for(const [index,statics] of [{events:'enter'},{walkable:'false'},{render:1},{transparent:null},{placeable:0},{events:['unknown']},{events:[['enter']]},{events:[{type:'enter'}]},{events:[1]}].entries()){
   const definition={version:1,id:'invalid_'+index+'_ai',name:'invalid',components:{tag:{}},static:statics};
   await assert.rejects(()=>savePrefab(root,definition),/Invalid static/);
   await assert.rejects(()=>fs.stat(path.join(root,'entity',definition.id+'.json')),/ENOENT/);
   await fs.writeFile(path.join(root,'entity',definition.id+'.json'),JSON.stringify(definition));
  }
  const catalog=await readCatalog(root);
  assert.equal(catalog.prefabs.length,1);
  for(let index=0;index<9;index++)assert.ok(catalog.errors.some(error=>error.file==='entity/invalid_'+index+'_ai.json'&&/Invalid static/.test(error.message)));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('catalog preserves valid inherited static fields accepted by entity worlds',async()=>{
 const root=await fixture();try{
  const statics={events:['enter','leave','interact'],walkable:false,render:true,transparent:false,placeable:true,custom:{value:1}};
  await savePrefab(root,{version:1,id:'base_static_ai',name:'base',components:{tag:{}},static:statics});
  await savePrefab(root,{version:1,id:'child_static_ai',name:'child',extends:'base_static_ai',components:{key:{}}});
  const catalog=await readCatalog(root);assert.deepEqual(catalog.prefabs.find(value=>value.id==='child_static_ai').static,statics);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
