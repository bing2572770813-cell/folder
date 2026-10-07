const test = require('node:test');
const assert = require('node:assert/strict');
const {assertBrowserEvidence} = require('../browser-evidence.cjs');

test('HTTP success cannot hide runtime exceptions or blank canvas evidence', () => {
  assert.throws(() => assertBrowserEvidence({errors: ['TypeError: broken'], canvasColors: 50}), /TypeError/);
  assert.throws(() => assertBrowserEvidence({errors: [], canvasColors: 1}), /blank/);
  assert.throws(() => assertBrowserEvidence({errors: [], canvasColors: undefined}), /blank/);
  assert.doesNotThrow(() => assertBrowserEvidence({errors: [], canvasColors: 50}));
});
