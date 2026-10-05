import assert from 'node:assert/strict';
import * as THREE from 'three';
import runtime from './player.cjs';
import {blocked,foldsAt} from './tile-model.mjs';
import {validateRegions,taggedCells,regionOf,migrateRegions} from './regions.mjs';
import {uniqueFoldAxes,foldGroupAt,inFoldRange} from './fold-geometry.mjs';
import {createTerrainState,canEnterTerrain,enterTerrain,finishAction,validateTerrains} from './special-terrain.mjs';
const map={width:5,height:5,tiles:Array.from({length:5},()=>Array(5).fill(null)),spawn:{r:0,c:0,dir:2},exit:null,maxSteps:0,bestSteps:null};
for(const [r,c,regionTag,tags] of [[0,0,'A',{spawn:true}],[0,1,'A',{exitTo:'B'}],[1,0,'A',{}],[3,3,'B',{entry:true}],[3,4,'B',{}]])map.tiles[r][c]={color:'white',regionTag,tags,height:.09,blocked:false};
const P=runtime.createPlayerState(map.spawn),nodes=new Map(),group=new THREE.Group(),ring={},noop=()=>{};
const inside=(r,c)=>r>=0&&c>=0&&r<5&&c<5;
const isHidden=(r,c)=>P.mode==='play'&&map.tiles[r]?.[c]&&!P.revealedRegions.has(regionOf(map.tiles[r][c]));
const walkable=(r,c)=>inside(r,c)&&!!map.tiles[r][c]&&!blocked(map.tiles[r][c])&&!isHidden(r,c)&&map.tiles[r][c].terrain!=='campfire';
let controller;
const env={state:P,THREE,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},getMap:()=>map,getFoldAxes:()=>uniqueFoldAxes(map),getPlayerGroup:()=>group,getSelectionRing:()=>ring,getEffectLayer:()=>new THREE.Group(),invalidateAxes:noop,isHidden,blocked,inside,walkable,canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord:(r,c)=>`${r},${c}`,FOLD_NAMES:{},clone:structuredClone,persist:noop,toast:noop,record:()=>controller.recordPlay(),updateUI:noop,buildPaper:noop,renderPlayer:noop,disposableClear:noop,overlay:noop,tileOutline:noop,wx:c=>c,wz:r=>r,tileTop:()=>.09};
controller=runtime.createPlayerController(env);controller.resetRegions();assert.equal(controller.validateForPlay().valid,true);
controller.setMode('play');assert.equal(P.terrainState.hasKey,false);assert.deepEqual([...P.revealedRegions],['A']);assert.equal(controller.canMoveTo(3,3),false);
controller.click(3,4);assert.deepEqual(P.player,{r:0,c:0,dir:2});assert.equal(P.legalMoves.length,0);
controller.click(0,0);assert.equal(P.legalMoves.length,2);controller.movePlayer(0,1);
assert.deepEqual(P.player,{r:3,c:3,dir:2});assert.deepEqual([...P.revealedRegions],['A','B']);assert.equal(P.steps,1);assert.equal(P.terrainState.hasKey,false,'区域出口不需要钥匙');assert.equal(P.levelWon,false,'区域出口跳转不会触发终点通关');assert.equal(P.animation.type,'teleport');assert.equal(controller.canMoveTo(3,4),true);
controller.tick(performance.now()+1000);assert.equal(P.moving,false);
const snapshot=controller.snapshot();snapshot.revealedRegions.push('unrelated');assert.equal(P.revealedRegions.has('unrelated'),false);
controller.undo();assert.deepEqual(P.player,map.spawn);assert.deepEqual([...P.revealedRegions],['A']);assert.equal(P.steps,0);
controller.click(0,0);controller.movePlayer(0,1);controller.tick(performance.now()+1000);controller.restart();assert.deepEqual([...P.revealedRegions],['A']);assert.equal(P.playHistory.length,0);assert.deepEqual(P.player,map.spawn);
controller.turn(-1);assert.equal(P.player.dir,1);
controller.setMode('edit');assert.deepEqual(P.player,map.spawn);
const bad=structuredClone(map);bad.tiles[1][0].tags={entry:true};assert.ok(validateRegions(bad).length);
console.log('PASS: player-only control, initial region, cumulative transitions, terrain actions, animation, independent snapshots, undo, restart and facing.');

