import assert from 'node:assert/strict';
import {collectModelDescriptors} from './render/model-descriptors.mjs';

const node={id:'key',configuration:{visual:{model:'model/key_ai.fbx'}},static:{},transformId:'key-transform'};
const document={world:{serialize:()=>[node],transforms:{worldCells:id=>id==='key-transform'?[{r:1,c:2},{r:1,c:3}]:[]},runtime:()=>({dir:4})}};
const descriptors=collectModelDescriptors(document,{runtime:true,nodeHidden:entry=>entry.id==='hidden',cellHidden:(r,c)=>r===1&&c===3,wx:c=>c-.5,wz:r=>r-.5,tileTop:(r,c)=>r+c/10});
assert.equal(descriptors.length,1);
assert.deepEqual(descriptors[0].position,[1.5,1.2,.5]);
assert.equal(descriptors[0].dir,4);
assert.equal(descriptors[0].cells.length,1);
assert.equal(collectModelDescriptors(document,{nodeHidden:()=>true}).length,0);
console.log('PASS: visual references project to visible, centered model descriptors.');
