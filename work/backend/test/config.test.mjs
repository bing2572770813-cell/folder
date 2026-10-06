import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {loadBackendConfig} from '../dist/config.js';

test('loads default backend configuration', () => {
  const config = loadBackendConfig({}, {workRoot: 'C:/project/work'});
  assert.equal(config.port, 4173);
  assert.equal(config.outputRoot, path.resolve('C:/project/outputs'));
  assert.equal(config.prefabRoot, path.resolve('C:/project/assets/prefab'));
});

test('accepts a configured port', () => {
  assert.equal(loadBackendConfig({FOLD_PORT: '4175'}, {workRoot: 'C:/project/work'}).port, 4175);
});

test('rejects invalid ports', () => {
  assert.throws(() => loadBackendConfig({FOLD_PORT: '0'}), /FOLD_PORT/);
  assert.throws(() => loadBackendConfig({FOLD_PORT: 'not-a-port'}), /FOLD_PORT/);
});
