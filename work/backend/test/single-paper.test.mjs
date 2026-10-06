import test from 'node:test';
import assert from 'node:assert/strict';
import {importTreeMap,serializeTreeMap} from '../dist/entities/tree-serialization.js';
import {normalizePrefab} from '../../entities/tile-model.mjs';

function fixture(){return {version:2,width:6,height:6,entities:[{id:'paper',prefabId:'large_paper_ai',transformId:'p',components:{surface:{height:.7,color:'blue'},fire:{}},tags:{exitTo:'B'},static:{}}],transforms:[{id:'p',parentId:null,local:{r:1,c:1,dir:2},footprint:{width:3,height:1,occupied:[false,true,true]}}],cellTags:{'1,2':{regionTag:'A'}},legacyMetadata:{spawn:{r:1,c:2,dir:0}}};}
test('old sparse paper splits into independent single tiles without moving explicit children or shared overlays',()=>{
 const input=fixture();input.entities.push({id:'overlay',prefabId:'custom',transformId:'p',components:{tag:{}},tags:{},static:{}});
 input.transforms.push({id:'child',parentId:'p',local:{r:2,c:1,dir:1},footprint:{width:1,height:1,occupied:[true]}});
 const before=structuredClone(input),{world,metadata,cellTags}=importTreeMap(input);
 const papers=world.serialize().filter(node=>node.components.surface);
 assert.equal(papers.length,2);for(const node of papers){assert.deepEqual(world.transforms.get(node.transformId).footprint,{width:1,height:1,occupied:[true]});assert.equal(node.prefabId,'paper_ai');assert.deepEqual(node.components.fire,{});assert.deepEqual(node.tags,{exitTo:'B'});}
 assert.deepEqual(world.transforms.worldCells('p'),[{r:1,c:2}]);
 assert.deepEqual(world.transforms.world('child'),{r:3,c:2,dir:3});
 assert.deepEqual(world.transforms.worldCells(world.get('overlay').transformId),[{r:1,c:2},{r:1,c:3}]);
 assert.deepEqual(cellTags,{'1,2':{regionTag:'A'}});assert.deepEqual(input,before);
 const saved=serializeTreeMap(world,metadata,cellTags);assert.deepEqual(importTreeMap(saved).world.serialize(),world.serialize());
});
test('legacy instance grouping becomes independent tiles with per-cell properties preserved',()=>{
 const input={version:1,width:4,height:4,tiles:Array.from({length:4},()=>Array(4).fill(null)),spawn:{r:1,c:1,dir:0}};
 for(const c of [1,2])input.tiles[1][c]={prefabId:'large_paper_ai',height:c/10,color:'white',instance:{id:'old',width:2,height:1,anchorR:1,anchorC:1}};
 const {world}=importTreeMap(input);for(const node of world.serialize()){assert.equal(node.configuration.instance,undefined);assert.equal(world.transforms.get(node.transformId).parentId,null);assert.equal(node.prefabId,'paper_ai');}
 const root=world.at(1,1)[0];world.transforms.setLocal(root.transformId,{r:2,c:1,dir:0});assert.equal(world.at(1,2).length,1);
});
test('new paper prefabs are single tile while surface-free multi-cell entities remain valid',()=>{
 assert.throws(()=>normalizePrefab({version:1,id:'wide',name:'wide',tile:{color:'white'},size:{width:2,height:1}}),/纸张实体只能占一个方格/);
 assert.throws(()=>normalizePrefab({version:1,id:'wide',name:'wide',components:{surface:{}},size:{width:2,height:1}}),/纸张实体只能占一个方格/);
 assert.doesNotThrow(()=>normalizePrefab({version:1,id:'wide',name:'wide',components:{tag:{}},size:{width:2,height:1}}));
});
