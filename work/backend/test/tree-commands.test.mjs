import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=async file=>{const result=await build({entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));};
const {TreeDocument}=await bundle('../../entities/tree-document.mjs');
const {moveNode,reparentNode,deleteNode,placeTreePrefab}=await bundle('../../entities/tree-commands.mjs');
const document=()=>new TreeDocument({version:1,width:6,height:6,spawn:{r:1,c:1,dir:0},tiles:Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>r===1&&c===1?{color:'white',regionTag:'A'}:null))});
const prefab={id:'hot',tile:{color:'red'},components:{fire:{damage:2}},static:{walkable:true}};
test('stacking preserves surface and snapshots inherited mixed component configuration',()=>{
  const doc=document(),original=doc.serialize();doc.world.setRuntime(original.entities[0].id,'surface',{visited:true});doc.world.transforms.retain(original.transforms[0].id,'player');
  const placed=placeTreePrefab(doc,{id:'mixed',extends:'base',components:{fire:{damage:3},ice:{}}},{color:'blue'},1,1,{stack:true,resolve:()=>prefab});
  assert.equal(placed.world.at(1,1).length,2);assert.deepEqual(doc.serialize(),original);
  const mixed=placed.world.at(1,1).find(n=>n.prefabId==='mixed');assert.equal(mixed.components.surface.color,'blue');assert.equal(mixed.components.fire.damage,3);assert.ok(mixed.components.ice);assert.equal(mixed.static.walkable,true);assert.equal(placed.cellTags['1,1'].regionTag,'A');
  assert.deepEqual(placed.world.runtime(original.entities[0].id,'surface'),{visited:true});assert.ok(placed.world.transforms.referenceOwners(original.transforms[0].id).includes('player'));
});
test('sparse prefab children move with their root; reparent preserves world coordinates',()=>{
  const doc=placeTreePrefab(document(),{...prefab,size:{width:2,height:2},occupied:[true,false,false,true],children:[{prefabId:'leaf',local:{r:0,c:1,dir:0}}]}, {},2,2,{stack:true,resolve:()=>({id:'leaf',tile:{color:'yellow'},components:{key:{name:'钥匙'}}})});
  const root=doc.world.at(2,2).find(n=>n.prefabId==='hot'),child=doc.world.at(2,3).find(n=>n.prefabId==='leaf');assert.equal(doc.world.at(3,2).length,0);assert.equal(doc.world.at(3,3).length,1);
  const moved=moveNode(doc,root.id,{r:3,c:2,dir:0});assert.equal(moved.world.at(3,3)[0].id,child.id);assert.equal(doc.world.at(2,3)[0].id,child.id);
  const detached=reparentNode(moved,child.id,null,true);assert.deepEqual(detached.world.transforms.world(child.transformId),moved.world.transforms.world(child.transformId));assert.equal(detached.world.transforms.get(child.transformId).parentId,null);
  assert.throws(()=>deleteNode(doc,root.id),/children/);
});
test('hidden cells and protected references reject operations atomically',()=>{
  const doc=placeTreePrefab(document(),prefab,{},2,2,{stack:true}),node=doc.world.at(2,2)[0],before=doc.serialize();
  assert.throws(()=>moveNode(doc,node.id,{r:3,c:3,dir:0},(r,c)=>r===3&&c===3),/隐藏/);assert.deepEqual(doc.serialize(),before);
  assert.throws(()=>deleteNode(doc,node.id,()=>false,()=>true),/隐藏/);
  doc.world.transforms.retain(node.transformId,'external');assert.throws(()=>deleteNode(doc,node.id),/references/);
  doc.world.transforms.release(node.transformId,'external');const erased=deleteNode(doc,node.id);assert.equal(erased.world.at(2,2).length,0);assert.equal(erased.cellTags['2,2'].regionTag,'默认区域');
  assert.throws(()=>placeTreePrefab(doc,{...prefab,components:{unregistered:{}}},{},3,3,{stack:true}),/Unregistered/);
  assert.throws(()=>placeTreePrefab(doc,{...prefab,BaseEntity:['paper_ai']},{},3,3,{stack:true}),/不允许/);
  assert.throws(()=>placeTreePrefab(doc,prefab,{},3,3),/显式/);
  assert.throws(()=>placeTreePrefab(doc,{...prefab,behavior:{scriptId:'arbitrary-code'}},{},3,3,{stack:true}),/未注册/);
});
