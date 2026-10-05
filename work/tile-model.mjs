export const COLOR_KEYS=['white','red','yellow','blue','green','purple','black'];
export const FOLD_TYPES=['h','v','d1','d2'];
export const hasColor=tile=>!!tile&&Object.hasOwn(tile,'color');
export const TERRAIN_TYPES=['campfire','ice','fire','eruption','goal','key'];
function copyTerrainConfig(value,depth=0) {
  if(depth>16)throw new Error('机制参数嵌套过深');
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return value.map(item=>copyTerrainConfig(item,depth+1));
  if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,copyTerrainConfig(item,depth+1)]));
  throw new Error('机制参数必须是有效 JSON 数据');
}
export const foldsOf=tile=>tile?.folds??(tile?.fold?[tile.fold]:[]);
export const blocked=tile=>!!tile&&(tile.blocked??tile.color==='black');
export const tileHeight=tile=>tile?.height??(tile?.color==='black'?.25:.09);
export function normalizeTile(tile) {
  if(tile===null)return null;
  if(!tile||(hasColor(tile)&&!COLOR_KEYS.includes(tile.color)))throw new Error('方块颜色无效');
  if(tile.edgeColor!==undefined&&(typeof tile.edgeColor!=='string'||!/^#[0-9a-f]{6}$/i.test(tile.edgeColor)))throw new Error('实体边缘颜色须为六位十六进制颜色');
  const height=tileHeight(tile),folds=foldsOf(tile);
  if(typeof height!=='number'||!Number.isFinite(height)||height<.01||height>16)throw new Error('方块高度须为 0.01–16');
  if(!Array.isArray(folds)||folds.some(f=>!FOLD_TYPES.includes(f))||(tile.fold!=null&&!FOLD_TYPES.includes(tile.fold)))throw new Error('折纸方向无效');
  if(tile.blocked!==undefined&&typeof tile.blocked!=='boolean')throw new Error('通行属性无效');
  if(tile.prefabId!=null&&(typeof tile.prefabId!=='string'||!tile.prefabId||tile.prefabId.length>80))throw new Error('实体类型无效');
  const terrain=tile.terrain??null;
  if(terrain!==null&&!TERRAIN_TYPES.includes(terrain))throw new Error('方块机制类型无效');
  if(terrain===null&&tile.terrainConfig!=null)throw new Error('机制参数需要指定机制类型');
  let terrainConfig;
  if(terrain!==null){
    const config=tile.terrainConfig??{};
    if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('机制参数必须是 JSON 对象');
    terrainConfig=copyTerrainConfig(config);
  }
  const regionTag=tile.regionTag??null;if(regionTag!==null&&(typeof regionTag!=='string'||!regionTag.trim()||regionTag.length>80))throw new Error('区域标签无效');
  const tags=tile.tags??{};if(!tags||typeof tags!=='object'||Array.isArray(tags))throw new Error('方块标签无效');
  if(tags.exitTo!==undefined&&(typeof tags.exitTo!=='string'||!tags.exitTo.trim()||tags.exitTo.length>80))throw new Error('跳转区域名称无效');
  for(const key of ['spawn','entry'])if(tags[key]!==undefined&&typeof tags[key]!=='boolean')throw new Error('方块标签无效');
  if(tile.kind!==undefined&&!['block','player-token'].includes(tile.kind))throw new Error('实体外观类型无效');
  const unique=[...new Set(folds)];
  return {...(hasColor(tile)?{color:tile.color}:{}),...(tile.edgeColor!==undefined?{edgeColor:tile.edgeColor}:{}),...(tile.kind?{kind:tile.kind}:{}),...(regionTag!==null?{regionTag}:{}),...(Object.keys(tags).length?{tags:{...tags}}:{}),...(tile.instance?{instance:{...tile.instance}}:{}),height,blocked:blocked(tile),fold:unique[0]??null,folds:unique,prefabId:tile.prefabId??null,...(terrain!==null?{terrain,terrainConfig}:{})};
}
export function normalizePrefab(data) {
  if(!data||data.version!==1||typeof data.id!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(data.id)||typeof data.name!=='string'||!data.name.trim()||!data.tile)throw new Error('实体方块需要 version:1、id、name 和 tile');
  const size=data.size??{width:1,height:1};if(!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<1||size.height<1||size.width>128||size.height>128)throw new Error('实体尺寸无效');const occupied=data.occupied??Array(size.width*size.height).fill(true);if(!Array.isArray(occupied)||occupied.length!==size.width*size.height||occupied.some(v=>typeof v!=='boolean')||!occupied.some(Boolean))throw new Error('实体占用方格无效');
  return {version:1,id:data.id,name:data.name.trim().slice(0,80),size:{...size},occupied:[...occupied],tile:normalizeTile({...data.tile,prefabId:data.id})};
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
export function normalizeFoldCells(data,width,height){
  if(data===undefined)return [];
  if(!Array.isArray(data))throw new Error('空格折线数据无效');
  const seen=new Set();return data.filter(p=>{if(!p||!Number.isInteger(p.r)||!Number.isInteger(p.c)||p.r<0||p.c<0||p.r>=height||p.c>=width||!FOLD_TYPES.includes(p.type))throw new Error('折线坐标或方向无效');const key=p.r+','+p.c+','+p.type;if(seen.has(key))return false;seen.add(key);return true;}).map(({r,c,type})=>({r,c,type}));
}
export function foldsAt(map,r,c){return [...new Set([...foldsOf(map.tiles[r]?.[c]),...(map.foldCells??[]).filter(p=>p.r===r&&p.c===c).map(p=>p.type)])];}
export function applyFoldLine(map,r,c,type){
  const old=foldsAt(map,r,c),next=type?[...new Set([...old,type])]:[];
  if(JSON.stringify(old)===JSON.stringify(next))return false;
  map.foldCells=(map.foldCells??[]).filter(p=>p.r!==r||p.c!==c);
  const tile=map.tiles[r][c];if(tile){tile.folds=next;tile.fold=next[0]??null;}else map.foldCells.push(...next.map(type=>({r,c,type})));
  return true;
}
