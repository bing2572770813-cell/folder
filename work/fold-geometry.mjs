import {foldsOf} from './tile-model.mjs';
export function axisKey(axis){
  const offset=axis.type==='h'?axis.r:axis.type==='v'?axis.c:axis.type==='d1'?axis.r-axis.c:axis.r+axis.c;
  return axis.type+':'+offset;
}
export function uniqueFoldAxes(map){
  const axes=new Map();
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)for(const type of foldsOf(map.tiles[r][c])){
    const axis={r,c,type};axes.set(axisKey(axis),axis);
  }
  return [...axes.values()];
}
// An infinite mathematical line is clipped to the visible world rectangle only
// for rendering. Its endpoints never belong to the map's finite bounds.
export function clipInfiniteLine(anchor,direction,rect){
  let lo=-Infinity,hi=Infinity;
  for(const [coordinate,min,max] of [['x',rect.minX,rect.maxX],['z',rect.minZ,rect.maxZ]]){
    const origin=anchor[coordinate],delta=direction[coordinate];
    if(Math.abs(delta)<1e-10){if(origin<min||origin>max)return null;continue;}
    const a=(min-origin)/delta,b=(max-origin)/delta;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));
    if(lo>hi)return null;
  }
  if(!Number.isFinite(lo)||!Number.isFinite(hi))return null;
  return [lo,hi].map(t=>({x:anchor.x+direction.x*t,z:anchor.z+direction.z*t}));
}
