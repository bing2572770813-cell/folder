import assert from 'node:assert/strict';
import { canEnterTerrain, createTerrainState, enterTerrain, finishAction, validateTerrains } from './special-terrain.mjs';

const map = { width: 4, height: 2, tiles: [
  [{ terrain: 'campfire' }, { terrain: 'ice' }, { terrain: 'ice' }, { terrain: 'key' }],
  [{ terrain: null }, { terrain: 'fire' }, { terrain: 'eruption' }, { terrain: 'goal' }],
] };
let state = createTerrainState();
let result = enterTerrain(map, { r: 0, c: 0 }, state);
assert.equal(result.valid, false, '篝火方块不可进入');
state = { ...state, frozen: true };
result = enterTerrain(map, { r: 1, c: 0 }, state);
assert.equal(result.state.frozen, false, '篝火相邻方块应立即解除冰冻');
state = { ...result.state, frozen: true };
result = enterTerrain(map, { r: 0, c: 2 }, state);
assert.equal(result.state.gameOver, true, '冰冻状态再次进入冰河应结束');
state = createTerrainState();
for (let i = 0; i < 5; i++) state = finishAction(state);
assert.equal(canEnterTerrain(map, { r: 1, c: 2 }, state).valid, true);
result = enterTerrain(map, { r: 1, c: 1 }, state);
assert.equal(result.state.overheat, 1);
for (let i = 0; i < 5; i++) result = enterTerrain(map, { r: 1, c: 1 }, result.state);
assert.equal(result.gameOver, true, '过热达到六层应结束游戏');
state = createTerrainState();
result = enterTerrain(map, { r: 0, c: 3 }, state);
assert.equal(result.state.hasKey, true);
result = enterTerrain(map, { r: 1, c: 3 }, result.state);
assert.equal(result.won, true);
assert.equal(canEnterTerrain(map, { r: 1, c: 2 }, createTerrainState()).valid, false, '喷发初始应关闭');
for (const count of [1, 3, 4, 6]) assert.equal(canEnterTerrain(map, { r: 1, c: 2 }, { ...createTerrainState(), actions: count }).valid, false);
for (const count of [2, 5, 8]) assert.equal(canEnterTerrain(map, { r: 1, c: 2 }, { ...createTerrainState(), actions: count }).valid, true);
assert.deepEqual(validateTerrains(map), []);
console.log('PASS: campfire, ice, fire, eruption, key and goal terrain rules.');
