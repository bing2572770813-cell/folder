const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {createCheckPlan} = require('../check-plan.cjs');
const cwd = path.resolve(__dirname, '../..');
const names = mode => createCheckPlan(cwd, mode).map(step => step.name);

test('full verification retains all suites and diff checks', () => {
  assert.deepEqual(names('all'), ['tool-tests', 'backend-build', 'backend-tests', 'html-build', 'frontend-tests', 'working-diff', 'staged-diff']);
});
test('backend feedback does not build HTML or run frontend tests', () => {
  assert.deepEqual(names('backend'), ['backend-build', 'backend-tests']);
});
test('frontend feedback compiles shared backend dependencies first', () => {
  assert.deepEqual(names('frontend'), ['backend-build', 'html-build', 'frontend-tests']);
});
test('invalid scope fails instead of silently passing an empty plan', () => {
  assert.throws(() => createCheckPlan(cwd, 'typo'), /Unknown check scope/);
});
