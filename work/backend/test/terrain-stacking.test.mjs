import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {importTreeMap,serializeTreeMap} from '../dist/entities/tree-serialization.js';
import {loadTree} from '../dist/entities/legacy-map.js';

const bundled = await build({
  stdin: {contents: "export {TreeDocument} from './entities/tree-document.mjs';export {moveNode,reparentNode,configureNode,placeTreePrefab} from './entities/tree-commands.mjs';export {copyTree,pasteTree} from './entities/tree-clipboard.mjs';", resolveDir:fileURLToPath(new URL('../../',import.meta.url))},
  bundle:true,platform:'node',format:'esm',write:false,
});
const {TreeDocument,moveNode,reparentNode,configureNode,placeTreePrefab,copyTree,pasteTree} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const entity = (id, components) => ({id,prefabId:id,transformId:id,components,tags:{},static:{}});
function fixture() {
  return {version:2,width:6,height:6,
    entities:[entity('paper',{surface:{color:'white'}}),entity('fire',{fire:{damage:1}}),entity('other',{collision:{blocked:false}})],
    transforms:[['paper',null,1,1],['fire','paper',0,0],['other','paper',0,0]].map(([id,parentId,r,c])=>({id,parentId,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}})),
    cellTags:{},legacyMetadata:{spawn:{r:1,c:1,dir:0},exit:null}};
}
const error = /纸张方格上最多只能叠加一个 terrain 实体/;

test('paper tiles allow zero or one terrain entity and ordinary overlays',()=>{
  const input=fixture();assert.doesNotThrow(()=>importTreeMap(input));
  input.entities[1].components={tag:{}};assert.doesNotThrow(()=>importTreeMap(input));
});
test('same-cell terrain is rejected regardless of roots, descendants or shared transforms',()=>{
  for(const relation of ['siblings','roots','nested','shared']){
    const input=fixture();input.entities[2].components={ice:{}};
    if(relation==='roots'){input.transforms[2].parentId=null;input.transforms[2].local={r:1,c:1,dir:0};}
    if(relation==='nested')input.transforms[2].parentId='fire';
    if(relation==='shared')input.entities[2].transformId='fire';
    const before=structuredClone(input);assert.throws(()=>importTreeMap(input),error);assert.throws(()=>loadTree(input),error);assert.deepEqual(input,before);
  }
  const world=importTreeMap(fixture()).world;
  world.add({...entity('second',{key:{name:'铜'}}),transformId:'other'});
  assert.throws(()=>serializeTreeMap(world),error);
});
test('different tiles on one multi-cell paper can each have terrain; sparse holes do not count',()=>{
  const input=fixture();input.transforms[0].footprint={width:3,height:1,occupied:[true,false,true]};
  input.entities[2].components={ice:{}};input.transforms[2].local.c=2;
  assert.doesNotThrow(()=>importTreeMap(input));
  input.transforms[1].local.c=1;input.transforms[2].local.c=1;
  assert.doesNotThrow(()=>importTreeMap(input));
  input.transforms[0].footprint.occupied[1]=true;assert.throws(()=>importTreeMap(input),error);
});
test('inline terrain consumes one slot; multiple components on one entity count once',()=>{
  const input=fixture();input.entities[0].components.fire={};assert.throws(()=>importTreeMap(input),error);
  input.entities[0].components={surface:{}};input.entities[1].components={fire:{},ice:{},key:{name:'铜'}};
  assert.doesNotThrow(()=>importTreeMap(input));
});
test('moving terrain or paper into a conflicting stack is atomic; preserve-world reparent is valid',()=>{
  const input=fixture();input.entities[2].components={key:{name:'铜'}};input.transforms[2].parentId=null;input.transforms[2].local={r:0,c:0,dir:0};
  const doc=new TreeDocument(input),before=doc.serialize();
  const attached=reparentNode(doc,'other','paper',true);
  assert.deepEqual(attached.world.transforms.world('other'),doc.world.transforms.world('other'));
  assert.throws(()=>reparentNode(doc,'other','paper',false),error);
  assert.throws(()=>moveNode(doc,'other',{r:1,c:1,dir:0}),error);assert.deepEqual(doc.serialize(),before);
  input.transforms[1].parentId=null;input.transforms[1].local={r:2,c:2,dir:0};input.transforms[2].local={r:2,c:2,dir:0};
  const floating=new TreeDocument(input),snapshot=floating.serialize();
  assert.throws(()=>moveNode(floating,'paper',{r:2,c:2,dir:0}),error);assert.deepEqual(floating.serialize(),snapshot);
});
test('component edits, stacked placement, prefab children and clipboard reject conflicts atomically',()=>{
  const doc=new TreeDocument(fixture()),before=doc.serialize();
  assert.throws(()=>configureNode(doc,'other',{ice:{}},{}),error);
  assert.throws(()=>placeTreePrefab(doc,{id:'cold',components:{ice:{}}},{},1,1,{stack:true}),error);
  const prefab={id:'custom-paper',components:{surface:{color:'white'}},children:[{id:'hot',components:{fire:{}}},{id:'cold',components:{ice:{}}}]};
  assert.throws(()=>placeTreePrefab(doc,prefab,{},3,3,{stack:true}),error);
  const clipboard=copyTree(doc,[{r:1,c:1}]);assert.throws(()=>pasteTree(doc,clipboard,1,1),error);
  clipboard.entities.find(node=>node.id==='other').components={ice:{}};
  assert.throws(()=>pasteTree(doc,clipboard,3,3),error);assert.deepEqual(doc.serialize(),before);
});
test('adding a paper surface under two floating terrains is rejected atomically',()=>{
  const input=fixture();input.entities[0].components={tag:{}};input.entities[2].components={ice:{}};
  const doc=new TreeDocument(input),before=doc.serialize();
  assert.throws(()=>configureNode(doc,'paper',{surface:{color:'white'}},{}),error);
  assert.deepEqual(doc.serialize(),before);
});
