import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createLiftBlock,setLiftBlockHeight} from '../../render/lift-block.mjs';
test('lift block body and its decal move as one object with constant thickness',()=>{
 const body=createLiftBlock(THREE,{height:.1,thickness:.09},new THREE.MeshBasicMaterial());
 const decal=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial());decal.position.y=.09/2+.035;body.add(decal);
 setLiftBlockHeight(body,.9);body.updateMatrixWorld(true);
 assert.ok(Math.abs(body.position.y-(.9-.09/2))<1e-9);
 assert.ok(Math.abs(decal.getWorldPosition(new THREE.Vector3()).y-(.9+.035))<1e-9);
 assert.equal(body.geometry.parameters.height,.09);assert.equal(body.scale.y,1);
 setLiftBlockHeight(body,.3);body.updateMatrixWorld(true);
 assert.ok(Math.abs(decal.getWorldPosition(new THREE.Vector3()).y-(.3+.035))<1e-9);
});
