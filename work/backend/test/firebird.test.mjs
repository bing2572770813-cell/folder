import test from 'node:test';
import assert from 'node:assert/strict';
import {center,inWatchRange,beam,resolveFirebird} from '../../mechanics/firebird.cjs';

const node={id:'bird',origin:{r:2,c:2},footprint:{width:3,height:3},config:{direction:'east'}};
test('firebird uses the 3x3 centre and a Chebyshev 9x9 watch range',()=>{
 assert.deepEqual(center(node.origin,node.footprint),{r:3,c:3});
 assert.equal(inWatchRange(node.origin,{r:7,c:7},node.footprint),true);
 assert.equal(inWatchRange(node.origin,{r:8,c:8},node.footprint),false);
});

test('firebird beam is three cells wide, 21 cells long and clipped',()=>{
 const cells=beam(node.origin,node.footprint,'east',30,30);
 assert.equal(cells.length,3*21);
 assert.deepEqual(cells.slice(0,3).sort((a,b)=>a.r-b.r),[{r:2,c:4},{r:3,c:4},{r:4,c:4}]);
 assert.equal(beam(node.origin,node.footprint,'north',5,5).length,3*3);
});

test('firebird returns one-shot effects for each branch',()=>{
 assert.deepEqual(resolveFirebird(node,{from:{r:0,c:0}},{r:20,c:20},30,30),[{type:'addFlame',cells:[{r:0,c:0}]}]);
 const effects=resolveFirebird(node,{from:{r:0,c:0}},{r:3,c:3},30,30);
 assert.equal(effects[0].type,'addFlame');
 assert.equal(effects[0].cells.length,63);
 assert.deepEqual(effects[1],{type:'replaceFirebird',entityId:'bird'});
});
