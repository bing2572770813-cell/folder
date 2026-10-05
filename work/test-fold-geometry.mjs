import assert from 'node:assert/strict';
import {applyFoldLine,normalizeFoldCells} from './tile-model.mjs';
import {uniqueFoldAxes,foldGroupAt,inFoldRange,foldStrokes} from './fold-geometry.mjs';
const map={width:7,height:7,tiles:Array.from({length:7},()=>Array(7).fill(null))};
for(const c of [1,2,4])applyFoldLine(map,3,c,'h');
let groups=uniqueFoldAxes(map);assert.equal(groups.length,2);
let g=foldGroupAt(groups,3,1,'h');assert.deepEqual(g.center,{r:3,c:1.5});assert.equal(g.radius,1);
assert.equal(inFoldRange(g,{r:3,c:.5}),true);assert.equal(inFoldRange(g,{r:2,c:1.5}),true);assert.equal(inFoldRange(g,{r:2,c:1}),false);
applyFoldLine(map,3,3,'h');groups=uniqueFoldAxes(map);assert.equal(groups.length,1);g=groups[0];assert.equal(g.radius,2);
applyFoldLine(map,3,3,'v');assert.equal(uniqueFoldAxes(map).length,2);
applyFoldLine(map,3,2,null);assert.equal(uniqueFoldAxes(map).length,3);
for(const type of ['d1','d2']){const m={width:7,height:7,tiles:Array.from({length:7},()=>Array(7).fill(null))};applyFoldLine(m,2,2,type);applyFoldLine(m,3,type==='d1'?3:1,type);const a=uniqueFoldAxes(m)[0];assert.equal(a.radius,2);for(const stroke of foldStrokes(a)){const length=Math.hypot(stroke[1].r-stroke[0].r,stroke[1].c-stroke[0].c);assert.ok(length<=1/3+1e-9);for(const p of stroke){assert.ok(p.r>=-.5&&p.c>=-.5&&p.r<=6.5&&p.c<=6.5);}}}
assert.throws(()=>normalizeFoldCells([{r:7,c:0,type:'h'}],7,7));
console.log('PASS: void placement, directional adjacency, merge/split, crossing groups, Manhattan boundary, diagonal radius, finite dash-dot strokes.');

const fs=await import('node:fs');const vm=await import('node:vm');
const source=fs.readFileSync(new URL('./app.js',import.meta.url),'utf8');
const gate=source.slice(source.indexOf('function foldTargetFor('),source.indexOf('function finishRun('));
const rangeMap={width:7,height:7,tiles:Array.from({length:7},()=>Array(7).fill(null))};
for(let c=1;c<=5;c++)applyFoldLine(rangeMap,3,c,'h');
const ctx={map:rangeMap,player:{r:1,c:3},foldAxes:uniqueFoldAxes(rangeMap),foldGroupAt,inFoldRange,reflectPoint:(r,c,a)=>({r:2*a.r-r,c}),inside:(r,c)=>r>=0&&c>=0&&r<7&&c<7,walkable:()=>true};
rangeMap.tiles[5][3]={color:'white'};rangeMap.tiles[5][0]={color:'white'};
vm.createContext(ctx);vm.runInContext(gate,ctx);
assert.equal(ctx.foldTargetFor({r:3,c:3,type:'h'},{r:1,c:3}).valid,true);
assert.equal(ctx.foldTargetFor({r:3,c:3,type:'h'},{r:1,c:0}).reason,'超出折线作用半径');
console.log('PASS: actual game teleport gate accepts in-range sources and rejects out-of-range sources with valid reflected destinations.');
