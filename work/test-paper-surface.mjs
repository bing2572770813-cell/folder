import assert from 'node:assert/strict';import {paperSurface} from './paper-surface.mjs';const tile=height=>({prefabId:'paper_ai',height});const map={tiles:[[tile(1),tile(3)],[tile(2),tile(4)]]};const a=paperSurface(map,0,0),b=paperSurface(map,0,1),d=paperSurface(map,1,0);for(let z=0;z<5;z++)assert.equal(a.points[z*5+4][1],b.points[z*5][1]);for(let x=0;x<5;x++)assert.equal(a.points[20+x][1],d.points[x][1]);assert.equal(a.points[12][1],1);assert.equal(a.points[6][1],1);assert.equal(a.points[24][1],2.5);assert.equal(a.positions.length%9,0);assert.equal(paperSurface({tiles:[[tile(1),tile(1)]]},0,0),null);assert.equal(paperSurface(map,0,0,()=>true),null);const diagonal={tiles:[[tile(1),null],[null,tile(3)]]};assert.equal(paperSurface(diagonal,0,0).points[24][1],paperSurface(diagonal,1,1).points[0][1]);const other={tiles:[[tile(1),{prefabId:'obstacle_ai',height:3}]]};assert.equal(paperSurface(other,0,0),null);assert.ok(a.positions.every(Number.isFinite));console.log('PASS: continuous shared edges/corners, flat centers, diagonal neighbours, void/non-paper boundaries and visibility.');

const thin={tiles:[[{...tile(4),thickness:.1,gradualRate:1},tile(1)]]};const thinSurface=paperSurface(thin,0,0);assert.equal(thinSurface.points[6][0],-.25);
for(let i=0;i<thinSurface.points.length;i++){const delta=thinSurface.points[i].map((v,axis)=>v-thinSurface.bottomPoints[i][axis]);assert.ok(Math.abs(Math.hypot(...delta)-.1)<1e-10);assert.ok(Math.abs(delta.reduce((sum,v,axis)=>sum+v*thinSurface.normals[i][axis],0)-.1)<1e-10);}
assert.ok(thinSurface.points.some(p=>p[1]<3.9));assert.equal(thinSurface.boundarySegments.length,16);assert.ok(thinSurface.bottomPoints.some((p,i)=>Math.abs(p[0]-thinSurface.points[i][0])>1e-6));assert.ok(thinSurface.positions.every(Number.isFinite));

assert.equal(paperSurface({tiles:[[{...tile(4),gradualRate:0},tile(1)]]},0,0),null);
const {normalizeTile,tileThickness,tileGradualRate}=await import('./tile-model.mjs');assert.equal(tileThickness(normalizeTile(tile(2))),2);assert.equal(tileGradualRate(normalizeTile(tile(2))),2/3);assert.equal(normalizeTile({...tile(2),thickness:3,gradualRate:2}).thickness,3);for(const value of [-1,NaN,Infinity,17])assert.throws(()=>normalizeTile({...tile(1),thickness:value}));for(const value of [-1,NaN,Infinity,101])assert.throws(()=>normalizeTile({...tile(1),gradualRate:value}));assert.deepEqual(normalizeTile(JSON.parse(JSON.stringify(normalizeTile({...tile(2),thickness:.1,gradualRate:1})))),normalizeTile({...tile(2),thickness:.1,gradualRate:1}));console.log('PASS: normal extrusion without world-height clipping, rate geometry, zero transition, property validation and JSON roundtrip.');

const meshEdges=new Map();for(let i=0;i<thinSurface.positions.length;i+=9){const vertices=[0,3,6].map(offset=>JSON.stringify(thinSurface.positions.slice(i+offset,i+offset+3)));for(let j=0;j<3;j++){const key=[vertices[j],vertices[(j+1)%3]].sort().join('|');meshEdges.set(key,(meshEdges.get(key)||0)+1);}}assert.ok([...meshEdges.values()].every(count=>count===2));console.log('PASS: physical paper shell is watertight; every mesh edge has two faces.');

const customPaper={tiles:[[{prefabId:'custom_paper_ai',surfaceConnected:true,height:1},{prefabId:'another_paper_ai',surfaceConnected:true,height:3}]]};
assert.ok(paperSurface(customPaper,0,0));
assert.equal(paperSurface({tiles:[[{...customPaper.tiles[0][0],surfaceConnected:false},customPaper.tiles[0][1]]]},0,0),null);
assert.equal(normalizeTile(customPaper.tiles[0][0]).surfaceConnected,true);
console.log('PASS: custom paper connection uses explicit surface capability instead of prefab identity.');
for(const type of ['h','v','d1','d2']){
 const folded=paperSurface({tiles:[[{...tile(1),thickness:.1,folds:[type]}]]},0,0);
 assert.ok(Math.abs(folded.points[544][1]-.96)<1e-10);
 for(let i=0;i<folded.points.length;i++)assert.ok(Math.abs(Math.hypot(...folded.points[i].map((v,j)=>v-folded.bottomPoints[i][j]))-.1)<1e-10);
 assert.ok(folded.positions.every(Number.isFinite));
 assert.equal(paperSurface({tiles:[[{...tile(1),folds:[type]}]]},0,0,()=>false,false),null);
}
const crossing=paperSurface({tiles:[[{...tile(1),thickness:.1,folds:['h','v','d1','d2']}]]},0,0);
assert.ok(Math.abs(crossing.points[544][1]-.96)<1e-10);
// 折痕深度: 1 完全不下压, 0 压穿整层厚度后该处不再渲染实体。
const grooved=type=>paperSurface({tiles:[[{...tile(1),thickness:.1,folds:[type]}]]},0,0,()=>false,true);
const flat=grooved('h');assert.ok(Math.abs(flat.points[544][1]-.96)<1e-10,'default crease depth presses 40% of the slab');
const lifted=paperSurface({tiles:[[{...tile(1),thickness:.1,folds:['h']}]]},0,0,()=>false,true,1);
assert.ok(Math.abs(lifted.points[544][1]-1)<1e-10,'crease depth 1 never presses the surface');
assert.equal(lifted.positions.length,flat.positions.length);
const cut=paperSurface({tiles:[[{...tile(1),thickness:.1,folds:['h']}]]},0,0,()=>false,true,0);
assert.ok(Math.abs(cut.points[544][1]-.9)<1e-10,'crease depth 0 presses through the whole slab');
assert.ok(cut.positions.length<flat.positions.length,'crease depth 0 removes the crease-line faces');
console.log('PASS: four crease directions, non-additive intersections, normal thickness, crease depth and visibility.');
