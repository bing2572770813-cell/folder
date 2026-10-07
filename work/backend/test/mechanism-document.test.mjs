import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
import {normalizePrefab} from '../../entities/tile-model.mjs';
import {mechanismMarker,shotMarker} from '../../render/directional-mechanisms.mjs';
const code="export {TreeDocument} from './entities/tree-document.mjs';export {placeCategorizedPrefab} from './entities/tree-commands.mjs';export {renderTreeCells} from './render/tree-render.mjs';";
const bundled=await build({stdin:{contents:code,resolveDir:fileURLToPath(new URL('../../',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab,renderTreeCells}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const prefab=id=>normalizePrefab(JSON.parse(readFileSync(new URL('../../../assets/prefab/entity/'+id+'.json',import.meta.url),'utf8')));
function fixture(folds=[]){const tiles=Array.from({length:4},()=>Array.from({length:4},()=>({prefabId:'paper_ai',height:.09})));tiles[1][1].folds=folds;return new TreeDocument({version:1,width:4,height:4,tiles,spawn:{r:0,c:0,dir:0}});}
test('new catalog prefabs place and preserve component configuration through native save/load',()=>{
 for(const id of ['ray_emitter_ai','fold_switch_ai','fragile_paper_ai']){
  const p=prefab(id),doc=placeCategorizedPrefab(fixture(['v']),p,p.tile,1,1),node=doc.world.at(1,1)[0];
  assert.equal(node.prefabId,id);assert.equal(doc.world.at(1,1).length,1);
  const loaded=new TreeDocument(doc.serialize());assert.deepEqual(loaded.world.get(node.id).components,node.components);
 }
});
test('switch rejects absent or intersecting creases and removing its crease atomically',()=>{
 const p=prefab('fold_switch_ai');
 for(const folds of [[],['h','v']]){const doc=fixture(folds),before=doc.serialize();assert.throws(()=>placeCategorizedPrefab(doc,p,p.tile,1,1),/恰好一条/);assert.deepEqual(doc.serialize(),before);}
 const doc=placeCategorizedPrefab(fixture(['v']),p,p.tile,1,1),before=doc.serialize(),view=doc.view();view.tiles[1][1].folds=[];view.tiles[1][1].fold=null;
 assert.throws(()=>doc.applyLegacy(view),/恰好一条/);assert.deepEqual(doc.serialize(),before);
});
test('broken support vanishes from runtime projections and preserves canonical saves',()=>{
 const p=prefab('fragile_paper_ai'),doc=placeCategorizedPrefab(fixture(),p,p.tile,1,1),node=doc.world.at(1,1)[0],before=doc.serialize();
 doc.world.setRuntime(node.id,'fragile',{broken:true});
 assert.equal(doc.view({runtime:true}).tiles[1][1],null);assert.ok(doc.view().tiles[1][1]);assert.deepEqual(doc.serialize(),before);
 assert.equal(renderTreeCells(doc,{runtime:true}).surfaceCells.some(cell=>cell.r===1&&cell.c===1),false);
 assert.equal(renderTreeCells(doc).surfaceCells.some(cell=>cell.r===1&&cell.c===1),true);
 assert.ok(new TreeDocument(doc.serialize()).view({runtime:true}).tiles[1][1]);
});
test('markers reflect runtime direction and state without mutating persisted configuration',()=>{
 const components={rayEmitter:{initialDirection:'east'},foldSwitch:{initialState:0},fragile:{}},before=structuredClone(components);
 const marker=mechanismMarker(THREE,components,{rayEmitter:{direction:'west'},foldSwitch:{state:1}});
 assert.equal(marker.userData.direction,'west');assert.equal(marker.userData.switchState,1);assert.ok(marker.children.length>=8);assert.deepEqual(components,before);
 const arrow=marker.children[0];marker.updateMatrixWorld();const tip=new THREE.Vector3(0,-.32,0).applyMatrix4(arrow.matrixWorld);assert.ok(tip.x<0);
 const shot=shotMarker(THREE,{last:true});assert.equal(shot.userData.lastShot,true);assert.equal(shot.material.opacity,.34);
});
