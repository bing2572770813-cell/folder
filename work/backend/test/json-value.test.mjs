import test from 'node:test';
import assert from 'node:assert/strict';
import {jsonCopy,jsonObject} from '../dist/entities/entity-model.js';
import {copyJson} from '../../core/json-value.mjs';

test('both JSON boundaries reject sparse arrays and non-JSON values',()=>{
 for(const copy of [jsonCopy,copyJson]){
  for(const value of [Array(2),[1,,3],undefined,Infinity,new Date(),()=>{}])assert.throws(()=>copy(value));
  assert.throws(()=>copy(JSON.parse('{"__proto__":{}}')));
  const source={nested:[{x:1}]},result=copy(source);result.nested[0].x=2;assert.equal(source.nested[0].x,1);
 }
 assert.throws(()=>jsonObject([]),/Expected JSON object/);
});

test('shared JSON implementation preserves each boundary depth policy',()=>{
 let value=1;for(let i=0;i<17;i++)value={nested:value};
 assert.throws(()=>copyJson(value),/嵌套过深/);assert.deepEqual(jsonCopy(value),value);
 for(let i=0;i<16;i++)value={nested:value};assert.throws(()=>jsonCopy(value),/nesting exceeds 32/);
});
