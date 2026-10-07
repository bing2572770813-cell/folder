const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {randomUUID} = require('node:crypto');
const {chromium} = require('playwright-core');
const {openPreview} = require('./preview-session.cjs');
const {assertBrowserEvidence} = require('./browser-evidence.cjs');

function parseScenario(args = process.argv.slice(2)) {
  if (args.length === 0) return 'all';
  if (args.length === 2 && args[0] === '--scenario' && ['all', 'desktop', 'mobile'].includes(args[1])) return args[1];
  throw new Error('Usage: node tools/browser-smoke.cjs [--scenario all|desktop|mobile]');
}

async function main() {
  const scenario = parseScenario();
  const cwd = path.resolve(__dirname, '..');
  const directory = path.join(cwd, '.dev-checks', 'browser-' + randomUUID().slice(0, 8));
  fs.mkdirSync(directory, {recursive: true});
  const started = performance.now(), results = [], errors = [];
  let preview, browser, context, page, failure;
  async function capture(name) {
    const canvas = page.locator('#viewport canvas').first();
    await canvas.waitFor({state: 'visible'});
    await page.waitForFunction(() => {
      const element = document.querySelector('#viewport canvas');
      return element?.width > 0 && element?.height > 0;
    });
    const png = await canvas.screenshot({path: path.join(directory, name + '-canvas.png')});
    // Decode the actual screenshot, avoiding cleared WebGL drawing buffers.
    const canvasColors = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height), colors = new Set();
      for (let y = 0; y < canvas.height; y += Math.max(1, Math.floor(canvas.height / 80))) {
        for (let x = 0; x < canvas.width; x += Math.max(1, Math.floor(canvas.width / 80))) {
          const i = (y * canvas.width + x) * 4;
          colors.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
        }
      }
      return colors.size;
    }, png.toString('base64'));
    assertBrowserEvidence({errors, canvasColors});
    await page.screenshot({path: path.join(directory, name + '.png'), fullPage: true});
    results.push({name, status: 'pass', canvasColors});
  }
  async function open(viewport, route) {
    context = await browser.newContext({viewport});
    await context.tracing.start({screenshots: true, snapshots: true});
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('requestfailed', request => errors.push(request.url() + ': ' + request.failure()?.errorText));
    page.on('response', response => {if (response.status() >= 400) errors.push(response.url() + ': HTTP ' + response.status());});
    // Browsers request a favicon independently; it is not part of the app's readiness contract.
    await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
    await page.goto(new URL(route, preview.url).href, {waitUntil: 'networkidle'});
  }
  async function closeContext(name) {
    await context.tracing.stop({path: path.join(directory, name + '-trace.zip')});
    await context.close(); context = null; page = null;
  }
  try {
    const {startServer} = require('../backend/dist/server.js');
    const {loadBackendConfig} = require('../backend/dist/config.js');
    preview = await openPreview({startServer, config: loadBackendConfig({}, {workRoot: cwd})});
    const launch = process.env.FOLD_BROWSER_EXECUTABLE ? {executablePath: process.env.FOLD_BROWSER_EXECUTABLE} :
      {channel: process.env.FOLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome')};
    browser = await chromium.launch({...launch, headless: true});
    if (scenario === 'all' || scenario === 'desktop') {
      await open({width: 1280, height: 800}, '/');
      await page.waitForFunction(() => document.getElementById('editMode')?.getAttribute('aria-pressed') === 'true');
      await capture('desktop-editor');
      const originalName = await page.locator('#mapName').inputValue();
      await page.locator('#mapName').fill('Development smoke fixture');
      await page.locator('#mapName').press('Tab');
      assert.equal(await page.locator('#mapName').inputValue(), 'Development smoke fixture');
      await page.locator('#undoBtn').click();
      assert.equal(await page.locator('#mapName').inputValue(), originalName);
      results.push({name: 'rename-and-undo', status: 'pass'});
      await page.locator('#playMode').click();
      await page.waitForFunction(() => document.getElementById('playMode').getAttribute('aria-pressed') === 'true');
      assert.equal(await page.locator('#playPanel').isVisible(), true);
      await page.locator('#restartBtn').click();
      assert.equal(await page.locator('#canvasSteps').textContent(), '00');
      await capture('desktop-play');
      await page.locator('#editMode').click();
      await page.waitForFunction(() => document.getElementById('editMode').getAttribute('aria-pressed') === 'true');
      assert.equal(await page.locator('#editPanel').isVisible(), true);
      await page.reload({waitUntil: 'networkidle'});
      assert.equal(await page.locator('#mapName').inputValue(), originalName);
      await capture('desktop-reload');
      await closeContext('desktop');
    }
    if (scenario === 'all' || scenario === 'mobile') {
      await open({width: 390, height: 844}, '/');
      await capture('mobile-editor');
      await closeContext('mobile-editor');
      await open({width: 390, height: 844}, '/game.html');
      await page.waitForFunction(() => document.body.classList.contains('game-only'));
      await capture('mobile-game');
      await closeContext('mobile-game');
    }
  } catch (error) {
    failure = error;
    if (page) await page.screenshot({path: path.join(directory, 'failure.png'), fullPage: true, timeout: 2000}).catch(() => {});
  } finally {
    if (context) {
      await context.tracing.stop({path: path.join(directory, 'failure-trace.zip')}).catch(() => {});
      await context.close().catch(() => {});
    }
    if (browser) await browser.close().catch(error => {failure ??= error;});
    if (preview) await preview.app.close().catch(error => {failure ??= error;});
    if (errors.length) failure ??= new Error('Browser errors: ' + errors.join('\n'));
    const report = {scenario, status: failure ? 'fail' : 'pass', durationMs: Math.round(performance.now() - started), results, errors,
      failure: failure?.stack ?? null, limitations: 'Smoke scenarios only; screenshots and color checks do not prove visual correctness or performance.'};
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(report.status.toUpperCase() + ' browser smoke: ' + results.length + ' scenarios; ' + report.durationMs + 'ms');
    console.log('Evidence: ' + directory);
  }
  if (failure) throw failure;
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});

module.exports = {parseScenario};
