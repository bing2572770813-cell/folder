import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import {validateMap} from './core/map-model.mjs';
import {normalizeTile} from './entities/tile-model.mjs';

const bundled=await build({stdin:{contents:[
  'export {TreeDocument} from "./entities/tree-document.mjs";',
  'export {placeCategorizedPrefab} from "./entities/tree-commands.mjs";',
  'export {previewPlacement} from "./entities/placement-preview.mjs";',
].join('\n'),resolveDir:fileURLToPath(new URL('./',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab,previewPlacement}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const blank=()=>({version:2,width:7,height:5,entities:[],transforms:[],cellTags:{},metadata:{spawn:{r:2,c:3,dir:0},exit:null,name:'草稿',description:'',maxSteps:0,bestSteps:null}});
const paper={version:1,id:'paper_ai',name:'纸张',size:{width:1,height:1},occupied:[true],BaseEntity:['void_ai'],static:{entityType:'terrain'},tile:{height:.09,thickness:.04,gradualRate:2/3,color:'white',blocked:false,surfaceConnected:true}};
const tile=normalizeTile({...paper.tile,prefabId:paper.id});
function taggedPaper(){
  const input=blank();
  input.entities=[{id:'start',prefabId:paper.id,transformId:'start-transform',components:{surface:{height:.09,thickness:.04,gradualRate:2/3,color:'white',connected:true},collision:{blocked:false}},tags:{spawn:true},static:{entityType:'terrain'},configuration:{...tile}}];
  input.transforms=[{id:'start-transform',parentId:null,local:{r:0,c:0,dir:0},footprint:{width:1,height:1,occupied:[true]}}];
  input.cellTags={'0,0':{regionTag:'旧区域'}};
  return new TreeDocument(input);
}

const empty=new TreeDocument(blank());
assert.equal(empty.world.serialize().length,0);
assert.doesNotThrow(()=>validateMap(empty.view(),true));
assert.throws(()=>validateMap(empty.view()),/玩家起点必须在可行走方块上/);
const blockedDraft=placeCategorizedPrefab(empty,paper,{...tile,blocked:true},2,3);
assert.doesNotThrow(()=>new TreeDocument(blockedDraft.serialize()));
assert.doesNotThrow(()=>validateMap(blockedDraft.view(),true));
assert.throws(()=>validateMap(blockedDraft.view()),/玩家起点必须在可行走方块上/);
for(const spawn of [{r:2,c:3},{r:-1,c:3,dir:0},{r:5,c:3,dir:0},{r:2,c:7,dir:0},{r:2,c:3,dir:8}]){
  const input=blank();input.metadata.spawn=spawn;
  assert.throws(()=>new TreeDocument(input),/玩家起点必须在可行走方块上/,'drafts still reject malformed spawn coordinates or direction');
}
console.log('PASS: empty and blocked-start drafts remain editable while strict map validation and malformed spawn guards remain enforced.');

// Execute the production new-map and replacement handlers, with only their UI effects stubbed.
const app=readFileSync(new URL('./app.ts',import.meta.url),'utf8');
const replaceHandler=app.split('\n').find(line=>line.startsWith('function replaceMap('));
const newHandler=app.split('\n').find(line=>line.startsWith("$('newMap').onclick="));
assert.ok(replaceHandler&&newHandler,'production map replacement and new-map handlers must be exercised');
const initial=taggedPaper();
initial.metadata={...initial.metadata,name:'旧地图',description:'旧说明',maxSteps:17,bestSteps:9,spawn:{r:0,c:0,dir:6}};
const beforeNew=initial.serialize(),button={},history=[],messages=[];
const counts={reset:0,progress:0,build:0,persist:0};
const noop=()=>{};
const context={TreeDocument,documentModel:initial,map:initial.view(),P:{mode:'play'},
  setMode:mode=>{context.P.mode=mode;},record:()=>history.push(context.documentModel.serialize()),
  debugOverrides:{clear:noop},nodeDebug:{clear:noop},clearInspection:noop,editRect:{r:0,c:0,w:1,h:1},
  setSelectedCells:cells=>{context.selectedCells=cells;},pendingRegion:{},hiddenRegions:new Set(['旧区域']),
  controller:{resetPosition:()=>counts.reset++,resetProgress:()=>counts.progress++},
  buildPaper:()=>counts.build++,fitCamera:noop,persist:()=>counts.persist++,updateUI:noop,
  toast:message=>messages.push(message),$:id=>{assert.equal(id,'newMap');return button;}};
runInNewContext(replaceHandler+'\n'+newHandler,context);
assert.doesNotThrow(()=>button.onclick(),'newMap must accept an empty native draft with a valid fallback spawn');
const created=context.documentModel.serialize();
assert.equal(created.width,beforeNew.width);assert.equal(created.height,beforeNew.height);
assert.deepEqual(created.entities,[]);assert.deepEqual(created.transforms,[]);assert.deepEqual(created.cellTags,{});
assert.deepEqual(context.map.spawn,{r:2,c:3,dir:0});
assert.ok(context.map.tiles.flat().every(value=>value===null));
assert.equal(context.map.name,'未命名关卡');assert.equal(context.map.description,'');
assert.equal(context.map.maxSteps,0);assert.equal(context.map.bestSteps,null);assert.equal(context.map.exit,null);
assert.equal(context.P.mode,'edit');assert.equal(context.hiddenRegions.size,0);
assert.equal(context.selectedCells.length,0);assert.equal(context.pendingRegion,null);
assert.equal(history.length,1);assert.deepEqual(history[0],beforeNew);
assert.deepEqual(counts,{reset:1,progress:1,build:1,persist:1});
assert.deepEqual(messages,['已新建空白地图']);
console.log('PASS: production newMap and replaceMap create an empty map with preserved dimensions, centered fallback spawn and one undo snapshot.');

const draft=context.documentModel,beforePlace=draft.serialize();
const preview=previewPlacement(draft,paper,tile,0,0).candidate;
const placed=placeCategorizedPrefab(draft,paper,tile,0,0);
for(const candidate of [preview,placed]){
  assert.equal(candidate.world.serialize().length,1);
  assert.equal(candidate.view().tiles[0][0].prefabId,paper.id);
  assert.equal(candidate.view().tiles[2][3],null);
  assert.deepEqual(candidate.view().spawn,{r:2,c:3,dir:0});
  assert.doesNotThrow(()=>new TreeDocument(candidate.serialize()));
}
assert.deepEqual(draft.serialize(),beforePlace,'preview and placement candidates do not mutate the source');
console.log('PASS: the first block preview and placement succeed away from the draft fallback spawn without modifying their source.');

// These real projection mutations used to instantiate an empty seed document and fail spawn validation.
const projected=new TreeDocument(blank()),projection=projected.view();
const target=normalizeTile({...tile,color:'blue',regionTag:'新格区域',folds:['h'],tags:{spawn:true}});
projection.tiles[0][0]=target;
assert.doesNotThrow(()=>projected.applyProjection(projection));
assert.deepEqual(projected.view().tiles[0][0],target);
assert.deepEqual(projected.view().spawn,{r:0,c:0,dir:0});
assert.equal(projected.world.serialize().length,1);
const firstId=projected.world.serialize()[0].id,replacement=projected.view();
const replacementTile=normalizeTile({...target,prefabId:'ice_ai',terrain:'ice',terrainConfig:{},color:'green'});
replacement.tiles[0][0]=replacementTile;
assert.doesNotThrow(()=>projected.applyProjection(replacement));
assert.equal(projected.world.serialize().length,1);
assert.notEqual(projected.world.serialize()[0].id,firstId);
assert.deepEqual(projected.view().tiles[0][0],replacementTile);
assert.deepEqual(new TreeDocument(projected.serialize()).view(),projected.view());
console.log('PASS: projected new cells and prefab replacements construct complete native nodes and preserve tags, folds, region and configuration through serialization.');

const tagged=taggedPaper();
const beforeBlocked=tagged.serialize();
for(const operation of [
  ()=>placeCategorizedPrefab(tagged,paper,{...tile,blocked:true},0,0),
  ()=>previewPlacement(tagged,paper,{...tile,blocked:true},0,0),
]){
  assert.throws(operation,/不能用不可通行实体覆盖玩家起点/);
  assert.deepEqual(tagged.serialize(),beforeBlocked,'rejected spawn-covering placement must remain atomic');
}
console.log('PASS: preview and placement retain actual spawn-label protection and leave rejected edits unchanged.');
