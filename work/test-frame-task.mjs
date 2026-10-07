import assert from 'node:assert/strict';
import {createFrameTask} from './core/frame-task.mjs';
let nextId=0;const callbacks=new Map(),cancelled=[],values=[];
const task=createFrameTask(value=>values.push(value),{
 requestFrame:callback=>{const id=nextId++;callbacks.set(id,callback);return id;},
 cancelFrame:id=>cancelled.push(id)
});
for(let i=0;i<1000;i++)task.request(i);
assert.equal(callbacks.size,1,'a burst schedules just one frame');
callbacks.get(0)();assert.deepEqual(values,[999],'only the latest position is processed');
task.request('stale');task.cancel();task.request('fresh');
callbacks.get(1)();assert.deepEqual(values,[999],'late cancelled callbacks do no work');
callbacks.get(2)();assert.deepEqual(values,[999,'fresh']);assert.deepEqual(cancelled,[1]);
task.cancel();task.cancel();
const reentrant=createFrameTask(value=>{values.push(value);if(value==='first')reentrant.request('next');},{
 requestFrame:callback=>{const id=nextId++;callbacks.set(id,callback);return id;},cancelFrame:()=>{}
});
reentrant.request('first');callbacks.get(3)();callbacks.get(4)();
assert.deepEqual(values.slice(-2),['first','next']);
console.log('PASS: frame tasks coalesce bursts, discard cancelled callbacks and allow rescheduling.');
