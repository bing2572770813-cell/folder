import {blocked} from './tile-model.mjs';
export function entityType(tile){return tile?.prefabId||(tile?.kind==='player-token'?'player_token_ai':tile?.terrain?tile.terrain+'_ai':blocked(tile)?'obstacle_ai':'paper_ai');}
export function entityChoices(prefabs,map){const entries=new Map(prefabs.map(p=>[p.id,p]));for(const tile of map.tiles.flat().filter(Boolean)){const id=entityType(tile);if(!entries.has(id))entries.set(id,{id,name:id==='paper_ai'?'纸张方块':id+'（地图实体）',size:{width:1,height:1},occupied:[true],tile});}return [...entries.values()];}
export const entityHidden=(tile,hidden)=>!!tile&&hidden.has(entityType(tile));
