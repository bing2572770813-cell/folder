import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {importTreeMap,serializeTreeMap} from '../dist/entities/tree-serialization.js';
import {loadTree} from '../dist/entities/legacy-map.js';

const bundled = await build({
  stdin: {contents: "export {TreeDocument} from './entities/tree-document.mjs';export {moveNode,reparentNode,deleteNode,configureNode,placeTreePrefab,replaceTreePrefab,renameTreeKeys} from './entities/tree-commands.mjs';export {copyTree,pasteTree} from './entities/tree-clipboard.mjs';", resolveDir:fileURLToPath(new URL('../../',import.meta.url))},
  bundle:true,platform:'node',format:'esm',write:false,
});
const {TreeDocument,moveNode,reparentNode,deleteNode,configureNode,placeTreePrefab,replaceTreePrefab,renameTreeKeys,copyTree,pasteTree} = await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const entity = (id, components) => ({id,prefabId:id,transformId:id,components,tags:{},static:{}});
function fixture() {
  return {version:2,width:6,height:6,
    entities:[entity('paper',{surface:{color:'white'}}),entity('fire',{fire:{damage:1}}),entity('other',{collision:{blocked:false}})],
    transforms:[['paper',null,1,1],['fire','paper',0,0],['other','paper',0,0]].map(([id,parentId,r,c])=>({id,parentId,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}})),
    cellTags:{},legacyMetadata:{spawn:{r:1,c:1,dir:0},exit:null}};
}
const error = /纸张方格上最多只能叠加一个 terrain 实体/;

test('replacing paper clears independent terrain but preserves keys and unrelated components',()=>{
 const input=fixture();input.transforms[1].parentId=null;input.transforms[1].local={r:1,c:1,dir:0};
 input.entities[2].components={key:{name:'铜'}};
 input.transforms[2].parentId=null;input.transforms[2].local={r:1,c:1,dir:0};
 input.entities[1].configuration={terrain:'fire',blocked:false};input.entities[1].components.collision={blocked:false};
 const doc=new TreeDocument(input),before=doc.serialize();
 const prefab={id:'paper_ai',size:{width:1,height:1},occupied:[true],tile:{color:'white'}};
 const plain=replaceTreePrefab(doc,prefab,{color:'white',prefabId:'paper_ai'},1,1);
 assert.equal(plain.world.at(1,1).some(node=>node.components.fire),false);
 assert.equal(plain.world.serialize().some(node=>node.id==='fire'),false);
 assert.equal(plain.world.at(1,1).some(node=>node.components.key),true);
 const cold=replaceTreePrefab(doc,{...prefab,id:'ice_ai'}, {color:'white',prefabId:'ice_ai',terrain:'ice'},1,1);
 assert.equal(cold.world.at(1,1).some(node=>node.components.fire),false);
 assert.equal(cold.world.at(1,1).some(node=>node.components.ice),true);
 assert.throws(()=>replaceTreePrefab(doc,prefab,prefab.tile,1,1,{nodeHidden:node=>node.id==='fire'}),/隐藏/);
 assert.deepEqual(doc.serialize(),before);
});

