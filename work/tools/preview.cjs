const path = require('node:path');
const {runChecks} = require('./check-runner.cjs');
const {createCheckPlan} = require('./check-plan.cjs');
const {openPreview} = require('./preview-session.cjs');

async function main() {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && args[0] !== '--smoke')) {
    console.error('Usage: npm run preview -- [--smoke]');
    process.exitCode = 2;
    return;
  }
  const cwd = path.resolve(__dirname, '..');
  const steps = createCheckPlan(cwd, 'prepare');
  steps.push({name: 'preview-http', command: process.execPath, args: ['tools/preview-session.cjs']});
  const report = await runChecks(steps, {cwd, outputRoot: path.join(cwd, '.dev-checks')});
  if (report.status !== 'pass') {process.exitCode = 1; return;}
  if (args[0] === '--smoke') return;
  const {startServer, installShutdownHandlers} = require('../backend/dist/server.js');
  const {loadBackendConfig} = require('../backend/dist/config.js');
  const preview = await openPreview({startServer, config: loadBackendConfig({}, {workRoot: cwd})});
  installShutdownHandlers(preview.app);
  console.log('Editor: ' + preview.url);
  console.log('Game: ' + new URL('game.html', preview.url));
  console.log('Preview ready; Ctrl+C stops this server. Re-run after changing source.');
}
main().catch(error => {console.error(error); process.exitCode = 1;});
