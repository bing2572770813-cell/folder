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
