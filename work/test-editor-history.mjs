import assert from 'node:assert/strict';
import {createEditSnapshot,trimHistory} from './editor/history-model.mjs';

const map={width:3,height:3,tiles:[[{tags:{requiredKeys:['铜钥匙']},height:2}]],foldCells:[{r:1,c:1,type:'h'}]};
const rect={r:0,c:0,w:1,h:1},selected=[{r:0,c:0}];
const snapshot=createEditSnapshot(map,rect,selected);
map.tiles[0][0].tags.requiredKeys.push('银钥匙');map.foldCells[0].type='v';rect.w=2;selected[0].r=2;
assert.deepEqual(snapshot.map.tiles[0][0].tags.requiredKeys,['铜钥匙']);
assert.equal(snapshot.map.foldCells[0].type,'h');assert.equal(snapshot.rect.w,1);assert.equal(snapshot.selectedCells[0].r,0);
assert.equal(createEditSnapshot(map,null,[]).rect,null);
const countLimited=Array.from({length:151},(_,id)=>({id,map:{width:3,height:3}}));
trimHistory(countLimited);assert.equal(countLimited.length,150);assert.equal(countLimited[0].id,1);
const large=Array.from({length:8},(_,id)=>({id,map:{width:128,height:128}}));
trimHistory(large);assert.equal(large.length,6);assert.equal(large[0].id,2);
const boundary=Array.from({length:10},()=>({map:{width:100,height:100}}));trimHistory(boundary);assert.equal(boundary.length,10);
const only=[{map:{width:400,height:400}}];trimHistory(only);assert.equal(only.length,1);
console.log('PASS: editor snapshots isolate nested config/void folds/selection, history limits preserve newest undo points.');
