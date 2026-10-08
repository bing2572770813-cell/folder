import {columnLabel} from '../entities/tile-model.mjs';
import directionConfig from '../entities/ray-emitter-config.cjs';
import fragilePresence from '../entities/fragile-presence.cjs';
const terrainNames={campfire:'篝火',ice:'冰块',fire:'火焰',eruption:'喷发'};

export function describeViewportCell(document,r,c,{nameFor=id=>id,nodeHidden=()=>false,runtime=false}={}){
 const nodes=document.world.at(r,c);
 const region=document.cellTags?.[r+','+c]?.regionTag??'默认区域';
 if(runtime&&fragilePresence.isBrokenCell(document.world,nodes))return `${columnLabel(c)}${r+1} · 易碎方块已破碎 · 虚空 · ${region}`;
 if(!nodes.length)return `${columnLabel(c)}${r+1} · 空格 · ${region}`;
 const visible=nodes.filter(node=>!nodeHidden(node));
 const labels=[...new Set(visible.map(node=>nameFor(node.prefabId)))];
 for(const node of visible){
  if(node.components.rayEmitter){const direction=runtime?(document.world.runtime(node.id,'rayEmitter').direction??node.components.rayEmitter.initialDirection):node.components.rayEmitter.initialDirection;labels.push('冰冻朝向 '+directionConfig.directions[direction].label,'射程 3 格');}
  if(node.components.foldSwitch){const state=runtime?(document.world.runtime(node.id,'foldSwitch').state??node.components.foldSwitch.initialState):node.components.foldSwitch.initialState;labels.push('开关 '+state+(state===0?'（限制出口）':'（开启）'));}
  if(node.components.fragile){const state=runtime?document.world.runtime(node.id,'fragile'):{};const remaining=state.remaining??node.components.fragile.count??1;labels.push(state.broken?'易碎方块已破碎':state.breaking?'易碎方块破碎中':'易碎次数 '+remaining);}
  if(node.components?.lift){
   const lift=node.components.lift,height=runtime?(document.world.runtime(node.id,'lift').height??lift.initialHeight):lift.initialHeight;
   labels.push((runtime?'当前高度 ':'初始高度 ')+Number(height.toFixed(3)),'单程 '+lift.turnsPerLeg+' 回合');
  }else if(node.components?.surface)labels.push('纸面高度 '+(node.components.surface.height??.09));
  const terrain=Object.keys(terrainNames).find(type=>Object.hasOwn(node.components??{},type));
  if(terrain)labels.push(terrainNames[terrain]);
  if(Object.hasOwn(node.components??{},'key'))labels.push('钥匙：'+(node.components.key.name??'钥匙'));
  if(node.components?.collision?.blocked)labels.push('阻挡');
  if(node.tags?.exitTo)labels.push('出口 → '+node.tags.exitTo);
 }
 const hidden=nodes.length-visible.length;
 if(hidden)labels.push('隐藏 '+hidden);
 return `${columnLabel(c)}${r+1} · ${labels.length?labels.join(' · '):'实体'} · ${region}`;
}
