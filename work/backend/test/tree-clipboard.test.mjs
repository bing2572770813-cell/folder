import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const load=async file=>{const result=await build({entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));};
const {TreeDocument}=await load('../../entities/tree-document.mjs'),{copyTree,pasteTree}=await load('../../entities/tree-clipboard.mjs');
test('full tree clipboard preserves stacks, sparse children, independent IDs and destination regions',()=>{
 const tile={color:'white',regionTag:'source',tags:{spawn:true},instance:{id:'group',anchorR:1,anchorC:1,width:2,height:2}},map={version:1,width:6,height:6,spawn:{r:1,c:1,dir:0},tiles:Array.from({length:6},()=>Array(6).fill(null))};map.tiles[1][1]=tile;map.tiles[2][2]={...tile,tags:{}};
 const tree=new TreeDocument(map).serialize();tree.entities.push({...structuredClone(tree.entities[0]),id:'overlay',components:{key:{name:'铜'}},tags:{}});const doc=new TreeDocument(tree);doc.cellTags['3,3']={regionTag:'target'};const clip=copyTree(doc,[{r:1,c:1}]);assert.equal(clip.entities.length,3);
 const pasted=pasteTree(doc,clip,3,3);assert.equal(pasted.world.at(3,3).length,2);assert.equal(pasted.world.at(4,4).length,1);assert.equal(pasted.world.at(3,4).length,0);assert.equal(pasted.cellTags['3,3'].regionTag,'target');assert.equal(pasted.cellTags['4,4'].regionTag,'默认区域');assert.equal(pasted.view().tiles[3][3].tags?.spawn,undefined);
 const ids=new Set(doc.world.serialize().map(node=>node.id));for(const node of pasted.world.at(3,3))assert.ok(!ids.has(node.id));assert.notEqual(pasted.view().tiles[3][3].instance.id,'group');
 assert.throws(()=>copyTree(doc,[{r:1,c:1}],{isHidden:(r,c)=>r===2&&c===2}),/隐藏/);const before=doc.serialize();assert.throws(()=>pasteTree(doc,clip,5,5),/bounds/);assert.deepEqual(doc.serialize(),before);
});
