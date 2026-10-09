import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
import {normalizeTile} from './entities/tile-model.mjs';

const bundle=await build({stdin:{contents:'export {TreeDocument} from "./entities/tree-document.mjs"; export {placeCategorizedPrefab} from "./entities/tree-commands.mjs"; export {previewPlacement} from "./entities/placement-preview.mjs";',resolveDir:fileURLToPath(new URL('./',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab,previewPlacement}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const prefab={id:'paper_ai',name:'纸张',size:{width:1,height:1},occupied:[true],BaseEntity:['void_ai'],static:{entityType:'terrain'},tile:{height:.09,thickness:.04,color:'white',blocked:false,surfaceConnected:true}};
const input={version:2,width:3,height:3,entities:[],transforms:[],cellTags:{},metadata:{spawn:{r:0,c:0,dir:0},exit:null,name:'放置回归',maxSteps:0}};
for(let r=0;r<3;r++)for(let c=0;c<3;c++){
 const id=r+','+c;input.transforms.push({id:'t'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 input.entities.push({id,prefabId:prefab.id,transformId:'t'+id,components:{surface:{height:.09,thickness:.04,color:'white',connected:true},collision:{blocked:false}},tags:r===0&&c===0?{spawn:true}:{},static:{entityType:'terrain'}});
 input.cellTags[id]={regionTag:'区域'+r};
}
const documentModel=new TreeDocument(input),before=documentModel.serialize(),tile=normalizeTile({...prefab.tile,prefabId:prefab.id,color:'red'});
const source=readFileSync(new URL('./app.ts',import.meta.url),'utf8');
const functions=source.slice(source.indexOf('function placementKey('),source.indexOf('let placementCheckCache=null;'));
const context={documentModel,map:documentModel.view(),prefabs:[prefab],selectedPrefabId:prefab.id,color:'red',visibility:{folds:true,player:true},hiddenEntities:new Set(),hiddenRegions:new Set(),placementTagCells:[{r:0,c:0}],placementCheckCache:null,
 $:()=>({value:'1'}),withEmitterDirection:base=>base,brushTile:()=>tile,entityHidden:()=>false,blocked:()=>false,cellHidden:()=>false,nodeHidden:()=>false,assertTreeVisibility:()=>{},previewPlacement,placeCategorizedPrefab};
runInNewContext(functions,context);
const preview=context.placementCandidate(1,1,{preview:true});
assert.equal(preview.world.serialize().length,2,'preview intentionally contains only placement and unique-tag cells');
context.placementCheckCache={document:documentModel,prefab,key:context.placementKey(1,1),candidate:preview,reason:''};
const placed=context.placementCandidate(1,1);
assert.equal(placed.world.serialize().length,9,'click after a cached hover preview must preserve the full map');
for(const node of before.entities.filter(node=>node.id!=='1,1'))assert.deepEqual(placed.world.get(node.id),documentModel.world.get(node.id));
assert.deepEqual(placed.cellTags,documentModel.cellTags);assert.equal(placed.view().tiles[1][1].color,'red');
assert.deepEqual(documentModel.serialize(),before,'preview and placement preparation preserve the original undo snapshot');
context.documentModel=placed;context.map=placed.view();const repeated=context.placementCandidate(1,2);assert.equal(repeated.world.serialize().length,9,'subsequent placement retains distant cells');
console.log('PASS: production placement after a cached local preview preserves unrelated cells, tags, regions and the undo source.');
