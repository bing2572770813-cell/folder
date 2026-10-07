import test from 'node:test';
import assert from 'node:assert/strict';
import {EntityWorld} from '../dist/entities/entity-world.js';
import {TransformManager} from '../dist/entities/transform-manager.js';
import {renderTreeCells,mapForSurface} from '../../render/tree-render.mjs';

function fixture(){
 const transforms=new TransformManager(4,4),world=new EntityWorld(transforms);
 const document={world,cellTags:{'1,1':{regionTag:'A'}},view(){const tiles=Array.from({length:4},()=>Array(4).fill(null));tiles[1][1]={color:'white',height:.09};tiles[1][2]={color:'white',height:.09};return {width:4,height:4,tiles};}};
 const add=(id,components,staticData={},configuration={})=>{transforms.create({id:'t-'+id,parentId:null,local:{r:1,c:1,dir:0},footprint:{width:1,height:1,occupied:[true]}});world.add({id,prefabId:'paper_ai',transformId:'t-'+id,components,tags:{entry:true},static:staticData,configuration});};
 add('a',{surface:{height:.09,color:'white'}});add('b',{surface:{height:.3,color:'blue'},fire:{},key:{name:'铜'}},{},{custom:{enabled:true},foldHints:false});
 return {document,add};
}

test('stacked surfaces and every terrain marker project without losing native config',()=>{
 const {document}=fixture(),before=document.world.serialize(),view=renderTreeCells(document);
 assert.equal(view.surfaceCells.length,2);assert.deepEqual(view.surfaceCells.map(cell=>cell.primary),[true,false]);
 assert.deepEqual(view.terrainCells.map(cell=>[cell.type,cell.index,cell.total]),[['fire',0,2],['key',1,2]]);
 assert.deepEqual(view.surfaceCells[1].tile.custom,{enabled:true});assert.equal(view.surfaceCells[1].tile.foldHints,false);
 assert.deepEqual(view.surfaceCells.map(cell=>cell.tile.regionTag),['A','A']);assert.equal(view.tagCells.length,2);
 view.surfaceCells[1].tile.custom.enabled=false;assert.deepEqual(document.world.serialize(),before);
});

test('hidden nodes, hidden cells and render-disabled surfaces are omitted',()=>{
 const {document,add}=fixture();add('off',{surface:{},fire:{}},{render:false});add('transparent',{surface:{}},{transparent:true});
 const view=renderTreeCells(document,{nodeHidden:node=>node.id==='b'});assert.deepEqual(view.surfaceCells.map(cell=>cell.nodeId),['a']);assert.equal(view.terrainCells.length,0);
 const hidden=renderTreeCells(document,{cellHidden:()=>true});assert.deepEqual(hidden,{surfaceCells:[],terrainCells:[],tagCells:[],tokenCells:[]});
});

test('surface-free overlays produce markers without fabricated paper',()=>{
 const {document,add}=fixture();add('0-overlay',{key:{name:'银'}});
 const view=renderTreeCells(document);assert.equal(view.surfaceCells.length,2);assert.equal(view.surfaceCells[0].primary,true);
 assert.equal(view.terrainCells.length,3);assert.equal(view.terrainCells[0].nodeId,'0-overlay');
});

test('surface map preserves neighbors and follows transform changes without cached spatial state',()=>{
 const {document}=fixture(),map=mapForSurface(document,'b');assert.equal(map.tiles[1][1].height,.3);assert.equal(map.tiles[1][2].height,.09);
 map.tiles[1][1].custom.enabled=false;assert.equal(document.world.get('b').configuration.custom.enabled,true);
 document.world.transforms.setLocal('t-b',{r:2,c:2,dir:0});const moved=renderTreeCells(document);
 const cell=moved.surfaceCells.find(cell=>cell.nodeId==='b');assert.deepEqual([cell.r,cell.c],[2,2]);assert.equal(cell.tile.regionTag,'默认区域');
 assert.equal(mapForSurface(document,'b').tiles[2][2].height,.3);
});

test('lift rendering shares initial and runtime height with markers without changing configuration',()=>{
 const {document,add}=fixture();add('lift',{surface:{height:.09,thickness:.09},lift:{minHeight:.09,maxHeight:1.4,initialHeight:1.4,durationMs:1000}});
 const before=document.world.serialize();let projection=renderTreeCells(document);
 assert.equal(projection.surfaceCells.find(cell=>cell.nodeId==='lift').tile.height,1.4);
 document.world.setRuntime('lift','lift',{height:.6,direction:-1});
 projection=renderTreeCells(document,{runtime:true});
 assert.equal(projection.surfaceCells.find(cell=>cell.nodeId==='lift').tile.height,.6);
 assert.equal(projection.tagCells.find(cell=>cell.nodeId==='lift').surfaceTop,.6);
 assert.deepEqual(document.world.serialize(),before);
});

test('player tokens render without their legacy slab, preserving support and visibility',()=>{
 const {document,add}=fixture();add('token',{surface:{height:.09,color:'red'},collision:{blocked:true}},{},{kind:'player-token'});
 const view=renderTreeCells(document);assert.equal(view.surfaceCells.length,2);
 assert.equal(view.tokenCells.length,1);assert.equal(view.tokenCells[0].surfaceTop,.3);
 assert.equal(view.tokenCells[0].tile.color,'red');
 assert.equal(renderTreeCells(document,{nodeHidden:node=>node.id==='token'}).tokenCells.length,0);
 assert.equal(renderTreeCells(document,{cellHidden:()=>true}).tokenCells.length,0);
 assert.ok(document.world.get('token').components.surface,'read-only render projection preserves legacy map data');
});
