import {foldsAt} from '../tile-model.mjs';
import {entityType} from '../entity-visibility.mjs';

export class VoidEntity {
  constructor(r,c,folds=[]) {
    this.prefabId='void_ai';this.name='虚空';this.r=r;this.c=c;
    this.transparent=true;this.placeable=false;this.blocked=true;
    this.folds=[...folds];this.tags={};
  }
  // Legacy maps persist void as null; its fold tags remain in foldCells.
  toJSON(){return null;}
}

export function inspectCell(map,r,c,isHidden=()=>false) {
  if(!Number.isInteger(r)||!Number.isInteger(c)||r<0||c<0||r>=map.height||c>=map.width)throw new Error('检视坐标超出地图');
  if(isHidden(r,c))throw new Error('隐藏实体或区域不可检视');
  const tile=map.tiles[r][c];
  if(!tile)return new VoidEntity(r,c,foldsAt(map,r,c));
  return {r,c,prefabId:entityType(tile),properties:JSON.parse(JSON.stringify(tile)),folds:foldsAt(map,r,c)};
}
