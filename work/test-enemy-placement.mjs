import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {normalizePrefab} from './entities/tile-model.mjs';
import {entityCategory,isPlaceableEntity} from './entities/entity-category.mjs';
import {withEmitterDirection} from './entities/emitter-placement.mjs';

const bundle=await build({stdin:{contents:'export {TreeDocument} from "./entities/tree-document.mjs";export {placeCategorizedPrefab,deleteNode} from "./entities/tree-commands.mjs";export {previewPlacement} from "./entities/placement-preview.mjs";',resolveDir:fileURLToPath(new URL('./',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab,previewPlacement,deleteNode}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const prefab=id=>normalizePrefab(JSON.parse(readFileSync(new URL('../assets/prefab/entity/'+id+'.json',import.meta.url),'utf8')));
const bird=prefab('firebird_ai'),emitter=prefab('ray_emitter_ai');
const input={version:2,width:6,height:6,entities:[],transforms:[],cellTags:{},metadata:{spawn:{r:0,c:0,dir:0},exit:null,name:'敌人测试',description:'',maxSteps:0,bestSteps:null}};
for(let r=0;r<6;r++)for(let c=0;c<6;c++){
 const id=r+'-'+c;
 input.cellTags[r+','+c]={regionTag:'默认区域'};
 input.transforms.push({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 input.entities.push({id,prefabId:'paper_ai',transformId:'t-'+id,components:{surface:{height:.09},collision:{blocked:false}},static:{entityType:'terrain'},tags:r===0&&c===0?{spawn:true}:{}});
}
const document=new TreeDocument(input),before=document.serialize();
const emitterBefore=structuredClone(emitter);
for(const direction of ['north','east','south','west']){
 const brush=withEmitterDirection(emitter,direction);
 for(const candidate of [placeCategorizedPrefab(document,brush,{},1,1),previewPlacement(document,brush,{},1,1).candidate]){
  const node=candidate.world.serialize().find(node=>node.prefabId===emitter.id);
  assert.equal(node.components.rayEmitter.initialDirection,direction);
  const restored=new TreeDocument(candidate.serialize());
  assert.equal(restored.world.get(node.id).components.rayEmitter.initialDirection,direction);
 }
}
assert.deepEqual(emitter,emitterBefore,'placement direction must not mutate the backend prefab');
assert.throws(()=>withEmitterDirection(emitter,'diagonal'),/direction/);
for(const enemy of [bird,emitter]){
 assert.equal(entityCategory(enemy),'creature');assert.equal(isPlaceableEntity(enemy),true);
 assert.equal(enemy.components.physics.canDropOnFold,true);
 assert.equal(enemy.components.surface,undefined);
 const placed=placeCategorizedPrefab(document,enemy,{},1,1),node=placed.world.serialize().find(node=>node.prefabId===enemy.id);
 assert.equal(placed.world.cells(node.id).length,enemy.occupied.length);
 assert.equal(placed.world.at(1,1).some(node=>node.prefabId==='paper_ai'),true);
 assert.equal(placed.world.at(1,1).filter(node=>node.components.surface).length,1);
 const preview=previewPlacement(document,enemy,{},1,1).candidate;
 assert.equal(preview.world.serialize().filter(node=>node.prefabId===enemy.id).length,1);
 assert.equal(preview.world.at(1,1).filter(node=>node.components.surface).length,1);
 assert.deepEqual(new TreeDocument(placed.serialize()).serialize(),placed.serialize());
 assert.deepEqual(deleteNode(placed,node.id).serialize(),before);
 assert.throws(()=>placeCategorizedPrefab(placed,enemy,{},1,1),/不能覆盖/);
 for(const options of [{isHidden:(r,c)=>r===1&&c===1},{nodeHidden:node=>node.id==='1-1'}]){
  assert.throws(()=>placeCategorizedPrefab(document,enemy,{},1,1,options),/隐藏/);
  assert.throws(()=>previewPlacement(document,enemy,{},1,1,options),/隐藏/);
 }
 assert.throws(()=>placeCategorizedPrefab(document,enemy,{},0,0),/起点/);
}
const missing=structuredClone(input);missing.entities=missing.entities.filter(node=>node.id!=='3-3');
assert.throws(()=>placeCategorizedPrefab(new TreeDocument(missing),bird,{},1,1),/纸面|基底/);
assert.throws(()=>previewPlacement(new TreeDocument(missing),bird,{},1,1),/纸面|基底/);
assert.throws(()=>placeCategorizedPrefab(document,bird,{},5,5),/超出/);
assert.throws(()=>placeCategorizedPrefab(document,{...bird,size:{width:2,height:2},occupied:[true,true,true,true]}, {},1,1),/完整/);
assert.equal(isPlaceableEntity(prefab('player_ai')),false);
assert.deepEqual(document.serialize(),before,'failed placements must never change the original map');
console.log('PASS: creature enemy placement, complete footprints, preserved paper, preview parity, persistence and atomic rejection.');
