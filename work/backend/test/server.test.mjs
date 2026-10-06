import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startServer} from '../dist/server.js';
import {EventEmitter} from 'node:events';
import * as server from '../dist/server.js';

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

test('shutdown signals close once and release both listeners',async t=>{
 const app=await startServer({port:0,outputRoot:os.tmpdir(),prefabRoot:os.tmpdir()});
 t.after(()=>app.close());
 const signals=new EventEmitter();let closes=0;
 const closed=new Promise(resolve=>app.server.once('close',()=>{closes++;resolve();}));
 server.installShutdownHandlers(app,signals);
 signals.emit('SIGTERM');signals.emit('SIGINT');await closed;
 assert.equal(closes,1);assert.equal(signals.listenerCount('SIGTERM'),0);assert.equal(signals.listenerCount('SIGINT'),0);
});

test('explicit close removes handlers and shutdown rejection is reported once',async t=>{
 const app=await startServer({port:0,outputRoot:os.tmpdir(),prefabRoot:os.tmpdir()}),signals=new EventEmitter();
 t.after(()=>app.close());
 server.installShutdownHandlers(app,signals);await app.close();assert.equal(signals.listenerCount('SIGTERM'),0);
 let attempts=0;const errors=[];
 server.installShutdownHandlers({server:new EventEmitter(),close:async()=>{attempts++;throw new Error('close failed');}},signals,error=>errors.push(error));
 signals.emit('SIGINT');signals.emit('SIGTERM');await new Promise(resolve=>setImmediate(resolve));
 assert.equal(attempts,1);assert.equal(errors[0].message,'close failed');
});

test('executable startup installs process handlers and explicit close restores baseline',async t=>{
 const before={int:process.listenerCount('SIGINT'),term:process.listenerCount('SIGTERM')};
 const app=await server.runServer({port:0,outputRoot:os.tmpdir(),prefabRoot:os.tmpdir()});t.after(()=>app.close());
 assert.equal(process.listenerCount('SIGINT'),before.int+1);assert.equal(process.listenerCount('SIGTERM'),before.term+1);
 await app.close();assert.equal(process.listenerCount('SIGINT'),before.int);assert.equal(process.listenerCount('SIGTERM'),before.term);
});
