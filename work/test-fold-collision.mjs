import assert from 'node:assert/strict';
import * as THREE from 'three';
import { foldCollisionLimit, hasCollisionBox } from './entities/fold-collision.mjs';
import { hingeFor } from './render/fold-motion.mjs';
import { uniqueFoldAxes, foldGroupAt, inFoldRange } from './tags/fold-geometry.mjs';
import { normalizeTile, tileThickness, tileHeight } from './entities/tile-model.mjs';

const HALF_PI_LIMIT = Math.PI;
function build(type='h',patch){
  const map={width:7,height:7,spawn:{r:2,c:3,dir:0},tiles:Array.from({length:7},()=>Array.from({length:7},()=>normalizeTile({color:'white',height:.09,thickness:.09,blocked:false,folds:[]}))),foldCells:[]};
  if(type==='v')map.spawn={r:3,c:2,dir:0};
  for(let i=0;i<7;i++){
    const r=type==='h'?3:type==='v'?i:type==='d1'?i:6-i,c=type==='v'?3:i;
    map.tiles[r][c].folds=[type];
  }
  patch?.(map);
  const axes=uniqueFoldAxes(map),group=foldGroupAt(axes,3,3,type);
  const hinge=hingeFor(map,group,c=>c-3,r=>r-3);
  const direction=type==='h'?{r:0,c:1}:type==='v'?{r:1,c:0}:type==='d1'?{r:1,c:1}:{r:1,c:-1};
  const side=p=>(p.c-group.center.c)*direction.r-(p.r-group.center.r)*direction.c;
  hinge.side=Math.sign(side(map.spawn))||1;
  const flap=[],crease=[],colliders=[];
  for(let r=0;r<7;r++)for(let c=0;c<7;c++){
    const value=side({r,c})*hinge.side;
    if(!map.tiles[r][c]||!inFoldRange(group,{r,c}))continue;
    if(value>0)flap.push({r,c});
    else if(value===0&&group.cells.some(q=>q.r===r&&q.c===c))crease.push({r,c,partial:true});
    else if(value<0)colliders.push({r,c});
  }
  const options={hinge,flap:[...flap,...crease],colliders,wx:c=>c-3,wz:r=>r-3,
    top:(r,c)=>tileHeight(map.tiles[r][c]),depth:(r,c)=>tileThickness(map.tiles[r][c]??{}),tileAt:(r,c)=>map.tiles[r][c]};
  return {map,group,hinge,flap,colliders,options,limit:(over={})=>foldCollisionLimit({...options,...over})};
}

// A flat sheet always folds all the way over, because landing on the far side
// is exactly what a 180 degree fold means.
for(const type of ['h','v','d1','d2'])
  assert.equal(build(type).limit(), HALF_PI_LIMIT, 'flat '+type+' folds fully');

// A tall tower standing where the flap would sweep stops it short of 180.
const tower=build('h',(map)=>{map.tiles[4][3]=normalizeTile({color:'black',height:1,thickness:.09,blocked:true,folds:[]});});
assert.ok(tower.limit() < HALF_PI_LIMIT - .1, 'a tower in the sweep blocks the fold');
assert.ok(tower.limit() > .5, 'the tower still leaves room to fold part way');

// Opting a tower out of collision opens the sweep back up.
const ghost=build('h',(map)=>{map.tiles[4][3]=normalizeTile({color:'black',height:1,thickness:.09,blocked:true,collision:false,folds:[]});});
assert.equal(hasCollisionBox(ghost.map.tiles[4][3]), false);
assert.equal(ghost.limit(), HALF_PI_LIMIT, 'collision:false towers do not block');

// The tabletop is a floor the flap may never dip through.
const table=build('h');
assert.equal(table.limit({groundY:-1}), HALF_PI_LIMIT, 'a tabletop below the paper blocks nothing');
assert.equal(table.limit({groundY:.05}), 0, 'a tabletop cutting through the paper blocks the fold');
console.log('PASS: fold collision caps the sweep at towers and at the tabletop, and keeps flat sheets free.');
