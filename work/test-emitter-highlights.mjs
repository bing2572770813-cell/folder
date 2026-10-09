import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import * as THREE from 'three';
import playerRuntime from './player.cjs';
import {mechanismMarker,shotMarker} from './render/directional-mechanisms.mjs';
const source=readFileSync(new URL('./app.ts',import.meta.url),'utf8');
const render=source.slice(source.indexOf('function refreshMechanismMarkers('),source.indexOf('function addAxisLabels('));
const origin={r:3,c:3},node={id:'emitter',components:{rayEmitter:{initialDirection:'east'}},static:{entityType:'creature'}};
let state={direction:'west',lastShot:playerRuntime.rayCells(origin,'east',7,7)};
const rayLayer=new THREE.Group(),mechanismLayer=new THREE.Group(),terrainTextures={ice:new THREE.Texture()};
const context={fragileMarkers:new Map(),THREE,playerRuntime,mechanismMarker,shotMarker,rayLayer,mechanismLayer,terrainTextures,map:{width:7,height:7,tiles:Array.from({length:7},()=>Array.from({length:7},()=>({height:.09})))},P:{mode:'play',terrainState:{flames:[]}},documentModel:{world:{serialize:()=>[node],get:()=>node,cells:()=>[origin],runtime:(_id,type)=>type==='rayEmitter'?state:{}}},refreshModels(){},renderTreeCells:()=>({surfaceCells:[]}),disposableClear:g=>g.clear(),nodeHidden:()=>false,cellHidden:()=>false,wx:c=>c,wz:r=>r,tileTop:()=>.09,tileHeight:tile=>tile.height,brokenViewKey:''};
runInNewContext(render,context);
for(const [direction,back] of [['north','south'],['east','west'],['south','north'],['west','east']]){
 state={direction,lastShot:playerRuntime.rayCells(origin,back,7,7)};const before=structuredClone(state);
 context.refreshMechanismMarkers();
 assert.deepEqual(rayLayer.children.map(mesh=>[mesh.position.x,mesh.position.z]),playerRuntime.rayCells(origin,direction,7,7).map(({r,c})=>[c,r]),direction+' highlights only the current forward range');
 assert.equal(rayLayer.children.length,3);assert.ok(rayLayer.children.every(mesh=>mesh.userData.iceIcon===true));assert.deepEqual(state,before,'rendering does not change attack history');
}
context.cellHidden=(r,c)=>r===3&&c===4;state={direction:'east',lastShot:playerRuntime.rayCells(origin,'west',7,7)};context.refreshMechanismMarkers();assert.equal(rayLayer.children.length,2,'hidden cells are omitted');
context.P.mode='edit';context.cellHidden=()=>false;context.refreshMechanismMarkers();assert.deepEqual(rayLayer.children.map(mesh=>[mesh.position.x,mesh.position.z]),[[4,3],[5,3],[6,3]],'edit mode shows initial configured forward range');
console.log('PASS: production emitter rendering highlights forward cells only, preserves last-shot state, visibility and edit mode.');
