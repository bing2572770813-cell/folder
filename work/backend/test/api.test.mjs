import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../dist/app.js';

const config = {port: 4173, outputRoot: 'C:/output', prefabRoot: 'C:/prefab'};

test('GET /api/prefabs returns the catalog and disables caching', async () => {
  const app = await createApp(config, {readCatalog: async folder => ({
    prefabs: [{id: 'paper_ai'}], tags: [], errors: [], folder,
  })});
  const response = await app.inject({method: 'GET', url: '/api/prefabs'});
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.json(), {prefabs: [{id: 'paper_ai'}], tags: [], errors: [], folder: 'C:/prefab'});
  await app.close();
});

test('non-GET /api/prefabs returns 405', async () => {
  const app = await createApp(config, {readCatalog: async () => ({prefabs: [], tags: [], errors: []})});
  const response = await app.inject({method: 'POST', url: '/api/prefabs'});
  assert.equal(response.statusCode, 405);
  assert.deepEqual(response.json(), {error: '方法无效'});
  await app.close();
});

test('catalog failures return a JSON 400 error', async () => {
  const app = await createApp(config, {readCatalog: async () => { throw new Error('目录不可读'); }});
  const response = await app.inject({method: 'GET', url: '/api/prefabs'});
  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {error: '目录不可读'});
  await app.close();
});
