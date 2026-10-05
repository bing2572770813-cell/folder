import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import catalog from './prefab-catalog.cjs';
import {normalizeTagPrefab,assertTagAttachment} from './tags/tag-model.mjs';
const folder=await fs.mkdtemp(path.join(os.tmpdir(),'fold-tags-'));
try{
  const definition={version:1,id:'fold_ai',name:'折线',BaseEntity:['paper_ai','void_ai'],behavior:{scriptId:'tag-fold',parameters:{},state:{}},properties:{direction:{serializable:true}}};
  await catalog.saveTagPrefab(definition,folder);const loaded=await catalog.readCatalog(folder);
  assert.equal(loaded.tags.length,1);assert.equal(loaded.prefabs.length,0);assert.equal(loaded.errors.length,0);
  await assert.rejects(catalog.saveTagPrefab(definition,folder),/已存在/);
  const map={tiles:[[null,{prefabId:'paper_ai'},{prefabId:'obstacle_ai'}]]};
  assert.doesNotThrow(()=>assertTagAttachment(loaded.tags,'tag-fold',map,0,0));
  assert.doesNotThrow(()=>assertTagAttachment(loaded.tags,'tag-fold',map,0,1));
  assert.throws(()=>assertTagAttachment(loaded.tags,'tag-fold',map,0,2),/不能附着/);
  assert.throws(()=>normalizeTagPrefab({...definition,BaseEntity:undefined}),/必须声明/);
  assert.throws(()=>normalizeTagPrefab({...definition,behavior:{scriptId:'execute-path'}}),/未注册/);
  await fs.writeFile(path.join(folder,'tag','broken.json'),'invalid');
  const partial=await catalog.readCatalog(folder);assert.equal(partial.tags.length,1);assert.equal(partial.errors[0].file,'tag/broken.json');
}finally{await fs.rm(folder,{recursive:true,force:true});}
console.log('PASS: tag serialization/catalog isolation, backend-only no-overwrite writes, controlled behaviors and entity/void attachment constraints.');
