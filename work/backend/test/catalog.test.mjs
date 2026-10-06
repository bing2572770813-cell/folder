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
