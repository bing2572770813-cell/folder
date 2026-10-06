import {assertEntityRegions} from '../tags/regions.mjs';
export const copy = value => JSON.parse(JSON.stringify(value));
export const contains = (rect, p) => !!rect && !!p && p.r >= rect.r && p.r < rect.r + rect.h && p.c >= rect.c && p.c < rect.c + rect.w;
export function rectangle(a,b) { return {r:Math.min(a.r,b.r),c:Math.min(a.c,b.c),h:Math.abs(a.r-b.r)+1,w:Math.abs(a.c-b.c)+1}; }
export function region(map,rect) { const tiles=Array.from({length:rect.h},(_,r)=>Array.from({length:rect.w},(_,c)=>copy(map.tiles[rect.r+r][rect.c+c]))); tiles.origin={r:rect.r,c:rect.c};tiles.foldCells=(map.foldCells??[]).filter(p=>contains(rect,p)).map(p=>({...p,r:p.r-rect.r,c:p.c-rect.c}));return tiles; }
export function pasteRegion(map,tiles,r,c,isHidden=()=>false) {
  const rect={r,c,h:tiles.length,w:tiles[0].length};
  if(r<0||c<0||r+rect.h>map.height||c+rect.w>map.width)throw new Error('选区超出地图，操作未应用');
  const affects=(dr,dc)=>!tiles.mask||tiles.mask[dr][dc];
  for(let dr=0;dr<rect.h;dr++)for(let dc=0;dc<rect.w;dc++)if(affects(dr,dc)){
    if(isHidden(r+dr,c+dc))throw new Error('不能粘贴到隐藏区域');
    const old=map.tiles[r+dr][c+dc],tile=tiles[dr][dc];
    if((old?.tags?.spawn||old?.tags?.entry)&&(!tile||tile.blocked||tile.terrain==='campfire'))throw new Error('不能覆盖起点或入口为不可通行方格');
  }
  const next=copy(map),instances=new Map();
  next.foldCells=(next.foldCells??[]).filter(p=>!contains(rect,p)||!affects(p.r-r,p.c-c));
  next.foldCells.push(...(tiles.foldCells??[]).filter(p=>affects(p.r,p.c)).map(p=>({...p,r:p.r+r,c:p.c+c})));
  tiles.forEach((row,dr)=>row.forEach((tile,dc)=>{
    if(!affects(dr,dc))return;
    const value=copy(tile),old=next.tiles[r+dr][c+dc];
    if(value?.tags){delete value.tags.spawn;delete value.tags.entry;}
    if(value&&old?.tags){value.tags={...value.tags,...old.tags};if(old.tags.spawn||old.tags.entry)value.regionTag=old.regionTag;}
    if(value?.instance){const source=value.instance;if(!instances.has(source.id))instances.set(source.id,globalThis.crypto.randomUUID());value.instance={...source,id:instances.get(source.id),anchorR:r+source.anchorR-(tiles.origin?.r??0),anchorC:c+source.anchorC-(tiles.origin?.c??0)};}
    next.tiles[r+dr][c+dc]=value;
  }));assertEntityRegions(next);return {map:next,rect};
}
export function unionCells(base,rect,isVisible=()=>true){const cells=new Map(base.map(p=>[p.r+','+p.c,p]));for(let r=rect.r;r<rect.r+rect.h;r++)for(let c=rect.c;c<rect.c+rect.w;c++)if(isVisible(r,c))cells.set(r+','+c,{r,c});return [...cells.values()];}
export function cellBounds(cells){if(!cells.length)return null;const rs=cells.map(p=>p.r),cs=cells.map(p=>p.c);return {r:Math.min(...rs),c:Math.min(...cs),h:Math.max(...rs)-Math.min(...rs)+1,w:Math.max(...cs)-Math.min(...cs)+1};}
export function selectionRegion(map,cells){const rect=cellBounds(cells),tiles=region(map,rect),selected=new Set(cells.map(p=>p.r+','+p.c));tiles.mask=tiles.map((row,r)=>row.map((t,c)=>selected.has((rect.r+r)+','+(rect.c+c))));tiles.foldCells=tiles.foldCells.filter(p=>tiles.mask[p.r][p.c]);return tiles;}
