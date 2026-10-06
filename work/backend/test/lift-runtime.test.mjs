import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLiftState,advanceLift} from '../../entities/lift-runtime.mjs';

const config={minHeight:.1,maxHeight:1,initialHeight:.1,durationMs:1000};
test('lift starts at initial height and smoothly reaches the high endpoint',()=>{
 let state=initialLiftState(config);
 state=advanceLift(state,config,0,false);
 state=advanceLift(state,config,500,false);
 assert.ok(state.height>.5&&state.height<.7);
 state=advanceLift(state,config,1000,false);
 assert.ok(Math.abs(state.height-1)<1e-9);
});
test('occupied lift reverses upward motion and never rises',()=>{
 let state=initialLiftState({...config,initialHeight:1});
 state=advanceLift(state,{...config,initialHeight:1},0,false);
 state=advanceLift(state,config,300,false);
 const before=state.height;
 state=advanceLift(state,config,301,true);
 assert.equal(state.direction,-1);
 state=advanceLift(state,config,800,true);
 assert.ok(state.height<before);
});
test('fixed lift stays fixed',()=>{
 const fixed={minHeight:.4,maxHeight:.4,initialHeight:.4,durationMs:100};
 let state=advanceLift(initialLiftState(fixed),fixed,0,false);
 state=advanceLift(state,fixed,10000,false);
 assert.deepEqual(state,{height:.4,direction:0,occupied:false,lastTime:10000});
});
