const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {frontendFiles, summarize, outputDigest} = require('../cost-experiments.cjs');
const cwd = path.resolve(__dirname, '../..');

test('parallel experiments share the default frontend discovery contract', () => {
  assert.equal(frontendFiles, require('../frontend-test-files.cjs').frontendFiles);
  assert.ok(frontendFiles(cwd).includes('test-player.mjs'));
  assert.ok(frontendFiles(cwd).includes('verify-static.cjs'));
});
test('summaries use medians and reject failed samples', () => {
  const sample = durationMs => ({status: 'pass', durationMs});
  assert.deepEqual(summarize([sample(500), sample(100), sample(200)]), {medianMs: 200, minMs: 100, maxMs: 500, runs: 3});
  assert.throws(() => summarize([{status: 'fail', durationMs: 1}]), /failed/);
  assert.throws(() => summarize([]), /empty/);
});
test('compiler comparison notices missing or changed emitted files', () => {
  const os = require('node:os');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'compiler-digest-'));
  try {
    const a = path.join(root, 'a'), b = path.join(root, 'b');
    fs.mkdirSync(a); fs.mkdirSync(b);
    fs.writeFileSync(path.join(a, 'server.js'), 'first'); fs.writeFileSync(path.join(b, 'server.js'), 'first');
    assert.equal(outputDigest(a), outputDigest(b));
    fs.writeFileSync(path.join(b, 'server.js'), 'second'); assert.notEqual(outputDigest(a), outputDigest(b));
    fs.unlinkSync(path.join(b, 'server.js')); assert.notEqual(outputDigest(a), outputDigest(b));
  } finally {fs.rmSync(root, {recursive: true, force: true});}
});
