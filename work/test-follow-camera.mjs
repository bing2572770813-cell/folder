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
const appSource=readFileSync(new URL('./app.ts',import.meta.url),'utf8');const tickSource=appSource.slice(appSource.indexOf('function tick(now)'),appSource.indexOf('\n// Scene startup',appSource.indexOf('function tick(now)')));
let corrections=0;const position=new Vector3(1,1,1),context={requestAnimationFrame:()=>{},controls:{update:()=>{}},updateFoldAxes:()=>{},controller:{tick:()=>{}},P:{mode:'play',moving:false,steps:0,player:{r:0,c:0}},manualPan:false,playerGroup:{getWorldPosition:t=>t.copy(position)},cameraFollowTarget:new Vector3(),lastFollowPosition:position.clone(),lastFollowSteps:0,correctFollowCamera:()=>corrections++,$:()=>({}),camera:{zoom:1},renderer:{render:()=>{}},scene:{},renderedFrames:0,screenPoints:()=>{}};
Object.assign(context,{cameraInteraction:{active:false},lastZoomLabel:null,diagnosticsEnabled:false,cameraFollowEnabled:false,regionCameraPending:false});
context.renderer.shadowMap={needsUpdate:false};
context.documentModel={world:{at:()=>[]}};context.paper={position:{y:0}};
const followPositionSource=appSource.slice(appSource.indexOf('function getCameraFollowPosition('),appSource.indexOf('function correctFollowCamera('));
runInNewContext(followPositionSource+'\n'+tickSource,context);
context.tick(0);assert.equal(corrections,0,'idle never follows');position.x=2;context.tick(1);assert.equal(corrections,0,'movement never follows');
context.P.moving=true;context.tick(2);assert.equal(corrections,0,'animation never follows');
context.P.foldMotion={phase:'drag'};context.tick(3);assert.equal(corrections,0,'folding never follows');
context.regionCameraPending=true;context.tick(3);assert.equal(corrections,0,'pending region waits for fold to finish');
context.P.foldMotion=null;let rendered=false;context.renderer.render=()=>{rendered=true;};context.correctFollowCamera=()=>{assert.equal(rendered,true,'new region is rendered before camera correction');corrections++;};
context.tick(3);assert.equal(corrections,1,'new region corrects once');context.tick(3);assert.equal(corrections,1,'later frames never keep following');

let axes=0;context.updateFoldAxes=()=>axes++;context.cameraInteraction.active=true;context.tick(4);assert.equal(axes,0,'camera gestures skip fold-axis work');context.cameraInteraction.active=false;context.tick(5);assert.equal(axes,1,'fold-axis work resumes after camera gestures');
let diagnostics=0;context.screenPoints=()=>diagnostics++;context.renderedFrames=9;context.tick(6);assert.equal(diagnostics,0,'default rendering does not write diagnostics');context.diagnosticsEnabled=true;context.renderedFrames=19;context.tick(7);assert.equal(diagnostics,1,'diagnostics are explicitly enabled');context.cameraInteraction.active=true;context.renderedFrames=29;context.tick(8);assert.equal(diagnostics,1,'camera gestures suspend diagnostics');
console.log('PASS: production camera loop only corrects once after a newly rendered region.');
context.P.moving=false;context.P.foldMotion=null;context.renderer.shadowMap.needsUpdate=false;
context.tick(9);assert.equal(context.renderer.shadowMap.needsUpdate,false,'camera-only frames reuse shadows');
context.P.moving=true;context.controller.tick=()=>{context.P.moving=false;};context.tick(10);
assert.equal(context.renderer.shadowMap.needsUpdate,true,'last animation frame refreshes shadows even after movement ends');
context.renderer.shadowMap.needsUpdate=false;context.P.foldMotion={phase:'return'};context.tick(11);
assert.equal(context.renderer.shadowMap.needsUpdate,true,'fold rebound refreshes shadows');
console.log('PASS: idle camera frames reuse shadows; movement completion and folding invalidate them.');

// The same production adapter must ignore surface crumble while retaining normal height tracking.
const fragile={id:'fragile',components:{surface:{height:.7},fragile:{count:1}}};
let fragileState={breaking:true,progress:.5};context.documentModel.world={at:()=>[fragile],runtime:()=>fragileState};
position.y=.2;assert.equal(context.getCameraFollowPosition(new Vector3()).y,.718);
fragileState={broken:true};position.y=.018;assert.equal(context.getCameraFollowPosition(new Vector3()).y,.718);
fragileState={remaining:1};assert.equal(context.getCameraFollowPosition(new Vector3()).y,.018);
console.log('PASS: crumbling/broken player support retains camera height; ordinary height tracking remains active.');
