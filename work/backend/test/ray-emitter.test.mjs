import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import player from '../../player.cjs';
import {EntityWorld} from '../dist/entities/entity-world.js';
import {TransformManager} from '../dist/entities/transform-manager.js';
import {defaultComponents} from '../dist/entities/components.js';
import {validateTerrainStacking} from '../dist/entities/terrain-stacking.js';
import {createTerrainState,canEnterTerrain,enterTerrain,finishAction} from '../../special-terrain.mjs';

function fixture(direction='east',origin={r:3,c:0},heightAt=()=>0){
 const map={width:7,height:7,tiles:Array.from({length:7},()=>Array.from({length:7},()=>({height:.09,regionTag:'A',tags:{}}))),spawn:{r:2,c:1,dir:2},exit:null,maxSteps:0};
 map.tiles[2][1].tags.spawn=true;
 const world=new EntityWorld(new TransformManager(7,7));
 const add=(id,r,c,components,tags={})=>{world.transforms.create({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});world.add({id,prefabId:'test',transformId:'t-'+id,components,tags,static:{}});};
 for(let r=0;r<7;r++)for(let c=0;c<7;c++)add(`${r}-${c}`,r,c,{surface:{}});
 add('emitter',origin.r,origin.c,{rayEmitter:{initialDirection:direction}});
 const state=player.createPlayerState(map.spawn),group=new THREE.Group(),ring={},elements=new Map(),noop=()=>{};
 let controller;
 const env={state,THREE,getEntityWorld:()=>world,componentRegistry:defaultComponents(),getMap:()=>map,
  $:id=>{if(!elements.has(id))elements.set(id,{});return elements.get(id);},blocked:()=>false,inside:(r,c)=>r>=0&&r<7&&c>=0&&c<7,walkable:()=>true,isHidden:()=>false,
  canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains:()=>[],validateRegions:()=>[],
  taggedCells:(_map,tag)=>map.tiles.flatMap((row,r)=>row.flatMap((tile,c)=>tile.tags[tag]?[{r,c,tile}]:[])),regionOf:tile=>tile.regionTag,
  foldsAt:()=>[],inFoldRange:()=>true,foldGroupAt:(...args)=>env.resolveFoldGroup?.(...args),getFoldAxes:()=>[],coord:(r,c)=>`${r},${c}`,FOLD_NAMES:{},clone:structuredClone,persist:noop,toast:noop,
  record:()=>controller.recordPlay(),updateUI:noop,buildPaper:noop,renderPlayer:noop,disposableClear:noop,overlay:noop,tileOutline:noop,
  wx:c=>c,wz:r=>r,tileTop:heightAt,getSelectionRing:()=>ring,getPlayerGroup:()=>group,getEffectLayer:()=>group,invalidateAxes:noop};
 controller=player.createPlayerController(env);controller.setMode('play');
 const move=(r,c)=>{controller.selectPlayer();const ok=controller.movePlayer(r,c);controller.tick(performance.now()+1000);return ok;};
 return {world,map,state,controller,move,add,env};
}

test('emitter fires three cells excluding itself in each cardinal direction',()=>{
 assert.equal(typeof player.rayCells,'function');
 for(const [direction,want] of [['north',[{r:2,c:3},{r:1,c:3},{r:0,c:3}]],['south',[{r:4,c:3},{r:5,c:3},{r:6,c:3}]],['east',[{r:3,c:4},{r:3,c:5},{r:3,c:6}]],['west',[{r:3,c:2},{r:3,c:1},{r:3,c:0}]]])assert.deepEqual(player.rayCells({r:3,c:3},direction,7,7),want);
 assert.deepEqual(player.rayCells({r:0,c:0},'north',7,7),[]);
});

test('successful walk fires at the destination then reverses, undo and restart restore runtime',()=>{
 const f=fixture(),before=f.controller.snapshot();
 assert.equal(f.controller.canMoveTo(3,0),false,'emitter itself cannot be entered even without collision');
 assert.equal(f.move(3,1),true);assert.equal(f.state.terrainState.gameOver,true);assert.equal(f.state.turn.outcome,'terrain');
 assert.equal(f.world.runtime('emitter','rayEmitter').direction,'west');
 assert.deepEqual(f.world.runtime('emitter','rayEmitter').lastShot,[{r:3,c:1},{r:3,c:2},{r:3,c:3}]);
 f.controller.undo();assert.deepEqual(f.controller.snapshot(),before);
 f.move(2,2);assert.equal(f.state.terrainState.gameOver,false);assert.equal(f.world.runtime('emitter','rayEmitter').direction,'west');
 f.controller.restart();assert.deepEqual(f.world.runtime('emitter','rayEmitter'),{});
});

