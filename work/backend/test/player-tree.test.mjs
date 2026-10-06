import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import player from '../../player.cjs';
import {EntityWorld} from '../dist/entities/entity-world.js';
import {TransformManager} from '../dist/entities/transform-manager.js';
import {defaultComponents} from '../dist/entities/components.js';
import {createTerrainState,canEnterTerrain,enterTerrain,finishAction} from '../../special-terrain.mjs';
import {validateRegions} from '../../regions.mjs';

function fixture(extra=[]){
 const map={width:4,height:3,tiles:Array.from({length:3},()=>Array.from({length:4},()=>({regionTag:'A',tags:{}}))),spawn:{r:1,c:0,dir:2},exit:null,maxSteps:0};
 map.tiles[1][0].tags.spawn=true;
 const transforms=new TransformManager(4,3);let world=new EntityWorld(transforms);
 function add(id,r,c,components,staticData={}){transforms.create({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});world.add({id,prefabId:'test',transformId:'t-'+id,components,tags:{},static:staticData});}
 for(let r=0;r<3;r++)for(let c=0;c<4;c++)add(`surface-${r}-${c}`,r,c,{surface:{}});
 for(const node of extra)add(...node);
 const state=player.createPlayerState(map.spawn),group=new THREE.Group(),ring={},elements=new Map(),noop=()=>{};
 const registry=defaultComponents();let controller;
 const env={state,THREE,getEntityWorld:()=>world,componentRegistry:registry,getMap:()=>map,
  $:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},
  blocked:tile=>!!tile.blocked,inside:(r,c)=>r>=0&&r<3&&c>=0&&c<4,walkable:()=>true,isHidden:()=>false,
  canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains:()=>[],validateRegions:()=>[],
  taggedCells:(_map,tag)=>map.tiles.flatMap((row,r)=>row.flatMap((tile,c)=>tile.tags[tag]?[{r,c,tile}]:[])),regionOf:tile=>tile.regionTag,
  foldsAt:()=>[],inFoldRange:()=>true,foldGroupAt:noop,getFoldAxes:()=>[],coord:(r,c)=>`${r},${c}`,FOLD_NAMES:{},
  clone:structuredClone,persist:noop,toast:noop,record:()=>controller.recordPlay(),updateUI:noop,buildPaper:noop,renderPlayer:noop,
  disposableClear:noop,overlay:noop,tileOutline:noop,wx:c=>c,wz:r=>r,tileTop:()=>0,
  getSelectionRing:()=>ring,getPlayerGroup:()=>group,getEffectLayer:()=>group,invalidateAxes:noop};
 controller=player.createPlayerController(env);controller.setMode('play');
 const move=(r,c)=>{controller.selectPlayer();controller.movePlayer(r,c);controller.tick(performance.now()+1000);};
 return {map,state,controller,move,add,registry,env,get world(){return world;},replaceWorld:()=>{const snapshot=world.snapshotRuntime();world=new EntityWorld(transforms,world.serialize());world.restoreRuntime(snapshot);}};
}

test('stacked fire and named keys apply once, undo restores runtime, restart isolates nodes',()=>{
 const f=fixture([['fire',1,1,{fire:{}}],['key-a',1,1,{key:{name:'铜'}}],['key-b',1,2,{key:{name:'银'}}]]);
 f.map.tiles[1][1].terrain='fire';
 const before=f.controller.snapshot();assert.equal(f.controller.canMoveTo(1,1),true);assert.deepEqual(f.controller.snapshot(),before,'preflight is pure');
 f.move(1,1);assert.equal(f.state.terrainState.overheat,1);assert.equal(f.state.terrainState.actions,1);assert.deepEqual(f.state.terrainState.collectedKeys,['铜']);
 assert.deepEqual(f.world.runtime('key-a','key'),{collected:true});assert.deepEqual(f.world.runtime('key-b','key'),{});
 f.replaceWorld();f.controller.undo();assert.equal(f.state.steps,0);assert.deepEqual(f.state.terrainState.collectedKeys,[]);assert.deepEqual(f.world.runtime('key-a','key'),{});
 f.move(1,1);f.controller.restart();assert.deepEqual(f.state.terrainState.collectedKeys,[]);assert.deepEqual(f.world.snapshotRuntime(),{});assert.equal(f.state.terrainState.actions,0);
});

test('stacked collision rejects movement atomically before leave, hazards or history',()=>{
 const f=fixture([['key',1,1,{key:{name:'铜'}}],['fire',1,1,{fire:{}}],['wall',1,1,{collision:{blocked:true}}]]);
 f.registry.register('departure',{events:{leave:()=>({actor:{overheat:5}})}});f.add('departure',1,0,{departure:{}});
 f.controller.selectPlayer();f.state.legalMoves.push({r:1,c:1});const before=f.controller.snapshot();
 f.controller.movePlayer(1,1);assert.deepEqual(f.controller.snapshot(),before);assert.equal(f.state.playHistory.length,0);
 f.controller.setFreeTeleport(true);f.controller.testTeleport(1,1);assert.deepEqual(f.controller.snapshot(),before);
});

