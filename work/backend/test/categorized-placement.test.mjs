import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundled=await build({stdin:{contents:"export {TreeDocument} from './entities/tree-document.mjs';export {placeCategorizedPrefab} from './entities/tree-commands.mjs';",resolveDir:fileURLToPath(new URL('../../',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const prefab=(id,type,tile,BaseEntity)=>({id,name:id,version:1,size:{width:1,height:1},occupied:[true],static:{entityType:type},tile,BaseEntity});
const paper=prefab('paper_ai','terrain',{color:'white',height:.09},['void_ai']);
const fire=prefab('fire_ai','terrain',{color:'red',height:.09,terrain:'fire',blocked:false},['paper_ai']);
const ice=prefab('ice_ai','terrain',{color:'blue',height:.09,terrain:'ice',blocked:false},['paper_ai']);
const key=prefab('key_ai','item',{color:'green',height:.09,terrain:'key',keyName:'铜'},['paper_ai','fire_ai','ice_ai','key_ai']);
const token=prefab('player_token_ai','item',{kind:'player-token',color:'white',height:.09,blocked:true},['paper_ai','fire_ai','ice_ai','key_ai']);
function fixture(){return new TreeDocument({version:1,width:4,height:4,tiles:Array.from({length:4},()=>Array(4).fill(null)),spawn:{r:0,c:0,dir:0},exit:null,foldCells:[]});}
const put=(doc,p,r=1,c=1,options={})=>placeCategorizedPrefab(doc,p,{...p.tile,prefabId:p.id},r,c,options);
test('terrain consumes paper, clears items, rejects other terrains as bases and preserves cell metadata',()=>{
 let doc=put(fixture(),paper);doc.cellTags['1,1']={regionTag:'A'};
 doc=put(doc,key);assert.equal(doc.world.at(1,1).length,2);assert.equal(doc.world.at(1,1).find(n=>n.prefabId==='key_ai').components.surface,undefined);
 const before=doc.serialize();const hot=put(doc,fire);
 assert.deepEqual(hot.world.at(1,1).map(n=>n.prefabId),['fire_ai']);assert.equal(hot.view().tiles[1][1].terrain,'fire');assert.equal(hot.cellTags['1,1'].regionTag,'A');
 assert.throws(()=>put(hot,ice),/基底/);assert.deepEqual(doc.serialize(),before);
 assert.doesNotThrow(()=>put(put(hot,paper),ice));assert.throws(()=>put(fixture(),fire),/基底/);
 assert.equal(new TreeDocument(hot.serialize()).world.at(1,1).length,1);
});
test('items share support and never fabricate terrain; void and creatures are rejected',()=>{
 let doc=put(fixture(),paper);doc=put(doc,key);doc=put(doc,token);
 assert.equal(doc.world.at(1,1).filter(n=>n.components.surface).length,1);assert.equal(doc.world.at(1,1).length,3);
 assert.throws(()=>put(fixture(),key),/虚空/);assert.throws(()=>put(fixture(),token),/虚空/);
 assert.throws(()=>put(doc,{...token,id:'player_ai',static:{entityType:'creature',placeable:false}}),/生物/);
 const reset=put(doc,paper);assert.deepEqual(reset.world.at(1,1).map(n=>n.prefabId),['paper_ai']);
});
test('hidden support or items reject replacement atomically; multi-cell item overwrite stays forbidden',()=>{
 const doc=put(put(fixture(),paper),key),before=doc.serialize();
 assert.throws(()=>put(doc,fire,1,1,{nodeHidden:n=>n.prefabId==='key_ai'}),/隐藏/);assert.throws(()=>put(doc,fire,1,1,{isHidden:()=>true}),/隐藏/);assert.deepEqual(doc.serialize(),before);
 let row=put(put(fixture(),paper),paper,1,2);
 const wide={...key,tile:undefined,components:{key:{name:'大钥匙'}},size:{width:2,height:1},occupied:[true,true]};
 row=placeCategorizedPrefab(row,wide,{},1,1);assert.throws(()=>put(row,paper),/多方块/);
});
test('typed terrain cannot be stacked by imported native documents',()=>{
 const doc=put(fixture(),paper),snapshot=doc.serialize(),node=structuredClone(snapshot.entities[0]);
 node.id='duplicate';node.prefabId='fire_ai';node.components.fire={};snapshot.entities.push(node);
 assert.throws(()=>new TreeDocument(snapshot),/互斥/);
});
