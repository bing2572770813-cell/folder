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
const {boundedFollowTarget}=await import('./render/follow-camera.mjs');
assert.deepEqual(boundedFollowTarget(new Vector3(-6,2,4),14,10).toArray(),[-2.5,2,.5]);
assert.deepEqual(boundedFollowTarget(new Vector3(0,1,0),14,10).toArray(),[0,1,0]);
assert.deepEqual(boundedFollowTarget(new Vector3(2,1,-2),5,5).toArray(),[0,1,0]);
assert.deepEqual(boundedFollowTarget(new Vector3(6,1,4),14,10,4.5).toArray(),[4.75,1,2.75]);
console.log('PASS: boundary clamping, small-map centering and zoom-aware follow limits.');
const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');
const appSource=readFileSync(new URL('./app.js',import.meta.url),'utf8');const tickSource=appSource.slice(appSource.indexOf('function tick(now)'),appSource.indexOf('resetRegions();setupPrefabs();'));
let corrections=0;const position=new Vector3(1,1,1),context={requestAnimationFrame:()=>{},controls:{update:()=>{}},updateFoldAxes:()=>{},controller:{tick:()=>{}},P:{mode:'play',moving:false,steps:0},manualPan:false,playerGroup:{getWorldPosition:t=>t.copy(position)},cameraFollowTarget:new Vector3(),lastFollowPosition:position.clone(),lastFollowSteps:0,correctFollowCamera:()=>corrections++,$:()=>({}),camera:{zoom:1},renderer:{render:()=>{}},scene:{},renderedFrames:0,screenPoints:()=>{}};
runInNewContext(tickSource,context);context.tick(0);assert.equal(corrections,0,'idle player must not undo manual pan');position.x=2;context.tick(1);assert.equal(corrections,1,'movement corrects camera');context.manualPan=true;context.P.moving=true;context.tick(2);assert.equal(corrections,1,'active right drag is respected');context.manualPan=false;context.tick(3);assert.equal(corrections,2,'correction resumes after pan');
console.log('PASS: production camera loop preserves idle pan and corrects after movement.');
