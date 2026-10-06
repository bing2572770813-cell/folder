import {assertHiddenContentUnchanged} from './visibility-policy.mjs';

// Structural operation: preserve map metadata and dimensions; remove all cells and marks.
export function clearMapCells(map, isHidden=()=>false, visibility={folds:true,player:true}) {
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if(map.tiles[r][c]&&isHidden(r,c))throw new Error('清空会删除隐藏实体，请先显示全部实体与区域');
  const next=structuredClone(map);
  next.tiles=Array.from({length:map.height},()=>Array(map.width).fill(null));
  next.foldCells=[];next.exit=null;
  assertHiddenContentUnchanged(map,next,visibility);
  return next;
}