map.tiles[1][0].terrain='key';map.tiles[1][0].keyName='铜';map.tiles[1][1]={color:'yellow',terrain:'key',keyName:'银',regionTag:'A',height:.09,blocked:false};map.tiles[0][1].tags.requiredKeys=['铜','银'];
controller.setMode('play');assert.equal(controller.validateForPlay().valid,true);
P.player={r:0,c:1,dir:2};controller.applyTerrainEntry();assert.equal(P.player.r,0);assert.deepEqual([...P.revealedRegions],['A']);
P.player={r:1,c:0,dir:2};controller.applyTerrainEntry();assert.deepEqual(P.terrainState.collectedKeys,['铜']);
P.player={r:0,c:1,dir:2};controller.applyTerrainEntry();assert.equal(P.player.r,0,'一把钥匙不足以跳转');
const keysSnapshot=controller.snapshot();P.player={r:1,c:1,dir:2};controller.applyTerrainEntry();assert.deepEqual(P.terrainState.collectedKeys,['铜','银']);assert.deepEqual(keysSnapshot.terrainState.collectedKeys,['铜']);
P.player={r:0,c:1,dir:2};controller.applyTerrainEntry();assert.deepEqual(P.player,{r:3,c:3,dir:2});controller.restore(keysSnapshot);assert.deepEqual(P.terrainState.collectedKeys,['铜']);controller.restart();assert.deepEqual(P.terrainState.collectedKeys,[]);
map.tiles[0][1].tags.requiredKeys=['不存在'];assert.equal(controller.validateForPlay().valid,false);map.tiles[0][1].tags.requiredKeys=[];assert.equal(controller.validateForPlay().valid,true);map.tiles[1][1].blocked=true;map.tiles[0][1].tags.requiredKeys=['银'];assert.equal(controller.validateForPlay().valid,false);
console.log('PASS: all-key exit gates, missing/blocked keys, independent collection snapshots and restart.');

map.tiles[0][1].tags.requiredKeys=[];map.tiles[0][0].terrain='key';map.tiles[0][0].keyName='起点钥匙';controller.restart();assert.deepEqual(P.terrainState.collectedKeys,['起点钥匙']);

// Completing either animation performs the same guarded player click as mouse input.
delete map.tiles[0][1].tags.exitTo;delete map.tiles[0][1].tags.requiredKeys;
map.tiles[0][2]={color:'white',regionTag:'A',height:.09,blocked:false};map.tiles[1][2]={color:'white',regionTag:'A',height:.09,blocked:false};
map.foldCells=[0,1,2].map(r=>({r,c:1,type:'v'}));controller.restart();controller.click(0,0);controller.movePlayer(1,0);assert.equal(P.legalMoves.length,0,'动画期间不提前选中');controller.tick(performance.now()+1000);assert.equal(ring.visible,true);assert.ok(P.legalMoves.some(p=>p.r===0&&p.c===0));const moveHistory=P.playHistory.length;controller.click(0,0);assert.equal(P.steps,2,'自动选择支持直接点击下一个目标');controller.tick(performance.now()+1000);assert.equal(P.playHistory.length,moveHistory+1,'自动选择不会添加历史步骤');controller.selectFold(0,1);controller.teleport();assert.deepEqual({r:P.player.r,c:P.player.c},{r:0,c:2});controller.tick(performance.now()+1000);assert.equal(ring.visible,true);assert.equal(P.chosenFold,null);assert.ok(P.legalMoves.some(p=>p.r===0&&p.c===1));assert.equal(P.steps,3);assert.equal(P.teleports,1);
map.exit={r:0,c:0};controller.selectFold(0,1);controller.teleport();controller.tick(performance.now()+1000);assert.equal(P.levelWon,true);assert.equal(ring.visible,false,'通关后不重新开启可移动选区');assert.equal(P.legalMoves.length,0);
console.log('PASS: automatic player selection after walking and folding, consecutive movement, unchanged action history and terminal guard.');
