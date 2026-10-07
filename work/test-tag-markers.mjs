import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createTagMarkerBatches,updateTagMarkerBatch} from './render/tag-markers.mjs';
const cells=Array.from({length:16384},(_,i)=>({r:Math.floor(i/128),c:i%128,nodeId:'node-'+i,surfaceTop:.09,tags:i%2?{entry:true}:{exitTo:'A'}}));
cells.push({r:0,c:0,tags:{spawn:true}});
const textures={entry:new THREE.Texture(),exit:new THREE.Texture()},geometry=new THREE.PlaneGeometry(.94,.94);
const options={geometry,textures,wx:c=>c,wz:r=>r,top:cell=>cell.surfaceTop};
const meshes=createTagMarkerBatches(THREE,cells,options);
assert.equal(meshes.length,2,'dense tags require only two batches');
assert.equal(meshes.reduce((n,mesh)=>n+mesh.count,0),16384);
for(const mesh of meshes){
 assert.equal(mesh.material.map,textures[mesh.userData.tagKind]);
 const first=mesh.userData.cells[0],matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
 assert.ok(Math.abs(matrix.elements[13]-.135)<1e-6);
 first.surfaceTop=.7;updateTagMarkerBatch(THREE,mesh,options);mesh.getMatrixAt(0,matrix);
 assert.ok(Math.abs(matrix.elements[13]-.745)<1e-6,'lift height updates instance position');
 assert.equal(mesh.userData.cells[0].nodeId,first.nodeId,'picking retains entity identity');
 mesh.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(new THREE.Vector3(first.c-.27,2,first.r),new THREE.Vector3(0,-1,0));
 const hit=ray.intersectObject(mesh)[0];assert.ok(hit,'batched labels remain raycastable');
 assert.equal(mesh.userData.cells[hit.instanceId].nodeId,first.nodeId);
 assert.ok(mesh.boundingSphere.radius>0);
 mesh.dispose();mesh.material.dispose();
}
geometry.dispose();Object.values(textures).forEach(texture=>texture.dispose());
console.log('PASS: 128x128 tags use two batches, retain picking identities and update support heights.');
