import {foldsOf} from './tile-model.mjs';
export const directions={h:{r:0,c:1},v:{r:1,c:0},d1:{r:1,c:1},d2:{r:1,c:-1}};
export function axisKey(a){return a.type+':'+(a.type==='h'?a.r:a.type==='v'?a.c:a.type==='d1'?a.r-a.c:a.r+a.c);}
export function uniqueFoldAxes(map){
 const markers=new Map();
 for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)for(const type of foldsOf(map.tiles[r][c]))markers.set(type+':'+r+','+c,{r,c,type});
 for(const p of map.foldCells??[])markers.set(p.type+':'+p.r+','+p.c,p);
 const seen=new Set(),groups=[];
 for(const [key,p] of markers){if(seen.has(key))continue;const d=directions[p.type],cells=[];let start=p;
 while(markers.has(p.type+':'+(start.r-d.r)+','+(start.c-d.c)))start=markers.get(p.type+':'+(start.r-d.r)+','+(start.c-d.c));
 let q=start;while(q){cells.push(q);seen.add(q.type+':'+q.r+','+q.c);q=markers.get(p.type+':'+(q.r+d.r)+','+(q.c+d.c));}
 const end=cells.at(-1),center={r:(start.r+end.r)/2,c:(start.c+end.c)/2};
 const a={r:start.r-d.r/2,c:start.c-d.c/2},b={r:end.r+d.r/2,c:end.c+d.c/2};
 // Endpoints lie on the containing cell boundary, clamped to map bounds.
 const clamp=v=>({r:Math.max(-.5,Math.min(map.height-.5,v.r)),c:Math.max(-.5,Math.min(map.width-.5,v.c))});
 const from=clamp(a),to=clamp(b),contribution=cells.length*.5,radius=Math.ceil(contribution);
 groups.push({...p,cells,center,from,to,contribution,radius,id:key});
 }return groups;
}
export function foldGroupAt(groups,r,c,type){return groups.find(g=>g.type===type&&g.cells.some(p=>p.r===r&&p.c===c));}
export function foldDistance(group,p){return group?.cells?.length?Math.min(...group.cells.map(cell=>Math.abs(p.r-cell.r)+Math.abs(p.c-cell.c))):Infinity;}
export function inFoldRange(group,p){return !!group&&foldDistance(group,p)<=group.radius;}
export function foldStrokes(group){
 const dr=group.to.r-group.from.r,dc=group.to.c-group.from.c,length=Math.hypot(dr,dc),result=[];
 if(!length)return result;
 // A long stroke is exactly one third of a tile side; alternate with a dot.
 for(let t=0;t<length;t+=2/3){for(const [offset,size] of [[0,1/3],[.48,.035]]){const a=t+offset,b=Math.min(length,a+size);if(a>=length)continue;result.push([{r:group.from.r+dr*a/length,c:group.from.c+dc*a/length},{r:group.from.r+dr*b/length,c:group.from.c+dc*b/length}]);}}
 return result;
}
