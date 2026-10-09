import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {mechanismMarker} from './render/directional-mechanisms.mjs';

const counter=(config,state)=>mechanismMarker(THREE,{fragile:config},{fragile:state}).children.find(child=>Object.hasOwn(child.userData,'fragileCounter'));
test('fragile counter reads configured count, live remaining count and restored state',()=>{
 const config={count:4};
 for(const [state,value] of [[undefined,4],[{remaining:3},3],[{remaining:0,breaking:true},0],[{},4],[{remaining:100},100]]){
  const badge=counter(config,state);assert.equal(badge.userData.fragileCounter,value);
  const geometry=badge.children[1].geometry;geometry.computeBoundingBox();
  assert.ok(geometry.attributes.position.count>0);assert.ok(geometry.boundingBox.min.x>=-.25);assert.ok(geometry.boundingBox.max.x<=.25);
  assert.equal(badge.children[1].material.toneMapped,false);
 }
 assert.deepEqual(config,{count:4});
});
test('broken fragile blocks have no counter and counters do not participate in picking',()=>{
 assert.equal(counter({count:4},{remaining:0,broken:true}),undefined);
 const badge=counter({count:4},{}),hits=[];
 badge.traverse(object=>object.raycast?.(new THREE.Raycaster(),hits));assert.deepEqual(hits,[]);
});
