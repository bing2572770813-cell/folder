import assert from 'node:assert/strict';
import * as THREE from 'three';
import runtime from './player.cjs';
import {createFoldMotionView,hingeFor,clipFoldPolygon} from './render/fold-motion.mjs';
import {uniqueFoldAxes,foldGroupAt,inFoldRange} from './tags/fold-geometry.mjs';
import {blocked,foldsAt} from './entities/tile-model.mjs';
import {validateRegions,taggedCells,regionOf} from './tags/regions.mjs';
import {createTerrainState,canEnterTerrain,enterTerrain,finishAction,validateTerrains} from './entities/mechanism-rules.mjs';

function fixture(type='h',project=null){
 const map={width:7,height:7,spawn:{r:2,c:3,dir:0},tiles:Array.from({length:7},()=>Array.from({length:7},()=>({prefabId:'paper_ai',height:.09,thickness:.025,color:'white',folds:[],tags:{},regionTag:'A'}))),foldCells:[],maxSteps:0,bestSteps:null,exit:null};
 if(type==='v')map.spawn={r:3,c:2,dir:0};
 for(let i=0;i<7;i++){const r=type==='h'?3:i,c=type==='v'?3:type==='d1'?i:type==='d2'?6-i:i;map.tiles[r][c].folds=[type];}
 map.tiles[map.spawn.r][map.spawn.c].tags.spawn=true;
 const paper=new THREE.Group(),layer=new THREE.Group(),player=new THREE.Group(),ring={visible:false},nodes=new Map();paper.add(layer,player);
 const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(1,.025,1),new THREE.MeshStandardMaterial(),49);mesh.userData.cells=[];
 for(let r=0;r<7;r++)for(let c=0;c<7;c++){mesh.setMatrixAt(r*7+c,new THREE.Matrix4().makeTranslation(c-3,.0775,r-3));mesh.userData.cells.push({r,c});}layer.add(mesh);
 const view=createFoldMotionView({paper,layers:[layer],playerGroup:player,wx:c=>c-3,wz:r=>r-3});
 const P=runtime.createPlayerState(map.spawn),inside=(r,c)=>r>=0&&c>=0&&r<7&&c<7,noop=()=>{};
 const renderPlayer=()=>{player.position.set(P.player.c-3,.108,P.player.r-3);player.rotation.set(0,-P.player.dir*Math.PI/4,0);};
 let controller;
 const env={state:P,THREE,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},getMap:()=>map,getFoldAxes:()=>uniqueFoldAxes(map),getPlayerGroup:()=>player,getSelectionRing:()=>ring,getEffectLayer:()=>paper,getFoldHinge:g=>hingeFor(map,g,c=>c-3,r=>r-3),foldView:view,invalidateAxes:noop,...(project?{project}:{}),isHidden:()=>false,blocked,inside,walkable:(r,c)=>inside(r,c)&&!!map.tiles[r][c]&&!blocked(map.tiles[r][c]),canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord:(r,c)=>`${r},${c}`,FOLD_NAMES:{},clone:structuredClone,persist:noop,toast:noop,record:()=>controller.recordPlay(),updateUI:noop,buildPaper:noop,renderPlayer,disposableClear:noop,overlay:noop,tileOutline:noop,wx:c=>c-3,wz:r=>r-3,tileTop:(r,c)=>map.tiles[r]?.[c]?.height??0};
 controller=runtime.createPlayerController(env);controller.setMode('play');renderPlayer();controller.selectFold(3,3,type);
 return {P,map,controller,view,layer,player,mesh};
}
for(const type of ['h','v','d1','d2']){
 const f=fixture(type),before=JSON.stringify(f.map),source={...f.P.player};
 assert.equal(f.controller.beginFoldDrag(source.r,source.c,300,300),true);
 assert.ok(f.P.foldMotion.creaseCells.length,'crease cells must have mixed halves');
 assert.equal(f.controller.updateFoldDrag(300,180,240),false,'90 degrees is not above target');
 assert.ok(f.view.playerPosition()[1]>.5,'player lifts with paper');
 assert.equal(f.P.steps,0);assert.deepEqual(f.P.player,source);
 f.controller.endFoldDrag();assert.equal(f.P.foldMotion.phase,'return');f.controller.tick(performance.now()+1000);
 assert.equal(f.view.active(),false);assert.equal(f.mesh.visible,true);assert.equal(JSON.stringify(f.map),before);
 f.controller.selectFold(3,3,type);f.controller.beginFoldDrag(source.r,source.c,300,300);
 assert.equal(f.controller.updateFoldDrag(300,300-240*170/180,240),true,'170 degrees aligns with reflected cell');
 const target={...f.P.foldMotion.target};assert.equal(f.controller.endFoldDrag(),true);
 assert.equal(f.P.player.r,target.r);assert.equal(f.P.player.c,target.c);assert.equal(f.P.animation.type,'drop');assert.equal(f.P.steps,1);assert.equal(f.P.teleports,1);assert.equal(f.P.playHistory.length,1);
 assert.equal(JSON.stringify(f.map),before,'fold never writes map coordinates');
 f.controller.tick(performance.now()+1000);f.controller.undo();assert.deepEqual(f.P.player,source);assert.equal(f.P.steps,0);
}
const blockedTarget=fixture();blockedTarget.controller.beginFoldDrag(2,3,300,300);blockedTarget.controller.updateFoldDrag(300,300-240*170/180,240);blockedTarget.map.tiles[4][3].blocked=true;
assert.equal(blockedTarget.controller.endFoldDrag(),false,'release rechecks changed target');assert.equal(blockedTarget.P.steps,0);
blockedTarget.controller.setMode('edit');assert.equal(blockedTarget.view.active(),false);assert.equal(blockedTarget.P.foldMotion,null);
const cancelled=fixture();cancelled.controller.beginFoldDrag(2,3,300,300);cancelled.controller.updateFoldDrag(300,73,240);cancelled.controller.endFoldDrag(true);assert.equal(cancelled.P.foldMotion.phase,'return');assert.equal(cancelled.P.steps,0);
const full=fixture();full.controller.beginFoldDrag(2,3,300,300);assert.equal(full.controller.updateFoldDrag(300,60,240),true,'180-degree fold aligns surface feet with target');full.controller.cancelFoldMotion();
const debug=fixture();debug.controller.setPlayerProperties({r:2,c:3,dir:0,maxUp:1,maxDown:1,foldVertical:.25,foldHorizontal:.1});assert.deepEqual(debug.P.foldDrop,{vertical:.25,horizontal:.1});debug.controller.undo();assert.deepEqual(debug.P.foldDrop,{vertical:1,horizontal:.35});assert.throws(()=>debug.controller.setPlayerProperties({r:2,c:3,dir:0,maxUp:1,maxDown:1,foldVertical:0}),/阈值/);
const polygon=[{position:[-1,0,0],uv:[0,0]},{position:[1,0,0],uv:[1,0]},{position:[0,0,1],uv:[.5,1]}];
for(const positive of [false,true]){const half=clipFoldPolygon(polygon,v=>v.position[0],positive);assert.ok(half.length>=3);assert.ok(half.every(v=>positive?v.position[0]>=0:v.position[0]<=0));}
const grab = fixture('h');
grab.controller.selectFold(3, 3, 'h');
assert.equal(
  grab.controller.beginFoldDrag(3, 3, 300, 300),
  true,
  'drag may start directly on a crease cell',
);
assert.ok(
  grab.P.foldMotion.creaseCells.some((p) => p.r === 3 && p.c === 3),
  'crease cells still take the split animation',
);
grab.controller.cancelFoldMotion();
// Only the drag component perpendicular to the crease folds, and that
// perpendicular is the screen image of the paper's own travel direction, so a
// crease drawn diagonally still answers a diagonal gesture.
const isoView=(x,y,z)=>[(x-z)/Math.SQRT2,-(x+z)/Math.SQRT2-y*.8];
function gestureOf(hinge,grip){
 const origin=new THREE.Vector3().fromArray(hinge.origin),
  axis=new THREE.Vector3().fromArray(hinge.direction).normalize(),
  shifted=new THREE.Vector3().fromArray(grip).sub(origin).applyAxisAngle(axis,.05*(hinge.side??1)).add(origin);
 const from=isoView(...origin.toArray()),to=isoView(...shifted.toArray());
 const x=to[0]-from[0],y=to[1]-from[1],length=Math.hypot(x,y);
 return length>1e-9?[x/length,y/length]:[0,-1];
}
for(const type of ['h','v','d1','d2']){
 const f=fixture(type,isoView),source={...f.P.player};
 const grip=[source.c-3,.09,source.r-3];
 f.controller.selectFold(3,3,type);
 assert.equal(f.controller.beginFoldDrag(source.r,source.c,300,300),true);
 const [gx,gy]=gestureOf(f.P.foldMotion.hinge,grip);
 assert.equal(f.controller.updateFoldDrag(300-gy*240,300+gx*240,240),false,'sliding along the crease folds nothing');
 assert.ok(f.P.foldMotion.angle<1e-9,'no rotation from an along-crease drag');
 f.controller.cancelFoldMotion();
 f.controller.selectFold(3,3,type);
 assert.equal(f.controller.beginFoldDrag(source.r,source.c,300,300),true);
 assert.equal(f.controller.updateFoldDrag(300+gx*240,300+gy*240,240),true,'perpendicular drag reaches the target');
 f.controller.cancelFoldMotion();
}
console.log('PASS: four physical fold axes, mixed crease halves, player attachment, aligned drop, rebound, stale gates, undo, immutable maps and perpendicular drag gestures.');
