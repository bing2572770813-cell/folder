import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {placeEntity} from '../../entities/placement-model.mjs';
const output=await build({entryPoints:[fileURLToPath(new URL('../../entities/tree-document.mjs',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const legacy=()=>({version:1,width:5,height:5,tiles:Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===1&&c===1?{color:'white',regionTag:'A'}:null)),spawn:{r:1,c:1,dir:0}});
function stacked(){const doc=new TreeDocument(legacy()),tree=doc.serialize(),node=structuredClone(tree.entities[0]);node.id='secondary';node.components.fold={directions:['v']};tree.entities.push(node);return new TreeDocument(tree);}
test('view and no-op updates preserve stacked IDs and hierarchy',()=>{
  const doc=stacked(),before=doc.serialize();const view=doc.view();view.tiles[1][1].color='red';assert.equal(doc.view().tiles[1][1].color,'white');
  doc.applyLegacy(doc.view());assert.deepEqual(doc.serialize(),before);
  const edit=doc.view();edit.tiles[1][1].height=.3;doc.applyLegacy(edit);
  assert.equal(doc.serialize().entities.length,2);assert.deepEqual(doc.serialize().transforms,before.transforms);assert.equal(doc.serialize().entities.find(n=>n.id==='secondary').components.fold.directions[0],'v');
});
test('projection follows parent movement while regions stay on cells',()=>{
  const doc=new TreeDocument(legacy()),tree=doc.serialize();tree.transforms.push({id:'parent',parentId:null,local:{r:0,c:0,dir:0},footprint:{width:1,height:1,occupied:[true]}});tree.transforms[0].parentId='parent';
  const moved=new TreeDocument(tree);moved.world.transforms.setLocal('parent',{r:1,c:0,dir:0});assert.equal(moved.view().tiles[1][1],null);assert.equal(moved.view().tiles[2][1].regionTag,'默认区域');assert.equal(moved.serialize().cellTags['1,1'].regionTag,'A');
});
test('protected erase and invalid edits are atomic',()=>{
  const doc=new TreeDocument(legacy()),tree=doc.serialize();tree.transforms.push({id:'child',parentId:tree.transforms[0].id,local:{r:0,c:1,dir:0},footprint:{width:1,height:1,occupied:[true]}});
  const protectedDoc=new TreeDocument(tree),before=protectedDoc.serialize(),next=protectedDoc.view();next.tiles[1][1]=null;
  assert.throws(()=>protectedDoc.applyLegacy(next),/children/);assert.deepEqual(protectedDoc.serialize(),before);
  next.tiles[1][1]={color:'white',height:-1};assert.throws(()=>protectedDoc.applyLegacy(next));assert.deepEqual(protectedDoc.serialize(),before);
});
test('metadata extras and resize survive serialization',()=>{
  const doc=new TreeDocument({...legacy(),custom:{enabled:true}}),view=doc.view();view.width=6;for(const row of view.tiles)row.push(null);doc.applyLegacy(view);assert.equal(doc.serialize().width,6);assert.deepEqual(doc.serialize().legacyMetadata.custom,{enabled:true});
});
test('external references and runtime survive edits and prevent erase atomically',()=>{
  const doc=new TreeDocument(legacy()),node=doc.world.serialize()[0];doc.world.transforms.retain(node.transformId,'player');doc.world.setRuntime(node.id,'surface',{visited:true});
  const edit=doc.view();edit.tiles[1][1].color='red';doc.applyLegacy(edit);
  assert.deepEqual(doc.world.runtime(node.id,'surface'),{visited:true});assert.ok(doc.world.transforms.referenceOwners(node.transformId).includes('player'));
  const before=doc.serialize(),erase=doc.view();erase.tiles[1][1]=null;assert.throws(()=>doc.applyLegacy(erase),/references/);assert.deepEqual(doc.serialize(),before);
});
test('failed shrink retains tree and erase retains fixed cell regions',()=>{
  const source=legacy();source.tiles[4][4]={color:'blue',regionTag:'B'};const doc=new TreeDocument(source),before=doc.serialize(),next=doc.view();next.width=3;next.height=3;next.tiles=next.tiles.slice(0,3).map(row=>row.slice(0,3));
  const edge=doc.world.at(4,4)[0];doc.world.transforms.retain(edge.transformId,'guard');assert.throws(()=>doc.applyLegacy(next),/references/);assert.deepEqual(doc.serialize(),before);
  const clear=doc.view();clear.tiles[1][1]=null;doc.applyLegacy(clear);assert.equal(doc.serialize().cellTags['1,1'].regionTag,'A');
});
test('real multi-cell placement groups transforms and root movement carries children',()=>{
  const doc=new TreeDocument(legacy());
  const prefab={id:'wide',size:{width:2,height:1},occupied:[true,true]};
  doc.applyLegacy(placeEntity(doc.view(),prefab,{color:'blue',prefabId:'wide'},2,1).map);
  const nodes=doc.world.at(2,1).concat(doc.world.at(2,2)),left=nodes.find(n=>doc.world.transforms.world(n.transformId).c===1),right=nodes.find(n=>n.id!==left.id);
  assert.equal(doc.world.transforms.get(right.transformId).parentId,left.transformId);
  doc.world.transforms.setLocal(left.transformId,{r:3,c:1,dir:0});assert.equal(doc.view().tiles[3][2].prefabId,'wide');assert.equal(doc.view().tiles[2][2],null);
});
test('placing on erased cell preserves its fixed region and joins existing instance root',()=>{
  const doc=new TreeDocument(legacy()),erase=doc.view();erase.tiles[1][1]=null;doc.applyLegacy(erase);
  doc.applyLegacy(placeEntity(doc.view(),{size:{width:1,height:1},occupied:[true]},{color:'blue'},1,1).map);assert.equal(doc.view().tiles[1][1].regionTag,'A');
  const root=doc.world.at(1,1)[0],before=doc.world.transforms.get(root.transformId),edit=doc.view();edit.tiles[1][2]={...structuredClone(edit.tiles[1][1])};doc.applyLegacy(edit);
  const child=doc.world.at(1,2)[0];assert.equal(doc.world.transforms.get(child.transformId).parentId,root.transformId);assert.deepEqual(doc.world.transforms.get(root.transformId),before);
});
