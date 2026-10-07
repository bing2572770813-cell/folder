const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {frontendFiles} = require('../frontend-test-files.cjs');

test('discovery includes new test and verification files but excludes helpers and directories', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-files-'));
  try {
    for(const file of ['test-new.mjs', 'test-other.cjs', 'verify-new.cjs', 'test-runner.cjs', 'test-notes.txt']) fs.writeFileSync(path.join(directory, file), '');
    fs.mkdirSync(path.join(directory, 'test-directory.cjs'));
    assert.deepEqual(frontendFiles(directory), ['test-new.mjs', 'test-other.cjs', 'verify-new.cjs']);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});

test('empty suites fail rather than report successful verification', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-empty-'));
  try {assert.throws(() => frontendFiles(directory), /empty/);} finally {fs.rmSync(directory, {recursive: true, force: true});}
});

test('default runner discovers a newly added failing test without editing a list', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'frontend-discovery-'));
  try {
    fs.writeFileSync(path.join(directory, 'test-new-regression.mjs'), "throw new Error('new regression discovered');\n");
    const code = `process.exitCode = require(${JSON.stringify(path.resolve(__dirname, '../../test-runner.cjs'))}).runFrontend(${JSON.stringify(directory)})`;
    const result = spawnSync(process.execPath, ['-e', code], {encoding: 'utf8', windowsHide: true});
    assert.equal(result.status, 1);
    assert.match(result.stderr, /new regression discovered/);
  } finally {fs.rmSync(directory, {recursive: true, force: true});}
});
