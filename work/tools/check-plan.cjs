const path = require('node:path');
const fs = require('node:fs');

function createCheckPlan(cwd, scope = 'all') {
  if (!['all', 'backend', 'frontend', 'tools', 'prepare'].includes(scope)) {
    throw new Error('Unknown check scope: ' + scope);
  }
  const node = (name, args) => ({name, command: process.execPath, args});
  const tests = (directory, suffix) => {
    const files = fs.readdirSync(path.join(cwd, directory)).filter(file => file.endsWith(suffix)).sort();
    if (!files.length) throw new Error('Required test suite is empty: ' + directory);
    return files.map(file => directory + '/' + file);
  };
  const steps = [];
  if (scope === 'all' || scope === 'tools') steps.push(node('tool-tests', ['--test', ...tests('tools/test', '.test.cjs')]));
  if (scope !== 'tools') {
    const tsc = path.join(path.dirname(require.resolve('typescript/package.json', {paths: [cwd]})), 'bin/tsc');
    steps.push(node('backend-build', [tsc, '-p', 'backend/tsconfig.json']));
  }
  if (scope === 'all' || scope === 'backend') steps.push(node('backend-tests', ['--test', ...tests('backend/test', '.test.mjs')]));
  if (['all', 'frontend', 'prepare'].includes(scope)) steps.push(node('html-build', ['build.cjs']));
  if (scope === 'all' || scope === 'frontend') steps.push(node('frontend-tests', ['test-runner.cjs', ...(scope==='all'?['--frontend-only']:[])]));
  if (scope === 'all') {
    steps.push({name: 'working-diff', command: 'git', args: ['diff', '--check']});
    steps.push({name: 'staged-diff', command: 'git', args: ['diff', '--cached', '--check']});
  }
  return steps;
}
module.exports = {createCheckPlan};
