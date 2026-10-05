export const copy = value => JSON.parse(JSON.stringify(value));
export const contains = (rect, p) => !!rect && !!p && p.r >= rect.r && p.r < rect.r + rect.h && p.c >= rect.c && p.c < rect.c + rect.w;
export function rectangle(a,b) { return {r:Math.min(a.r,b.r),c:Math.min(a.c,b.c),h:Math.abs(a.r-b.r)+1,w:Math.abs(a.c-b.c)+1}; }
export function region(map,rect) { return Array.from({length:rect.h},(_,r)=>Array.from({length:rect.w},(_,c)=>copy(map.tiles[rect.r+r][rect.c+c]))); }
export function pasteRegion(map,tiles,r,c) {
  const rect={r,c,h:tiles.length,w:tiles[0].length};
  if(r<0||c<0||r+rect.h>map.height||c+rect.w>map.width) throw new Error('选区超出地图，操作未应用');
  const next=copy(map);tiles.forEach((row,dr)=>row.forEach((tile,dc)=>next.tiles[r+dr][c+dc]=copy(tile)));return {map:next,rect};
}
