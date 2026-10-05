export function footprint(prefab,r,c){const cells=[];for(let i=0;i<prefab.occupied.length;i++)if(prefab.occupied[i])cells.push({r:r+Math.floor(i/prefab.size.width),c:c+i%prefab.size.width});return cells;}
export function placeEntity(map,prefab,tile,r,c,isHidden=()=>false){
 const cells=footprint(prefab,r,c);if(cells.some(p=>p.r<0||p.c<0||p.r>=map.height||p.c>=map.width))throw new Error('实体实际占用格超出地图');
 if(cells.some(p=>isHidden(p.r,p.c)))throw new Error('不能覆盖隐藏区域');
 if(cells.some(p=>map.tiles[p.r][p.c]?.tags?.spawn&&tile.blocked))throw new Error('不能用阻挡实体覆盖玩家起点');
 const next=JSON.parse(JSON.stringify(map)),id=globalThis.crypto.randomUUID();
 for(const p of cells){const old=next.tiles[p.r][p.c];next.tiles[p.r][p.c]={...JSON.parse(JSON.stringify(tile)),regionTag:old?.regionTag??'默认区域',tags:{...old?.tags},folds:old?.folds??[],fold:old?.fold??null,instance:{id,anchorR:r,anchorC:c,width:prefab.size.width,height:prefab.size.height}};}
 return {map:next,cells};
}
export function removeEntity(map,r,c,isHidden=()=>false){const id=map.tiles[r]?.[c]?.instance?.id,cells=[];for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if(id?map.tiles[y][x]?.instance?.id===id:y===r&&x===c)cells.push({r:y,c:x});if(cells.some(p=>isHidden(p.r,p.c)))throw new Error('实体包含隐藏区域，不能删除');return cells;}
