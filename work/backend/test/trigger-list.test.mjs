import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {ACTION_TRIGGERS,dispatchTriggerList}=require('../../mechanics/trigger-list.cjs');

test('trigger list filters by lifecycle event and action trigger',()=>{
 const calls=[];const list=[
  {event:'beforeTransition',triggers:['walk'],handler:'walkOnly'},
  {event:'afterAction',triggers:ACTION_TRIGGERS,handler:'allActions'},
 ];
 const handlers={walkOnly:()=>{calls.push('walk');return {type:'toggle'};},allActions:ctx=>{calls.push(ctx.action.trigger);return []}};
 assert.deepEqual(dispatchTriggerList(list,'beforeTransition',{action:{trigger:'teleport'}},handlers),[]);
 assert.deepEqual(dispatchTriggerList(list,'beforeTransition',{action:{trigger:'walk'}},handlers),[{type:'toggle'}]);
 dispatchTriggerList(list,'afterAction',{action:{trigger:'teleport'}},handlers);
 assert.deepEqual(calls,['walk','teleport']);
});

test('unknown handler fails before partial effect application',()=>{
 assert.throws(()=>dispatchTriggerList([{event:'x',handler:'missing'}],'x',{action:{}},{}),/Unknown trigger handler/);
});
