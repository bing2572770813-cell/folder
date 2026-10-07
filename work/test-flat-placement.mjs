import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import * as THREE from 'three';
const bundle=await build({stdin:{contents:"export {TreeDocument} from './entities/tree-document.mjs';export {placeCategorizedPrefab} from './entities/tree-commands.mjs';export {renderTreeCells} from './render/tree-render.mjs';export {refreshFlatPaperPlacement} from './render/flat-placement.mjs';",resolveDir:fileURLToPath(new URL('.',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab,renderTreeCells,refreshFlatPaperPlacement}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const prefab={id:'paper_ai',size:{width:1,height:1},occupied:[true],static:{entityType:'terrain'},tile:{color:'white',height:.09,thickness:.09},BaseEntity:['void_ai']};
const geometry=new THREE.BoxGeometry(1,1,1),materials=Object.fromEntries(['white','blue'].map(c=>[c,new THREE.MeshStandardMaterial()]));
let geometryDisposals=0;geometry.addEventListener('dispose',()=>geometryDisposals++);
function fixture(change=()=>{}){
 const map={version:1,width:4,height:4,tiles:Array.from({length:4},()=>Array.from({length:4},()=>({...prefab.tile,prefabId:'paper_ai'}))),spawn:{r:0,c:0,dir:0},foldCells:[]};change(map);
 const doc=new TreeDocument(map),layer=new THREE.Group(),cells=renderTreeCells(doc).surfaceCells;
 for(const color of ['white','blue']){const selected=cells.filter(cell=>cell.tile.color===color);if(!selected.length)continue;const mesh=new THREE.InstancedMesh(geometry,materials[color],selected.length);mesh.userData.cells=selected;mesh.castShadow=true;mesh.receiveShadow=true;selected.forEach((cell,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().compose(new THREE.Vector3(cell.c,.045,cell.r),new THREE.Quaternion(),new THREE.Vector3(1,.09,1))));layer.add(mesh);}
 return {doc,layer};
}
function replace(state,tile={...prefab.tile,color:'blue'}){const next=placeCategorizedPrefab(state.doc,prefab,tile,2,2);return {next,options:{before:state.doc.world,after:next.world,beforeMap:state.doc.view(),afterMap:next.view(),r:2,c:2,layer:state.layer,materialFor:color=>materials[color],wx:c=>c,wz:r=>r}};}
const state=fixture(map=>map.tiles[1][1].color='blue'),old=state.doc.world.at(2,2)[0],reference=state.layer.children.flatMap(m=>m.userData.cells).find(cell=>cell.nodeId===old.id),operation=replace(state);
assert.equal(refreshFlatPaperPlacement(THREE,operation.options),true);
assert.equal(reference.nodeId,operation.next.world.at(2,2)[0].id);assert.equal(reference.tile.color,'blue');
assert.equal(state.layer.children.reduce((count,mesh)=>count+mesh.count,0),16);assert.equal(state.layer.children.find(mesh=>mesh.material===materials.blue).count,2);assert.equal(geometryDisposals,0);
state.layer.updateMatrixWorld(true);const hit=new THREE.Raycaster(new THREE.Vector3(2,10,2),new THREE.Vector3(0,-1,0)).intersectObjects(state.layer.children)[0];
assert.equal(hit.object.userData.cells[hit.instanceId].nodeId,reference.nodeId);
const same=fixture(),originalMesh=same.layer.children[0],sameOperation=replace(same,prefab.tile);assert.equal(refreshFlatPaperPlacement(THREE,sameOperation.options),true);assert.equal(same.layer.children[0],originalMesh);
for(const change of [map=>map.tiles[2][2].folds=['h'],map=>map.tiles[2][3].height=.5]){const s=fixture(change),op=replace(s),meshes=[...s.layer.children];assert.equal(refreshFlatPaperPlacement(THREE,op.options),false);assert.deepEqual(s.layer.children,meshes);}
const height=fixture(),heightOp=replace(height,{...prefab.tile,height:.4});assert.equal(refreshFlatPaperPlacement(THREE,heightOp.options),false);
assert.equal(refreshFlatPaperPlacement(THREE,{...replace(fixture()).options,hidden:()=>true}),false);
for(const mesh of state.layer.children)mesh.dispose();for(const mesh of same.layer.children)mesh.dispose();geometry.dispose();for(const material of Object.values(materials))material.dispose();
console.log('PASS: flat paper replacement preserves chunk occupancy, picking and shared resources; creases, slopes, hidden cells and height changes fall back.');
