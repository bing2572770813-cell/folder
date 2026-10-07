import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../dist/app.js';
test('asset route serves models/textures and confines decoded paths and symlinks to the asset root',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'fold-visual-'));
 await fs.mkdir(path.join(root,'assets/model'),{recursive:true});await fs.mkdir(path.join(root,'assets/texture'));
 await fs.writeFile(path.join(root,'assets/model/key_ai.fbx'),'FBX fixture');await fs.writeFile(path.join(root,'assets/texture/key_ai.png'),Buffer.from([137,80,78,71]));
 await fs.writeFile(path.join(root,'secret.fbx'),'private');await fs.mkdir(path.join(root,'assets/model/escape'));await fs.rm(path.join(root,'assets/model/escape'),{recursive:true});
 await fs.symlink(root,path.join(root,'assets/model/escape'),'junction');
 const app=await createApp({port:4173,outputRoot:root,prefabRoot:path.join(root,'assets/prefab'),assetRoot:path.join(root,'assets')});
 try{
  const model=await app.inject('/assets/model/key_ai.fbx');assert.equal(model.statusCode,200);assert.equal(model.body,'FBX fixture');
  const texture=await app.inject('/assets/texture/key_ai.png');assert.equal(texture.statusCode,200);assert.match(texture.headers['content-type'],/image\/png/);
  for(const url of ['/assets/prefab/key.json','/assets/model/%2e%2e/secret.fbx','/assets/model/escape/secret.fbx','/assets/model/key_ai.fbx%00','/assets/model/key_ai.glb'])assert.ok([400,403,404].includes((await app.inject(url)).statusCode),url);
  assert.equal((await app.inject('/assets/model/missing.fbx')).statusCode,404);
 }finally{await app.close();await fs.rm(root,{recursive:true,force:true});}
});
