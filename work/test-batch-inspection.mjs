import assert from 'node:assert/strict';
import {inspectionCells,batchProperties,selectionDetails} from './editor/batch-inspection.mjs';
import {projectedCellSchema,assertNodePropertyChanges} from './editor/node-edit-permissions.mjs';
const map={height:2,width:3,tiles:[[{instance:{id:'a'}},{instance:{id:'a'}},null],[null,{instance:{id:'a'}},{instance:{id:'b'}}]]};
assert.deepEqual(inspectionCells(map,[{r:0,c:1}]),[{r:0,c:1},{r:0,c:0},{r:1,c:1}]);
const linked=selectionDetails(map,[{r:0,c:1}]);assert.equal(linked.direct.length,1);assert.equal(linked.cells.length,3);assert.equal(linked.linked.length,2);
assert.equal(selectionDetails(map,[{r:0,c:1}],(r,c)=>r===1&&c===1).cells.length,0,'隐藏一个占用格时整个实体不进入选区');
assert.equal(selectionDetails(map,[]).cells.length,0);
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
 const context={map:structuredClone(baseline),selectedCells:[{r:0,c:0},{r:0,c:1}],P:{mode:'edit'},clone:structuredClone,inspectionCells,cellHidden:()=>false,entityPropertySchema:t=>t.propertySchema??{},inspectedPropertySchema:(r,c,t)=>t.propertySchema??{},inspectionKey:(r,c)=>r+','+c,debugOverrides:{values:(k,t)=>t,set:()=>{}},updateProperty,mergeSerializableProperties,debugChanges,blocked:()=>false,normalizeTile:t=>t,assertHiddenContentUnchanged:()=>{},tagCatalog:[],visibility:{},validateMap:t=>t,record:()=>records++,controller:{resetPosition:()=>{}},buildPaper:()=>{},persist:()=>{},$:()=>({textContent:''}),updateUI:()=>{},scheduleInspection:()=>{}};
 context.applyMap=(next,saveHistory)=>{if(saveHistory)context.record();context.map=next;};
 context.applyPropertyMap=next=>context.applyMap(next,true);
 context.documentModel={};context.forkTreeDocument=()=>({applyLegacy:()=>{}});context.assertNodePropertyChanges=()=>{};context.nodeSchema=()=>({});
 runInNewContext(body,context);return {context,baseline,records:()=>records};
}
const denied=transactionFixture(true);assert.throws(()=>denied.context.applyInspectedProperty(['height'],.5),/不可编辑/);assert.deepEqual(denied.context.map,denied.baseline);assert.equal(denied.records(),0);
const accepted=transactionFixture(false);accepted.context.applyInspectedProperty(['height'],.5);assert.deepEqual(accepted.context.map.tiles[0].map(t=>t.height),[.5,.5]);assert.equal(accepted.records(),1);
console.log('PASS: production batch adapter rejects a later readonly target without partial writes and commits valid edits once.');
const local=transactionFixture(false);local.context.directSelectedCells=[{r:0,c:0}];local.context.map.tiles[0].forEach(t=>t.folds=[]);local.context.assertTagAttachment=()=>{};
local.context.applyInspectedProperty(['folds'],['h'],'cell');assert.deepEqual(local.context.map.tiles[0][0].folds,['h']);assert.deepEqual(local.context.map.tiles[0][1].folds,[]);assert.equal(local.records(),1);
console.log('PASS: per-cell tags/folds use direct cells while whole-instance attributes retain batch semantics.');

// Canonical component restrictions must govern the legacy Inspector transaction.
const {nodePermissions}=await import('./entities/node-permissions.mjs');
const {entityPropertySchema}=await import('./tags/tag-model.mjs');
const lockedNode={id:'locked',configuration:{propertySchema:{components:{children:{surface:{children:{height:{tempEditable:false,readable:false}}}}}}}};
const canonical=transactionFixture(false);
canonical.context.documentModel={primaryAt:(r,c)=>c===1?lockedNode:{id:'open',configuration:{}}};
canonical.context.nodeSchema=node=>nodePermissions(node,entityPropertySchema(node.configuration,[]));
canonical.context.inspectedPropertySchema=(r,c,tile)=>canonical.context.nodeSchema(canonical.context.documentModel.primaryAt(r,c));
assert.throws(()=>canonical.context.applyInspectedProperty(['height'],.8),/不可编辑/);
assert.deepEqual(canonical.context.map,canonical.baseline);assert.equal(canonical.records(),0);
console.log('PASS: canonical native restrictions reject legacy batch edits atomically.');

// Use the actual Inspector adapter as well as the actual batch transaction.
canonical.context.documentModel.world={at:()=>[]};
const inspectorContext={documentModel:canonical.context.documentModel,nodeSchema:canonical.context.nodeSchema,entityPropertySchema,projectedCellSchema,tagCatalog:[]};
runInNewContext(source.slice(source.indexOf('function inspectedPropertySchema('),source.indexOf('function inspectSelection(){')),inspectorContext);
const effective=inspectorContext.inspectedPropertySchema(0,1,{height:.2});
assert.equal(batchProperties([{values:{height:.2},schema:effective}]).schema.height.readable,false);
assert.equal(batchProperties([{values:{height:.2},schema:effective}]).schema.height.tempEditable,false);
const legacyLocked={configuration:{propertySchema:{height:{tempEditable:false},components:{children:{surface:{children:{height:{tempEditable:true}}}}}}}};
assert.equal(nodePermissions(legacyLocked,entityPropertySchema(legacyLocked.configuration,[])).components.children.surface.children.height.tempEditable,false);
console.log('PASS: Inspector display and editing use intersected native/legacy permissions in both directions.');

