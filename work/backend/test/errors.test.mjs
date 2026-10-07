import test from 'node:test';
import assert from 'node:assert/strict';
import {errorMessage,errorCode} from '../dist/core/errors.js';

test('error adapters handle Error, strings and non-stringifiable throws',()=>{
 assert.equal(errorMessage(new Error('失败')),'失败');assert.equal(errorMessage('失败'),'失败');
 assert.equal(errorMessage(Object.create(null)),'Unknown error');
 assert.equal(errorCode(Object.assign(new Error('missing'),{code:'ENOENT'})),'ENOENT');
 assert.equal(errorCode({code:404}),undefined);assert.equal(errorCode(null),undefined);
});
