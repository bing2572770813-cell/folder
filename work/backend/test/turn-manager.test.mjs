import test from 'node:test';
import assert from 'node:assert/strict';
import player from '../../player.cjs';

function fixture(){
 const state={turn:{number:0,phase:'idle',trigger:null,source:null,outcome:null}},phases=[];
 let value=0,records=0,presentation;
 const hooks={state,canExecute:()=>true,validate:action=>action.valid!==false,
  snapshot:()=>({value,records}),record:()=>records++,restore:s=>{value=s.value;records=s.records;},
  leave:()=>{},act:()=>value++,enter:()=>{},settle:()=>value++,outcome:()=>null,
  present:context=>{presentation=context.id;},onPhase:turn=>phases.push(turn.phase)};
 const manager=player.createTurnManager(hooks);
 return {state,phases,hooks,manager,get value(){return value;},get records(){return records;},get presentation(){return presentation;}};
}

test('manager runs lifecycle once and waits for matching presentation completion',()=>{
 const f=fixture();assert.equal(f.manager.execute({trigger:'walk',source:'move'}),true);
 assert.deepEqual(f.phases,['validate','snapshot','leave','action','enter','settle','outcome','present']);
 assert.equal(f.value,2);assert.equal(f.records,1);assert.equal(f.state.turn.number,1);
 assert.equal(f.manager.execute({trigger:'teleport'}),false);
 assert.equal(f.manager.complete(f.presentation+1),false);
 assert.equal(f.manager.complete(f.presentation),true);assert.equal(f.state.turn.phase,'complete');
 assert.equal(f.manager.complete(f.presentation),false);assert.equal(f.value,2);
});

test('invalid actions do not record, consume turns or emit entity phases',()=>{
 const f=fixture(),before=structuredClone(f.state);
 assert.equal(f.manager.execute({trigger:'walk',valid:false}),false);assert.deepEqual(f.state,before);
 assert.equal(f.value,0);assert.equal(f.records,0);
 assert.throws(()=>f.manager.execute({trigger:['walk','teleport']}),/trigger/i);
 assert.throws(()=>f.manager.execute({trigger:'hover'}),/trigger/i);
});

test('reentrant input is rejected and failed entity effects roll back the turn',()=>{
 const f=fixture();f.hooks.enter=()=>{assert.equal(f.manager.execute({trigger:'walk'}),false);throw new Error('bad effect');};
 assert.throws(()=>f.manager.execute({trigger:'walk'}),/bad effect/);
 assert.equal(f.value,0);assert.equal(f.records,0);assert.equal(f.state.turn.number,0);assert.equal(f.state.turn.phase,'idle');
 f.hooks.enter=()=>{};assert.equal(f.manager.execute({trigger:'teleport'}),true);
});

test('reset invalidates stale animation callbacks even when turn numbers repeat',()=>{
 const f=fixture();f.manager.execute({trigger:'walk'});const old=f.presentation;
 f.manager.reset();f.manager.execute({trigger:'teleport'});
 assert.equal(f.state.turn.number,1);assert.equal(f.manager.complete(old),false);
 assert.equal(f.manager.complete(f.presentation),true);
});
