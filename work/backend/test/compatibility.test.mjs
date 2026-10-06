import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createRequire} from 'node:module';
import {readCatalog as typedRead} from '../dist/resources/catalog.js';

test('legacy CommonJS catalog entry delegates to the typed adapter', async () => {
  const legacy = createRequire(import.meta.url)(path.resolve('prefab-catalog.cjs'));
  const root = path.resolve('../assets/prefab');
  const typed = await typedRead(root);
  const compat = await legacy.readCatalog(root);
  assert.deepEqual(compat, typed);
});
