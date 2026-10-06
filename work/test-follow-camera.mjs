import assert from 'node:assert/strict';
import {OrthographicCamera,Vector3} from 'three';
import {squareViewSpan,followTarget} from './render/follow-camera.mjs';
for(const aspect of [.5,1,2])for(const offset of [new Vector3(0,24,.001),new Vector3(12,17.04,15)]){
  const camera=new OrthographicCamera(-1,1,1,-1,.1,1200),controls={target:new Vector3()},target=new Vector3(7,3,-5);
  followTarget(camera,controls,target,offset);const span=squareViewSpan(camera,target,9,aspect);
  camera.left=-span*aspect;camera.right=span*aspect;camera.top=span;camera.bottom=-span;camera.updateProjectionMatrix();
  for(const dx of [-4.5,4.5])for(const dz of [-4.5,4.5]){const corner=target.clone().add(new Vector3(dx,0,dz)).project(camera);assert.ok(Math.abs(corner.x)<=1+1e-6);assert.ok(Math.abs(corner.y)<=1+1e-6);}
  const moved=new Vector3(-9,8,11);followTarget(camera,controls,moved,offset);assert.deepEqual(controls.target.toArray(),moved.toArray());assert.ok(camera.position.clone().sub(moved).distanceTo(offset)<1e-9);assert.ok(moved.clone().project(camera).length()<1,'target remains in frame');assert.equal(camera.zoom,1);
}
console.log('PASS: 9x9 camera framing across aspects/views, player tracking and height changes.');
