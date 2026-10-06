import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../dist/app.js';

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fold-output-'));
  await fs.writeFile(path.join(root, 'index.html'), '<h1>ok</h1>');
  await fs.writeFile(path.join(root, 'asset.js'), 'console.log(1);');
  return root;
}

test('serves the root index and static assets', async () => {
  const outputRoot = await fixture();
  const app = await createApp({port: 4173, outputRoot, prefabRoot: outputRoot}, {readCatalog: async () => ({prefabs: [], tags: [], errors: []})});
  const root = await app.inject('/');
  assert.equal(root.statusCode, 200);
  assert.match(root.body, /<h1>ok<\/h1>/);
  assert.equal(root.headers['content-type'], 'text/html; charset=utf-8');
  const asset = await app.inject('/asset.js');
  assert.equal(asset.statusCode, 200);
  assert.equal(asset.headers['content-type'], 'text/javascript; charset=utf-8');
  await app.close();
});

test('returns 404 and rejects encoded path traversal', async () => {
  const outputRoot = await fixture();
  const app = await createApp({port: 4173, outputRoot, prefabRoot: outputRoot}, {readCatalog: async () => ({prefabs: [], tags: [], errors: []})});
  assert.equal((await app.inject('/missing.txt')).statusCode, 404);
  assert.ok([403, 404].includes((await app.inject('/%2e%2e/%2e%2e/secret')).statusCode));
  await app.close();
});

test('static reader failures distinguish missing files from server IO errors',async()=>{
 const outputRoot=await fixture();let code='ENOENT';
 const app=await createApp({port:4173,outputRoot,prefabRoot:outputRoot},{readStaticFile:async()=>{throw Object.assign(new Error('unreadable'),{code});}});
 try{
  assert.equal((await app.inject('/asset.js')).statusCode,404);
  code='EACCES';const failure=await app.inject('/asset.js');assert.equal(failure.statusCode,500);assert.deepEqual(failure.json(),{error:'文件读取失败'});
  assert.equal((await app.inject('/%ZZ')).statusCode,400);
 }finally{await app.close();await fs.rm(outputRoot,{recursive:true,force:true});}
});
