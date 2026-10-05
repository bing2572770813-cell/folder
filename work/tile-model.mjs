export const COLOR_KEYS=['white','red','yellow','blue','green','purple','black'];
export const FOLD_TYPES=['h','v','d1','d2'];
export const foldsOf=tile=>tile?.folds??(tile?.fold?[tile.fold]:[]);
export const blocked=tile=>!!tile&&(tile.blocked??tile.color==='black');
export const tileHeight=tile=>tile?.height??(tile?.color==='black'?.25:.09);
export function normalizeTile(tile) {
  if(tile===null)return null;
  if(!tile||!COLOR_KEYS.includes(tile.color))throw new Error('方块颜色无效');
  const height=tileHeight(tile),folds=foldsOf(tile);
  if(typeof height!=='number'||!Number.isFinite(height)||height<.01||height>16)throw new Error('方块高度须为 0.01–16');
  if(!Array.isArray(folds)||folds.some(f=>!FOLD_TYPES.includes(f))||(tile.fold!=null&&!FOLD_TYPES.includes(tile.fold)))throw new Error('折纸方向无效');
  if(tile.blocked!==undefined&&typeof tile.blocked!=='boolean')throw new Error('通行属性无效');
  if(tile.prefabId!=null&&(typeof tile.prefabId!=='string'||!tile.prefabId||tile.prefabId.length>80))throw new Error('实体类型无效');
  const unique=[...new Set(folds)];
  return {color:tile.color,height,blocked:blocked(tile),fold:unique[0]??null,folds:unique,prefabId:tile.prefabId??null};
}
export function normalizePrefab(data) {
  if(!data||data.version!==1||typeof data.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(data.id)||typeof data.name!=='string'||!data.name.trim()||!data.tile)throw new Error('实体方块需要 version:1、id、name 和 tile');
  return {version:1,id:data.id,name:data.name.trim().slice(0,80),tile:normalizeTile({...data.tile,prefabId:data.id})};
}
export function columnLabel(c) {
  let label='';for(let n=c+1;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;return label;
}
export function lineCells(map,r,c,type) {
  const cells=[];
  for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
    if(type==='h'?y===r:type==='v'?x===c:type==='d1'?y-r===x-c:y-r===c-x)cells.push({r:y,c:x});
  }
  return cells;
}
export function applyFoldLine(map,r,c,type) {
  const types=type?[type]:foldsOf(map.tiles[r][c]);let changed=false;
  for(const direction of types)for(const p of lineCells(map,r,c,direction)){
    const tile=map.tiles[p.r][p.c];if(!tile)continue;
    const old=foldsOf(tile),next=type?[...new Set([...old,direction])]:old.filter(f=>f!==direction);
    if(JSON.stringify(old)!==JSON.stringify(next)){tile.folds=next;tile.fold=next[0]??null;changed=true;}
  }
  return changed;
}
