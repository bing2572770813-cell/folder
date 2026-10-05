import {foldsAt,blocked} from './tile-model.mjs';
import {entityType} from './entity-visibility.mjs';
import {createEntityBehavior,normalizeBaseEntity} from './entities/behaviors.mjs';
export function footprint(prefab,r,c){const cells=[];for(let i=0;i<prefab.occupied.length;i++)if(prefab.occupied[i])cells.push({r:r+Math.floor(i/prefab.size.width),c:c+i%prefab.size.width});return cells;}
export function placeEntity(map,prefab,tile,r,c,isHidden=()=>false){
 const cells=footprint(prefab,r,c);if(cells.some(p=>p.r<0||p.c<0||p.r>=map.height||p.c>=map.width))throw new Error('实体实际占用格超出地图');
 if(cells.some(p=>isHidden(p.r,p.c)))throw new Error('不能覆盖隐藏区域');
 const bases=normalizeBaseEntity(prefab.BaseEntity),behavior=createEntityBehavior(prefab.behavior);
 for(const p of cells){const old=map.tiles[p.r][p.c],base=old?entityType(old):'void_ai';if(bases&&!bases.includes(base))throw new Error('实体不允许放置在 '+base+' 上');const result=behavior.placement({baseEntity:old?JSON.parse(JSON.stringify(old)):null,r:p.r,c:p.c});if(result.operation!=='replace')throw new Error('尚未启用该实体叠层策略');}
 if(cells.some(p=>(map.tiles[p.r][p.c]?.tags?.spawn||map.tiles[p.r][p.c]?.tags?.entry)&&(blocked(tile)||tile.terrain==='campfire')))throw new Error('不能用不可通行实体覆盖玩家起点或区域入口');
 const next=JSON.parse(JSON.stringify(map)),id=globalThis.crypto.randomUUID();
 for(const p of cells){const old=next.tiles[p.r][p.c],folds=foldsAt(next,p.r,p.c);next.tiles[p.r][p.c]={...JSON.parse(JSON.stringify(tile)),regionTag:old?.regionTag??'默认区域',tags:{...old?.tags},folds,fold:folds[0]??null,instance:{id,anchorR:r,anchorC:c,width:prefab.size.width,height:prefab.size.height}};next.foldCells=(next.foldCells??[]).filter(mark=>mark.r!==p.r||mark.c!==p.c);}
 return {map:next,cells};
}
export function removeEntity(map,r,c,isHidden=()=>false){const id=map.tiles[r]?.[c]?.instance?.id,cells=[];for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if(id?map.tiles[y][x]?.instance?.id===id:y===r&&x===c)cells.push({r:y,c:x});if(cells.some(p=>isHidden(p.r,p.c)))throw new Error('实体包含隐藏区域，不能删除');return cells;}
