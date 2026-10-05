function inside(map, r, c) { return Number.isInteger(r) && Number.isInteger(c) && r >= 0 && c >= 0 && r < map.height && c < map.width; }
function walkable(map, r, c) { return inside(map, r, c) && map.tiles[r][c] && map.tiles[r][c].color !== 'black'; }
function reflectPoint(r, c, axis) {
  if (axis.type === 'h') return { r: 2 * axis.r - r, c };
  if (axis.type === 'v') return { r, c: 2 * axis.c - c };
  if (axis.type === 'd1') return { r: axis.r + (c - axis.c), c: axis.c + (r - axis.r) };
  return { r: axis.r - (c - axis.c), c: axis.c - (r - axis.r) };
}
function foldTarget(map, axis, position) {
  const target = reflectPoint(position.r, position.c, axis);
  if (!inside(map, target.r, target.c)) return { ...target, valid: false, reason: '越界' };
  if (!map.tiles[target.r][target.c]) return { ...target, valid: false, reason: '空格' };
  if (!walkable(map, target.r, target.c)) return { ...target, valid: false, reason: '阻挡' };
  if (target.r === position.r && target.c === position.c) return { ...target, valid: false, reason: '位于轴上' };
  return { ...target, valid: true, reason: '' };
}
function key(position) { return `${position.r},${position.c}`; }

export function validateLevel(map) {
  const errors = [];
  if (!walkable(map, map.spawn.r, map.spawn.c)) errors.push('起点无效');
  if (!map.exit) errors.push('未设置出口');
  else if (!walkable(map, map.exit.r, map.exit.c)) errors.push('出口不可通行');
  for (let r = 0; r < map.height; r++) for (let c = 0; c < map.width; c++) {
    const tile = map.tiles[r][c];
    if (tile?.fold && tile.color === 'black') errors.push(`${String.fromCharCode(65 + c)}${r + 1} 折纸线位于阻挡方块`);
  }
  return errors;
}

export function analyzeLevel(map, options = {}) {
  const errors = validateLevel(map);
  if (errors.length) return { errors, reachable: 0, total: 0, shortest: null, path: null };
  const start = { r: map.spawn.r, c: map.spawn.c };
  const mechanics = options.mechanics || createMechanics().register(movementMechanic);
  const queue = [start];
  const seen = new Set([key(start)]);
  const previous = new Map();
  let goal = null;
  while (queue.length) {
    const current = queue.shift();
    if (current.r === map.exit.r && current.c === map.exit.c) { goal = current; break; }
    const actions = mechanics.actions(createMechanicContext(map, current));
    for (let r = 0; r < map.height; r++) for (let c = 0; c < map.width; c++) {
      const fold = map.tiles[r][c]?.fold;
      if (!fold) continue;
      const target = foldTarget(map, { r, c, type: fold }, current);
      if (target.valid) actions.push({ to: { r: target.r, c: target.c }, kind: 'fold', axis: { r, c, type: fold } });
    }
    for (const action of actions) {
      const nextKey = key(action.to);
      if (seen.has(nextKey)) continue;
      seen.add(nextKey); queue.push(action.to); previous.set(nextKey, { from: current, action });
    }
    if (options.onProgress && seen.size % 24 === 0) options.onProgress(seen.size);
  }
  if (!goal) return { errors: [], reachable: seen.size, total: map.width * map.height, shortest: null, path: null };
  const path = [];
  let cursor = goal;
  while (key(cursor) !== key(start)) { const step = previous.get(key(cursor)); path.unshift({ from: step.from, ...step.action }); cursor = step.from; }
  return { errors: [], reachable: seen.size, total: map.width * map.height, shortest: path.length, path };
}

export function analyzeDependencies(map) {
  const axes = [];
  for (let r = 0; r < map.height; r++) for (let c = 0; c < map.width; c++) {
    const fold = map.tiles[r][c]?.fold;
    if (fold) axes.push({ r, c, type: fold });
  }
  return axes.map(axis => {
    const altered = { ...map, tiles: map.tiles.map(row => row.map(tile => tile ? { ...tile } : tile)) };
    altered.tiles[axis.r][axis.c].fold = null;
    const alternate = analyzeLevel(altered);
    return { axis, required: alternate.shortest === null, alternateSteps: alternate.shortest };
  });
}
import { createMechanics, movementMechanic, createMechanicContext } from './mechanics.mjs';

