import assert from 'node:assert/strict';
import * as THREE from 'three';
import runtime from './player.cjs';
import {createFoldMotionView,hingeFor,clipFoldPolygon,tabletopHeight} from './render/fold-motion.mjs';
import {uniqueFoldAxes,foldGroupAt,inFoldRange} from './tags/fold-geometry.mjs';
import {blocked,foldsAt} from './entities/tile-model.mjs';
import {validateRegions,taggedCells,regionOf} from './tags/regions.mjs';
import {createTerrainState,canEnterTerrain,enterTerrain,finishAction,validateTerrains} from './entities/mechanism-rules.mjs';

function fixture(type='h'){
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
 const env={state:P,THREE,$:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},getMap:()=>map,getFoldAxes:()=>uniqueFoldAxes(map),getPlayerGroup:()=>player,getSelectionRing:()=>ring,getEffectLayer:()=>paper,getFoldHinge:g=>hingeFor(map,g,c=>c-3,r=>r-3),foldView:view,invalidateAxes:noop,isHidden:()=>false,blocked,inside,walkable:(r,c)=>inside(r,c)&&!!map.tiles[r][c]&&!blocked(map.tiles[r][c]),canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord:(r,c)=>`${r},${c}`,FOLD_NAMES:{},clone:structuredClone,persist:noop,toast:noop,record:()=>controller.recordPlay(),updateUI:noop,buildPaper:noop,renderPlayer,disposableClear:noop,overlay:noop,tileOutline:noop,wx:c=>c-3,wz:r=>r-3,tileTop:(r,c)=>map.tiles[r]?.[c]?.height??0};
 const selectionChanges=[];env.onSelectionChanged=()=>selectionChanges.push(P.chosenFold?{...P.chosenFold}:null);
 controller=runtime.createPlayerController(env);controller.setMode('play');renderPlayer();controller.selectFold(3,3,type);
 return {P,map,controller,view,layer,player,mesh,env,selectionChanges};
}
// The rendered angle eases toward the pointer under a bounded angular speed,
// so tests advance the clock instead of expecting an instantaneous pose.
const settle=(f,seconds=1)=>{const start=performance.now();for(let elapsed=0;elapsed<=seconds*1000;elapsed+=16)f.controller.tick(start+elapsed);};
for(const type of ['h','v','d1','d2']){
 const f=fixture(type),before=JSON.stringify(f.map),source={...f.P.player};
 assert.deepEqual(f.selectionChanges.at(-1),{r:3,c:3,type},'selection notifies rendering immediately');
 const preview=f.controller.foldHighlightRegions(),group=uniqueFoldAxes(f.map)[0];
 const d=type==='h'?{r:0,c:1}:type==='v'?{r:1,c:0}:type==='d1'?{r:1,c:1}:{r:1,c:-1};
 const side=p=>(p.c-group.center.c)*d.r-(p.r-group.center.r)*d.c;
 const sign=Math.sign(side(source));
 assert.ok(preview.source.length&&preview.target.length,'both sides have filled areas');
 for(const p of preview.source){assert.ok(inFoldRange(group,p));assert.ok(p.half===sign||side(p)*sign>0);}
 for(const p of preview.target){assert.ok(inFoldRange(group,p));assert.ok(p.half===-sign||side(p)*sign<0);}
 assert.ok(preview.source.some(p=>p.r===source.r&&p.c===source.c));
 f.env.isHidden=(r,c)=>r===source.r&&c===source.c;
 assert.ok(!f.controller.foldHighlightRegions().source.some(p=>p.r===source.r&&p.c===source.c),'hidden cells stay excluded');
 f.env.isHidden=()=>false;
 f.controller.clearSelection();assert.equal(f.selectionChanges.at(-1),null,'clearing selection clears highlights immediately');
 f.controller.click(3,3);assert.deepEqual(f.selectionChanges.at(-1),{r:3,c:3,type});
 assert.equal(f.controller.beginFoldDrag(source.r,source.c,300),true);
 assert.ok(f.P.foldMotion.creaseCells.length,'crease cells must have mixed halves');
 assert.equal(f.controller.updateFoldDrag(180,240),false,'90 degrees is not above target');settle(f);
 assert.ok(f.view.playerPosition()[1]>.5,'player lifts with paper');
 assert.equal(f.P.steps,0);assert.deepEqual(f.P.player,source);
 f.controller.endFoldDrag();assert.equal(f.P.foldMotion.phase,'return');f.controller.tick(performance.now()+1000);
 assert.equal(f.view.active(),false);assert.equal(f.mesh.visible,true);assert.equal(JSON.stringify(f.map),before);
 f.controller.selectFold(3,3,type);f.controller.beginFoldDrag(source.r,source.c,300);
 f.controller.updateFoldDrag(300-240*170/180,240);settle(f);assert.equal(f.P.foldMotion.ready,true,'170 degrees aligns with reflected cell');
 const target={...f.P.foldMotion.target};assert.equal(f.controller.endFoldDrag(),true);
 assert.equal(f.P.player.r,target.r);assert.equal(f.P.player.c,target.c);assert.equal(f.P.animation.type,'drop');assert.equal(f.P.steps,1);assert.equal(f.P.teleports,1);assert.equal(f.P.playHistory.length,1);
 assert.equal(JSON.stringify(f.map),before,'fold never writes map coordinates');
 f.controller.tick(performance.now()+1000);f.controller.undo();assert.deepEqual(f.P.player,source);assert.equal(f.P.steps,0);
}
const blockedTarget=fixture();blockedTarget.controller.beginFoldDrag(2,3,300);blockedTarget.controller.updateFoldDrag(300-240*170/180);blockedTarget.map.tiles[4][3].blocked=true;
assert.equal(blockedTarget.controller.endFoldDrag(),false,'release rechecks changed target');assert.equal(blockedTarget.P.steps,0);
blockedTarget.controller.setMode('edit');assert.equal(blockedTarget.view.active(),false);assert.equal(blockedTarget.P.foldMotion,null);
const cancelled=fixture();cancelled.controller.beginFoldDrag(2,3,300);cancelled.controller.updateFoldDrag(73);cancelled.controller.endFoldDrag(true);assert.equal(cancelled.P.foldMotion.phase,'return');assert.equal(cancelled.P.steps,0);
const full=fixture();full.controller.beginFoldDrag(2,3,300);full.controller.updateFoldDrag(60);settle(full);assert.equal(full.P.foldMotion.ready,false,'feet below the tabletop cannot drop');full.controller.cancelFoldMotion();
const debug=fixture();debug.controller.setPlayerProperties({r:2,c:3,dir:0,maxUp:1,maxDown:1,foldVertical:.25,foldHorizontal:.1});assert.deepEqual(debug.P.foldDrop,{vertical:.25,horizontal:.1});debug.controller.undo();assert.deepEqual(debug.P.foldDrop,{vertical:1,horizontal:.35});assert.throws(()=>debug.controller.setPlayerProperties({r:2,c:3,dir:0,maxUp:1,maxDown:1,foldVertical:0}),/阈值/);
const polygon=[{position:[-1,0,0],uv:[0,0]},{position:[1,0,0],uv:[1,0]},{position:[0,0,1],uv:[.5,1]}];
for(const positive of [false,true]){const half=clipFoldPolygon(polygon,v=>v.position[0],positive);assert.ok(half.length>=3);assert.ok(half.every(v=>positive?v.position[0]>=0:v.position[0]<=0));}
console.log('PASS: four physical fold axes, mixed crease halves, player attachment, aligned drop, rebound, stale gates, undo and immutable maps.');
const outOfRange=fixture();outOfRange.map.tiles[3][0].folds=[];outOfRange.map.tiles[3][6].folds=[];outOfRange.P.player={r:0,c:0,dir:0};assert.deepEqual(outOfRange.controller.foldHighlightRegions(),{source:[],target:[]});
const onAxis=fixture();onAxis.P.player={r:3,c:3,dir:0};assert.deepEqual(onAxis.controller.foldHighlightRegions(),{source:[],target:[]});
const even=fixture();for(const c of [0,1,4,5,6])even.map.tiles[3][c].folds=[];
const evenPreview=even.controller.foldHighlightRegions();
assert.ok(evenPreview.source.every(p=>p.r>=2&&p.r<=3&&p.c>=2&&p.c<=3),'even-run radius uses both central cells');
assert.ok(evenPreview.target.every(p=>p.r>=3&&p.r<=4&&p.c>=2&&p.c<=3));
even.map.tiles[4][2]=null;assert.ok(!even.controller.foldHighlightRegions().target.some(p=>p.r===4&&p.c===2),'void target cells are not filled');
console.log('PASS: immediate crease selection updates and source/target region halves follow player side, range and hidden-cell guards.');