const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
const bundle=await require('esbuild').build({stdin:{contents:"export {TreeDocument} from './entities/tree-document.mjs';export {forkTreeDocument} from './entities/tree-commands.mjs';",resolveDir:import.meta.dirname},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,forkTreeDocument}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const primary={id:'a-surface',prefabId:'paper_ai',transformId:'surface-t',components:{surface:{color:'white',height:.09,thickness:.09,gradualRate:0},collision:{blocked:false}},tags:{},static:{},configuration:{}};
const secondary={id:'z-tag',prefabId:'tag_ai',transformId:'tag-t',components:{fold:{directions:['h']}},tags:{exitTo:'A'},static:{},configuration:{propertySchema:{tags:{children:{exitTo:{tempEditable:false}}},components:{children:{fold:{tempEditable:false}}}}}};
function ownerDocument(tagNode=secondary){return new TreeDocument({version:2,width:3,height:3,entities:[primary,tagNode],transforms:[{id:'surface-t',parentId:null,local:{r:0,c:0,dir:0},footprint:{width:1,height:1,occupied:[true]}},{id:'tag-t',parentId:null,local:{r:0,c:0,dir:0},footprint:{width:1,height:1,occupied:[true]}}],cellTags:{'0,0':{regionTag:'A'}},legacyMetadata:{spawn:{r:0,c:0,dir:0}}});}
const schemaFor=node=>nodePermissions(node,entityPropertySchema(node.configuration??{},[]));
const owners=ownerDocument(),ownerSchema=projectedCellSchema(owners.primaryAt(0,0),owners.world.at(0,0),owners.view().tiles[0][0],schemaFor,{});
const regionOnly=owners.view();regionOnly.tiles[0][0].regionTag='B';const regionCandidate=forkTreeDocument(owners);regionCandidate.applyLegacy(regionOnly);
assert.doesNotThrow(()=>assertNodePropertyChanges(owners,regionCandidate,schemaFor),'unrestricted fixed region change remains allowed');
assert.throws(()=>updateProperty(owners.view().tiles[0][0],ownerSchema,['tags','exitTo'],'B'),/不可编辑/);
assert.throws(()=>updateProperty(owners.view().tiles[0][0],ownerSchema,['folds'],[]),/不可编辑/);
for(const edit of [tile=>tile.tags.exitTo='B',tile=>{tile.folds=[];tile.fold=null;},tile=>delete tile.tags.exitTo]){
 const next=owners.view();edit(next.tiles[0][0]);const checked=forkTreeDocument(owners);checked.applyLegacy(next);
 assert.throws(()=>assertNodePropertyChanges(owners,checked,schemaFor),/不可编辑/);
 assert.equal(owners.world.get('z-tag').tags.exitTo,'A');
}
console.log('PASS: secondary tag/fold owners and indirect tag removal obey their own canonical permissions.');

const uniqueOwner=structuredClone(secondary);uniqueOwner.tags={spawn:true};uniqueOwner.configuration.propertySchema.tags.children={spawn:{tempEditable:false}};
const uniqueDoc=ownerDocument(uniqueOwner),uniqueSaved=uniqueDoc.serialize();
uniqueSaved.entities.push({...structuredClone(primary),id:'target',transformId:'target-t'});
uniqueSaved.transforms.push({id:'target-t',parentId:null,local:{r:0,c:1,dir:0},footprint:{width:1,height:1,occupied:[true]}});
const uniqueFixture=transactionFixture(false),uniqueContext=uniqueFixture.context;
const {tagCell,regionOf,validateRegions}=await import('./tags/regions.mjs');
const {normalizeTile}=await import('./entities/tile-model.mjs');
Object.assign(uniqueContext,{documentModel:new TreeDocument(uniqueSaved),nodeSchema:schemaFor,projectedCellSchema,assertNodePropertyChanges,forkTreeDocument,tagCell,regionOf,validateRegions,assertTagAttachment:()=>{},directSelectedCells:[{r:0,c:1}],selectedCells:[{r:0,c:1}]});
uniqueContext.normalizeTile=normalizeTile;
uniqueContext.map=uniqueContext.documentModel.view();uniqueContext.map.tiles[0][1].tags={spawn:false};
runInNewContext(source.slice(source.indexOf('function inspectedPropertySchema('),source.indexOf('function inspectSelection(){')),uniqueContext);
const uniqueBefore=structuredClone(uniqueContext.map);
assert.throws(()=>uniqueContext.applyInspectedProperty(['tags','spawn'],true,'cell'),/不可编辑/);
assert.deepEqual(uniqueContext.map,uniqueBefore);assert.equal(uniqueFixture.records(),0);
assert.equal(uniqueContext.documentModel.world.get('z-tag').tags.spawn,true);
console.log('PASS: production Inspector rejects indirect readonly unique-tag clearing without history or partial edits.');
assert.doesNotThrow(()=>projectedCellSchema(primary,[{...secondary,components:{fold:{}}}],{tags:{},folds:[]},schemaFor,{}));
const hiddenConfiguration=ownerDocument({...structuredClone(secondary),configuration:{custom:1,propertySchema:{custom:{readable:false}}}});
const hiddenCandidate={world:{get:id=>{const value=hiddenConfiguration.world.get(id);if(id==='z-tag')value.configuration.custom=2;return value;}}};
assert.throws(()=>assertNodePropertyChanges(hiddenConfiguration,hiddenCandidate,schemaFor),/不可编辑/);
