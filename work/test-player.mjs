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
controller.click(0,0);assert.equal(P.legalMoves.length,2);controller.click(0,0);assert.equal(ring.visible,false);assert.equal(P.legalMoves.length,0);assert.equal(P.steps,0);assert.equal(P.playHistory.length,0);controller.click(0,0);assert.equal(ring.visible,true);assert.equal(P.legalMoves.length,2);controller.movePlayer(0,1);
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

map.exit=null;for(const [r,c] of [[0,1],[1,0],[1,1]])map.tiles[r][c].blocked=true;controller.restart();controller.click(0,0);assert.equal(ring.visible,true);assert.equal(P.legalMoves.length,0);controller.click(0,0);assert.equal(ring.visible,false,'即使没有可移动方块也能取消选中');assert.equal(P.steps,0);assert.equal(P.playHistory.length,0);console.log('PASS: player click toggles selection, including zero legal moves, without actions or history.');

let drawnOverlays=0;env.overlay=()=>{drawnOverlays++;};const hintController=runtime.createPlayerController({...env,overlay:()=>drawnOverlays++});P.mode='play';hintController.resetRegions();P.player={r:0,c:0,dir:2};hintController.selectFold(0,1);assert.equal(drawnOverlays,2);drawnOverlays=0;hintController.setFoldHints(false);assert.equal(drawnOverlays,2,'关闭提示仍显示选定折线的源和落点');assert.ok(nodes.get('foldDetail').textContent.includes('→'));assert.equal(P.chosenFold.type,'v');drawnOverlays=0;hintController.setFoldHints(true);assert.equal(drawnOverlays,2);assert.equal(P.steps,0);console.log('PASS: fold displacement hints toggle without changing the selected axis or action counts.');

hintController.restart();hintController.setFreeTeleport(true);const beforeFree=hintController.snapshot();hintController.click(4,4);assert.deepEqual(P.player,beforeFree.player);hintController.click(1,0);assert.deepEqual(P.player,beforeFree.player);hintController.click(3,3);assert.deepEqual(P.player,{r:3,c:3,dir:2});assert.ok(P.revealedRegions.has('B'));assert.equal(P.steps,1);assert.equal(P.teleports,1);hintController.tick(performance.now()+1000);assert.equal(ring.visible,true);hintController.undo();assert.deepEqual(P.player,beforeFree.player);assert.deepEqual([...P.revealedRegions],beforeFree.revealedRegions);assert.equal(P.steps,0);hintController.setFreeTeleport(false);hintController.click(3,3);assert.deepEqual(P.player,beforeFree.player);hintController.setFreeTeleport(true);hintController.setMode('edit');assert.equal(P.freeTeleport,false);console.log('PASS: testing teleport rejects void/blocked cells, reveals regions, preserves facing, supports undo and disables in edit mode.');

for(const [r,c] of [[0,1],[1,0],[1,1]])map.tiles[r][c].blocked=false;hintController.setMode('play');hintController.setFoldHints(true);hintController.click(0,0);assert.ok(P.legalFoldMoves.some(p=>p.r===0&&p.c===2));hintController.setFoldHints(false);assert.equal(ring.visible,true);assert.equal(P.legalFoldMoves.length,0);assert.ok(P.legalMoves.length);hintController.selectFold(0,1);assert.equal(nodes.get('teleportBtn').disabled,false);hintController.setFoldHints(true);hintController.click(0,0);hintController.click(0,2);assert.equal(P.player.c,2);assert.equal(P.teleports,1);assert.equal(P.steps,1);hintController.tick(performance.now()+1000);assert.ok(P.legalFoldMoves.some(p=>p.r===0&&p.c===0));hintController.undo();hintController.selectPlayer();map.tiles[0][2].blocked=true;hintController.click(0,2);assert.equal(P.player.c,0,'执行时重新校验传送合法性');hintController.selectPlayer();assert.ok(!P.legalFoldMoves.some(p=>p.r===0&&p.c===2));console.log('PASS: selected player exposes all valid fold destinations, toggle refreshes selection, direct destinations teleport and stale invalid targets are rejected.');

