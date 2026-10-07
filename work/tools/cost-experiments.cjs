const fs = require('node:fs');
const path = require('node:path');
const {createHash, randomUUID} = require('node:crypto');
const {runChecks} = require('./check-runner.cjs');
const {createCheckPlan} = require('./check-plan.cjs');
const {frontendFiles} = require('./frontend-test-files.cjs');
function summarize(samples) {
  if (!samples.length) throw new Error('Cannot summarize empty samples');
  if (samples.some(sample => sample.status !== 'pass')) throw new Error('Cannot summarize failed samples as savings');
  const values = samples.map(sample => sample.durationMs).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return {medianMs: values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2,
    minMs: values[0], maxMs: values.at(-1), runs: values.length};
}
function outputDigest(root) {
  const hash = createHash('sha256');
  function walk(directory) {
    for (const item of fs.readdirSync(directory, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
      const file = path.join(directory, item.name);
      if (item.isDirectory()) walk(file);
      else if (item.name.endsWith('.js')) hash.update(JSON.stringify([path.relative(root, file), fs.readFileSync(file).toString('base64')]));
    }
  }
  walk(root);
  return hash.digest('hex');
}

async function main() {
  const rounds = Number(process.argv[2] ?? 3);
  if (process.argv.length > 3 || !Number.isInteger(rounds) || rounds < 3 || rounds > 10) {
    throw new Error('Usage: npm run experiment:cost -- [rounds: 3..10]');
  }
  const cwd = path.resolve(__dirname, '..');
  const directory = path.join(cwd, '.dev-checks', 'experiment-' + randomUUID().slice(0, 8));
  const outputRoot = path.join(directory, 'runs');
  fs.mkdirSync(directory, {recursive: true});
  const samples = {}, cold = {};
  const node = (name, args) => ({name, command: process.execPath, args});
  async function execute(step) {
    const report = await runChecks([step], {cwd, outputRoot, write: () => {}});
    if (report.status !== 'pass') throw new Error('Experiment failed: ' + step.name + '; log: ' + report.steps[0].logPath);
    return {status: report.status, durationMs: report.steps[0].durationMs, logPath: report.steps[0].logPath};
  }
  const prepared = await runChecks(createCheckPlan(cwd, 'prepare'), {cwd, outputRoot});
  if (prepared.status !== 'pass') throw new Error('Preparation failed');
  const files = frontendFiles(cwd);
  const frontend = [node('legacy-serial', ['test-runner.cjs']),
    ...[1, 2, 4].map(count => node('isolated-' + count, ['--test', '--test-concurrency=' + count, ...files]))];
  const compiler = createCheckPlan(cwd, 'backend')[0];
  const normalRoot = path.join(directory, 'compiler-normal'), incrementalRoot = path.join(directory, 'compiler-incremental');
  const compilers = [node('compiler-normal', [...compiler.args, '--outDir', normalRoot]),
    node('compiler-incremental', [...compiler.args, '--outDir', incrementalRoot, '--incremental', '--tsBuildInfoFile', path.join(directory, 'incremental.tsbuildinfo')])];
  const cases = [...frontend, ...compilers];
  // Separate warm-up from samples and rotate order to reduce ordering bias.
  for (const step of cases) {cold[step.name] = await execute(step); samples[step.name] = [];}
  for (let round = 0; round < rounds; round++) {
    const ordered = [...cases.slice(round % cases.length), ...cases.slice(0, round % cases.length)];
    for (const step of ordered) {
      const sample = await execute(step); samples[step.name].push(sample);
      console.log(step.name + ' round ' + (round + 1) + ': ' + sample.durationMs + 'ms');
    }
  }
  if (outputDigest(normalRoot) !== outputDigest(incrementalRoot)) throw new Error('Compiler output mismatch');
  const summary = Object.fromEntries(Object.entries(samples).map(([name, values]) => [name, summarize(values)]));
  const result = {nodeVersion: process.version, platform: process.platform, rounds, frontendFiles: files, cold, samples, summary,
    compilerOutputsMatch: true, limitations: 'Warm unchanged-source runs; same frontend files, not coverage equivalence. No inference about total development time or edited-source incremental correctness.'};
  fs.writeFileSync(path.join(directory, 'comparison.json'), JSON.stringify(result, null, 2) + '\n');
  console.table(summary);
  console.log('Comparison: ' + path.join(directory, 'comparison.json'));
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});
module.exports = {frontendFiles, summarize, outputDigest};
