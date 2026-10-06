import assert from 'node:assert/strict';
import { creaseGuides, creaseSelection, creaseAreaSelection } from './render/crease-guides.mjs';
import { DEFAULT_CREASE_DEPTH } from './render/paper-surface.mjs';
import { uniqueFoldAxes } from './tags/fold-geometry.mjs';
import { normalizeTile } from './tile-model.mjs';

const HEIGHT = 0.09;
const DASH = 1 / 3, DOT = 0.035, PERIOD = 2 / 3;
// Mirror of the dash-dot stroke spec: one long dash, then one dot per period.
const expectedDash = length => {
  let total = 0;
  for (let t = 0; t < length; t += PERIOD) total += Math.min(length, t + DASH) - t;
  return total;
};
const expectedDots = length => {
  let total = 0;
  for (let t = 0; t < length; t += PERIOD) if (t + 0.48 < length) total++;
  return total;
};
function fixture(type = 'h', { hollow = false } = {}) {
  const map = {
    width: 7,
    height: 7,
    spawn: { r: 2, c: 3, dir: 0 },
    tiles: Array.from({ length: 7 }, () =>
      Array.from({ length: 7 }, () =>
        normalizeTile({ prefabId: 'paper_ai', height: HEIGHT, thickness: 0.09, folds: [] }),
      ),
    ),
    foldCells: [],
  };
  for (let i = 0; i < 7; i++) {
    const r = type === 'h' ? 3 : type === 'v' ? i : type === 'd1' ? i : 6 - i;
    const c = type === 'v' ? 3 : i;
    if (hollow) map.tiles[r][c] = null;
    else map.tiles[r][c].folds = [type];
    map.foldCells.push({ r, c, type });
  }
  const spawnTile = map.tiles[map.spawn.r][map.spawn.c];
  if (spawnTile) spawnTile.tags = { ...(spawnTile.tags ?? {}), spawn: true };
  return map;
}

