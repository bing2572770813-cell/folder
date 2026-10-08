import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=await build({stdin:{contents:'export {TreeDocument} from "./entities/tree-document.mjs";export {renderTreeCells} from "./render/tree-render.mjs";',resolveDir:fileURLToPath(new URL('./',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,renderTreeCells}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const map={version:2,width:8,height:8,entities:[],transforms:[],cellTags:{},metadata:{name:'区域生成',spawn:{r:0,c:0,dir:0},exit:null}};
for(const [id,r,c,tags,components] of [['start',0,0,{spawn:true},{}],['switch',7,7,{}, {foldSwitch:{initialState:1},fold:{directions:['v']},collision:{blocked:true}}],['tail',0,1,{},{}]]){
 map.entities.push({id,prefabId:'paper_ai',transformId:'t-'+id,components:{surface:{height:.09},...components},tags,static:{entityType:'terrain'}});
 map.transforms.push({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 map.cellTags[r+','+c]={regionTag:id==='switch'?'B':'A'};
}
const document=new TreeDocument(map),before=document.serialize();
document.world.setSpawnedEntities(new Set(['start','tail']));
assert.deepEqual(document.world.at(7,7),[]);assert.equal(document.world.has('switch'),false);
assert.equal(document.view({runtime:true}).tiles[7][7],null);
assert.equal(renderTreeCells(document,{runtime:true}).surfaceCells.length,2);
assert.deepEqual(document.serialize(),before,'export retains hidden definitions and validates hidden switches');
assert.deepEqual(new TreeDocument(document.serialize()).serialize(),before);
const cloned=document.clone();cloned.world.setSpawnedEntities(null);assert.equal(cloned.world.has('switch'),true);assert.equal(document.world.has('switch'),false);
document.world.setSpawnedEntities(new Set(['start','tail','switch']));document.world.setRuntime('switch','foldSwitch',{state:0});
assert.equal(renderTreeCells(document,{runtime:true}).surfaceCells.length,3);
document.world.setSpawnedEntities(new Set(['start','tail']));document.world.setSpawnedEntities(null);
assert.deepEqual(document.world.runtime('switch','foldSwitch'),{},'respawn starts from prefab configuration');
assert.deepEqual(document.serialize(),before);assert.throws(()=>document.world.setSpawnedEntities(new Set(['missing'])),/Unknown entity/);
console.log('PASS: hidden region has no instances or geometry, while editor/export preserves full map definitions.');

const terrain=document.world.get('tail'),configured=document.serialize();
const ice={...terrain,prefabId:'ice_ai',components:{surface:{height:.09,color:'blue'},collision:{blocked:true},ice:{}},static:{entityType:'terrain',walkable:false}};
document.world.replaceRuntimeEntities([ice]);
assert.equal(document.view({runtime:true}).tiles[0][1].prefabId,'ice_ai');assert.equal(document.view().tiles[0][1].prefabId,'paper_ai');
assert.deepEqual(document.serialize(),configured,'temporary replacement never enters map export');
const replacements=document.world.snapshotReplacements();const fork=document.clone();fork.world.replaceRuntimeEntities([]);assert.equal(fork.world.get('tail').prefabId,'paper_ai');assert.equal(document.world.get('tail').prefabId,'ice_ai');
assert.throws(()=>document.world.replaceRuntimeEntities([ice,{...ice,id:'missing'}]),/replacement identity/);assert.deepEqual(document.world.snapshotReplacements(),replacements,'failed replacement is atomic');
document.world.resetRuntime();assert.equal(document.world.get('tail').prefabId,'paper_ai');
console.log('PASS: runtime terrain replacement renders ice and preserves canonical map export, cloning and atomicity.');
