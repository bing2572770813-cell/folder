import assert from 'node:assert/strict';
import {collectModelDescriptors} from './render/model-descriptors.mjs';

const node={id:'key',configuration:{visual:{model:'model/key_ai.fbx'}},static:{},transformId:'key-transform'};
const document={world:{serialize:()=>[node],transforms:{worldCells:id=>id==='key-transform'?[{r:1,c:2},{r:1,c:3}]:[],world:()=>({r:1,c:2,dir:3})}}};
const descriptors=collectModelDescriptors(document,{nodeHidden:entry=>entry.id==='hidden',cellHidden:(r,c)=>r===1&&c===3,wx:c=>c-.5,wz:r=>r-.5,tileTop:(r,c)=>r+c/10});
assert.equal(descriptors.length,1);
assert.deepEqual(descriptors[0].position,[1.5,1.2,.5]);
assert.equal(descriptors[0].dir,3);
assert.equal(descriptors[0].cells.length,1);
assert.equal(descriptors[0].cell.nodeId,'key');
assert.equal(collectModelDescriptors(document,{nodeHidden:()=>true}).length,0);
console.log('PASS: visual references project to visible, centered model descriptors.');

const enemy={id:'emitter',prefabId:'ray_emitter_ai',configuration:{},components:{rayEmitter:{initialDirection:'east'}},static:{},transformId:'key-transform'};
const enemyDocument={world:{...document.world,serialize:()=>[enemy],runtime:()=>({direction:'west'})}};
const getPrefab=()=>({visual:{model:'model/emitter_ai.fbx',scale:[.005,.005,.005],offset:[0,0,0]}});
assert.equal(collectModelDescriptors(enemyDocument,{getPrefab})[0].visual.model,'model/emitter_ai.fbx','old instances inherit a missing visual from their prefab');
assert.equal(collectModelDescriptors(enemyDocument,{getPrefab})[0].dir,2);
assert.equal(collectModelDescriptors(enemyDocument,{getPrefab,runtime:true})[0].dir,6,'model follows runtime direction reversal');
assert.equal(collectModelDescriptors(enemyDocument,{getPrefab})[0].dir,2,'runtime changes do not alter edit-mode configuration');
enemy.configuration.visual=null;assert.equal(collectModelDescriptors(enemyDocument,{getPrefab})[0].visual.model,'model/emitter_ai.fbx','current prefab visual replaces stale instance null');
assert.equal(collectModelDescriptors(enemyDocument,{getPrefab:()=>({visual:null})}).length,0,'explicit prefab null disables its visual');
enemy.configuration.visual={model:'model/custom_ai.fbx'};assert.equal(collectModelDescriptors(enemyDocument,{getPrefab})[0].visual.model,'model/emitter_ai.fbx','current prefab visual replaces stale instance snapshots');
assert.equal(collectModelDescriptors(enemyDocument)[0].visual.model,'model/custom_ai.fbx','missing prefab retains saved visual');
assert.equal(collectModelDescriptors(enemyDocument,{getPrefab:()=>({visual:{model:'model/snake_ai.fbx'}})})[0].visual.model,'model/snake_ai.fbx','changing prefab reference updates existing instances');
console.log('PASS: current prefab reference changes, runtime orientation and missing-prefab fallback.');

const oldOffset=[4.6652925885,.0319734826,-4.5407583767];
enemy.configuration.visual={model:'model/emitter_ai.fbx',offset:oldOffset};
assert.deepEqual(collectModelDescriptors(enemyDocument,{getPrefab})[0].visual.offset,[0,0,0]);
assert.deepEqual(enemy.configuration.visual.offset,oldOffset,'legacy origin correction must not modify saved configuration');

const bird={...enemy,components:{firebird:{direction:'east'}}};
const birdDocument={world:{...enemyDocument.world,serialize:()=>[bird],runtime:()=>({replaced:true})}};
assert.equal(collectModelDescriptors(birdDocument,{getPrefab,runtime:true}).length,0,'replaced bird uses the existing replacement marker instead of the creature model');
assert.equal(collectModelDescriptors(birdDocument,{getPrefab}).length,1,'play state does not hide the configured editor entity');
