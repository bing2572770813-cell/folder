import {tileHeight,tileThickness,tileGradualRate} from '../entities/tile-model.mjs';import {entityType} from '../entities/visibility-model.mjs';
export const isPaper=tile=>!!tile&&!tile.lift&&entityType(tile)==='paper_ai';
// Shared top boundaries join flat centers; thickness offsets the underside along surface normals.
export function paperSurface(map,r,c,hidden=()=>false){
 const tile=map.tiles[r]?.[c];if(!isPaper(tile)||hidden(r,c))return null;const height=tileHeight(tile);
 const paper=(y,x)=>isPaper(map.tiles[y]?.[x])&&!hidden(y,x),average=cells=>{const values=cells.filter(([y,x])=>paper(y,x)).map(([y,x])=>tileHeight(map.tiles[y][x]));return values.reduce((a,b)=>a+b,0)/values.length;};
 let changed=false;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(paper(r+dr,c+dc)&&tileHeight(map.tiles[r+dr][c+dc])!==height)changed=true;if(!changed||tileGradualRate(tile)===0)return null;
 const corners=[average([[r,c],[r-1,c],[r,c-1],[r-1,c-1]]),average([[r,c],[r-1,c],[r,c+1],[r-1,c+1]]),average([[r,c],[r+1,c],[r,c+1],[r+1,c+1]]),average([[r,c],[r+1,c],[r,c-1],[r+1,c-1]])];
 const mids=[average([[r,c],[r-1,c]]),average([[r,c],[r,c+1]]),average([[r,c],[r+1,c]]),average([[r,c],[r,c-1]])],inner=.5/(1+tileGradualRate(tile)),steps=[-.5,-inner,0,inner,.5];
 const interpolate=(a,m,b,t)=>t<=0?a+(m-a)*(t+.5)*2:m+(b-m)*t*2;
 const points=[];for(let z=0;z<5;z++)for(let x=0;x<5;x++){let y=height;if(z===0)y=interpolate(corners[0],mids[0],corners[1],steps[x]);else if(z===4)y=interpolate(corners[3],mids[2],corners[2],steps[x]);else if(x===0)y=interpolate(corners[0],mids[3],corners[3],steps[z]);else if(x===4)y=interpolate(corners[1],mids[1],corners[2],steps[z]);points.push([steps[x],y,steps[z]]);}

 // Extrude the surface along unit vertex normals rather than clipping at a world height.
 const faces=[];for(let z=0;z<4;z++)for(let x=0;x<4;x++){const a=z*5+x,b=a+1,d=a+5,e=d+1;faces.push([a,d,b],[b,d,e]);}
 const normals=points.map(()=>[0,0,0]);
 for(const [a,b,c] of faces){const u=points[b].map((v,i)=>v-points[a][i]),v=points[c].map((v,i)=>v-points[a][i]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];for(const index of [a,b,c])for(let i=0;i<3;i++)normals[index][i]+=n[i];}
 for(const n of normals){const length=Math.hypot(...n);for(let i=0;i<3;i++)n[i]/=length;}
 const thickness=tileThickness(tile),bottomPoints=points.map((p,index)=>p.map((value,i)=>value-normals[index][i]*thickness));
 const positions=[],tri=(a,b,c)=>positions.push(...a,...b,...c);
 for(const [a,b,c] of faces){tri(points[a],points[b],points[c]);tri(bottomPoints[c],bottomPoints[b],bottomPoints[a]);}
 const ring=[0,1,2,3,4,9,14,19,24,23,22,21,20,15,10,5],boundary=ring.map(i=>points[i]),boundarySegments=[];
 // Close each shell, including neighbours with different thicknesses.
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];tri(points[a],points[b],bottomPoints[a]);tri(points[b],bottomPoints[b],bottomPoints[a]);boundarySegments.push([points[a],points[b]]);}
 return {positions,boundary,boundarySegments,points,bottomPoints,normals,height,thickness};
}
