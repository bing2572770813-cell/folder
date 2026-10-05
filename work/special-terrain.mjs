export const TERRAIN_TYPES = ['campfire', 'ice', 'fire', 'eruption', 'goal', 'key'];

export function createTerrainState() {
  return { hasKey: false, frozen: false, overheat: 0, actions: 0, gameOver: false, won: false, message: '' };
}

function isTerrain(map, r, c, terrain) {
  return map.tiles[r]?.[c]?.terrain === terrain;
}

function adjacentTo(map, r, c, terrain) {
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    if (isTerrain(map, r + dr, c + dc, terrain)) return true;
  }
  return false;
}

// The eruption cycle is: action 2 open, action 3 closed, action 5 open, ...
export function eruptionOpen(actionCount) {
  return actionCount > 0 && actionCount % 3 === 2;
}

export function canEnterTerrain(map, position, state = createTerrainState()) {
  const terrain = map.tiles[position.r]?.[position.c]?.terrain;
  if (terrain === 'campfire') return { valid: false, reason: '篝火方块不可进入' };
  if (terrain === 'eruption' && !eruptionOpen(state.actions)) return { valid: false, reason: '喷发地形尚未熄火' };
  return { valid: true, reason: '' };
}

export function enterTerrain(map, position, state = createTerrainState()) {
  const check = canEnterTerrain(map, position, state);
  if (!check.valid) return { state: { ...state, message: check.reason }, valid: false, gameOver: false, won: false };
  const next = { ...state, message: '', gameOver: false, won: false };
  const terrain = map.tiles[position.r]?.[position.c]?.terrain;

  if (terrain === 'ice') {
    if (next.frozen) return { state: { ...next, gameOver: true, message: '冰冻状态下再次进入冰河，游戏结束' }, valid: true, gameOver: true, won: false };
    next.frozen = true;
    next.overheat = 0;
  }
  if (terrain === 'fire') {
    next.overheat += 1;
    if (next.overheat >= 6) return { state: { ...next, gameOver: true, message: '过热层数达到 6 层，游戏结束' }, valid: true, gameOver: true, won: false };
  }
  if (adjacentTo(map, position.r, position.c, 'campfire') && next.frozen) {
    next.frozen = false;
    next.message = '篝火解除冰冻';
  }
  if (terrain === 'key' && !next.hasKey) {
    next.hasKey = true;
    next.message = '获得钥匙';
  }
  if (terrain === 'goal' && next.hasKey) {
    next.won = true;
    next.message = '已取得钥匙并到达终点';
  }
  return { state: next, valid: true, gameOver: false, won: next.won };
}

export function finishAction(state = createTerrainState()) {
  const actions = state.actions + 1;
  return { ...state, actions, eruptionOpen: eruptionOpen(actions) };
}

export function validateTerrains(map) {
  const errors = [];
  let keys = 0, goals = 0;
  for (const row of map.tiles) for (const tile of row) {
    if (!tile?.terrain) continue;
    if (!TERRAIN_TYPES.includes(tile.terrain)) errors.push(`未知特殊地形：${tile.terrain}`);
    if (tile.terrain === 'key') keys++;
    if (tile.terrain === 'goal') goals++;
  }
  if (keys > 1) errors.push('每关最多放置一个钥匙');
  if (goals > 1) errors.push('每关最多放置一个终点');
  return errors;
}
