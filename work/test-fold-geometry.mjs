import assert from 'node:assert/strict';
import {applyFoldLine,normalizeFoldCells} from './tile-model.mjs';
import {uniqueFoldAxes,foldGroupAt,inFoldRange,foldDistance,foldStrokes} from './fold-geometry.mjs';
const map={width:7,height:7,tiles:Array.from({length:7},()=>Array(7).fill(null))};
for(const c of [1,2,4])applyFoldLine(map,3,c,'h');
let groups=uniqueFoldAxes(map);assert.equal(groups.length,2);
let g=foldGroupAt(groups,3,1,'h');assert.deepEqual(g.center,{r:3,c:1.5});assert.equal(g.radius,1);
assert.equal(inFoldRange(g,{r:3,c:.5}),false);assert.equal(inFoldRange(g,{r:2,c:1.5}),true);assert.equal(inFoldRange(g,{r:2,c:1}),true);
applyFoldLine(map,3,3,'h');groups=uniqueFoldAxes(map);assert.equal(groups.length,1);g=groups[0];assert.equal(g.radius,2);
applyFoldLine(map,3,3,'v');assert.equal(uniqueFoldAxes(map).length,2);
applyFoldLine(map,3,2,null);assert.equal(uniqueFoldAxes(map).length,3);
for(const type of ['d1','d2']){const m={width:7,height:7,tiles:Array.from({length:7},()=>Array(7).fill(null))};applyFoldLine(m,2,2,type);applyFoldLine(m,3,type==='d1'?3:1,type);const a=uniqueFoldAxes(m)[0];assert.equal(a.radius,1);for(const stroke of foldStrokes(a)){const length=Math.hypot(stroke[1].r-stroke[0].r,stroke[1].c-stroke[0].c);assert.ok(length<=1/3+1e-9);for(const p of stroke){assert.ok(p.r>=-.5&&p.c>=-.5&&p.r<=6.5&&p.c<=6.5);}}}
assert.throws(()=>normalizeFoldCells([{r:7,c:0,type:'h'}],7,7));
console.log('PASS: void placement, directional adjacency, merge/split, crossing groups, Chebyshev boundary, diagonal radius, finite dash-dot strokes.');

const {default:playerRuntime}=await import('./player.cjs');
const rangeMap={width:7,height:7,tiles:Array.from({length:7},()=>Array(7).fill(null))};
for(let c=1;c<=3;c++)applyFoldLine(rangeMap,3,c,'h');
rangeMap.tiles[5][3]={color:'white'};rangeMap.tiles[6][0]={color:'white'};
const state=playerRuntime.createPlayerState({r:1,c:3});
const ctx=playerRuntime.createPlayerController({state,getMap:()=>rangeMap,getFoldAxes:()=>uniqueFoldAxes(rangeMap),foldGroupAt,inFoldRange,inside:(r,c)=>r>=0&&c>=0&&r<7&&c<7,walkable:()=>true,createTerrainState:()=>({})});
assert.equal(ctx.foldTargetFor({r:3,c:3,type:'h'},{r:1,c:3}).valid,true);
assert.equal(ctx.foldTargetFor({r:3,c:3,type:'h'},{r:0,c:0}).reason,'超出折线作用半径');
console.log('PASS: actual game teleport gate accepts in-range sources and rejects out-of-range sources with valid reflected destinations.');

for(const type of ['h','v','d1','d2'])for(const count of [1,2,3,4,5]){
 const m={width:9,height:9,tiles:Array.from({length:9},()=>Array(9).fill(null))};
 for(let i=0;i<count;i++)applyFoldLine(m,type==='h'?2:2+i,type==='v'?6:type==='d2'?6-i:2+i,type);
 const a=uniqueFoldAxes(m)[0];assert.equal(a.cells.length,count);assert.equal(a.contribution,count*.5);assert.equal(a.radius,type==='d1'||type==='d2'?Math.floor(count*.5):Math.ceil(count*.5));
 const midpoint=a.cells[Math.floor(count/2)];const player={r:midpoint.r-a.radius,c:midpoint.c};
 assert.equal(foldDistance(a,player),a.radius);assert.equal(inFoldRange(a,player),true);
 assert.equal(inFoldRange(a,{r:player.r-1,c:player.c}),false);
}
assert.equal(foldDistance(null,{r:0,c:0}),Infinity);
console.log('PASS: all four directions contribute 0.5 per cell, diagonal totals round down and straight totals round up, central-cell distance includes radius boundary.');

const single={cells:[{r:3,c:3}],radius:1};
assert.equal(foldDistance(single,{r:2,c:2}),1);
assert.equal(inFoldRange(single,{r:2,c:2}),true);
assert.equal(inFoldRange(single,{r:1,c:2}),false);
assert.equal(foldDistance({cells:[{r:0,c:0},{r:4,c:4}]},{r:3,c:2}),3);
console.log('PASS: diagonal neighbours use Chebyshev distance and farther central-cell selection.');

for(const type of ['h','v','d1','d2']){
 const d={h:[0,1],v:[1,0],d1:[1,1],d2:[1,-1]}[type];
 for(const count of [3,4]){
  const cells=Array.from({length:count},(_,i)=>({r:3+i*d[0],c:5+i*d[1]}));
  const player={r:cells[0].r,c:cells[0].c};
  assert.equal(foldDistance({cells},player),count===3?1:2);
  assert.equal(foldDistance({cells:[...cells].reverse()},player),count===3?1:2);
 }
}
console.log('PASS: odd runs use geometric center; even runs use farther central cell in every direction.');

const {canEnterTerrain,createTerrainState}=await import('./special-terrain.mjs');
state.mode='play';state.terrainState=createTerrainState();
const playGate=playerRuntime.createPlayerController({state,getMap:()=>rangeMap,getFoldAxes:()=>uniqueFoldAxes(rangeMap),foldGroupAt,inFoldRange,inside:(r,c)=>r>=0&&c>=0&&r<7&&c<7,walkable:()=>true,createTerrainState,canEnterTerrain});
rangeMap.tiles[5][3]={color:'white',terrain:'campfire'};
assert.equal(playGate.foldTargetFor({r:3,c:3,type:'h'},{r:1,c:3}).reason,'篝火方块不可进入');
assert.equal(ctx.foldTargetFor({r:3,c:3,type:'h'},{r:0,c:0}).reason,'超出折线作用半径');
console.log('PASS: merged gameplay applies both fold radius and mechanism entry restrictions.');
