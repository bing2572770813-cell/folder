import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const load=async file=>{const result=await build({entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));};
const {TreeDocument}=await load('../../entities/tree-document.mjs');
const {configureNode,placeTreePrefab}=await load('../../entities/tree-commands.mjs');
const {copyTree,pasteTree}=await load('../../entities/tree-clipboard.mjs');
const tree=tags=>({version:2,width:5,height:5,entities:[{id:'overlay',prefabId:'tag',transformId:'t',components:{tag:{}},static:{},tags}],transforms:[{id:'t',parentId:null,local:{r:1,c:1,dir:0},footprint:{width:1,height:1,occupied:[true]}}],cellTags:{},legacyMetadata:{spawn:{r:0,c:0,dir:0}}});
const invalid=[{requiredKeys:7},{requiredKeys:['']},{requiredKeys:[3]},{requiredKeys:['x'.repeat(81)]},{spawn:'true'},{entry:1},{exitTo:false},{exitTo:' '},{exitTo:'x'.repeat(81)},{regionTag:'A'}];
for(const tags of invalid){
  const label=JSON.stringify(tags);
  test('surface-free import rejects invalid tags '+label,()=>assert.throws(()=>new TreeDocument(tree(tags))));
  for(const operation of ['configure','place','paste'])test('surface-free '+operation+' rejects invalid tags atomically '+label,()=>{
    const doc=new TreeDocument(tree({})),before=doc.serialize();
    if(operation==='configure')assert.throws(()=>configureNode(doc,'overlay',{tag:{}},tags));
    if(operation==='place')assert.throws(()=>placeTreePrefab(doc,{id:'tag',components:{tag:{}},tags},{},2,2,{stack:true}));
    if(operation==='paste'){
      const clipboard=copyTree(doc,[{r:1,c:1}]);clipboard.entities[0].tags=tags;
      assert.throws(()=>pasteTree(doc,clipboard,2,2));
    }
    assert.deepEqual(doc.serialize(),before);
  });
}
test('valid surface-free tags survive serialization, edits, placement and paste',()=>{
  const tags={spawn:false,entry:false,exitTo:'A',requiredKeys:[],custom:{enabled:true}};
  const doc=new TreeDocument(tree(tags));assert.deepEqual(new TreeDocument(doc.serialize()).world.get('overlay').tags,tags);
  const edited=configureNode(doc,'overlay',{tag:{}},{...tags,requiredKeys:['铜']});
  const placed=placeTreePrefab(edited,{id:'tag',components:{tag:{}},tags},{},2,2,{stack:true});
  const pasted=pasteTree(placed,copyTree(placed,[{r:2,c:2}]),3,3);
  assert.deepEqual(pasted.world.at(3,3)[0].tags,{exitTo:'A',requiredKeys:[],custom:{enabled:true}});
});
