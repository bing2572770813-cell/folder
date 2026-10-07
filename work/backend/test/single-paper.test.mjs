import test from 'node:test';
import assert from 'node:assert/strict';
import {importTreeMap,serializeTreeMap} from '../dist/entities/tree-serialization.js';
import {normalizePrefab} from '../../entities/tile-model.mjs';

function fixture(){return {version:2,width:6,height:6,entities:[{id:'paper',prefabId:'large_paper_ai',transformId:'p',components:{surface:{height:.7,color:'blue'},fire:{}},tags:{exitTo:'B'},static:{}}],transforms:[{id:'p',parentId:null,local:{r:1,c:1,dir:2},footprint:{width:3,height:1,occupied:[false,true,true]}}],cellTags:{'1,2':{regionTag:'A'}},metadata:{spawn:{r:1,c:2,dir:0}}};}
test('new paper prefabs are single tile while surface-free multi-cell entities remain valid',()=>{
 assert.throws(()=>normalizePrefab({version:1,id:'wide',name:'wide',tile:{color:'white'},size:{width:2,height:1}}),/纸张实体只能占一个方格/);
 assert.throws(()=>normalizePrefab({version:1,id:'wide',name:'wide',components:{surface:{}},size:{width:2,height:1}}),/纸张实体只能占一个方格/);
 assert.doesNotThrow(()=>normalizePrefab({version:1,id:'wide',name:'wide',components:{tag:{}},size:{width:2,height:1}}));
});
