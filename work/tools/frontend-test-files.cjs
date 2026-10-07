const fs = require('node:fs');

function frontendFiles(cwd) {
  const files = fs.readdirSync(cwd, {withFileTypes: true}).filter(item => item.isFile() &&
    /^(test-.*\.(mjs|cjs)|verify-.*\.cjs)$/.test(item.name) && item.name !== 'test-runner.cjs').map(item => item.name).sort();
  if (!files.length) throw new Error('Frontend test suite is empty');
  return files;
}
module.exports = {frontendFiles};
