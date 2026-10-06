import {legalKeyNames} from './keys.mjs';
import {blocked} from '../entities/tile-model.mjs';
export const DEFAULT_REGION='默认区域';
export const regionOf=tile=>tile?.regionTag??DEFAULT_REGION;
export function migrateRegions(map){
 const legacy=!map.tiles.flat().some(t=>t&&(t.regionTag!==undefined||t.tags!==undefined));
 for(const row of map.tiles)for(const tile of row)if(tile)tile.regionTag??=DEFAULT_REGION;
 const tagged=map.tiles.flat().some(t=>t?.tags?.spawn);
 if(!tagged&&legacy&&map.spawn&&map.tiles[map.spawn.r]?.[map.spawn.c])map.tiles[map.spawn.r][map.spawn.c].tags={...map.tiles[map.spawn.r][map.spawn.c].tags,spawn:true};
 return map;
}
export function regionNames(map){return [...new Set(map.tiles.flat().filter(Boolean).map(regionOf))].sort();}
export function taggedCells(map,tag){const cells=[];for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if(map.tiles[r][c]?.tags?.[tag])cells.push({r,c,tile:map.tiles[r][c]});return cells;}
export function validateRegions(map,world){
 const errors=[],spawn=taggedCells(map,'spawn'),entries=taggedCells(map,'entry');
 if(spawn.length!==1)errors.push('必须且只能有一个玩家起点标签');
 for(const p of [...spawn,...entries])if(blocked(p.tile)||p.tile.terrain==='campfire')errors.push('起点与区域入口必须在可行走方块上');
 const names=new Set(regionNames(map)),counts=new Map(),keys=new Set(legalKeyNames(map,world));
 for(const p of entries){const name=regionOf(p.tile);counts.set(name,(counts.get(name)??0)+1);if(spawn.some(s=>regionOf(s.tile)===name))errors.push('区域入口不能与玩家起点共存于区域：'+name);}
 for(const [name,count] of counts)if(count>1)errors.push('区域只能有一个入口：'+name);
 for(const p of taggedCells(map,'exitTo')){const target=p.tile.tags.exitTo;for(const key of p.tile.tags.requiredKeys??[])if(!keys.has(key))errors.push('出口所需钥匙不存在或不可收集：'+key);if(!names.has(target))errors.push('跳转区域不存在：'+target);else if(counts.get(target)!==1)errors.push('跳转区域需要唯一入口：'+target);}
 return [...new Set(errors)];
}
export function assignRegion(map,cells,name,existing=false){
 name=name.trim();if(!name||name.length>80)throw new Error('区域名称须为 1–80 字');if(!existing&&regionNames(map).includes(name))throw new Error('区域名称已存在');if(existing&&!regionNames(map).includes(name))throw new Error('区域不存在');
 const next=JSON.parse(JSON.stringify(map)),oldNames=new Set();let count=0;for(const p of cells)if(next.tiles[p.r]?.[p.c]){oldNames.add(regionOf(next.tiles[p.r][p.c]));next.tiles[p.r][p.c].regionTag=name;count++;}
 if(!count)throw new Error('选区中没有可设置标签的方块');
 const remaining=new Set(regionNames(next));for(const p of taggedCells(next,'exitTo'))if(oldNames.has(p.tile.tags.exitTo)&&!remaining.has(p.tile.tags.exitTo))p.tile.tags.exitTo=name;
 const conflicts=validateRegions(next).filter(e=>e.startsWith('区域入口不能')||e.startsWith('区域只能'));if(conflicts.length)throw new Error(conflicts.join('；'));
 return next;
}
export function tagCell(map,r,c,tag,value){
 const tile=map.tiles[r]?.[c];if(!tile)throw new Error('标签需要已有方块');
 if(!['spawn','entry','exitTo'].includes(tag))throw new Error('未知方块标签');
 if(tag==='exitTo'&&(!regionNames(map).includes(value)||!value))throw new Error('跳转区域不存在');
 const name=regionOf(tile);if(tag==='spawn'&&taggedCells(map,'entry').some(p=>regionOf(p.tile)===name)||tag==='entry'&&taggedCells(map,'spawn').some(p=>regionOf(p.tile)===name))throw new Error('同一区域不能同时包含玩家起点与区域入口');
 if(tag==='spawn')for(const p of taggedCells(map,'spawn'))delete p.tile.tags.spawn;
 if(tag==='entry')for(const p of taggedCells(map,'entry'))if(regionOf(p.tile)===name)delete p.tile.tags.entry;
 tile.tags={...tile.tags,[tag]:value};if(tag==='spawn')map.spawn={r,c,dir:map.spawn.dir};
}
