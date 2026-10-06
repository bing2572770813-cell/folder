import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {placeEntity} from '../../entities/placement-model.mjs';
import player from '../../player.cjs';
import {defaultComponents} from '../dist/entities/components.js';
import {validateRegions,taggedCells} from '../../tags/regions.mjs';
const output=await build({entryPoints:[fileURLToPath(new URL('../../entities/tree-document.mjs',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
const legacy=()=>({version:1,width:5,height:5,tiles:Array.from({length:5},(_,r)=>Array.from({length:5},(_,c)=>r===1&&c===1?{color:'white',regionTag:'A'}:null)),spawn:{r:1,c:1,dir:0}});
function stacked(){const doc=new TreeDocument(legacy()),tree=doc.serialize(),node=structuredClone(tree.entities[0]);node.id='secondary';node.components={fold:{directions:['v']}};tree.entities.push(node);return new TreeDocument(tree);}
test('view and no-op updates preserve stacked IDs and hierarchy',()=>{
  const doc=stacked(),before=doc.serialize();const view=doc.view();view.tiles[1][1].color='red';assert.equal(doc.view().tiles[1][1].color,'white');
  doc.applyLegacy(doc.view());assert.deepEqual(doc.serialize(),before);
  const edit=doc.view();edit.tiles[1][1].height=.3;doc.applyLegacy(edit);
  assert.equal(doc.serialize().entities.length,2);assert.deepEqual(doc.serialize().transforms,before.transforms);assert.equal(doc.serialize().entities.find(n=>n.id==='secondary').components.fold.directions[0],'v');
});
test('legacy fold removal updates every surface-free owner independently',()=>{
 const doc=new TreeDocument(legacy()),tree=doc.serialize();
 tree.entities[0].components={fold:{directions:['h','v']},tag:{retained:true}};
 tree.entities.push({id:'fold-b',prefabId:'void_ai',transformId:'fold-b-t',components:{collision:{blocked:true},fold:{directions:['v','d1']},key:{name:'keep'}},tags:{custom:true},static:{transparent:true}});
 tree.transforms.push({id:'fold-b-t',parentId:null,local:{r:1,c:1,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 const stacked=new TreeDocument(tree),before=stacked.serialize(),next=stacked.view();next.foldCells=next.foldCells.filter(fold=>fold.type==='v');
 stacked.applyLegacy(next);
 assert.deepEqual(stacked.view().foldCells,[{r:1,c:1,type:'v'}]);
 assert.deepEqual(stacked.world.get(tree.entities[0].id).components.tag,{retained:true});
 assert.deepEqual(stacked.world.get(tree.entities[0].id).components.fold.directions,['v']);
 assert.deepEqual(stacked.world.get('fold-b').components.key,{name:'keep'});
 assert.deepEqual(stacked.world.get('fold-b').components.fold.directions,['v']);
 assert.deepEqual(stacked.world.get('fold-b').tags,{custom:true});
 assert.deepEqual(stacked.serialize().transforms,before.transforms);
 const cleared=stacked.view();cleared.foldCells=[];stacked.applyLegacy(cleared);
 assert.equal(stacked.world.get('fold-b').components.fold,undefined);
 assert.deepEqual(stacked.world.get('fold-b').components.key,{name:'keep'});
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
test('legacy multi-cell paper placement becomes independent single tiles',()=>{
  const doc=new TreeDocument(legacy());
  const prefab={id:'wide',size:{width:2,height:1},occupied:[true,true]};
  doc.applyLegacy(placeEntity(doc.view(),prefab,{color:'blue',prefabId:'wide'},2,1).map);
  const nodes=doc.world.at(2,1).concat(doc.world.at(2,2)),left=nodes.find(n=>doc.world.transforms.world(n.transformId).c===1),right=nodes.find(n=>n.id!==left.id);
  assert.equal(doc.world.transforms.get(right.transformId).parentId,null);
  assert.equal(right.configuration.instance,undefined);
  doc.world.transforms.setLocal(left.transformId,{r:3,c:1,dir:0});assert.equal(doc.view().tiles[2][2].prefabId,'wide');assert.equal(doc.view().tiles[3][2],null);
});
test('placing on erased cell preserves its fixed region without grouping paper',()=>{
  const doc=new TreeDocument(legacy()),erase=doc.view();erase.tiles[1][1]=null;doc.applyLegacy(erase);
  doc.applyLegacy(placeEntity(doc.view(),{size:{width:1,height:1},occupied:[true]},{color:'blue'},1,1).map);assert.equal(doc.view().tiles[1][1].regionTag,'A');
  const root=doc.world.at(1,1)[0],before=doc.world.transforms.get(root.transformId),edit=doc.view();edit.tiles[1][2]={...structuredClone(edit.tiles[1][1])};doc.applyLegacy(edit);
  const child=doc.world.at(1,2)[0];assert.equal(doc.world.transforms.get(child.transformId).parentId,null);assert.deepEqual(doc.world.transforms.get(root.transformId),before);
});
test('key-only overlays keep ground geometry and contribute tags without copying ownership',()=>{
  const tree=new TreeDocument(legacy()).serialize(),ground=tree.entities[0];ground.tags={};ground.components.surface.height=.7;
  tree.entities.push({id:'000-key',prefabId:'key_ai',transformId:ground.transformId,components:{key:{name:'铜'}},tags:{spawn:true},static:{}});
  const doc=new TreeDocument(tree),before=doc.serialize();assert.equal(doc.primaryAt(1,1).id,ground.id);assert.equal(doc.view().tiles[1][1].height,.7);assert.equal(doc.view().tiles[1][1].tags.spawn,true);
  doc.applyLegacy(doc.view());assert.deepEqual(doc.serialize(),before);
  const edit=doc.view();edit.tiles[1][1].height=.8;doc.applyLegacy(edit);assert.deepEqual(doc.world.get(ground.id).tags,{});assert.deepEqual(doc.world.get('000-key').tags,{spawn:true});
  const map=doc.view();const controller=player.createPlayerController({state:player.createPlayerState(map.spawn),createTerrainState:()=>({}),getMap:()=>map,getEntityWorld:()=>doc.world,componentRegistry:defaultComponents(),inside:()=>true,isHidden:()=>false,validateTerrains:()=>[],validateRegions,taggedCells,blocked:tile=>tile.blocked});assert.equal(controller.validateForPlay().valid,true);
  const tagEdit=doc.view();delete tagEdit.tiles[1][1].tags.spawn;doc.applyLegacy(tagEdit);assert.deepEqual(doc.world.get('000-key').tags,{});assert.deepEqual(doc.world.get(ground.id).tags,{});
});
test('transparent and key-only nodes do not fabricate ground; conflicting tags reject',()=>{
  const tree=structuredClone(new TreeDocument(legacy()).serialize());tree.entities[0].static.transparent=true;const doc=new TreeDocument(tree);assert.equal(doc.primaryAt(1,1),null);assert.equal(doc.view().tiles[1][1],null);
  tree.entities[0].static={render:false};assert.equal(new TreeDocument(tree).view().tiles[1][1].color,'white');
  tree.entities[0].tags.exitTo='A';tree.entities.push({...structuredClone(tree.entities[0]),id:'other',components:{tag:{}},tags:{exitTo:'B'}});assert.throws(()=>new TreeDocument(tree),/Conflicting/);
});

test('legacy height and fixed cell region edits preserve additional mixed components',()=>{
 const snapshot=new TreeDocument(legacy()).serialize();snapshot.entities[0].components={...snapshot.entities[0].components,tag:{retained:true},fire:{damage:3},key:{name:'铜'}};const doc=new TreeDocument(snapshot);
 for(const edit of [tile=>tile.height=.4,tile=>tile.regionTag='B']){const next=doc.view();edit(next.tiles[1][1]);doc.applyLegacy(next);const node=doc.world.serialize()[0];assert.deepEqual(node.components.fire,{damage:3});assert.deepEqual(node.components.key,{name:'铜'});assert.deepEqual(node.components.tag,{retained:true});}
 });

test('moved spawn and overlay spawn tags update compatibility and saved spawn coordinates',async()=>{
 const {moveNode}=await import('data:text/javascript;base64,'+Buffer.from((await build({entryPoints:[fileURLToPath(new URL('../../entities/tree-commands.mjs',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false})).outputFiles[0].text).toString('base64'));
 const source=new TreeDocument(legacy()).serialize();source.entities[0].tags.spawn=true;const doc=new TreeDocument(source),moved=moveNode(doc,source.entities[0].id,{r:2,c:2,dir:0});assert.deepEqual(moved.view().spawn,{r:2,c:2,dir:0});assert.deepEqual(moved.serialize().legacyMetadata.spawn,{r:2,c:2,dir:0});assert.equal(new TreeDocument(moved.serialize()).view().spawn.r,2);
 });

test('collectible key selector includes overlays and mixed nodes on separate paper tiles and respects every blocker',async()=>{
 const {legalKeyNames}=await import('../../tags/keys.mjs');
 const snapshot=new TreeDocument(legacy()).serialize(),base=snapshot.entities[0];
 const overlay={...structuredClone(base),id:'key-overlay',transformId:'key-tile',components:{key:{name:'铜'}},tags:{}};
 base.tags={spawn:true};base.components.fire={};base.components.key={name:'银'};
 snapshot.entities.push(overlay,{...structuredClone(base),id:'key-ground',transformId:'key-tile',components:{surface:{}},tags:{}});
 snapshot.transforms.push({id:'key-tile',parentId:null,local:{r:2,c:2,dir:0},footprint:{width:1,height:1,occupied:[true]}});
 let doc=new TreeDocument(snapshot);assert.deepEqual(legalKeyNames(doc.view(),doc.world),['铜','银'].sort());
 base.static={...base.static,walkable:false};overlay.static={...overlay.static,walkable:false};doc=new TreeDocument(snapshot);assert.deepEqual(legalKeyNames(doc.view(),doc.world),[]);
 });

test('old lift duration maps import as turn-based configuration without modifying input',()=>{
 const input=legacy();input.tiles[1][1].lift={minHeight:.09,maxHeight:1,initialHeight:.09,durationMs:1800};
 const before=structuredClone(input),doc=new TreeDocument(input),node=doc.serialize().entities[0];
 assert.equal(node.components.lift.turnsPerLeg,3);assert.equal(node.components.lift.durationMs,undefined);
 assert.equal(doc.view().tiles[1][1].lift.turnsPerLeg,3);assert.deepEqual(input,before);
 const v2=doc.serialize();v2.entities[0].components.lift={minHeight:.09,maxHeight:1,initialHeight:.09,durationMs:1800};
 v2.entities[0].configuration.propertySchema={durationMs:{tempEditable:false},components:{children:{lift:{children:{durationMs:{serializable:false}}}}}};
 const migrated=new TreeDocument(v2).serialize().entities[0];
 assert.equal(migrated.components.lift.turnsPerLeg,3);assert.equal(migrated.components.lift.durationMs,undefined);
 assert.deepEqual(migrated.configuration.propertySchema.turnsPerLeg,{tempEditable:false,label:'单程回合数'});
 assert.deepEqual(migrated.configuration.propertySchema.components.children.lift.children.turnsPerLeg,{serializable:false,label:'单程回合数'});
 assert.equal(migrated.configuration.propertySchema.durationMs,undefined);
 const snapshotOnly=structuredClone(v2);snapshotOnly.entities[0].configuration.lift=structuredClone(snapshotOnly.entities[0].components.lift);delete snapshotOnly.entities[0].components.lift;
 assert.equal(new TreeDocument(snapshotOnly).world.get(snapshotOnly.entities[0].id).components.lift.turnsPerLeg,3);
 for(const durationMs of [0,-1,'1800']){
  const invalid=structuredClone(v2);invalid.entities[0].components.lift.durationMs=durationMs;
  assert.throws(()=>new TreeDocument(invalid),/Invalid lift|单程回合数/);
 }
});
