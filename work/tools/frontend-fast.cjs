const path = require('node:path');
const {runChecks} = require('./check-runner.cjs');
const {createCheckPlan} = require('./check-plan.cjs');
const {frontendFiles} = require('./cost-experiments.cjs');
const concurrency = Number(process.argv[2] ?? 4);
if (process.argv.length > 3 || ![1, 2, 4].includes(concurrency)) {
  console.error('Usage: npm run frontend:fast -- [1|2|4]'); process.exitCode = 2;
} else {
  const cwd = path.resolve(__dirname, '..');
  const steps = createCheckPlan(cwd, 'prepare');
  steps.push({name: 'frontend-isolated-' + concurrency, command: process.execPath, args: ['--test', '--test-concurrency=' + concurrency, ...frontendFiles(cwd)]});
  console.log('Partial frontend verification; run npm run check before committing.');
  runChecks(steps, {cwd, outputRoot: path.join(cwd, '.dev-checks')}).then(report => {process.exitCode = report.status === 'pass' ? 0 : 1;})
    .catch(error => {console.error(error); process.exitCode = 1;});
}
