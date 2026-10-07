const test = require('node:test');
const assert = require('node:assert/strict');
const {parseScenario} = require('../browser-smoke.cjs');

test('browser smoke accepts the three supported scenario groups', () => {
  assert.equal(parseScenario([]), 'all');
  assert.equal(parseScenario(['--scenario', 'desktop']), 'desktop');
  assert.equal(parseScenario(['--scenario', 'mobile']), 'mobile');
});

test('browser smoke rejects unknown or incomplete scenario arguments', () => {
  assert.throws(() => parseScenario(['--scenario', 'tablet']), /Usage/);
  assert.throws(() => parseScenario(['--scenario']), /Usage/);
  assert.throws(() => parseScenario(['--scenario', 'desktop', 'extra']), /Usage/);
});
