import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSpatialInstances,createSurfaceBatchCollector} from './render/spatial-batches.mjs';
import {paperSurface} from './render/paper-surface.mjs';
const cells=Array.from({length:128*128},(_,i)=>({r:Math.floor(i/128),c:i%128,nodeId:'entity-'+i}));
const before=structuredClone(cells),geometry=new THREE.BoxGeometry(1,.1,1),material=new THREE.MeshBasicMaterial();
const meshes=createSpatialInstances(THREE,{cells,geometry,material,matrixFor:cell=>new THREE.Matrix4().makeTranslation(cell.c,.05,cell.r)});
assert.equal(meshes.length,64);assert.ok(meshes.every(mesh=>mesh.count===256));assert.deepEqual(cells,before);
const camera=new THREE.OrthographicCamera(-4.5,4.5,4.5,-4.5,.1,100);
camera.position.set(8,30,8);camera.up.set(0,0,-1);camera.lookAt(8,0,8);camera.updateMatrixWorld(true);
const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
meshes.forEach(mesh=>mesh.updateMatrixWorld(true));
const visible=meshes.filter(mesh=>frustum.intersectsObject(mesh));
const visibleCells=visible.reduce((sum,mesh)=>sum+mesh.count,0);
assert.ok(visibleCells<cells.length/10,'close camera rejects distant batches');
const ray=new THREE.Raycaster(new THREE.Vector3(8,5,8),new THREE.Vector3(0,-1,0));
const hit=ray.intersectObjects(meshes)[0];assert.equal(hit.object.userData.cells[hit.instanceId].nodeId,'entity-1032');
const versions=meshes.map(mesh=>mesh.instanceMatrix.version);
camera.position.x=100;camera.lookAt(100,0,8);camera.updateMatrixWorld(true);
assert.deepEqual(meshes.map(mesh=>mesh.instanceMatrix.version),versions,'camera changes never rewrite instance data');
console.log(`PASS: 128x128 uses 64 spatial batches; close view submits ${visibleCells}/${cells.length} cells; picking retains identity.`);
meshes.forEach(mesh=>mesh.dispose());geometry.dispose();material.dispose();

const map={width:32,height:3,tiles:Array.from({length:3},()=>Array.from({length:32},()=>({height:.3,thickness:.02,gradualRate:2/3,surfaceConnected:true,color:'white',folds:['h']}))),foldCells:[]};
map.tiles[1][16].height=.6;
const collector=createSurfaceBatchCollector({wx:c=>c,wz:r=>r}),original=new Map();
for(const c of [15,16]){
 const cell={r:1,c,nodeId:'curved-'+c,tile:map.tiles[1][c]},surface=paperSurface(map,1,c);
 assert.ok(surface);original.set(cell.nodeId,{cell,surface});collector.add(cell,surface);
}
const surfaceMaterial=new THREE.MeshStandardMaterial(),curves=collector.meshes(THREE,()=>surfaceMaterial);
assert.equal(curves.length,2,'neighboring shells across a chunk boundary separate');
for(const mesh of curves){
 const cell=mesh.userData.surfaceCells[0],source=original.get(cell.nodeId).surface;
 const translated=source.positions.map((value,i)=>value+(i%3===0?cell.c:i%3===2?cell.r:0));
 assert.deepEqual([...mesh.geometry.attributes.position.array],[...new Float32Array(translated)],'batching preserves every shell vertex');
 assert.equal(mesh.userData.triangleCells.length,source.positions.length/9);
 assert.ok(mesh.userData.triangleCells.every(item=>item===cell));
 mesh.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(cell.c+.15,2,cell.r+.2),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObject(mesh)[0];assert.ok(hit);
 assert.equal(mesh.userData.triangleCells[hit.faceIndex].nodeId,cell.nodeId);
 mesh.geometry.dispose();
}
surfaceMaterial.dispose();
console.log('PASS: creased sloping shells preserve exact vertices and triangle picking across spatial boundaries.');
