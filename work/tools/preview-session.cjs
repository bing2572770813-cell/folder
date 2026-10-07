const {performance} = require('node:perf_hooks');

async function openPreview({startServer, config, timeoutMs = 5000}) {
  // Port zero is assigned atomically by the OS, so existing previews cannot be reused by mistake.
  const app = await startServer({...config, port: 0});
  try {
    const address = app.server.address();
    const url = 'http://127.0.0.1:' + address.port + '/';
    const checks = [];
    for (const route of ['/', '/game.html', '/api/prefabs']) {
      const started = performance.now();
      const response = await fetch(new URL(route, url), {signal: AbortSignal.timeout(timeoutMs)});
      if (response.status !== 200) throw new Error(route + ': HTTP ' + response.status);
      const contentType = response.headers.get('content-type') ?? '';
      if (route === '/api/prefabs') {
        const catalog = await response.json();
        if (!contentType.includes('application/json') || !Array.isArray(catalog.prefabs) || !catalog.prefabs.length ||
            !Array.isArray(catalog.tags) || !Array.isArray(catalog.errors) || catalog.errors.length) {
          throw new Error('Invalid prefab catalog: ' + JSON.stringify(catalog.errors ?? catalog));
        }
      } else {
        const html = await response.text();
        if (!contentType.includes('text/html') || !/<!doctype html>/i.test(html) || !/<script\b/i.test(html)) {
          throw new Error(route + ': expected a built HTML application');
        }
      }
      checks.push({path: route, status: response.status, durationMs: Math.round(performance.now() - started)});
    }
    return {app, url, checks};
  } catch (error) {
    await app.close();
    throw error;
  }
}

async function main() {
  const {startServer} = require('../backend/dist/server.js');
  const {loadBackendConfig} = require('../backend/dist/config.js');
  const preview = await openPreview({startServer, config: loadBackendConfig({}, {workRoot: require('node:path').resolve(__dirname, '..')})});
  try {
    console.log(JSON.stringify({url: preview.url, checks: preview.checks}));
  } finally {await preview.app.close();}
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
module.exports = {openPreview};
