import assert from 'node:assert/strict';
import { creaseGuides } from './render/crease-guides.mjs';
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
        normalizeTile({ prefabId: 'paper_ai', height: HEIGHT, thickness: 0.025, folds: [] }),
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
console.log('PASS: dash/dot crease hints hug the groove on paper, ride the void plane elsewhere and respect visibility.');
