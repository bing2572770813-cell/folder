import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {normalizeTile} from './entities/tile-model.mjs';
const bundle=await build({stdin:{contents:'export {TreeDocument} from "./entities/tree-document.mjs";export {copyTree,pasteTree} from "./entities/tree-clipboard.mjs";export {deleteNode} from "./entities/tree-commands.mjs";',resolveDir:fileURLToPath(new URL('./',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,copyTree,pasteTree,deleteNode}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const map={version:2,width:8,height:8,entities:[],transforms:[],cellTags:{},metadata:{name:'出口绑定',spawn:{r:0,c:0,dir:0},exit:null}};
for(const [id,r,c,tags,components] of [['start',0,0,{spawn:true},{}],['switch',0,2,{}, {foldSwitch:{initialState:1},fold:{directions:['v']},collision:{blocked:true}}],['exit',1,1,{exitTo:'B',requiredSwitches:['switch']},{}],['b',7,7,{},{}]]){
 map.entities.push({id,prefabId:'paper_ai',transformId:'t-'+id,components:{surface:{height:.09},...components},tags,static:{entityType:'terrain'}});
 map.transforms.push({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 map.cellTags[r+','+c]={regionTag:id==='b'?'B':'A'};
}
const document=new TreeDocument(map),before=document.serialize();
assert.deepEqual(new TreeDocument(before).world.get('exit').tags.requiredSwitches,['switch']);
const copied=copyTree(document,[{r:0,c:2},{r:1,c:1}]);
const pasted=pasteTree(document,copied,3,3),newSwitch=pasted.world.serialize().find(node=>node.id!=='switch'&&node.components.foldSwitch),newExit=pasted.world.serialize().find(node=>node.id!=='exit'&&node.tags.exitTo);
assert.deepEqual(newExit.tags.requiredSwitches,[newSwitch.id]);
assert.deepEqual(pasted.world.get('exit').tags.requiredSwitches,['switch']);
const onlyExit=pasteTree(document,copyTree(document,[{r:1,c:1}]),5,5);
assert.deepEqual(onlyExit.world.serialize().find(node=>node.id!=='exit'&&node.tags.exitTo).tags.requiredSwitches,['switch']);
assert.deepEqual(deleteNode(document,'switch').world.get('exit').tags.requiredSwitches,['switch'],'deleted target retains its reference for fail-closed validation');
assert.deepEqual(document.serialize(),before);
for(const requiredSwitches of [['switch','switch'],[123],{},['']])assert.throws(()=>normalizeTile({tags:{requiredSwitches}}),/绑定开关/);
const bad=structuredClone(map);bad.entities.find(node=>node.id==='exit').tags.requiredSwitches=['switch','switch'];assert.throws(()=>new TreeDocument(bad),/绑定开关/);
console.log('PASS: exit switch bindings persist, remap copied targets, retain external/missing references and reject malformed lists.');
