import assert from 'node:assert/strict';
import {copy,rectangle,region,pasteRegion,unionCells,selectionRegion} from './editor-model.mjs';
const base={width:4,height:4,tiles:Array.from({length:4},()=>Array(4).fill(null)),spawn:{r:0,c:0,dir:0},exit:{r:3,c:3}};
base.tiles[0][0]={color:'blue',fold:'h',height:2,prefabId:'paper_ai'};
const before=copy(base),rect=rectangle({r:1,c:1},{r:0,c:0}),clip=region(base,rect);
assert.deepEqual(rect,{r:0,c:0,h:2,w:2});
const result=pasteRegion(base,clip,1,1);assert.deepEqual(result.map.tiles[1][1],base.tiles[0][0]);assert.equal(result.map.tiles[1][2],null);
assert.deepEqual(result.map.spawn,base.spawn);assert.deepEqual(result.map.exit,base.exit);result.map.tiles[1][1].height=8;assert.equal(clip[0][0].height,2);
assert.throws(()=>pasteRegion(base,clip,3,3));assert.deepEqual(base,before);
console.log('PASS: reverse selection, independent clipboard, tile properties, null cells, atomic bounds and unique markers.');

base.foldCells=[{r:0,c:1,type:'h'},{r:3,c:3,type:'v'}];
const voidClip=region(base,rect),voidPaste=pasteRegion(base,voidClip,1,1);
assert.ok(voidPaste.map.foldCells.some(p=>p.r===1&&p.c===2&&p.type==='h'));
assert.ok(voidPaste.map.foldCells.some(p=>p.r===3&&p.c===3&&p.type==='v'));
assert.equal(voidPaste.map.tiles[1][2],null);
assert.equal(voidClip.foldCells.length,1);
assert.equal(pasteRegion(base,region({...base,foldCells:[]},rect),2,2).map.foldCells.some(p=>p.r===3&&p.c===3),false);
console.log('PASS: clipboard preserves independent void folds and clears overwritten markers.');

const cells=unionCells([{r:0,c:0}],{r:2,c:2,h:1,w:2},(r,c)=>c!==3);
assert.deepEqual(cells,[{r:0,c:0},{r:2,c:2}]);
base.tiles[0][0].instance={id:'original',anchorR:0,anchorC:0,width:1,height:1};
base.tiles[0][0].tags={spawn:true};base.tiles[0][0].regionTag='A';
base.tiles[1][2]={color:'red'};base.foldCells.push({r:1,c:2,type:'d1'});
const sparse=selectionRegion(base,cells),pasted=pasteRegion(base,sparse,1,1);
assert.equal(pasted.map.tiles[1][2].color,'red');
assert.ok(pasted.map.foldCells.some(p=>p.r===1&&p.c===2&&p.type==='d1'));
assert.notEqual(pasted.map.tiles[1][1].instance.id,'original');
assert.equal(pasted.map.tiles[1][1].instance.anchorR,1);
assert.equal(pasted.map.tiles[1][1].tags.spawn,undefined);
assert.throws(()=>pasteRegion(base,sparse,1,1,(r,c)=>r===3&&c===3),/隐藏/);
assert.doesNotThrow(()=>pasteRegion(base,sparse,1,1,(r,c)=>r===1&&c===2));
assert.throws(()=>pasteRegion(base,[[null]],0,0),/起点/);
console.log('PASS: additive sparse selections, untouched gaps/folds, independent pasted instances, unique start tags and hidden-cell guards.');

// Exercise the production pointer-up selection guard for surface-free canonical nodes.
const {readFileSync}=await import('node:fs');const {runInNewContext}=await import('node:vm');
const pointerSource=readFileSync(new URL('./app.js',import.meta.url),'utf8').split('\n').find(line=>line.startsWith("renderer.domElement.addEventListener('pointerup'"));
function pointerSelection(nodes){
 let handler,selected=[{r:9,c:9}];
 const context={renderer:{domElement:{addEventListener:(event,fn)=>handler=fn}},finishGesture:()=>{},activePointers:new Set([1]),pointerDown:{button:0,x:10,y:10},manualPan:false,multiTouch:false,dragEdited:false,lastEditKey:null,syncState:()=>{},P:{mode:'edit'},hitAt:()=>({r:0,c:0,nodeId:nodes[0]?.id}),documentModel:{primaryAt:()=>null,world:{at:()=>nodes}},refreshTreePanel:()=>{},map:{tiles:[[null]]},tool:'select',setSelectedCells:value=>selected=value,drawEditSelection:()=>{},editAt:(r,c)=>selected=[{r,c}]};
 runInNewContext(pointerSource,context);handler({pointerId:1,clientX:10,clientY:10});return selected;
}
assert.deepEqual(pointerSelection([{id:'key',components:{key:{name:'only'}}}]),[{r:0,c:0}]);
assert.deepEqual(pointerSelection([]),[],'真正虚空保留原有清空单选规则');
console.log('PASS: surface-free canonical occupancy remains selectable; genuine void clears selection.');
