import test from 'node:test';
import assert from 'node:assert/strict';
import {TransformManager} from '../dist/entities/transform-manager.js';

const node = (id,r,c,parentId=null) => ({id,parentId,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
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
