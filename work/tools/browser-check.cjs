const path = require('node:path');
const {runChecks} = require('./check-runner.cjs');
const {createCheckPlan} = require('./check-plan.cjs');
const cwd = path.resolve(__dirname, '..');
const steps = createCheckPlan(cwd, 'prepare');
steps.push({name: 'browser-smoke', command: process.execPath, args: ['tools/browser-smoke.cjs']});
runChecks(steps, {cwd, outputRoot: path.join(cwd, '.dev-checks')}).then(report => {process.exitCode = report.status === 'pass' ? 0 : 1;})
  .catch(error => {console.error(error); process.exitCode = 1;});
