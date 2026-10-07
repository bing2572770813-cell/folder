const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {loadReport, describeReport, quotePowerShell} = require('../check-report.cjs');

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'check-report-'));
  try {run(directory);} finally {fs.rmSync(directory, {recursive: true, force: true});}
}
const failed = cwd => ({cwd, nodeVersion: process.version, status: 'fail', durationMs: 125,
  steps: [{name: 'backend-build', status: 'pass', durationMs: 100},
    {name: 'backend-tests', status: 'fail', durationMs: 25, exitCode: 7, signal: null, error: null,
      command: process.execPath, args: ['--test', 'backend/test/a.test.mjs'], logPath: path.join(cwd, 'test.log')},
    {name: 'html-build', status: 'skipped'}]});

test('one report lookup provides failure evidence and the exact stage rerun', () => fixture(directory => {
  const reportPath = path.join(directory, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(failed(directory)));
  fs.writeFileSync(path.join(directory, 'latest.json'), JSON.stringify({reportPath}));
  fs.writeFileSync(path.join(directory, 'test.log'), 'Earlier output\nAssertionError: movement failed\n');
  const loaded = loadReport(directory);
  const output = describeReport(loaded.report, loaded.reportPath, loaded.evidence);
  assert.match(output, /backend-tests.*exit 7/);
  assert.match(output, /test\.log/);
  assert.match(output, /Set-Location -LiteralPath/);
  assert.match(output, /'--test' 'backend\/test\/a\.test\.mjs'/);
  assert.match(output, /snapshot/);
  assert.match(output, /prerequisites/);
  assert.match(output, /AssertionError: movement failed/);
  assert.doesNotMatch(output, /'build\.cjs'/);
}));
test('log summaries are bounded and missing logs do not hide valid reports', () => fixture(directory => {
  const reportPath = path.join(directory, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(failed(directory)));
  fs.writeFileSync(path.join(directory, 'test.log'), 'noise\n'.repeat(20000) + 'Last failure detail\n');
  const loaded = loadReport(directory, reportPath);
  assert.ok(loaded.evidence.tail.length <= 16);
  assert.match(loaded.evidence.tail.join('\n'), /Last failure detail/);
  fs.unlinkSync(path.join(directory, 'test.log'));
  assert.match(loadReport(directory, reportPath).evidence.error, /ENOENT/);
}));
test('passing a recorded partial check does not claim complete verification', () => {
  const output = describeReport({cwd: 'C:/repo', status: 'pass', durationMs: 1, steps: [{name: 'backend-tests', status: 'pass', durationMs: 1}]}, 'report.json');
  assert.match(output, /Recorded stages: backend-tests/);
  assert.doesNotMatch(output, /Rerun failed stage/);
});
test('PowerShell literals cannot expand argument contents', () => {
  assert.equal(quotePowerShell("a'b $(Get-Content secret) `value"), "'a''b $(Get-Content secret) `value'");
});
test('missing or malformed evidence fails clearly', () => fixture(directory => {
  assert.throws(() => loadReport(directory), /No check report/);
  const reportPath = path.join(directory, 'broken.json');
  fs.writeFileSync(reportPath, '{}');
  assert.throws(() => loadReport(directory, reportPath), /Invalid check report/);
  assert.throws(() => describeReport({...failed(directory), steps: []}, reportPath), /Invalid check report/);
}));
