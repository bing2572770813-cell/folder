const fs = require('node:fs');
const path = require('node:path');

function validateReport(report) {
  if (!report || typeof report.cwd !== 'string' || !['pass', 'fail'].includes(report.status) ||
      !Number.isFinite(report.durationMs) || !Array.isArray(report.steps) || !report.steps.length ||
      report.steps.some(step => !step || typeof step.name !== 'string' || !['pass', 'fail', 'skipped'].includes(step.status))) {
    throw new Error('Invalid check report');
  }
  const failure = report.steps.find(step => step.status === 'fail');
  if ((report.status === 'fail') !== Boolean(failure) || (report.status === 'pass' && report.steps.some(step => step.status !== 'pass'))) {
    throw new Error('Invalid check report: inconsistent status');
  }
  if (failure && (typeof failure.command !== 'string' || !Array.isArray(failure.args) ||
      failure.args.some(arg => typeof arg !== 'string') || typeof failure.logPath !== 'string')) {
    throw new Error('Invalid check report: failure command or log missing');
  }
}
function loadReport(outputRoot, explicitPath) {
  let reportPath = explicitPath;
  if (!reportPath) {
    const latestPath = path.join(outputRoot, 'latest.json');
    if (!fs.existsSync(latestPath)) throw new Error('No check report; run a check first');
    const latest = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    if (typeof latest.reportPath !== 'string') throw new Error('Invalid latest report pointer');
    reportPath = latest.reportPath;
  }
  reportPath = path.resolve(reportPath);
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  validateReport(report);
  const failure = report.steps.find(step => step.status === 'fail');
  const evidence = {tail: [], error: null};
  if (failure) {
    let fd;
    try {
      fd = fs.openSync(failure.logPath, 'r');
      const size = fs.fstatSync(fd).size, length = Math.min(size, 65536);
      const buffer = Buffer.alloc(length);
      const read = fs.readSync(fd, buffer, 0, length, size - length);
      evidence.tail = buffer.subarray(0, read).toString('utf8').trimEnd().split(/\r?\n/).slice(-16).map(line => line.slice(-4096));
    } catch (error) {evidence.error = error.message;}
    finally {if (fd !== undefined) fs.closeSync(fd);}
  }
  return {report, reportPath, evidence};
}
function quotePowerShell(value) {
  return "'" + value.replace(/'/g, "''") + "'";
}
function describeReport(report, reportPath, evidence = {tail: []}) {
  validateReport(report);
  const lines = [
    'Recorded snapshot: ' + report.status.toUpperCase() + '; ' + (report.durationMs / 1000).toFixed(2) + 's',
    'Report: ' + reportPath,
    'Working directory: ' + report.cwd,
    'Recorded stages: ' + report.steps.map(step => step.name).join(', '),
    'This snapshot does not verify current source or unrecorded checks.',
  ];
  const failure = report.steps.find(step => step.status === 'fail');
  if (failure) {
    lines.push('Failure: ' + failure.name + '; exit ' + failure.exitCode + (failure.signal ? '; signal ' + failure.signal : ''));
    if (failure.error) lines.push('Error: ' + failure.error);
    lines.push('Evidence: ' + failure.logPath);
    if (evidence.error) lines.push('Log unavailable: ' + evidence.error);
    if (evidence.tail.length) lines.push('Last log lines:', ...evidence.tail);
    lines.push('Rerun failed stage in PowerShell (rebuild prerequisites after source changes):');
    lines.push('Set-Location -LiteralPath ' + quotePowerShell(report.cwd));
    lines.push('& ' + [failure.command, ...failure.args].map(quotePowerShell).join(' '));
    lines.push('A passing rerun covers this stage only; run full verification before committing.');
  }
  return lines.join('\n');
}
function main() {
  if (process.argv.length > 3) throw new Error('Usage: npm run check:report -- [report.json]');
  const {report, reportPath, evidence} = loadReport(path.resolve(__dirname, '../.dev-checks'), process.argv[2]);
  console.log(describeReport(report, reportPath, evidence));
}
if (require.main === module) {
  try {main();} catch (error) {console.error(error.message); process.exitCode = 1;}
}
module.exports = {loadReport, describeReport, quotePowerShell};
