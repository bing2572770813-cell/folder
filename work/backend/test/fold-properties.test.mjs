import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const output=await build({stdin:{contents:"export {TreeDocument} from './entities/tree-document.mjs';export {configureNode} from './entities/tree-commands.mjs';",resolveDir:fileURLToPath(new URL('../../',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,configureNode}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
import {nodePermissions} from '../../entities/node-permissions.mjs';
import {nodeFollowsFold,nodeCanDropOnFold,followsFold} from '../../entities/fold-properties.mjs';
import {normalizeTile} from '../../entities/tile-model.mjs';

const legacy=()=>({version:1,width:3,height:3,tiles:Array.from({length:3},(_,r)=>Array.from({length:3},(_,c)=>r===0&&c===0?{prefabId:'paper_ai',height:.2,followFold:false}:null)),spawn:{r:0,c:0,dir:0},exit:null});
test('followFold survives legacy import, canonical edits and version:2 roundtrip',()=>{
 const document=new TreeDocument(legacy()),node=document.primaryAt(0,0);
 assert.equal(nodeFollowsFold(node),false);assert.equal(document.view().tiles[0][0].followFold,false);
 const next=configureNode(document,node.id,{...node.components,physics:{followFold:true}},node.tags);
 const restored=new TreeDocument(next.serialize());
 assert.equal(restored.primaryAt(0,0).components.physics.followFold,true);assert.equal(restored.view().tiles[0][0].followFold,true);
 assert.equal(document.view().tiles[0][0].followFold,false,'edits do not mutate the original');
 const changed=restored.view();changed.tiles[0][0].followFold=false;restored.applyLegacy(changed);
 assert.equal(restored.primaryAt(0,0).components.physics.followFold,false);
});
test('only paper defaults to following folds; explicit flags apply to each entity',()=>{
 assert.equal(followsFold({prefabId:'paper_ai'}),true);
 for(const tile of [{prefabId:'block_ai'},{prefabId:'paper_ai',lift:{}},{prefabId:'paper_ai',terrain:'key'},{kind:'player-token'}])assert.equal(followsFold(tile),false);
 assert.equal(nodeFollowsFold({prefabId:'key_ai',components:{key:{}}}),false);
 assert.equal(nodeFollowsFold({prefabId:'key_ai',components:{key:{},physics:{followFold:true}}}),true);
});
test('invalid fold flags and readonly physics edits are rejected atomically',()=>{
 assert.throws(()=>normalizeTile({followFold:'false'}),/布尔/);
 const document=new TreeDocument(legacy()),node=document.primaryAt(0,0),before=document.serialize();
 assert.throws(()=>configureNode(document,node.id,{...node.components,physics:{followFold:1}},node.tags),/followFold/);
 const schema=nodePermissions(node,{followFold:{tempEditable:false}});
 assert.throws(()=>configureNode(document,node.id,{...node.components,physics:{followFold:true}},node.tags,undefined,undefined,schema),/只读|不可编辑|read.?only/i);
 assert.deepEqual(document.serialize(),before);
 const native=structuredClone(before);native.entities[0].components.physics.followFold='false';
 assert.throws(()=>new TreeDocument(native),/followFold/);
});

test('item and creature fold-drop defaults and explicit opt-outs survive map roundtrip',()=>{
 assert.equal(nodeCanDropOnFold({prefabId:'key_ai',components:{key:{}}}),true);
 assert.equal(nodeCanDropOnFold({prefabId:'player_token_ai',components:{}}),true);
 assert.equal(nodeCanDropOnFold({prefabId:'player_ai',components:{}}),true);
 assert.equal(nodeCanDropOnFold({prefabId:'paper_ai',components:{surface:{}}}),false);
 assert.equal(nodeCanDropOnFold({prefabId:'key_ai',components:{key:{},physics:{canDropOnFold:false}}}),false);
 const source=legacy();source.tiles[0][0]={prefabId:'key_ai',terrain:'key',keyName:'铜',canDropOnFold:false};
 const document=new TreeDocument(source),node=document.primaryAt(0,0);
 assert.equal(node.components.physics.canDropOnFold,false);
 assert.equal(document.view().tiles[0][0].canDropOnFold,false);
 assert.equal(new TreeDocument(document.serialize()).primaryAt(0,0).components.physics.canDropOnFold,false);
 assert.throws(()=>normalizeTile({canDropOnFold:'false'}),/布尔/);
 const invalid=structuredClone(document.serialize());invalid.entities[0].components.physics.canDropOnFold='false';
 assert.throws(()=>new TreeDocument(invalid),/canDropOnFold/);
});