test('teleport hits at the third cell but not the fourth, invalid actions and frames never fire',()=>{
 const f=fixture(),before=f.controller.snapshot();f.controller.selectPlayer();
 assert.equal(f.controller.movePlayer(99,99),false);f.controller.turn(1);for(let i=0;i<20;i++)f.controller.tick(i*1000);
 assert.deepEqual(f.world.runtime('emitter','rayEmitter'),{});assert.equal(f.state.turn.number,0);
 f.controller.setFreeTeleport(true);assert.equal(f.controller.testTeleport(3,4),true);assert.equal(f.state.terrainState.gameOver,false);
 assert.equal(f.world.runtime('emitter','rayEmitter').direction,'west');f.controller.tick(performance.now()+1000);f.controller.undo();
 assert.equal(f.controller.testTeleport(3,3),true);assert.equal(f.state.terrainState.gameOver,true);
 assert.equal(f.state.turn.number,before.turn.number+1);
});

test('regional teleport fires once at final arrival and obstacles do not shorten the ray',()=>{
 const f=fixture();f.map.tiles[2][2].tags.exitTo='B';f.map.tiles[3][3].regionTag='B';f.map.tiles[3][3].tags.entry=true;
 f.add('obstacle',3,2,{collision:{blocked:true}});
 f.move(2,2);assert.equal(f.state.player.r,3);assert.equal(f.state.player.c,3);
 assert.equal(f.state.terrainState.gameOver,true);assert.equal(f.world.runtime('emitter','rayEmitter').direction,'west');assert.equal(f.state.turn.number,1);
});

test('invalid emitter direction is rejected by the shared registry',()=>{
 const registry=defaultComponents(),node={id:'e',prefabId:'test',transformId:'t',components:{rayEmitter:{initialDirection:'diagonal'}},tags:{},static:{}};
 assert.throws(()=>registry.validate(node),/direction/i);
});

function birdFixture(){
 const f=fixture();f.world.remove('emitter');
 f.world.transforms.create({id:'t-bird',parentId:null,local:{r:4,c:4,dir:0},footprint:{width:3,height:3,occupied:Array(9).fill(true)}});
 f.world.add({id:'bird',prefabId:'firebird_ai',transformId:'t-bird',components:{firebird:{direction:'east'},collision:{blocked:true}},tags:{},static:{entityType:'creature',walkable:false}});
 return f;
}
test('entering fragile paper keeps departure height even when the source lift advances',()=>{
 let sourceHeight=.7;
 const f=fixture('east',{r:3,c:0},(r,c)=>r===2&&c===1?sourceHeight:.7);f.world.remove('emitter');
 f.add('source-lift',2,1,{lift:{minHeight:.7,maxHeight:1.7,initialHeight:.7,turnsPerLeg:1}});
 f.add('destination-fragile',2,2,{fragile:{}});
 f.env.getPlayerGroup().position.set(1,.718,2);
 f.env.refreshLiftSurfaces=()=>{sourceHeight=f.world.runtime('source-lift','lift').height;};
 f.controller.selectPlayer();assert.equal(f.controller.movePlayer(2,2),true);
 assert.equal(sourceHeight,1.7);
 f.controller.tick(f.state.animation.start+20);
 assert.equal(f.state.animation.from.y,.718,'departed terrain must not drag the player animation or camera upward');
 assert.deepEqual(f.world.runtime('destination-fragile','fragile'),{},'entering must not break the target');
});
test('fragile scene refresh cannot lower the departure animation or shake camera tracking',()=>{
 const f=fixture();f.world.remove('emitter');f.add('fragile',2,1,{fragile:{}});
 const position=new THREE.Vector3(1,.718,2);
 f.env.getPlayerGroup().position.copy(position);
 f.env.refreshMechanismSurfaces=()=>{if(f.world.runtime('fragile','fragile').broken)f.map.tiles[2][1]=null;};
 f.controller.selectPlayer();assert.equal(f.controller.movePlayer(2,2),true);
 assert.equal(f.map.tiles[2][1],null);
 assert.deepEqual(f.state.animation.from.toArray(),position.toArray(),'capture the rendered departure pose before destruction');
 f.controller.tick(f.state.animation.start+20);
 assert.deepEqual(f.state.animation.from.toArray(),position.toArray(),'animation frames must not resample a destroyed departure surface');
 assert.equal(f.world.runtime('fragile','fragile').broken,true);
});
test('placed firebird activates once after arrival, with undo/restart restoring its runtime',()=>{
 const f=birdFixture(),before=f.controller.snapshot();
 assert.equal(f.controller.canMoveTo(4,4),false);
 assert.equal(f.controller.movePlayer(99,99),false);assert.deepEqual(f.state.terrainState.flames,[]);
 assert.equal(f.move(2,2),true);assert.equal(f.world.runtime('bird','firebird').replaced,true);
 assert.equal(f.state.terrainState.flames.length,3);
 assert.deepEqual(f.state.terrainState.flames,[{r:4,c:6},{r:5,c:6},{r:6,c:6}]);
 f.controller.undo();assert.deepEqual(f.controller.snapshot(),before);
 f.move(2,2);f.controller.restart();assert.deepEqual(f.world.runtime('bird','firebird'),{});assert.deepEqual(f.state.terrainState.flames,[]);
});
test('outside watch range firebird ignites action origin and old flames spread only on successful turns',()=>{
 const f=birdFixture();f.controller.setFreeTeleport(true);
 assert.equal(f.controller.testTeleport(0,0),true);f.controller.tick(performance.now()+1000);
 assert.deepEqual(f.state.terrainState.flames,[{r:2,c:1}]);assert.deepEqual(f.world.runtime('bird','firebird'),{});
 assert.equal(f.controller.canMoveTo(2,1),false);
 const before=f.controller.snapshot();f.controller.movePlayer(99,99);f.controller.tick(performance.now()+2000);assert.deepEqual(f.controller.snapshot(),before);
 assert.equal(f.move(0,1),true);assert.equal(f.state.terrainState.flames.some(cell=>cell.r===1&&cell.c===1),true);
 f.controller.undo();assert.deepEqual(f.controller.snapshot(),before);
});

