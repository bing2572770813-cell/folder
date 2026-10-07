import test from 'node:test';
import assert from 'node:assert/strict';
import {TransformManager} from '../dist/entities/transform-manager.js';

const node = (id,r,c,parentId=null) => ({id,parentId,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
test('local transform updates only compute changed subtree cells',()=>{
 const records=Array.from({length:2304},(_,i)=>node('tile-'+i,Math.floor(i/48),i%48));
 records.push(node('child',0,0,'tile-49'));
 const m=new TransformManager(48,48,records),cells=m.cells;let reads=0;
 m.cells=function(...args){reads++;return cells.apply(this,args);};
 m.setLocal('tile-49',{r:3,c:3,dir:1});
 assert.ok(reads<=8,`a two-node subtree computed ${reads} footprints`);
 const restored=new TransformManager(48,48,m.serialize());
 for(let r=0;r<48;r++)for(let c=0;c<48;c++)assert.deepEqual(m.at(r,c),restored.at(r,c));
});
test('incremental edits preserve index order, clone independence and atomic failures',()=>{
 const m=new TransformManager(12,12,[node('a',2,2),node('b',4,4),node('c',0,0,'b'),node('d',0,0,'b')]);
 const check=()=>{const restored=new TransformManager(12,12,m.serialize());for(let r=0;r<12;r++)for(let c=0;c<12;c++)assert.deepEqual(m.at(r,c),restored.at(r,c));for(const record of m.serialize())assert.deepEqual(m.childrenOf(record.id),restored.childrenOf(record.id));};
 m.setParent('c','a');m.setParent('d','a');check();
 m.setParent('c','b');m.setParent('c','a');check();
 const copy=m.clone();copy.setParent('d','b');copy.setLocal('a',{r:5,c:5,dir:2});check();assert.deepEqual(m.childrenOf('a'),['c','d']);
 const before=m.serialize();assert.throws(()=>m.setParent('a','c'),/cycle/);assert.throws(()=>m.setParent('a','missing'),/parent/);assert.throws(()=>m.setLocal('a',{r:12,c:12,dir:0}),/bounds/);assert.deepEqual(m.serialize(),before);check();
 m.remove('c');m.create(node('c',0,0,'a'));check();assert.deepEqual(m.childrenOf('a'),['d','c']);
});
test('incremental moves and reparenting agree with full validation over deterministic sequences',()=>{
 const m=new TransformManager(16,16,[node('a',2,2),node('b',5,5),node('c',1,0,'a'),{...node('d',0,1,'c'),footprint:{width:2,height:2,occupied:[true,false,false,true]}},node('e',1,1,'b')]);
 let seed=73;const random=n=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%n;};
 for(let i=0;i<200;i++){
  const before=m.serialize(),proposal=structuredClone(before),record=proposal[random(proposal.length)],move=random(2)===0;
  if(move)record.local={r:random(20)-3,c:random(20)-3,dir:random(8)};
  else record.parentId=random(4)===0?null:proposal[random(proposal.length)].id;
  let expected,expectedError,actualError;
  try{expected=new TransformManager(16,16,proposal);}catch(error){expectedError=error.message;}
  try{if(move)m.setLocal(record.id,record.local);else m.setParent(record.id,record.parentId);}catch(error){actualError=error.message;}
  assert.equal(actualError,expectedError,`operation ${i}`);
  if(expected){assert.deepEqual(m.serialize(),proposal);for(let r=0;r<16;r++)for(let c=0;c<16;c++)assert.deepEqual(m.at(r,c),expected.at(r,c));for(const node of proposal)assert.deepEqual(m.childrenOf(node.id),expected.childrenOf(node.id));}
  else assert.deepEqual(m.serialize(),before);
 }
});
test('parent movement updates descendants and overlapping cell index', () => {
  const m=new TransformManager(10,10);
  m.create(node('root',2,2));m.create(node('child',1,0,'root'));m.create(node('other',3,2));
  assert.deepEqual(m.at(3,2),['child','other']);
  m.setLocal('root',{r:4,c:4,dir:0});
  assert.deepEqual(m.world('child'),{r:5,c:4,dir:0});
  assert.deepEqual(m.at(3,2),['other']);
  const copy=m.get('root');copy.local.r=9;
  assert.equal(m.world('root').r,4);
});
test('invalid mutations are atomic and deletion protects references', () => {
  const m=new TransformManager(8,8);m.create(node('a',1,1));m.create(node('b',2,2,'a'));
  const before=m.serialize();
  assert.throws(()=>m.setParent('a','b'),/cycle/);
  assert.throws(()=>m.setLocal('a',{r:7,c:7,dir:0}),/bounds/);
  assert.throws(()=>m.remove('a'),/children/);
  assert.deepEqual(m.serialize(),before);
  m.retain('b','entity-b');assert.throws(()=>m.remove('b'),/references/);
  m.release('b','entity-b');m.remove('b');m.remove('a');assert.deepEqual(m.serialize(),[]);
});
test('reparenting supports preserved world position and serializes local data only', () => {
  const m=new TransformManager(10,10);m.create(node('a',2,2));m.create(node('b',5,5));m.create(node('child',1,1,'a'));
  m.setParent('child','b',true);
  assert.deepEqual(m.world('child'),{r:3,c:3,dir:0});
  assert.deepEqual(m.get('child').local,{r:-2,c:-2,dir:0});
  assert.deepEqual(m.childrenOf('b'),['child']);
  const restored=new TransformManager(10,10,m.serialize());
  assert.deepEqual(restored.at(3,3),['child']);
});
test('sparse footprints and notification failure isolation', () => {
  const m=new TransformManager(10,10);let notified=0;
  m.onChange(()=>{throw new Error('listener');});m.onChange(()=>notified++);
  m.create({...node('shape',1,1),footprint:{width:2,height:2,occupied:[true,false,false,true]}});
  assert.deepEqual(m.at(1,2),[]);assert.deepEqual(m.at(2,2),['shape']);assert.equal(notified,1);
  assert.equal(m.notificationErrors.length,1);
});
test('deletion preflight and reference copies do not release protection',()=>{
  const m=new TransformManager(5,5);m.create(node('a',1,1));
  m.retain('a','entity:a');m.retain('a','editor:selection');
  const owners=m.referenceOwners('a');owners.length=0;
  assert.throws(()=>m.assertRemovable('a',['entity:a']),/references/);
  m.release('a','editor:selection');m.assertRemovable('a',['entity:a']);
  assert.throws(()=>m.remove('a'),/references/);
});
