import {tileHeight,tileThickness,tileGradualRate} from './tile-model.mjs';import {entityType} from './entity-visibility.mjs';
export const isPaper=tile=>!!tile&&entityType(tile)==='paper_ai';
// The flat center is 0.6 × 0.6; a 0.2-wide rim interpolates shared boundary heights.
export function paperSurface(map,r,c,hidden=()=>false){
 const tile=map.tiles[r]?.[c];if(!isPaper(tile)||hidden(r,c))return null;const height=tileHeight(tile);
 const paper=(y,x)=>isPaper(map.tiles[y]?.[x])&&!hidden(y,x),average=cells=>{const values=cells.filter(([y,x])=>paper(y,x)).map(([y,x])=>tileHeight(map.tiles[y][x]));return values.reduce((a,b)=>a+b,0)/values.length;};
 let changed=false;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(paper(r+dr,c+dc)&&tileHeight(map.tiles[r+dr][c+dc])!==height)changed=true;if(!changed||tileGradualRate(tile)===0)return null;
 const corners=[average([[r,c],[r-1,c],[r,c-1],[r-1,c-1]]),average([[r,c],[r-1,c],[r,c+1],[r-1,c+1]]),average([[r,c],[r+1,c],[r,c+1],[r+1,c+1]]),average([[r,c],[r+1,c],[r,c-1],[r+1,c-1]])];
 const mids=[average([[r,c],[r-1,c]]),average([[r,c],[r,c+1]]),average([[r,c],[r+1,c]]),average([[r,c],[r,c-1]])],inner=.5/(1+tileGradualRate(tile)),steps=[-.5,-inner,0,inner,.5];
 const interpolate=(a,m,b,t)=>t<=0?a+(m-a)*(t+.5)*2:m+(b-m)*t*2;
 const points=[];for(let z=0;z<5;z++)for(let x=0;x<5;x++){let y=height;if(z===0)y=interpolate(corners[0],mids[0],corners[1],steps[x]);else if(z===4)y=interpolate(corners[3],mids[2],corners[2],steps[x]);else if(x===0)y=interpolate(corners[0],mids[3],corners[3],steps[z]);else if(x===4)y=interpolate(corners[1],mids[1],corners[2],steps[z]);points.push([steps[x],y,steps[z]]);}
 const bottom=height-tileThickness(tile),positions=[];
 const tri=(a,b,c)=>{const polygon=[a,b,c],clipped=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=a[1]>=bottom,insideB=b[1]>=bottom;if(insideA)clipped.push(a);if(insideA!==insideB){const t=(bottom-a[1])/(b[1]-a[1]);clipped.push([a[0]+(b[0]-a[0])*t,bottom,a[2]+(b[2]-a[2])*t]);}}for(let i=1;i+1<clipped.length;i++)positions.push(...clipped[0],...clipped[i],...clipped[i+1]);};for(let z=0;z<4;z++)for(let x=0;x<4;x++){const a=points[z*5+x],b=points[z*5+x+1],d=points[(z+1)*5+x],e=points[(z+1)*5+x+1];tri(a,d,b);tri(b,d,e);}
 const boundary=[0,1,2,3,4,9,14,19,24,23,22,21,20,15,10,5].map(i=>points[i]);for(let i=0;i<16;i++){const a=boundary[i],b=boundary[(i+1)%16],side=Math.floor(i/4),neighbour=[[-1,0],[0,1],[1,0],[0,-1]][side];if(!paper(r+neighbour[0],c+neighbour[1])){const lowA=[a[0],bottom,a[2]],lowB=[b[0],bottom,b[2]];tri(a,b,lowA);tri(b,lowB,lowA);}}
 for(let z=0;z<4;z++)for(let x=0;x<4;x++){const a=points[z*5+x],b=points[z*5+x+1],d=points[(z+1)*5+x],e=points[(z+1)*5+x+1];const before=positions.length;tri(a,b,d);tri(b,e,d);for(let i=before+1;i<positions.length;i+=3)positions[i]=bottom;}
 const boundarySegments=[];for(let i=0;i<boundary.length;i++){let a=boundary[i],b=boundary[(i+1)%boundary.length];if(a[1]<bottom&&b[1]<bottom)continue;if((a[1]<bottom)!==(b[1]<bottom)){const t=(bottom-a[1])/(b[1]-a[1]),cut=[a[0]+(b[0]-a[0])*t,bottom,a[2]+(b[2]-a[2])*t];if(a[1]<bottom)a=cut;else b=cut;}boundarySegments.push([a,b]);}
 return {positions,boundary,boundarySegments,points,height,bottom};
}
