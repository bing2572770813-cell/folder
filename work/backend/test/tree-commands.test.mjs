import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundle=async file=>{const result=await build({entryPoints:[fileURLToPath(new URL(file,import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));};
const {TreeDocument}=await bundle('../../entities/tree-document.mjs');
const {moveNode,reparentNode,deleteNode,placeTreePrefab,configureNode}=await bundle('../../entities/tree-commands.mjs');
const document=()=>new TreeDocument({version:1,width:6,height:6,spawn:{r:1,c:1,dir:0},tiles:Array.from({length:6},(_,r)=>Array.from({length:6},(_,c)=>r===1&&c===1?{color:'white',regionTag:'A'}:null))});
const prefab={id:'hot',tile:{color:'red'},components:{fire:{damage:2}},static:{walkable:true}};
test('placement preserves existing surface and snapshots inherited terrain and collection configuration',()=>{
  const doc=document(),original=doc.serialize();doc.world.setRuntime(original.entities[0].id,'surface',{visited:true});doc.world.transforms.retain(original.transforms[0].id,'player');
  const placed=placeTreePrefab(doc,{id:'mixed',extends:'base',components:{fire:{damage:3},key:{name:'铜'}}},{color:'blue'},2,2,{stack:true,resolve:()=>prefab});
  assert.equal(placed.world.at(1,1).length,1);assert.deepEqual(doc.serialize(),original);
  const mixed=placed.world.at(2,2).find(n=>n.prefabId==='mixed');assert.equal(mixed.components.surface.color,'blue');assert.equal(mixed.components.fire.damage,3);assert.equal(mixed.components.key.name,'铜');assert.equal(mixed.static.walkable,true);assert.equal(placed.cellTags['1,1'].regionTag,'A');
  assert.deepEqual(placed.world.runtime(original.entities[0].id,'surface'),{visited:true});assert.ok(placed.world.transforms.referenceOwners(original.transforms[0].id).includes('player'));
});
test('native overlay has no ground and unique tags reject atomically',()=>{
 const source=document().serialize();source.entities[0].tags={spawn:true};const doc=new TreeDocument(source),before=doc.serialize();assert.throws(()=>placeTreePrefab(doc,{id:'start',components:{tag:{}},tags:{spawn:true}},{},3,3,{stack:true}),/起点/);assert.deepEqual(doc.serialize(),before);
 const native=placeTreePrefab(doc,{id:'key',components:{key:{name:'铜'}}},{},3,3,{stack:true});const node=native.world.at(3,3)[0];assert.equal(node.components.surface,undefined);assert.equal(node.components.collision,undefined);assert.equal(native.view().tiles[3][3],null);
 const entry=placeTreePrefab(doc,{id:'entry',components:{tag:{}},tags:{entry:true}},{},3,3,{stack:true});assert.throws(()=>placeTreePrefab(entry,{id:'entry2',components:{tag:{}},tags:{entry:true}},{},4,4,{stack:true}),/入口/);
});
test('node permissions preserve unreadable state and reject readonly edits',()=>{
 const doc=placeTreePrefab(document(),prefab,{},2,2,{stack:true}),node=doc.world.at(2,2)[0],schema={components:{children:{fire:{children:{damage:{tempEditable:false}}},surface:{children:{color:{readable:false}}}}}};
 const visible=structuredClone(node.components);delete visible.surface.color;const next=configureNode(doc,node.id,visible,node.tags,()=>false,()=>false,schema);assert.equal(next.world.get(node.id).components.surface.color,'red');visible.fire.damage=7;assert.throws(()=>configureNode(doc,node.id,visible,node.tags,()=>false,()=>false,schema),/不可编辑/);
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

test('entry relocation and scalar conflict reparent reject without changing the source',()=>{
 const source=document().serialize();source.cellTags['2,2']={regionTag:'B'};source.cellTags['3,3']={regionTag:'C'};source.cellTags['2,3']={regionTag:'B'};
 let doc=placeTreePrefab(new TreeDocument(source),{id:'entry',components:{tag:{}},tags:{entry:true}},{},2,2,{stack:true});doc=placeTreePrefab(doc,{id:'entry2',components:{tag:{}},tags:{entry:true}},{},3,3,{stack:true});const node=doc.world.at(3,3)[0],before=doc.serialize();assert.throws(()=>moveNode(doc,node.id,{r:2,c:3,dir:0}),/入口/);assert.deepEqual(doc.serialize(),before);
 doc=placeTreePrefab(document(),{id:'exitA',components:{tag:{}},tags:{exitTo:'A'}},{},2,2,{stack:true});doc=placeTreePrefab(doc,{id:'exitB',components:{tag:{}},tags:{exitTo:'B'}},{},3,3,{stack:true});const a=doc.world.at(2,2)[0],b=doc.world.at(3,3)[0],snapshot=doc.serialize();assert.throws(()=>reparentNode(moveNode(doc,b.id,{r:0,c:0,dir:0}),b.id,a.id,false),/Conflicting/);assert.deepEqual(doc.serialize(),snapshot);
 });
 test('invalid static and component JSON edits are atomic',()=>{
 const doc=placeTreePrefab(document(),prefab,{},2,2,{stack:true}),node=doc.world.at(2,2)[0],before=doc.serialize();
 for(const components of [{surface:{height:-1}},{collision:{blocked:'yes'}},{fire:{damage:-1}},{unknown:{}}]){assert.throws(()=>configureNode(doc,node.id,components,node.tags));assert.deepEqual(doc.serialize(),before);}
 assert.throws(()=>placeTreePrefab(doc,{id:'invalid',components:{key:{}},static:{walkable:'yes'}},{},3,3,{stack:true}));assert.deepEqual(doc.serialize(),before);
 });
