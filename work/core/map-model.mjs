import {normalizeTile,blocked,normalizeFoldCells} from '../entities/tile-model.mjs';
import {migrateRegions,assertEntityRegions} from '../tags/regions.mjs';
import {normalizeMapName} from './map-name.mjs';
export function validateMap(data,allowDraft=false) {
  if (!data || data.version !== 1 || !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width<3 || data.width>128 || data.height<3 || data.height>128) throw new Error('地图尺寸须为 3–128，格式版本须为 1');
  if (!Array.isArray(data.tiles) || data.tiles.length!==data.height) throw new Error('地图数据不完整');
  const tiles = data.tiles.map(row => { if(!Array.isArray(row)||row.length!==data.width)throw new Error('地图行列不匹配'); return row.map(normalizeTile); });
  assertEntityRegions({tiles});
  const s=data.spawn;
  if(!s || !Number.isInteger(s.r)||!Number.isInteger(s.c)||!Number.isInteger(s.dir)||s.r<0||s.c<0||s.r>=data.height||s.c>=data.width||s.dir<0||s.dir>7||(!allowDraft&&(!tiles[s.r][s.c]||blocked(tiles[s.r][s.c]))))throw new Error('玩家起点必须在可行走方块上');
  const exit=data.exit==null?null:data.exit;
  if(exit!==null&&(!Number.isInteger(exit.r)||!Number.isInteger(exit.c)||exit.r<0||exit.c<0||exit.r>=data.height||exit.c>=data.width||(!allowDraft&&(!tiles[exit.r][exit.c]||blocked(tiles[exit.r][exit.c])))))throw new Error('出口必须在可行走方块上');
  const maxSteps=data.maxSteps==null?0:Number(data.maxSteps);
  if(!Number.isInteger(maxSteps)||maxSteps<0||maxSteps>999)throw new Error('最大步数须为 0–999 的整数');
  const bestSteps=data.bestSteps==null?null:Number(data.bestSteps);
  if(bestSteps!==null&&(!Number.isInteger(bestSteps)||bestSteps<0||bestSteps>9999))throw new Error('最佳步数无效');
  return migrateRegions({version:1,width:data.width,height:data.height,tiles,foldCells:normalizeFoldCells(data.foldCells,data.width,data.height),spawn:{r:s.r,c:s.c,dir:s.dir},exit:exit?{r:exit.r,c:exit.c}:null,name:normalizeMapName(data.name),description:typeof data.description==='string'?data.description.slice(0,240):'',maxSteps,bestSteps});
}
