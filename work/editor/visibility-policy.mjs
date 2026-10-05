import {foldsOf} from '../tile-model.mjs';
function foldSignature(map){
  const entries=new Set((map.foldCells??[]).map(p=>p.r+','+p.c+':'+p.type));
  map.tiles.forEach((row,r)=>row.forEach((tile,c)=>{for(const type of foldsOf(tile))entries.add(r+','+c+':'+type);}));
  return JSON.stringify([...entries].sort());
}
export function assertHiddenContentUnchanged(before,after,visibility){
  if(!visibility.folds&&foldSignature(before)!==foldSignature(after))throw new Error('隐藏折线禁止修改');
  if(!visibility.player){
    for(let r=0;r<Math.max(before.height,after.height);r++)for(let c=0;c<Math.max(before.width,after.width);c++){
      if(JSON.stringify(before.tiles[r]?.[c]?.tags??{})!==JSON.stringify(after.tiles[r]?.[c]?.tags??{}))throw new Error('隐藏标签禁止修改');
    }
  }
}
