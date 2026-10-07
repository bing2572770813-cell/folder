const path = require('node:path');
const {spawnSync} = require('node:child_process');

const workRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(workRoot, '..');
const ignoredPrefixes = ['outputs/', 'docs/', '.dev-checks/'];

function normalize(file) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '');
}

function changedFiles({git = runGit} = {}) {
  const tracked = git(['diff', '--name-only', 'HEAD']);
  const staged = git(['diff', '--cached', '--name-only']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...tracked, ...staged, ...untracked].map(normalize))].sort();
}

function runGit(args) {
  const result = spawnSync('git', ['-C', repoRoot, ...args], {encoding: 'utf8', windowsHide: true});
  if (result.error || result.status !== 0) {
    throw new Error(result.error?.message ?? (result.stderr.trim() || `git ${args.join(' ')} failed`));
  }
  return result.stdout.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
}

function classifyFiles(files) {
  const relevant = files.filter(file => !ignoredPrefixes.some(prefix => file.startsWith(prefix)));
  const scopes = new Set();
  const reasons = new Map();
  for (const file of relevant) {
    const relative = file.startsWith('work/') ? file.slice('work/'.length) : file;
    let scope = null;
    if (relative.startsWith('tools/')) scope = 'tools';
    else if (relative.startsWith('backend/')) scope = 'backend';
    else if (/^(editor|entities|render|resources|tags|ui|core)\//.test(relative)
      || /^(app|build|server|player|test-runner)\.(cjs|mjs|js|ts|tsx)$/.test(relative)
      || /^(index|game)\.html$/.test(relative)) scope = 'frontend';
    if (scope) {
      scopes.add(scope);
      if (!reasons.has(scope)) reasons.set(scope, []);
      reasons.get(scope).push(file);
    }
  }
  const scope = scopes.size > 1 ? 'all' : [...scopes][0] ?? null;
  return {scope, files: relevant, reasons: Object.fromEntries(reasons)};
}

function recommendation(files = changedFiles()) {
  return classifyFiles(files);
}

function printRecommendation(result) {
  if (!result.files.length) {
    console.log('No relevant source changes detected.');
    return;
  }
  if (!result.scope) {
    console.log('Only documentation or generated-file changes detected; no scoped check is required.');
    console.log('Before committing, run: npm run check');
    return;
  }
  console.log(`Recommended check scope: ${result.scope}`);
  for (const [scope, files] of Object.entries(result.reasons)) {
    console.log(`${scope}: ${files.join(', ')}`);
  }
  console.log(`Command: npm run check -- ${result.scope}`);
  console.log('Before committing, run: npm run check');
}

function runRecommended(scope) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return spawnSync(npm, ['run', 'check', '--', scope], {cwd: workRoot, stdio: 'inherit', windowsHide: true}).status ?? 1;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--run', '--json'].includes(arg))) {
    console.error('Usage: npm run check:affected [-- --run|--json]');
    process.exitCode = 2;
  } else {
    try {
      const result = recommendation();
      if (args.includes('--json')) console.log(JSON.stringify(result, null, 2));
      else printRecommendation(result);
      process.exitCode = args.includes('--run') && result.scope ? runRecommended(result.scope) : 0;
    } catch (error) {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}

module.exports = {classifyFiles, changedFiles, recommendation};
