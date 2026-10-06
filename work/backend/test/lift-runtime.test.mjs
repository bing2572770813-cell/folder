import test from 'node:test';
import assert from 'node:assert/strict';
import {initialLiftState,advanceLift} from '../../entities/lift-runtime.mjs';
const config={minHeight:.1,maxHeight:1,initialHeight:.1,turnsPerLeg:3};
test('three turns reach each endpoint and reverse immediately',()=>{
 let s=initialLiftState(config);
 for(const height of [.4,.7,1,.7,.4,.1]){s=advanceLift(s,config,false);assert.ok(Math.abs(s.height-height)<1e-9);}
 assert.equal(s.direction,1);
});
test('occupied lifts only descend and stop at the bottom until released',()=>{
 let s=initialLiftState({...config,initialHeight:.7});
 s=advanceLift(s,config,true);assert.ok(Math.abs(s.height-.4)<1e-9);assert.equal(s.direction,-1);
 for(let i=0;i<10;i++)s=advanceLift(s,config,true);
 assert.equal(s.height,.1);assert.equal(s.direction,-1);
 s=advanceLift(s,config,false);assert.ok(Math.abs(s.height-.4)<1e-9);
});
test('fixed lift stays fixed and partial initial heights clamp at endpoints',()=>{
 const fixed={...config,minHeight:.4,maxHeight:.4,initialHeight:.4};
 assert.equal(advanceLift(initialLiftState(fixed),fixed,false).height,.4);
 let s=initialLiftState({...config,initialHeight:.9});s=advanceLift(s,config,false);assert.equal(s.height,1);assert.equal(s.direction,-1);
});
