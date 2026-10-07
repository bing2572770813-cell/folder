function assertBrowserEvidence({errors, canvasColors}) {
  if (errors.length) throw new Error('Browser errors: ' + errors.join('\n'));
  if (!Number.isFinite(canvasColors) || canvasColors < 12) throw new Error('Canvas may be blank: sampled colors = ' + canvasColors);
}
module.exports = {assertBrowserEvidence};