test('replacement removes terrain capabilities while keeping a mixed overlay and refuses partial terrain footprints',()=>{
 const input=fixture();input.transforms[1].parentId=null;input.transforms[1].local={r:1,c:1,dir:0};
 input.transforms[2].parentId=null;input.transforms[2].local={r:1,c:1,dir:0};
 input.entities[1].components.key={name:'银'};
 const prefab={id:'paper_ai',size:{width:1,height:1},occupied:[true],tile:{color:'white',prefabId:'paper_ai'}};
 const doc=new TreeDocument(input),plain=replaceTreePrefab(doc,prefab,prefab.tile,1,1);
 assert.deepEqual(plain.world.get('fire').components,{key:{name:'银'}});
 input.transforms[1].footprint={width:2,height:1,occupied:[true,true]};
 input.entities.push(entity('support',{surface:{}}));
 input.transforms.push({id:'support',parentId:null,local:{r:1,c:2,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 const multi=new TreeDocument(input),before=multi.serialize();
 assert.throws(()=>replaceTreePrefab(multi,prefab,prefab.tile,1,1),/不能部分替换多格地形/);
 assert.deepEqual(multi.serialize(),before);
});

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
  world.add({...entity('second',{ice:{}}),transformId:'other'});
  assert.throws(()=>serializeTreeMap(world),error);
});
test('different tiles on one multi-cell paper can each have terrain; sparse holes do not count',()=>{
  const input=fixture();input.transforms[0].footprint={width:3,height:1,occupied:[true,false,true]};
  input.entities[2].components={ice:{}};input.transforms[2].local.c=2;
  assert.doesNotThrow(()=>importTreeMap(input));
  input.transforms[1].local.c=1;input.transforms[2].local.c=1;
  assert.throws(()=>importTreeMap(input),/承载/);
  input.transforms[0].footprint.occupied[1]=true;assert.throws(()=>importTreeMap(input),error);
});
test('inline terrain consumes one slot; terrain types are exclusive and keys can coexist',()=>{
  const input=fixture();input.entities[0].components.fire={};assert.throws(()=>importTreeMap(input),error);
  input.entities[0].components={surface:{}};input.entities[1].components={fire:{},ice:{},key:{name:'铜'}};
  assert.throws(()=>importTreeMap(input),/多种地形/);
  input.entities[1].components={fire:{},key:{name:'铜'}};
  input.entities[2].components={key:{name:'银'}};
  assert.doesNotThrow(()=>importTreeMap(input));
});
test('moving terrain or paper into a conflicting stack is atomic; preserve-world reparent is valid',()=>{
  const input=fixture();input.entities[2].components={ice:{}};input.transforms[2].parentId=null;input.transforms[2].local={r:0,c:0,dir:0};
  input.entities.push(entity('support',{surface:{}}));input.transforms.push({...structuredClone(input.transforms[2]),id:'support'});
  const doc=new TreeDocument(input),before=doc.serialize();
  const attached=reparentNode(doc,'other','paper',true);
  assert.deepEqual(attached.world.transforms.world('other'),doc.world.transforms.world('other'));
  assert.throws(()=>reparentNode(doc,'other','paper',false),error);
  assert.throws(()=>moveNode(doc,'other',{r:1,c:1,dir:0}),error);assert.deepEqual(doc.serialize(),before);
  assert.throws(()=>moveNode(doc,'paper',{r:0,c:0,dir:0}),/多个纸张/);assert.deepEqual(doc.serialize(),before);
});
test('component edits, stacked placement, prefab children and clipboard reject conflicts atomically',()=>{
  const doc=new TreeDocument(fixture()),before=doc.serialize();
  assert.throws(()=>configureNode(doc,'other',{ice:{}},{}),error);
  assert.throws(()=>placeTreePrefab(doc,{id:'cold',components:{ice:{}}},{},1,1,{stack:true}),error);
  const prefab={id:'custom-paper',components:{surface:{color:'white'}},children:[{id:'hot',components:{fire:{}}},{id:'cold',components:{ice:{}}}]};
  assert.throws(()=>placeTreePrefab(doc,prefab,{},3,3,{stack:true}),error);
  const clipboard=copyTree(doc,[{r:1,c:1}]);assert.throws(()=>pasteTree(doc,clipboard,1,1),/多个纸张/);
  clipboard.entities.find(node=>node.id==='other').components={ice:{}};
  assert.throws(()=>pasteTree(doc,clipboard,3,3),error);assert.deepEqual(doc.serialize(),before);
});
test('terrain cannot exist without paper even if hidden or render-disabled',()=>{
  for(const staticData of [{},{transparent:true},{render:false}]){
    const input=fixture();input.entities[0].components={tag:{}};input.entities[1].static=staticData;
    assert.throws(()=>importTreeMap(input),/承载/);
  }
});
test('removing, moving or deconfiguring paper cannot leave independent terrain unsupported',()=>{
  const input=fixture();input.transforms[1].parentId=null;input.transforms[1].local={r:1,c:1,dir:0};
  input.transforms[2].parentId=null;input.transforms[2].local={r:1,c:1,dir:0};
  const doc=new TreeDocument(input),before=doc.serialize();
  assert.throws(()=>deleteNode(doc,'paper'),/承载/);
  assert.throws(()=>moveNode(doc,'paper',{r:3,c:3,dir:0}),/承载/);
  assert.throws(()=>configureNode(doc,'paper',{tag:{}},{}),/承载/);
  assert.deepEqual(doc.serialize(),before);
});
test('duplicate paper is forbidden even when transparent or sharing the same Transform',()=>{
  for(const staticData of [{},{transparent:true},{render:false}]){
    const input=fixture();input.entities.push({...entity('duplicate',{surface:{}}),transformId:'paper',static:staticData});
    assert.throws(()=>importTreeMap(input),/多个纸张/);
  }
});
test('legacy key and terrain prefabs reuse paper when stacked, but paper prefabs cannot stack',()=>{
  const input=fixture();input.entities[1].components={tag:{}};
  const doc=new TreeDocument(input),before=doc.serialize();
  const fire=placeTreePrefab(doc,{id:'fire_ai',tile:{color:'red',terrain:'fire'}},{},1,1,{stack:true});
  const withKey=placeTreePrefab(fire,{id:'key_ai',tile:{color:'yellow',terrain:'key',keyName:'铜'}},{},1,1,{stack:true});
  assert.equal(withKey.world.at(1,1).filter(node=>node.components.surface).length,1);
  assert.equal(withKey.world.at(1,1).filter(node=>node.components.fire).length,1);
  assert.equal(withKey.world.at(1,1).find(node=>node.prefabId==='key_ai').components.key.name,'铜');
  assert.throws(()=>placeTreePrefab(doc,{id:'paper_ai',tile:{color:'white'}},{},1,1,{stack:true}),/多个纸张/);
  assert.deepEqual(doc.serialize(),before);
});

test('lift belongs to its single paper and removal stays removed across import',()=>{
 const input=fixture(),lift={minHeight:.09,maxHeight:1,initialHeight:.4,turnsPerLeg:3};
 input.entities[0].components.lift=lift;input.entities[0].configuration={lift};
 const doc=new TreeDocument(input),before=doc.serialize();
 const removed=configureNode(doc,'paper',{surface:{color:'white'}},{});
 assert.equal(removed.world.get('paper').components.lift,undefined);
 assert.equal(removed.world.get('paper').configuration.lift,undefined);
 assert.equal(new TreeDocument(removed.serialize()).world.get('paper').components.lift,undefined);
 assert.deepEqual(doc.serialize(),before);
 const updated=configureNode(doc,'paper',{surface:{color:'white'},lift:{...lift,initialHeight:.7}},{});
 assert.equal(updated.world.get('paper').configuration.lift.initialHeight,.7);
 input.entities[2].components={lift};assert.throws(()=>importTreeMap(input),/升降.*纸张/);
 delete input.entities[0].components.lift;assert.throws(()=>importTreeMap(input),/升降.*纸张/);
});

test('rename stacked keys and exit references atomically, preserving remaining names and permissions',()=>{
 const input=fixture();input.entities[1].components={key:{name:'铜'}};input.entities[2].components={key:{name:'铁'}};
 input.entities[0].tags={requiredKeys:['铜','铁'],exitTo:'B'};
 const doc=new TreeDocument(input),before=doc.serialize();
 const renamed=renameTreeKeys(doc,[{r:1,c:1}],'银');
 assert.equal(renamed.world.get('fire').components.key.name,'银');assert.equal(renamed.world.get('other').components.key.name,'银');
 assert.deepEqual(renamed.world.get('paper').tags.requiredKeys,['银']);assert.deepEqual(doc.serialize(),before);
 assert.throws(()=>renameTreeKeys(doc,[{r:1,c:1}],'银',{nodeHidden:n=>n.id==='other'}),/隐藏/);
 assert.throws(()=>renameTreeKeys(doc,[{r:1,c:1}],'银',{schemaFor:()=>({components:{children:{key:{children:{name:{tempEditable:false}}}}}})}),/只读|修改|编辑/);
 assert.throws(()=>renameTreeKeys(doc,[{r:1,c:1}],'银',{schemaFor:n=>n.id==='paper'?{tags:{children:{requiredKeys:{tempEditable:false}}}}:{}}),/只读|修改|编辑/);
 input.entities.push({...entity('remaining',{key:{name:'铜'}}),transformId:'other-paper'});
 input.entities.push(entity('other-paper',{surface:{}}));input.transforms.push({id:'other-paper',parentId:null,local:{r:2,c:2,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 const remaining=renameTreeKeys(new TreeDocument(input),[{r:1,c:1}],'银');assert.deepEqual(remaining.world.get('paper').tags.requiredKeys,['铜','银']);
 assert.deepEqual(doc.serialize(),before);
});
