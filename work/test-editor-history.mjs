import assert from 'node:assert/strict';
import {createEditSnapshot,trimHistory} from './editor/history-model.mjs';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

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

// Exercise the production commit/history boundary, including its no-op path.
const source=readFileSync(new URL('./app.ts',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function editSnapshot('),source.indexOf('function finishGesture('))+source.slice(source.indexOf('function commitTree('),source.indexOf('function refreshTreePanel('));
const counts={before:0,after:0,build:0,ui:0,persist:0};
const original={serialize(){counts.before++;return {version:2,width:3,height:3,value:{height:1}};}},next={serialize(){counts.after++;return {version:2,width:3,height:3,value:{height:2}};},view(){return {width:3,height:3};}};
const context={documentModel:original,map:{},P:{mode:'edit'},gestureBefore:null,editHistory:[],redoHistory:[{}],editRect:null,selectedCells:[],directSelectedCells:[],selectedNodeId:null,clone:structuredClone,createEditSnapshot,trimHistory,assertTreeVisibility(){},controller:{resetPosition(){}},buildPaper(){counts.build++;counts.ui++;},persist(){counts.persist++;},updateUI(){counts.ui++;},refreshTreePanel(){}};
runInNewContext(functions+';commitTree(next);',{...context,next,counts});
assert.equal(counts.before,1,'comparison and history share one old snapshot');
assert.equal(counts.after,1);assert.equal(counts.build,1);assert.equal(counts.persist,1);assert.equal(counts.ui,1,'scene build performs the final UI refresh');
assert.equal(context.editHistory.length,1);assert.equal(context.editHistory[0].map.value.height,1);
const unchanged={...context,documentModel:original,editHistory:[],next:original};counts.build=0;counts.persist=0;
runInNewContext(functions+';commitTree(next);',unchanged);
assert.equal(unchanged.editHistory.length,0);assert.equal(counts.build,0);assert.equal(counts.persist,0);
console.log('PASS: production tree commits reuse history snapshots, refresh once and leave no-op history untouched.');

const placed={...context,documentModel:original,next,editHistory:[],gestureBefore:{map:{version:2}},selectedNodeId:null};
counts.before=0;counts.after=0;counts.build=0;counts.persist=0;
runInNewContext(functions+';commitTree(next,{placement:true});',placed);
assert.equal(counts.before,0);assert.equal(counts.after,0);assert.equal(placed.editHistory.length,0);assert.equal(counts.build,1);
const clicked={...context,documentModel:original,next,editHistory:[],gestureBefore:null,selectedNodeId:null};
counts.before=0;counts.after=0;
runInNewContext(functions+';commitTree(next,{placement:true});',clicked);
assert.equal(counts.before,1);assert.equal(counts.after,0);assert.equal(clicked.editHistory.length,1);
console.log('PASS: placement preserves click undo while drag cells reuse the gesture snapshot without repeated serialization.');
