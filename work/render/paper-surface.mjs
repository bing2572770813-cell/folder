import {tileHeight,tileThickness,tileGradualRate,foldsAt} from '../entities/tile-model.mjs';import {entityType} from '../entities/visibility-model.mjs';
export const isPaper=tile=>!!tile&&entityType(tile)==='paper_ai';
// 折痕深度: 1 为完全不下压, 0 为把折纸线处压穿整层厚度, 该处不再渲染实体。
export const DEFAULT_CREASE_DEPTH=.6;
export const creaseRatio=value=>Math.min(1,Math.max(0,Number.isFinite(value)?value:DEFAULT_CREASE_DEPTH));
// Shared top boundaries join flat centers; thickness offsets the underside along surface normals.
export function paperSurface(map,r,c,hidden=()=>false,showFolds=true,creaseDepth=DEFAULT_CREASE_DEPTH){
 const tile=map.tiles[r]?.[c];if(!isPaper(tile)||hidden(r,c))return null;const height=tileHeight(tile),thickness=tileThickness(tile),folds=showFolds?foldsAt(map,r,c):[];
 const paper=(y,x)=>isPaper(map.tiles[y]?.[x])&&!hidden(y,x),average=cells=>{const values=cells.filter(([y,x])=>paper(y,x)).map(([y,x])=>tileHeight(map.tiles[y][x]));return values.reduce((a,b)=>a+b,0)/values.length;};
 let changed=false;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(paper(r+dr,c+dc)&&tileHeight(map.tiles[r+dr][c+dc])!==height)changed=true;if((!changed||tileGradualRate(tile)===0)&&!folds.length)return null;
 const corners=[average([[r,c],[r-1,c],[r,c-1],[r-1,c-1]]),average([[r,c],[r-1,c],[r,c+1],[r-1,c+1]]),average([[r,c],[r+1,c],[r,c+1],[r+1,c+1]]),average([[r,c],[r+1,c],[r,c-1],[r+1,c-1]])];
 const mids=[average([[r,c],[r-1,c]]),average([[r,c],[r,c+1]]),average([[r,c],[r+1,c]]),average([[r,c],[r,c-1]])],inner=.5/(1+tileGradualRate(tile)),steps=[-.5,-inner,0,inner,.5];
 const interpolate=(a,m,b,t)=>t<=0?a+(m-a)*(t+.5)*2:m+(b-m)*t*2;
 let points=[];for(let z=0;z<5;z++)for(let x=0;x<5;x++){let y=height;if(z===0)y=interpolate(corners[0],mids[0],corners[1],steps[x]);else if(z===4)y=interpolate(corners[3],mids[2],corners[2],steps[x]);else if(x===0)y=interpolate(corners[0],mids[3],corners[3],steps[z]);else if(x===4)y=interpolate(corners[1],mids[1],corners[2],steps[z]);points.push([steps[x],tileGradualRate(tile)===0?height:y,steps[z]]);}

 // Refine only creased cells; retain the existing transition surface as the base.
 let size=5;
 if(folds.length){
  const base=points;size=33;points=[];
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
   const px=x/(size-1)-.5,pz=z/(size-1)-.5;
   const interval=v=>Math.min(3,steps.findIndex((n,i)=>i<4&&v<=steps[i+1]));
   const ix=interval(px),iz=interval(pz),tx=(px-steps[ix])/(steps[ix+1]-steps[ix]),tz=(pz-steps[iz])/(steps[iz+1]-steps[iz]);
   const y=(1-tz)*((1-tx)*base[iz*5+ix][1]+tx*base[iz*5+ix+1][1])+tz*((1-tx)*base[(iz+1)*5+ix][1]+tx*base[(iz+1)*5+ix+1][1]);
   points.push([px,y,pz]);
  }
 }
 const faces=[];let visibleFaces=faces;for(let z=0;z<size-1;z++)for(let x=0;x<size-1;x++){const a=z*size+x,b=a+1,d=a+size,e=d+1;faces.push([a,d,b],[b,d,e]);}
 const vertexNormals=()=>{
  const result=points.map(()=>[0,0,0]);
  for(const [a,b,c] of faces){const u=points[b].map((v,i)=>v-points[a][i]),v=points[c].map((v,i)=>v-points[a][i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const index of [a,b,c])for(let i=0;i<3;i++)result[index][i]+=n[i];}
  for(const n of result){const length=Math.hypot(...n);for(let i=0;i<3;i++)n[i]/=length;}
  return result;
 };
 if(folds.length){const press=thickness*(1-creaseRatio(creaseDepth)),offsets=[];const baseNormals=vertexNormals();points=points.map((p,index)=>{
  const distance=Math.min(...folds.map(type=>type==='h'?Math.abs(p[2]):type==='v'?Math.abs(p[0]):Math.abs(type==='d1'?p[2]-p[0]:p[2]+p[0])/Math.SQRT2));
  const depth=press*Math.max(0,1-distance/.065);offsets[index]=depth;
  return p.map((v,i)=>v-baseNormals[index][i]*depth);
 });visibleFaces=faces.filter(face=>face.every(index=>offsets[index]<thickness-1e-9));}
 // Preserve thickness along the normals of the deformed surface.
 const normals=vertexNormals();
 const bottomPoints=points.map((p,index)=>p.map((value,i)=>value-normals[index][i]*thickness));
 const positions=[],tri=(a,b,c)=>positions.push(...a,...b,...c);
 for(const [a,b,c] of visibleFaces){tri(points[a],points[b],points[c]);tri(bottomPoints[c],bottomPoints[b],bottomPoints[a]);}
 const ring=[];for(let x=0;x<size;x++)ring.push(x);for(let z=1;z<size;z++)ring.push(z*size+size-1);for(let x=size-2;x>=0;x--)ring.push((size-1)*size+x);for(let z=size-2;z>0;z--)ring.push(z*size);const boundary=ring.map(i=>points[i]),boundarySegments=[];
 // Close each shell, including neighbours with different thicknesses.
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];tri(points[a],points[b],bottomPoints[a]);tri(points[b],bottomPoints[b],bottomPoints[a]);boundarySegments.push([points[a],points[b]]);}
 return {positions,boundary,boundarySegments,points,bottomPoints,normals,height,thickness};
}