const raised=fixture();raised.map.tiles[4][3].height=10;const base=tabletopHeight(raised.map);assert.equal(hingeFor(raised.map,uniqueFoldAxes(raised.map)[0],c=>c,r=>r).origin[1],base);raised.controller.beginFoldDrag(2,3,300);raised.controller.updateFoldDrag(70);settle(raised);assert.equal(raised.P.foldMotion.ready,true,'target surface height does not change the tabletop-relative drop threshold');raised.controller.cancelFoldMotion();

const mixedRoot=new THREE.Group(),mixedLayer=new THREE.Group(),mixedPlayer=new THREE.Group();mixedRoot.add(mixedLayer,mixedPlayer);
const movingPaper=new THREE.Mesh(new THREE.BoxGeometry(.9,.1,.9),new THREE.MeshBasicMaterial());movingPaper.name='moving-paper';movingPaper.position.set(0,.2,0);movingPaper.userData.cell={r:0,c:0,nodeId:'paper'};
const fixedEntity=movingPaper.clone();fixedEntity.name='fixed-key';fixedEntity.userData.cell={r:0,c:0,nodeId:'key'};mixedLayer.add(movingPaper,fixedEntity);mixedPlayer.position.copy(movingPaper.position);
const mixedView=createFoldMotionView({paper:mixedRoot,layers:[mixedLayer],playerGroup:mixedPlayer,wx:c=>c,wz:r=>r,canFold:cell=>cell?.nodeId==='paper'});
mixedView.begin([{r:0,c:0}],{origin:[1,0,0],direction:[0,0,1],side:1});mixedView.setAngle(Math.PI/2);mixedRoot.updateMatrixWorld(true);
const visibleNamed=name=>{let result;mixedRoot.traverse(o=>{if(o.name===name&&o.visible)result=o;});return result;};
assert.deepEqual(visibleNamed('fixed-key').getWorldPosition(new THREE.Vector3()).toArray(),[0,.2,0],'nonfoldable entity stays fixed even on a rotating paper cell');
assert.notDeepEqual(visibleNamed('moving-paper').getWorldPosition(new THREE.Vector3()).toArray(),[0,.2,0]);mixedView.reset();assert.equal(movingPaper.visible,true);assert.equal(fixedEntity.visible,true);
const notFoldable=fixture();notFoldable.map.tiles[2][3].followFold=false;assert.equal(notFoldable.controller.beginFoldDrag(2,3,300),false,'player standing on a nonfoldable entity cannot start a fold');
