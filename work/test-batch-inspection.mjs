import assert from 'node:assert/strict';
import {inspectionCells,batchProperties} from './editor/batch-inspection.mjs';
const map={height:2,width:3,tiles:[[{instance:{id:'a'}},{instance:{id:'a'}},null],[null,{instance:{id:'a'}},{instance:{id:'b'}}]]};
assert.deepEqual(inspectionCells(map,[{r:0,c:1}]),[{r:0,c:1},{r:0,c:0},{r:1,c:1}]);
const result=batchProperties([{values:{height:.1,properties:{n:1,s:'a'},color:'white',prefabId:'a'},schema:{}},{values:{height:.4,properties:{n:2,s:'b'},prefabId:'b'},schema:{height:{tempEditable:false},properties:{children:{n:{serializable:false}}}}}]);
assert.equal(result.values.color,undefined);assert.equal(result.values.height,.1);
assert.equal(result.schema.height.tempEditable,false);assert.equal(result.schema.properties.children.n.serializable,false);
assert.equal(result.schema.prefabId.tempEditable,false);assert.ok(result.mixed.has('["height"]'));assert.ok(result.mixed.has('["properties","s"]'));
assert.deepEqual(batchProperties([]).values,{});
assert.deepEqual(batchProperties([{values:{n:1},schema:{}},{values:{n:'a'},schema:{}}]).values,{});
console.log('PASS: whole-instance selection expansion, shared fields/types, mixed values and restrictive batch permissions.');

// Exercise the production transaction adapter, including a later-target rejection.
const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');
const {updateProperty,mergeSerializableProperties,debugChanges}=await import('./core/property-model.mjs');
const source=readFileSync(new URL('./app.js',import.meta.url),'utf8');
const body=source.slice(source.indexOf('function applyInspectedProperty('),source.indexOf("document.querySelectorAll('.rotate-left')"));
function transactionFixture(readonly){
 const baseline={height:1,width:2,tiles:[[{height:.1},{height:.2,...(readonly?{propertySchema:{height:{tempEditable:false}}}:{})}]]};let records=0;
 const context={map:structuredClone(baseline),selectedCells:[{r:0,c:0},{r:0,c:1}],P:{mode:'edit'},clone:structuredClone,inspectionCells,cellHidden:()=>false,entityPropertySchema:t=>t.propertySchema??{},inspectionKey:(r,c)=>r+','+c,debugOverrides:{values:(k,t)=>t,set:()=>{}},updateProperty,mergeSerializableProperties,debugChanges,blocked:()=>false,normalizeTile:t=>t,assertHiddenContentUnchanged:()=>{},tagCatalog:[],visibility:{},validateMap:t=>t,record:()=>records++,controller:{resetPosition:()=>{}},buildPaper:()=>{},persist:()=>{},$:()=>({textContent:''}),updateUI:()=>{},scheduleInspection:()=>{}};
 context.applyMap=(next,saveHistory)=>{if(saveHistory)context.record();context.map=next;};
 runInNewContext(body,context);return {context,baseline,records:()=>records};
}
const denied=transactionFixture(true);assert.throws(()=>denied.context.applyInspectedProperty(['height'],.5),/不可编辑/);assert.deepEqual(denied.context.map,denied.baseline);assert.equal(denied.records(),0);
const accepted=transactionFixture(false);accepted.context.applyInspectedProperty(['height'],.5);assert.deepEqual(accepted.context.map.tiles[0].map(t=>t.height),[.5,.5]);assert.equal(accepted.records(),1);
console.log('PASS: production batch adapter rejects a later readonly target without partial writes and commits valid edits once.');
