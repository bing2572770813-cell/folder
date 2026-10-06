import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {importTreeMap,serializeTreeMap} from '../dist/entities/tree-serialization.js';
import {canAttachTerrain} from '../dist/entities/terrain-children.js';
import {loadTree} from '../dist/entities/legacy-map.js';

const bundled = await build({
  stdin: {contents: "export {TreeDocument} from './entities/tree-document.mjs';export {reparentNode,configureNode,placeTreePrefab} from './entities/tree-commands.mjs';export {copyTree,pasteTree} from './entities/tree-clipboard.mjs';", resolveDir:fileURLToPath(new URL('../../',import.meta.url))},
  bundle:true,platform:'node',format:'esm',write:false,
});
const {TreeDocument,reparentNode,configureNode,placeTreePrefab,copyTree,pasteTree} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const entity = (id, components) => ({id,prefabId:id,transformId:id,components,tags:{},static:{}});
function fixture() {
  return {version:2,width:6,height:6,
    entities:[entity('paper',{surface:{color:'white'}}),entity('fire',{fire:{damage:1}}),entity('other',{collision:{blocked:false}})],
    transforms:[['paper',null,1,1],['fire','paper',0,0],['other','paper',0,0]].map(([id,parentId,r,c])=>({id,parentId,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}})),
    cellTags:{},legacyMetadata:{spawn:{r:1,c:1,dir:0},exit:null}};
}
const error = /最多只能有一个 terrain 子实体/;

test('paper allows zero or one direct terrain child and ordinary children',()=>{
  const input=fixture();assert.doesNotThrow(()=>importTreeMap(input));
  input.entities[1].components={tag:{}};assert.doesNotThrow(()=>importTreeMap(input));
});
test('import and export reject two terrain children, even on different cells or a shared child transform',()=>{
  for(const shared of [false,true]){
    const input=fixture();input.entities[2].components={ice:{}};
    if(shared)input.entities[2].transformId='fire';else input.transforms[2].local.c=1;
    const before=structuredClone(input);assert.throws(()=>importTreeMap(input),error);assert.throws(()=>loadTree(input),error);assert.deepEqual(input,before);
  }
  const world=importTreeMap(fixture()).world;
  world.add({...entity('second',{key:{name:'铜'}}),transformId:'other'});
  assert.throws(()=>serializeTreeMap(world),error);
});
test('terrain count uses direct hierarchy rather than same-cell overlap or descendants',()=>{
  const input=fixture();input.entities[2].components={ice:{}};input.transforms[2].parentId=null;input.transforms[2].local={r:1,c:1,dir:0};
  assert.doesNotThrow(()=>importTreeMap(input));
  input.transforms[2].parentId='fire';input.transforms[2].local={r:0,c:0,dir:0};assert.doesNotThrow(()=>importTreeMap(input));
});
test('reparent and component edits reject a second terrain atomically',()=>{
  const input=fixture();input.entities[2].components={key:{name:'铜'}};input.transforms[2].parentId=null;input.transforms[2].local={r:1,c:2,dir:0};
  const doc=new TreeDocument(input),before=doc.serialize();
  assert.equal(canAttachTerrain(doc.world,'other','paper'),false);
  assert.equal(canAttachTerrain(doc.world,'fire','paper'),true);
  assert.throws(()=>reparentNode(doc,'other','paper',true),error);assert.deepEqual(doc.serialize(),before);
  const ordinary=new TreeDocument(fixture()),snapshot=ordinary.serialize();
  assert.throws(()=>configureNode(ordinary,'other',{ice:{}},{}),error);assert.deepEqual(ordinary.serialize(),snapshot);
});
test('prefab children and tampered clipboard cannot bypass the terrain limit',()=>{
  const doc=new TreeDocument(fixture()),before=doc.serialize();
  const prefab={id:'custom-paper',components:{surface:{color:'white'}},children:[{id:'hot',components:{fire:{}}},{id:'cold',components:{ice:{}}}]};
  assert.throws(()=>placeTreePrefab(doc,prefab,{},3,3,{stack:true}),error);assert.deepEqual(doc.serialize(),before);
  const clipboard=copyTree(doc,[{r:1,c:1}]);clipboard.entities.find(node=>node.id==='other').components={ice:{}};
  assert.throws(()=>pasteTree(doc,clipboard,3,3),error);assert.deepEqual(doc.serialize(),before);
});
test('turning an ordinary parent with two terrain children into paper is rejected atomically',()=>{
  const input=fixture();input.entities[0].components={tag:{}};input.entities[2].components={ice:{}};
  const doc=new TreeDocument(input),before=doc.serialize();
  assert.throws(()=>configureNode(doc,'paper',{surface:{color:'white'}},{}),error);
  assert.deepEqual(doc.serialize(),before);
});
