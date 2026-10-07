const test = require('node:test');
const assert = require('node:assert/strict');
const {classifyFiles} = require('../affected-check.cjs');

test('recommends the narrow scope for one subsystem', () => {
  assert.equal(classifyFiles(['work/backend/src/app.ts', 'work/backend/test/app.test.mjs']).scope, 'backend');
  assert.equal(classifyFiles(['work/render/paper.mjs', 'work/test-paper.mjs']).scope, 'frontend');
  assert.equal(classifyFiles(['work/tools/check.cjs']).scope, 'tools');
});

test('widens mixed backend and frontend changes to the full check', () => {
  const result = classifyFiles(['work/backend/src/app.ts', 'work/app.js']);
  assert.equal(result.scope, 'all');
  assert.deepEqual(Object.keys(result.reasons).sort(), ['backend', 'frontend']);
});

test('ignores generated and documentation changes', () => {
  const result = classifyFiles(['outputs/index.html', 'docs/notes.md']);
  assert.equal(result.scope, null);
  assert.deepEqual(result.files, []);
});

test('root workflow files are treated as frontend changes', () => {
  assert.equal(classifyFiles(['work/test-runner.cjs']).scope, 'frontend');
  assert.equal(classifyFiles(['work/player.cjs']).scope, 'frontend');
});