function switchFixture(initialState=0){
 const f=fixture();f.world.remove('emitter');
 f.add('switch',0,2,{foldSwitch:{initialState},fold:{directions:['v']}});
 const group={type:'v',center:{r:2,c:2},cells:[{r:0,c:2},{r:1,c:2},{r:2,c:2},{r:3,c:2}],radius:5};
 f.env.getFoldAxes=()=>[group];f.env.resolveFoldGroup=()=>group;
 return f;
}

test('a zero switch blocks exits; using its fold group toggles state once and undo restores it',()=>{
 const f=switchFixture();f.map.tiles[2][3].tags.exitTo='B';f.map.tiles[6][6].regionTag='B';f.map.tiles[6][6].tags.entry=true;
 assert.equal(f.controller.canMoveTo(0,2),false);
 f.controller.setFreeTeleport(true);f.controller.testTeleport(2,3);
 assert.equal(f.state.player.r,2);assert.equal(f.state.player.c,3);assert.match(f.state.terrainState.message,/开关/);
 assert.equal(f.state.revealedRegions.has('B'),false);f.controller.tick(performance.now()+1000);f.controller.undo();
 assert.equal(f.controller.teleport({r:2,c:2,type:'v'}),true);
 assert.equal(f.world.runtime('switch','foldSwitch').state,1);assert.equal(f.state.player.r,6);assert.equal(f.state.player.c,6);
 assert.equal(f.state.turn.number,1);f.controller.tick(performance.now()+1000);f.controller.undo();
 assert.deepEqual(f.world.runtime('switch','foldSwitch'),{});assert.equal(f.state.revealedRegions.has('B'),false);
});

test('only actual use of the switch fold group toggles; any zero switch also prevents final victory',()=>{
 const f=switchFixture(1);f.add('other',0,5,{foldSwitch:{initialState:0},fold:{directions:['v']}});
 f.map.exit={r:2,c:2};f.move(2,2);assert.equal(f.state.levelWon,false);
 assert.equal(f.world.runtime('switch','foldSwitch').state,undefined,'walking does not toggle');
 f.controller.restart();f.controller.teleport({r:2,c:2,type:'v'});
 assert.equal(f.world.runtime('switch','foldSwitch').state,0);assert.deepEqual(f.world.runtime('other','foldSwitch'),{});
 f.controller.tick(performance.now()+1000);f.controller.restart();assert.deepEqual(f.world.runtime('switch','foldSwitch'),{});
});

test('switch placement requires exactly one crease, one cell and supported terrain',()=>{
 const f=switchFixture();assert.doesNotThrow(()=>validateTerrainStacking(f.world));
 const node=f.world.get('switch');node.components.fold.directions=['h','v'];f.world.remove(node.id);f.world.add(node);
 assert.throws(()=>validateTerrainStacking(f.world),/恰好一条/);
 node.components.fold.directions=[];f.world.remove(node.id);f.world.add(node);assert.throws(()=>validateTerrainStacking(f.world),/恰好一条/);
});

test('fragile paper breaks on successful departure; failed moves, previews, undo and restart preserve it',()=>{
 const f=fixture();f.world.remove('emitter');f.add('fragile',2,1,{fragile:{}});
 const before=f.controller.snapshot();f.controller.selectPlayer();
 assert.equal(f.controller.movePlayer(99,99),false);assert.deepEqual(f.world.runtime('fragile','fragile'),{});
 assert.equal(f.move(2,2),true);assert.equal(f.world.runtime('fragile','fragile').broken,true);
 assert.equal(f.controller.canMoveTo(2,1),false,'broken support is void even if other owners remain');
 f.controller.undo();assert.deepEqual(f.controller.snapshot(),before);assert.equal(f.controller.canMoveTo(2,1),true);
 f.controller.setFreeTeleport(true);assert.equal(f.controller.testTeleport(4,4),true);assert.equal(f.world.runtime('fragile','fragile').broken,true);
 f.controller.tick(performance.now()+1000);f.controller.restart();assert.deepEqual(f.world.runtime('fragile','fragile'),{});
});
