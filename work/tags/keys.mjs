import {blocked} from '../entities/tile-model.mjs';
export const keyNameOf=tile=>tile?.keyName?.trim()||'钥匙';
export function legalKeyNames(map){return [...new Set(map.tiles.flat().filter(t=>t?.terrain==='key'&&!blocked(t)).map(keyNameOf))].sort();}

export function renameKeyCells(map,cells,name,isHidden=()=>false){
 name=name.trim();if(!name||name.length>80)throw new Error('钥匙名须为 1–80 字');
 const keys=cells.filter(p=>map.tiles[p.r]?.[p.c]?.terrain==='key');if(!keys.length)throw new Error('先选择钥匙方块');
 const next=structuredClone(map),oldNames=new Set(keys.map(p=>keyNameOf(map.tiles[p.r][p.c])));
 for(const p of keys){if(isHidden(p.r,p.c))throw new Error('不能修改隐藏区域');next.tiles[p.r][p.c].keyName=name;}
 const remaining=new Set(legalKeyNames(next));for(let r=0;r<next.height;r++)for(let c=0;c<next.width;c++){const tile=next.tiles[r][c];if(!tile?.tags?.requiredKeys)continue;const list=[...new Set(tile.tags.requiredKeys.map(k=>oldNames.has(k)&&!remaining.has(k)?name:k))];if(JSON.stringify(list)!==JSON.stringify(tile.tags.requiredKeys)){if(isHidden(r,c))throw new Error('钥匙更名会修改隐藏出口，请先显示该区域');tile.tags.requiredKeys=list;}}
 return next;
}
