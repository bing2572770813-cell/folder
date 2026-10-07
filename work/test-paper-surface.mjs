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

const {entityEdgeSegments}=await import('./render/entity-edges.mjs');
for(const flat of [tile(1),{...tile(1),surfaceConnected:true}, {...tile(4),gradualRate:0}]){
 const segments=entityEdgeSegments(flat,null);assert.equal(segments.length,4);
 assert.ok(segments.flat().every(p=>p[1]===flat.height+.004),'flat paper borders only its front');
}
const curvedEdges=entityEdgeSegments(thin.tiles[0][0],thinSurface);
assert.deepEqual(curvedEdges,thinSurface.boundarySegments.map(segment=>segment.map(p=>[p[0],p[1]+.004,p[2]])),'curved paper borders only its front boundary');
assert.equal(entityEdgeSegments({prefabId:'obstacle_ai',height:1},null).length,12,'non-paper keeps its box edges');
console.log('PASS: flat, custom and curved paper have front-only borders, without underside or vertical edges.');

const {validateLighting,lightingDefaults}=await import('./render/lighting.mjs');
assert.equal(validateLighting({...lightingDefaults,creaseDepth:-.5}).creaseDepth,-.5);
for(const type of ['h','v','d1','d2']){
 const raised=paperSurface({tiles:[[{...tile(1),thickness:.1,folds:[type]}]]},0,0,()=>false,true,-.5);
 assert.ok(Math.abs(raised.points[544][1]-1.05)<1e-10,'negative depth raises the crease');
 assert.ok(raised.positions.every(Number.isFinite));
 for(let i=0;i<raised.points.length;i++)assert.ok(Math.abs(Math.hypot(...raised.points[i].map((v,axis)=>v-raised.bottomPoints[i][axis]))-.1)<1e-10,'raised crease preserves normal thickness');
}
console.log('PASS: negative crease depth raises all four crease directions and preserves thickness.');

const surfaceModule=await import('./render/paper-surface.mjs');
assert.equal(typeof surfaceModule.createPaperSurfaceCache,'function','scene geometry must support bounded reuse');
const cache=surfaceModule.createPaperSurfaceCache();
const cachedMap={tiles:[[tile(1),tile(3)],[tile(2),tile(4)]],foldCells:[]};
const cached=(r=0,c=0,hidden=()=>false,showFolds=true,depth=.6)=>cache.get(cachedMap,r,c,hidden,showFolds,depth);
cache.begin();const original=cached();cache.end();
cache.begin();assert.equal(cached(),original,'unchanged geometry is reused across rebuilds');cache.end();
cachedMap.tiles[0][0].color='red';cachedMap.tiles[0][0].regionTag='region';
assert.equal(cached(),original,'display-only edits do not invalidate geometry');
for(const [description,change] of [
 ['diagonal height',()=>cachedMap.tiles[1][1].height=8],
 ['neighbor visibility',()=>cachedMap.tiles[0][1].surfaceConnected=false],
 ['thickness',()=>cachedMap.tiles[0][0].thickness=.1],
 ['transition rate',()=>cachedMap.tiles[0][0].gradualRate=1],
 ['entity crease',()=>cachedMap.tiles[0][0].folds=['v']],
 ['virtual crease',()=>cachedMap.foldCells=[{r:0,c:0,type:'h'}]],
]){
 const before=cached();change();const after=cached();
 assert.notEqual(after,before,description+' must invalidate');
 assert.deepEqual(after,paperSurface(cachedMap,0,0),description+' matches uncached geometry');
}
assert.deepEqual(cached(0,0,()=>false,false),paperSurface(cachedMap,0,0,()=>false,false));
assert.deepEqual(cached(0,0,()=>false,true,-.5),paperSurface(cachedMap,0,0,()=>false,true,-.5));
assert.equal(cached(0,0,()=>true),null,'hidden center has no surface');
assert.deepEqual(cached(0,0,(r,c)=>r===1&&c===1),paperSurface(cachedMap,0,0,(r,c)=>r===1&&c===1));
cachedMap.tiles[0][0].lift={};assert.equal(cached(),null,'lift does not connect to paper');delete cachedMap.tiles[0][0].lift;
cachedMap.tiles[0][0].surfaceConnected=false;assert.equal(cached(),null);delete cachedMap.tiles[0][0].surfaceConnected;
const retained=cached();cache.begin();cache.end();assert.notEqual(cached(),retained,'unvisited entities are released');
const moved=cache.get(cachedMap,1,0);assert.deepEqual(moved,paperSurface(cachedMap,1,0),'cell coordinates change dependencies');
const replacement={tiles:[[tile(1)]],foldCells:[]};assert.equal(cache.get(replacement,0,0),null,'map replacement drops old neighbors and folds');
const bounded=surfaceModule.createPaperSurfaceCache({maxComponents:1});
const oversized=bounded.get(cachedMap,0,0);assert.notEqual(bounded.get(cachedMap,0,0),oversized,'oversized results are not retained');
const sharedMap={tiles:Array.from({length:5},()=>Array.from({length:5},()=>({...tile(1),folds:['h']})))};
assert.equal(cache.get(sharedMap,1,1),cache.get(sharedMap,3,3),'identical local geometry is shared across cells');
const firstSurface=paperSurface(cachedMap,0,0),oneEntry=surfaceModule.createPaperSurfaceCache({maxComponents:firstSurface.positions.length+firstSurface.points.length*9+firstSurface.boundary.length*3+firstSurface.boundarySegments.length*6});
const firstEntry=oneEntry.get(cachedMap,0,0);
oneEntry.get(cachedMap,0,0,()=>false,true,-.5);
assert.notEqual(oneEntry.get(cachedMap,0,0),firstEntry,'least recently used geometry is evicted when capacity is exceeded');
console.log('PASS: bounded surface reuse, local dependency invalidation, folds, visibility, movement, map replacement and eviction.');
