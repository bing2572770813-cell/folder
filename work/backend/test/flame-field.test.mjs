import test from 'node:test';
import assert from 'node:assert/strict';
import {addFlame,spreadFlame,contains,neighbors} from '../../mechanics/flame-field.cjs';

test('flame field clips cardinal neighbours and deduplicates cells',()=>{
 assert.deepEqual(neighbors({r:0,c:0},3,3),[{r:1,c:0},{r:0,c:1}]);
 assert.deepEqual(addFlame([{r:1,c:1}],[{r:1,c:1},{r:0,c:0}],3,3),[{r:0,c:0},{r:1,c:1}]);
 assert.equal(contains(spreadFlame([{r:1,c:1}],[],3,3),{r:0,c:1}),true);
});

test('spread only adds one cardinal ring per resolution',()=>{
 assert.deepEqual(spreadFlame([{r:1,c:1}],[],5,5),[
  {r:0,c:1},{r:1,c:0},{r:1,c:1},{r:1,c:2},{r:2,c:1},
 ]);
});
