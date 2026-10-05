import assert from 'node:assert/strict';
import { createMechanics, movementMechanic, createMechanicContext } from './mechanics.mjs';
const map={width:3,height:3,tiles:Array.from({length:3},()=>Array.from({length:3},()=>({color:'white'})))};
const mechanics=createMechanics().register(movementMechanic);const actions=mechanics.actions(createMechanicContext(map,{r:1,c:1}));
assert.equal(actions.length,8);assert.equal(actions[0].mechanic,'movement');assert.equal(mechanics.list().length,1);assert.throws(()=>mechanics.register({id:'bad'}));
console.log('PASS: mechanism registry and shared action contract.');
