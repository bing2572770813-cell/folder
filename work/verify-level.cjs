(async()=>{
const {uniqueFoldAxes,inFoldRange}=await import('./fold-geometry.mjs');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, '../outputs/fold-field-demo.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, 'player.cjs'), 'utf8');
const reflectSource=source.slice(source.indexOf('function reflectPoint('),source.indexOf('function foldTarget(',source.indexOf('function reflectPoint('))).trim();
const reflect = vm.runInNewContext('(' + reflectSource.replace(/const map\s*=\s*env.getMap\(\);/,'') + ')');
const walk = p => !!map.tiles[p.r]?.[p.c] && map.tiles[p.r][p.c].color !== 'black';
const coord = p => String.fromCharCode(65 + p.c) + (p.r + 1);
const folds = uniqueFoldAxes(map);
function edges(p, axes) {
  const result = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const to = {r:p.r+dr,c:p.c+dc};
    if ((dr || dc) && walk(to)) result.push({to, action:'move'});
  }
  for (const axis of axes) {
    const to = reflect(p.r,p.c,axis);
    if (inFoldRange(axis,p) && walk(to) && coord(to) !== coord(p)) result.push({to, action:axis.type});
  }
  return result;
}
function solve(axes) {
  // Facing does not affect legality or the exit, so coordinate states suffice.
  const start = coord(map.spawn), goal = coord(map.exit);
  const distance = new Map([[start,0]]), ways = new Map([[start,1]]), queue = [map.spawn];
  for (let i=0;i<queue.length;i++) {
    const p=queue[i], k=coord(p), d=distance.get(k);
    for (const {to} of edges(p,axes)) {
      const next=coord(to);
      if (!distance.has(next)) { distance.set(next,d+1); ways.set(next,0); queue.push(to); }
      if (distance.get(next)===d+1) ways.set(next,ways.get(next)+ways.get(k));
    }
  }
  return {steps:distance.get(goal),ways:ways.get(goal)};
}
assert.ok(walk(map.spawn) && walk(map.exit));
assert.deepEqual(solve(folds),{steps:6,ways:1});
assert.equal(solve([]).steps,undefined);
for (const removed of folds) assert.equal(solve(folds.filter(a=>a!==removed)).steps,undefined);
const route=[['h','E3'],['move','F4'],['move','G5'],['h','G7'],['v','M7'],['d1','O5']];
let p=map.spawn;
for (const [action,target] of route) {
  const edge=edges(p,folds).find(e=>e.action===action && coord(e.to)===target);
  assert.ok(edge,`Invalid route action ${coord(p)} -> ${target}`);
  p=edge.to;
}
assert.equal(coord(p),coord(map.exit));
assert.ok(route.length<=map.maxSteps);
assert.equal(walk(reflect(3,5,folds.find(a=>a.type==='h'))),false);
const html=fs.readFileSync(path.join(__dirname,'../outputs/game.html'),'utf8');
const boot=html.match(/<script>(window\.__FOLD_FIELD_EXPORT_MAP__=[\s\S]*?)<\/script>/)[1];
const context={window:{}};vm.runInNewContext(boot,context);
assert.equal(JSON.stringify(context.window.__FOLD_FIELD_EXPORT_MAP__),JSON.stringify(map));
assert.equal(context.window.__FOLD_FIELD_GAME_ONLY__,true);
console.log('PASS: unique 6-step shortest route; all 3 axes required; horizontal axis reused; no walking bypass; blocked intermediate reflection; exported map matches.');

})().catch(error=>{console.error(error);process.exitCode=1;});
