import assert from 'node:assert/strict';
import {createFrameTask} from './core/frame-task.mjs';
import {createEditRefresh} from './editor/edit-refresh.mjs';
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
task.request('finish');const pending=callbacks.get(5);task.flush();
assert.equal(values.at(-1),'finish','flush processes the latest task immediately');
pending();assert.equal(values.filter(value=>value==='finish').length,1,'the cancelled frame cannot repeat a flushed task');
const length=values.length;task.flush();assert.equal(values.length,length,'empty flush does no work');
task.request('after-flush');callbacks.get(6)();assert.equal(values.at(-1),'after-flush');
console.log('PASS: finishing a gesture flushes once and subsequent frames can be scheduled.');
const refreshFrames=[],refreshEvents=[];
let state=0;
const refresh=createEditRefresh({rebuild:()=>refreshEvents.push(['scene',state]),notify:()=>refreshEvents.push(['save',state]),requestFrame:fn=>{refreshFrames.push(fn);return refreshFrames.length;},cancelFrame:()=>{}});
for(let i=1;i<=10;i++){state=i;refresh.request({scene:true},true);refresh.request({save:true},true);}
assert.equal(refreshFrames.length,1);assert.deepEqual(refreshEvents,[]);
refreshFrames[0]();assert.deepEqual(refreshEvents,[['scene',10],['save',10]],'all committed data is reflected once, in scene/save order');
state=11;refresh.request({scene:true,save:true},true);refresh.flush();refreshFrames[1]();
assert.deepEqual(refreshEvents.slice(2),[['scene',11],['save',11]],'gesture end flushes the last data once');
state=12;refresh.request({save:true});assert.deepEqual(refreshEvents.at(-1),['save',12],'ordinary saves remain synchronous');
refresh.flush();assert.equal(refreshEvents.length,5);
console.log('PASS: drag refreshes coalesce scene/save effects without deferring data commits.');
