const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {openPreview} = require('../preview-session.cjs');

async function fixture(run, response = (req, res) => {
  res.setHeader('Content-Type', req.url === '/api/prefabs' ? 'application/json' : 'text/html');
  res.end(req.url === '/api/prefabs' ? JSON.stringify({prefabs: [{id: 'paper'}], tags: [], errors: []}) : '<!doctype html><script>app()</script>');
}) {
  const server = http.createServer(response);
  let closed = 0;
  const startServer = async config => {
    assert.equal(config.port, 0);
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
    return {server, close: async () => {
      closed++;
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }};
  };
  try {await run(startServer, () => closed);} finally {
    if (server.listening) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
  }
}

test('checks editor, game and catalog on its own port and closes explicitly', () => fixture(async (startServer, closed) => {
  const preview = await openPreview({startServer, config: {port: 4173}});
  assert.match(preview.url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.deepEqual(preview.checks.map(item => item.path), ['/', '/game.html', '/api/prefabs']);
  assert.equal(closed(), 0);
  await preview.app.close();
  assert.equal(closed(), 1);
}));
test('missing page fails and releases the server', () => fixture(async (startServer, closed) => {
  await assert.rejects(openPreview({startServer, config: {}}), /game.html.*404/);
  assert.equal(closed(), 1);
}, (req, res) => {res.statusCode = req.url === '/game.html' ? 404 : 200; res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><script></script>');}));
test('a broken catalog is not reported as ready', () => fixture(async (startServer, closed) => {
  await assert.rejects(openPreview({startServer, config: {}}), /catalog/);
  assert.equal(closed(), 1);
}, (req, res) => {
  res.setHeader('Content-Type', req.url === '/api/prefabs' ? 'application/json' : 'text/html');
  res.end(req.url === '/api/prefabs' ? JSON.stringify({prefabs: [], tags: [], errors: ['bad prefab']}) : '<!doctype html><script></script>');
}));
test('stalled HTTP requests time out and release the server', () => fixture(async (startServer, closed) => {
  await assert.rejects(openPreview({startServer, config: {}, timeoutMs: 100}), /timed out|abort/i);
  assert.equal(closed(), 1);
}, () => {}));
