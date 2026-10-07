import test from 'node:test';
import assert from 'node:assert/strict';
import {PrefabRegistry} from '../dist/entities/prefab-definition.js';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=async file=>{const entry=fileURLToPath(new URL(file,import.meta.url)),result=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text+'\n//# sourceURL='+entry.replaceAll('\\','/')).toString('base64'));};
const {TreeDocument}=await bundle('../../entities/tree-document.mjs');
const {placeCategorizedPrefab}=await bundle('../../entities/tree-commands.mjs');
const {copyTree,pasteTree}=await bundle('../../entities/tree-clipboard.mjs');
import {normalizePrefab} from '../../entities/tile-model.mjs';

test('visual configuration inherits and can be disabled without changing entity rules',()=>{
 const registry=new PrefabRegistry([{id:'base',components:{key:{name:'key'}},visual:{model:'model/key_ai.fbx'}},{id:'child',extends:'base',visual:{scale:[2,2,2]}},{id:'off',extends:'child',visual:null}]);
 const node=registry.instantiate('child','child-instance','transform');
 assert.equal(node.configuration.visual.model,'model/key_ai.fbx');assert.deepEqual(node.configuration.visual.scale,[2,2,2]);
 assert.deepEqual(node.components,{key:{name:'key'}});assert.equal(registry.instantiate('off','off','t-off').configuration.visual,null);
});

test('placed prefab retains visual through native persistence, copy/paste and map reload',()=>{
 const tiles=Array.from({length:3},()=>Array.from({length:3},()=>({prefabId:'paper_ai',height:.09})));
 tiles[2][2]=null;
 const document=new TreeDocument({version:1,width:3,height:3,tiles,spawn:{r:0,c:0,dir:0}});
 const prefab=normalizePrefab({version:1,id:'model_key_ai',name:'Key',tile:{terrain:'key'},static:{entityType:'item'},BaseEntity:['paper_ai'],visual:{model:'model/key_ai.fbx',offset:[0,.2,0]}});
 const placed=placeCategorizedPrefab(document,prefab,prefab.tile,1,1);
 const node=placed.world.at(1,1).find(node=>node.prefabId===prefab.id);
 assert.deepEqual(node.configuration.visual,prefab.visual);
 const loaded=new TreeDocument(placed.serialize());assert.deepEqual(loaded.world.get(node.id).configuration.visual,prefab.visual);
 const pasted=pasteTree(loaded,copyTree(loaded,[{r:1,c:1}]),2,2);
 assert.deepEqual(pasted.world.at(2,2).find(node=>node.prefabId===prefab.id).configuration.visual,prefab.visual);
 const invalid=placed.serialize();invalid.entities.find(item=>item.id===node.id).configuration.visual.model='../secret.fbx';assert.throws(()=>new TreeDocument(invalid));
});
