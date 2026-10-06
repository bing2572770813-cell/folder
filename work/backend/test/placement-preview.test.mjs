import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSurfacePreview} from '../../render/placement-preview.mjs';

test('placement ghost uses the final surface height, thickness and connected slope geometry',()=>{
 const material=new THREE.MeshBasicMaterial(),tile={height:.7,thickness:.09,lift:{initialHeight:.7}},map={tiles:[[tile]]};
 const body=createSurfacePreview(THREE,map,{r:0,c:0,tile},material);
 assert.ok(Math.abs(body.position.y-(.7-.045))<1e-9);assert.equal(body.geometry.parameters.height,.09);
 const slope={tiles:[[{height:.1,thickness:.09,surfaceConnected:true},{height:1,thickness:.09,surfaceConnected:true}]]};
 const mesh=createSurfacePreview(THREE,slope,{r:0,c:0,tile:slope.tiles[0][0]},material);
 assert.equal(mesh.geometry.type,'BufferGeometry');assert.ok(mesh.geometry.attributes.position.count>36);
 assert.equal(mesh.position.y,0);assert.equal(slope.tiles[0][0].height,.1);
});