test('spawn collects every key without applying hazards or counting an action',()=>{
 const f=fixture([['a',1,0,{key:{name:'甲'},fire:{}}],['b',1,0,{key:{name:'乙'}}]]);
 assert.deepEqual(f.state.terrainState.collectedKeys,['甲','乙']);assert.equal(f.state.terrainState.overheat,0);assert.equal(f.state.terrainState.actions,0);
 f.move(1,1);f.controller.restart();assert.deepEqual(f.state.terrainState.collectedKeys,['甲','乙']);assert.equal(f.state.terrainState.actions,0);
});

test('tree ice, adjacent campfire and eruption retain player action semantics',()=>{
 const f=fixture([['ice',1,1,{ice:{}}],['camp',0,2,{campfire:{}}],['eruption',1,2,{eruption:{}}]]);
 assert.equal(f.controller.canMoveTo(1,2),false);f.move(1,1);assert.equal(f.state.terrainState.frozen,false,'adjacent campfire thaws ice');
 f.move(1,0);assert.equal(f.state.terrainState.actions,2);assert.equal(f.controller.canMoveTo(1,2),true);
 f.controller.setFreeTeleport(true);f.controller.testTeleport(1,2);assert.equal(f.state.terrainState.actions,3);assert.equal(f.state.player.c,2);
});

test('custom interaction and leave handlers run through player orchestration',()=>{
 const f=fixture();f.registry.register('switch',{events:{interact:(_context,_config,state)=>({state:{presses:Number(state.presses??0)+1}}),leave:()=>({actor:{overheat:2}})}});
 f.add('switch',1,0,{switch:{}});f.controller.interact();assert.deepEqual(f.world.runtime('switch','switch'),{presses:1});assert.equal(f.state.steps,0);
 f.controller.undo();assert.deepEqual(f.world.runtime('switch','switch'),{});f.move(1,1);assert.equal(f.state.terrainState.overheat,2);
});

test('stacked static blockers and missing surfaces reject without mutation',()=>{
 const f=fixture([['solid',1,1,{key:{name:'铜'}},{walkable:false}]]);
 assert.equal(f.controller.canMoveTo(1,1),false);
 f.world.remove('surface-1-2');f.add('floating-key',1,2,{key:{name:'银'}});
 assert.equal(f.controller.canMoveTo(1,2),false);assert.deepEqual(f.world.snapshotRuntime(),{});
});

test('repeated tree ice and six fire entries produce the original terminal states',()=>{
 const frozen=fixture([['ice',1,1,{ice:{}}]]);frozen.move(1,1);assert.equal(frozen.state.terrainState.frozen,true);
 frozen.move(1,0);frozen.move(1,1);assert.equal(frozen.state.terrainState.gameOver,true);assert.equal(frozen.state.stepLimitHit,true);
 const hot=fixture([['fire',1,1,{fire:{}}]]);
 for(let i=0;i<6;i++){hot.move(1,1);if(i<5)hot.move(1,0);}
 assert.equal(hot.state.terrainState.overheat,6);assert.equal(hot.state.terrainState.actions,11);assert.equal(hot.state.stepLimitHit,true);
});

test('key gates validate all stacked tree keys and still reject missing or blocked keys',()=>{
 const f=fixture([['key',1,1,{key:{name:'铜'},fire:{}}]]);f.env.validateRegions=validateRegions;
 // Create a fresh controller so the production validator is captured.
 f.state.mode='edit';f.map.tiles[1][2].tags.exitTo='B';f.map.tiles[1][2].tags.requiredKeys=['铜'];
 f.map.tiles[2][3].regionTag='B';f.map.tiles[2][3].tags.entry=true;
 f.map.tiles[1][1].terrain='fire';const controller=player.createPlayerController(f.env);
 assert.equal(controller.validateForPlay().valid,true,'compatibility tile does not need to expose the key');
 f.map.tiles[1][2].tags.requiredKeys=['缺失'];assert.equal(controller.validateForPlay().valid,false);
 f.map.tiles[1][2].tags.requiredKeys=['铜'];f.add('wall',1,1,{collision:{blocked:true}});assert.equal(controller.validateForPlay().valid,false);
});

test('static event subscriptions never suppress collision preflight',()=>{
 const f=fixture([['wall',1,1,{collision:{blocked:true}},{events:['leave']}]]);
 assert.equal(f.controller.canMoveTo(1,1),false);assert.equal(f.state.terrainState.actions,0);
});
test('play validation checks overlays and exit uses stable structural walkability',()=>{
 const f=fixture();f.add('bad',2,2,{unknown:{}});assert.equal(f.controller.validateForPlay().valid,false);f.world.remove('bad',true);
 f.map.exit={r:1,c:1};f.add('cycle',1,1,{eruption:{}});assert.equal(f.controller.exitIsValid(),true);
 f.add('blocked-exit',1,1,{collision:{blocked:true}});assert.equal(f.controller.exitIsValid(),false);assert.equal(f.controller.validateForPlay().valid,false);
});