map.tiles[0][2].blocked=false;map.tiles[2][0]={color:'white',regionTag:'A',height:.09,blocked:false};map.foldCells.push(...[0,1,2].map(c=>({r:1,c,type:'h'})));hintController.selectPlayer();assert.ok(P.legalFoldMoves.some(p=>p.r===0&&p.c===2));assert.ok(P.legalFoldMoves.some(p=>p.r===2&&p.c===0));map.tiles[2][0].regionTag='B';hintController.selectPlayer();assert.ok(!P.legalFoldMoves.some(p=>p.r===2&&p.c===0),'未揭示区域不会被列入合法传送');map.tiles[2][0].regionTag='A';map.tiles[2][0].terrain='eruption';hintController.selectPlayer();assert.ok(!P.legalFoldMoves.some(p=>p.r===2&&p.c===0),'机制进入限制仍生效');console.log('PASS: multiple fold axes are aggregated while unrevealed regions and closed mechanisms are excluded.');
// Asymmetric walking height limits: exact boundary, stale targets, folds and debug lifecycle.
map.tiles[1][0].terrain=undefined;map.tiles[0][0].terrain=undefined;map.tiles[0][0].height=.1;map.tiles[1][0].height=1.1;hintController.restart();
assert.equal(hintController.canMoveTo(1,0),true);map.tiles[1][0].height=1.101;assert.equal(hintController.canMoveTo(1,0),false);
hintController.setPlayerProperties({r:0,c:0,dir:4,maxUp:2,maxDown:.2});assert.deepEqual(P.moveHeight,{maxUp:2,maxDown:.2});assert.equal(P.player.dir,4);assert.equal(hintController.canMoveTo(1,0),true);
P.player={r:1,c:0,dir:4};assert.equal(hintController.canMoveTo(0,0),false);P.player={r:0,c:0,dir:4};map.tiles[0][2].height=10;assert.equal(hintController.foldTarget({r:0,c:1,type:'v'}).valid,true,'折纸不受高度差限制');
const debugBefore=hintController.snapshot(),historyBefore=P.playHistory.length;assert.throws(()=>hintController.setPlayerProperties({r:4,c:4,dir:0,maxUp:1,maxDown:1}),/可通行/);assert.deepEqual(hintController.snapshot(),debugBefore);assert.equal(P.playHistory.length,historyBefore);
assert.throws(()=>hintController.setPlayerProperties({r:0,c:0,dir:0,maxUp:-1,maxDown:1}),/高度差/);
hintController.setPlayerProperties({r:0,c:0,dir:2,maxUp:0,maxDown:0});hintController.undo();assert.deepEqual(P.moveHeight,debugBefore.moveHeight);assert.equal(P.steps,debugBefore.steps);
hintController.restart();assert.deepEqual(P.moveHeight,{maxUp:1,maxDown:1});assert.deepEqual(P.player,map.spawn);
console.log('PASS: asymmetric walking heights, inclusive boundaries, unlimited folds, atomic player edits, undo and restart.');
map.tiles[0][3]={color:'white',terrain:'key',keyName:'调试钥匙',regionTag:'A',height:.09,blocked:false};
const statusArgs={r:P.player.r,c:P.player.c,dir:P.player.dir,maxUp:1,maxDown:1};
const statusBefore=hintController.snapshot();hintController.setPlayerProperties({...statusArgs,overheat:5,frozen:true,actions:2,collectedKeys:['调试钥匙','调试钥匙']});
assert.equal(P.terrainState.overheat,5);assert.equal(P.terrainState.frozen,true);assert.equal(P.terrainState.actions,2);assert.equal(P.terrainState.eruptionOpen,true);assert.equal(P.terrainState.hasKey,true);assert.deepEqual(P.terrainState.collectedKeys,['调试钥匙']);assert.equal(P.steps,statusBefore.steps);
const statusEdited=hintController.snapshot(),statusHistory=P.playHistory.length;
for(const invalid of [{overheat:-1},{overheat:1.5},{actions:Infinity},{frozen:'yes'},{collectedKeys:['不存在']}])assert.throws(()=>hintController.setPlayerProperties({...statusArgs,...invalid}));
assert.deepEqual(hintController.snapshot(),statusEdited);assert.equal(P.playHistory.length,statusHistory);
hintController.undo();assert.deepEqual(P.terrainState,statusBefore.terrainState);hintController.setPlayerProperties({...statusArgs,overheat:3,frozen:true,actions:5,collectedKeys:[]});assert.equal(P.terrainState.hasKey,false);hintController.restart();assert.equal(P.terrainState.overheat,0);assert.equal(P.terrainState.frozen,false);assert.equal(P.terrainState.actions,0);
console.log('PASS: mechanism state debugging, derived key/eruption states, validation, independent undo and lifecycle reset.');
// Entry-free exits reveal cumulatively without relocation, duplicate actions or destination effects.
hintController.setMode('edit');map.tiles[0][1].tags={exitTo:'B',requiredKeys:[]};delete map.tiles[3][3].tags.entry;
assert.equal(hintController.validateForPlay().valid,true);hintController.setMode('play');hintController.selectPlayer();hintController.movePlayer(0,1);
assert.deepEqual(P.player,{r:0,c:1,dir:2});assert.ok(P.revealedRegions.has('B'));assert.equal(P.animation.type,'move');assert.equal(P.steps,1);assert.equal(P.teleports,0);assert.equal(P.terrainState.actions,1);
hintController.tick(performance.now()+1000);hintController.undo();assert.deepEqual(P.player,map.spawn);assert.deepEqual([...P.revealedRegions],['A']);assert.equal(P.terrainState.actions,0);
map.tiles[0][1].tags.requiredKeys=['调试钥匙'];hintController.selectPlayer();hintController.movePlayer(0,1);assert.equal(P.revealedRegions.has('B'),false);hintController.tick(performance.now()+1000);hintController.restart();
hintController.setPlayerProperties({r:P.player.r,c:P.player.c,dir:P.player.dir,maxUp:1,maxDown:1,collectedKeys:['调试钥匙']});hintController.selectPlayer();hintController.movePlayer(0,1);assert.equal(P.revealedRegions.has('B'),true);assert.equal(P.player.c,1);
console.log('PASS: entry-free exits reveal without teleport; key gates, action counts and undo remain valid.');
