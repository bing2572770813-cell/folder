import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../dist/server.js';

test('starts on an ephemeral port and closes cleanly', async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'fold-server-'));
  await fs.writeFile(path.join(outputRoot, 'index.html'), 'ok');
  const app = await startServer({port: 0, outputRoot, prefabRoot: outputRoot}, {
    readCatalog: async () => ({prefabs: [], tags: [], errors: []}),
  });
  const address = app.server.address();
  assert.equal(typeof address, 'object');
  assert.ok(address.port > 0);
  assert.equal((await fetch(`http://127.0.0.1:${address.port}/`)).status, 200);
  await app.close();
});
