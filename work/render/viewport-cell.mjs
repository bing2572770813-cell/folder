import {columnLabel} from '../entities/tile-model.mjs';
const terrainNames={campfire:'篝火',ice:'冰河',fire:'火焰',eruption:'喷发'};

export function describeViewportCell(document,r,c,{nameFor=id=>id,nodeHidden=()=>false,runtime=false}={}){
 const nodes=document.world.at(r,c);
 const region=document.cellTags?.[r+','+c]?.regionTag??'默认区域';
 if(!nodes.length)return `${columnLabel(c)}${r+1} · 空格 · ${region}`;
 const visible=nodes.filter(node=>!nodeHidden(node));
 const labels=[...new Set(visible.map(node=>nameFor(node.prefabId)))];
 for(const node of visible){
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