for (const type of ['h', 'v', 'd1', 'd2']) {
  const map = fixture(type);
  const groups = uniqueFoldAxes(map);
  assert.equal(groups.length, 1);
  const span = Math.hypot(
    groups[0].to.r - groups[0].from.r,
    groups[0].to.c - groups[0].from.c,
  );
  const guides = creaseGuides(map, groups);
  assert.ok(guides.positions.length, type + ' must emit dash segments');
  assert.equal(guides.positions.length % 6, 0);
  assert.equal(guides.lineCells.length, guides.positions.length / 6);
  assert.ok(guides.positions.every(Number.isFinite));
  let total = 0, longest = 0;
  for (let i = 0; i < guides.positions.length; i += 6) {
    const length = Math.hypot(
      guides.positions[i] - guides.positions[i + 3],
      guides.positions[i + 2] - guides.positions[i + 5],
  );
    assert.ok(length <= DASH + 1e-6, 'segments never exceed one dash');
    total += length; longest = Math.max(longest, length);
  }
  // Surface-conforming sampling adds a little length on sloped grooves.
  const ratio = total / expectedDash(span);
  assert.ok(ratio >= 0.999 && ratio < 1.05, 'dash coverage matches the spec');
  // A dot straddling a cell boundary is emitted once per cell it touches.
  const periods = expectedDots(span);
  assert.ok(
    guides.dots.length >= periods && guides.dots.length <= periods * 2,
    'one dot disc per stroke period',
  );
  for (const dot of guides.dots) {
    assert.equal(dot.positions.length % 9, 0);
    assert.ok(dot.positions.every(Number.isFinite));
    assert.ok(dot.position[1] < HEIGHT - 0.02, 'dot sits at the bottom of the crease');
  }
  // Clicking a crease and starting a fold both render this highlight. Exercise
  // the default as well as the depth supplied by the physics panel.
  const selection = creaseSelection(map, groups[0]);
  assert.ok(selection.positions.length, type + ' must emit a selected highlight');
  assert.equal(selection.cells.length, selection.positions.length / 9);
  assert.ok(selection.positions.every(Number.isFinite));
  assert.ok(selection.cells.every(p=>groups[0].cells.some(q=>q.r===p.r&&q.c===p.c)),
    'crease ribbon has no outline around the reached region');
  assert.deepEqual(selection, creaseSelection(map, groups[0], {
    creaseDepth: DEFAULT_CREASE_DEPTH,
  }), 'selection uses the same default crease depth as the paper surface');
  let previousBottom = -Infinity;
  for (const creaseDepth of [0, .25, DEFAULT_CREASE_DEPTH, 1]) {
    const highlight = creaseSelection(map, groups[0], { creaseDepth });
    assert.ok(highlight.positions.every(Number.isFinite));
    const heights = highlight.positions.filter((_, i) => {
      const cell = highlight.cells[Math.floor(i / 9)];
      return i % 3 === 1 && map.tiles[cell.r][cell.c].folds.includes(type);
    });
    const bottom = Math.min(...heights);
    assert.ok(bottom > previousBottom, type + ' highlight follows the configured groove depth');
    previousBottom = bottom;
    if (creaseDepth === 1)
      assert.ok(heights.every(y => Math.abs(y - (HEIGHT + .004)) < 1e-9),
        'a flat paper surface has a flat selection highlight');
  }
  // Void creases: no groove to hug, so the hint rides the supplied plane.
  const hollowMap = fixture(type, { hollow: true });
  const hollowGuides = creaseGuides(hollowMap, uniqueFoldAxes(hollowMap), {
    voidPlane: () => 0.25,
  });
  assert.ok(hollowGuides.positions.length, 'void creases are still drawn');
  for (let i = 0; i < hollowGuides.positions.length; i += 3)
    if (i % 6 === 1) assert.ok(Math.abs(hollowGuides.positions[i] - 0.268) < 1e-6);
}
assert.equal(creaseGuides(fixture(), uniqueFoldAxes(fixture()), { hidden: () => true }).positions.length, 0);
assert.equal(creaseGuides(fixture(), [], {}).positions.length, 0);
const splitMap=fixture();splitMap.tiles[3][3].folds=[];splitMap.foldCells=splitMap.foldCells.filter(p=>p.c!==3);
const splitGroups=uniqueFoldAxes(splitMap);
const otherGuides=creaseGuides(splitMap,splitGroups,{selected:splitGroups[0].cells[0]});
assert.ok(otherGuides.positions.length,'selecting a crease keeps disconnected collinear hints visible');
assert.ok(otherGuides.lineCells.every(p=>splitGroups[1].cells.some(q=>q.r===p.r&&q.c===p.c)));
assert.deepEqual(creaseSelection(fixture(), null), { positions: [], cells: [] });
assert.deepEqual(creaseSelection(fixture(), uniqueFoldAxes(fixture())[0], {
  hidden: () => true,
}), { positions: [], cells: [] });
for(const type of ['h','v','d1','d2']){
  const map=fixture(type),group=uniqueFoldAxes(map)[0];
  const source=creaseAreaSelection(map,[{r:3,c:3,half:1}],group);
  const target=creaseAreaSelection(map,[{r:3,c:3,half:-1}],group,{striped:true});
  const dr=group.to.r-group.from.r,dc=group.to.c-group.from.c;
  for(const [geometry,sign] of [[source,1],[target,-1]]){
    assert.ok(geometry.positions.length&&geometry.positions.every(Number.isFinite));
    assert.equal(geometry.cells.length,geometry.positions.length/9);
    for(let i=0;i<geometry.positions.length;i+=3){
      const x=geometry.positions[i],z=geometry.positions[i+2];
      assert.ok((x*dr-z*dc)*sign>=-1e-8,'axis-cell tint is clipped to its correct half');
    }
  }
  assert.ok(target.stripes.length,'target has a pattern as well as its color');
  assert.equal(target.stripeCells.length,target.stripes.length/9);
  assert.equal(source.stripes.length,0);
  const hidden=creaseAreaSelection(map,[{r:3,c:3}],group,{hidden:()=>true});
  assert.equal(hidden.positions.length,0);
  map.tiles[3][3]=null;assert.equal(creaseAreaSelection(map,[{r:3,c:3}],group).positions.length,0);
}
console.log('PASS: crease hints and selection highlights follow groove depth in all four directions and respect visibility.');
