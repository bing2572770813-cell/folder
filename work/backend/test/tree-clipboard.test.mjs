import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const load=async file=>{const result=await build({entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));};
const {TreeDocument}=await load('../../entities/tree-document.mjs'),{copyTree,pasteTree}=await load('../../entities/tree-clipboard.mjs');
test('full tree clipboard preserves stacks, sparse children, independent IDs and destination regions',()=>{
 const tile={color:'white',regionTag:'source',tags:{spawn:true},instance:{id:'group',anchorR:1,anchorC:1,width:2,height:2}},map={version:1,width:6,height:6,spawn:{r:1,c:1,dir:0},tiles:Array.from({length:6},()=>Array(6).fill(null))};map.tiles[1][1]=tile;map.tiles[2][2]={...tile,tags:{}};
 const tree=new TreeDocument(map).serialize();tree.entities.push({...structuredClone(tree.entities[0]),id:'overlay',components:{key:{name:'铜'}},tags:{}});const doc=new TreeDocument(tree);doc.cellTags['3,3']={regionTag:'target'};assert.equal(copyTree(doc,[{r:1,c:1}]).entities.length,2);const clip=copyTree(doc,[{r:1,c:1},{r:2,c:2}]);assert.equal(clip.entities.length,3);
 const pasted=pasteTree(doc,clip,3,3);assert.equal(pasted.world.at(3,3).length,2);assert.equal(pasted.world.at(4,4).length,1);assert.equal(pasted.world.at(3,4).length,0);assert.equal(pasted.cellTags['3,3'].regionTag,'target');assert.equal(pasted.cellTags['4,4'].regionTag,'默认区域');assert.equal(pasted.view().tiles[3][3].tags?.spawn,undefined);
 const ids=new Set(doc.world.serialize().map(node=>node.id));for(const node of pasted.world.at(3,3))assert.ok(!ids.has(node.id));assert.equal(pasted.view().tiles[3][3].instance,undefined);
 assert.throws(()=>copyTree(doc,[{r:1,c:1},{r:2,c:2}],{isHidden:(r,c)=>r===2&&c===2}),/隐藏/);const before=doc.serialize();assert.throws(()=>pasteTree(doc,clip,5,5),/bounds/);assert.deepEqual(doc.serialize(),before);
});

test('surface-free scalar conflicts and hidden destinations reject paste atomically',()=>{
 const tree={version:2,width:6,height:6,entities:[{id:'a',prefabId:'tag',transformId:'ta',components:{tag:{}},static:{},tags:{exitTo:'A'}},{id:'b',prefabId:'tag',transformId:'tb',components:{tag:{}},static:{},tags:{exitTo:'B'}}],transforms:[{id:'ta',parentId:null,local:{r:1,c:1,dir:0},footprint:{width:1,height:1,occupied:[true]}},{id:'tb',parentId:null,local:{r:2,c:2,dir:0},footprint:{width:1,height:1,occupied:[true]}}],cellTags:{},legacyMetadata:{spawn:{r:0,c:0,dir:0}}};
 tree.entities.push({id:'ground',prefabId:'paper_ai',transformId:'ground-t',components:{surface:{}},static:{},tags:{spawn:true}});tree.transforms.push({id:'ground-t',parentId:null,local:{r:0,c:0,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 const doc=new TreeDocument(tree),clip=copyTree(doc,[{r:2,c:2}]),before=doc.serialize();assert.throws(()=>pasteTree(doc,clip,1,1),/Conflicting/);assert.deepEqual(doc.serialize(),before);assert.throws(()=>pasteTree(doc,clip,3,3,{isHidden:()=>true}),/隐藏/);
 doc.world.setRuntime('a','tag',{seen:true});doc.world.transforms.retain('ta','external');const pasted=pasteTree(doc,clip,3,3);assert.deepEqual(pasted.world.runtime('a','tag'),{seen:true});assert.ok(pasted.world.transforms.referenceOwners('ta').includes('external'));
 });
