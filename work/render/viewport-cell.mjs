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

/** Player-facing guidance reads the same canonical components and runtime state as the game. */
export function describeViewportGuidance(document,r,c,{nameFor=id=>id,runtime=true,collectedKeys=[]}={}){
 const coordinate=columnLabel(c)+(r+1),nodes=document.world.at(r,c);
 if(runtime&&fragilePresence.isBrokenCell(document.world,nodes))return `${coordinate}: 易碎方块已碎裂，现在是虚空，无法站立。`;
 if(!nodes.length)return `${coordinate}: 虚空。无法行走或掉落到这里。`;
 const details=[],state=(node,id)=>runtime?document.world.runtime(node.id,id):{};
 for(const node of nodes){
  const components=node.components??{};
  if(components.fragile){const remaining=state(node,'fragile').remaining??components.fragile.count??1;details.push(state(node,'fragile').breaking?'易碎方块正在碎裂，站在上面会坠亡！':`易碎方块。再进行 ${remaining} 次成功行动（行走或折叠掉落）后碎裂；碎裂时站在上面会坠亡！`);}
  if(components.lift){const lift=components.lift,height=state(node,'lift').height??lift.initialHeight;details.push(`升降纸张。当前高度 ${Number(height.toFixed(3))}，范围 ${lift.minHeight}–${lift.maxHeight}，单程 ${lift.turnsPerLeg} 回合；站在上面只下降，离开后恢复往返。`);}
  if(components.key){const name=components.key.name??'钥匙',collected=state(node,'key').collected||collectedKeys.includes(name);details.push(`钥匙「${name}」${collected?'已收集':'尚未收集，走到这里即可拾取'}。用于满足区域出口的钥匙条件。`);}
  if(components.fire)details.push(`火焰。进入增加 ${components.fire.damage??1} 层过热，累计 6 层会死亡。`);
  if(components.ice)details.push('冰块。阻挡属性开启时无法进入。');
  if(components.campfire)details.push('篝火。不可进入；走到八方向相邻格可解除冰冻。');
  if(components.eruption)details.push('喷发装饰方块。与纸张一样可通行，没有特殊行动效果。');
  if(components.foldSwitch){const current=state(node,'foldSwitch').state??components.foldSwitch.initialState;details.push(`折线开关。当前${current===1?'开启':'关闭'}；折线经过时可切换，控制关联的区域出口。`);}
  if(components.rayEmitter){const direction=state(node,'rayEmitter').direction??components.rayEmitter.initialDirection;details.push(`冰冻射线机关。当前朝${directionConfig.directions[direction].label}，射程 3 格；不可进入，射线会冰冻玩家。`);}
  if(components.firebird)details.push('火焰鸟。不可进入，会追踪玩家并喷出火焰；靠近会使它发怒。');
  if(components.flame)details.push('火焰覆盖。不可进入。');
  if(components.collision?.blocked&&!components.firebird&&!components.rayEmitter&&!components.foldSwitch&&!components.campfire)details.push('阻挡方块。无法行走或掉落到这里。');
  if(node.tags?.exitTo){const required=node.tags.requiredKeys??[],missing=required.filter(key=>!collectedKeys.includes(key));details.push(`区域出口 → ${node.tags.exitTo}。${missing.length?'还需钥匙：'+missing.join('、')+'。':'钥匙条件已满足。'}到达后显示目标区域；有入口时传送到入口。`);}
  if(node.tags?.entry)details.push('区域入口。来自其他区域的传送会在这里落地。');
  if(node.tags?.spawn)details.push('玩家起点。游玩和重新开始时从这里出发。');
  if(components.fold?.directions?.length)details.push('折痕。点击选择折线可查看对称落点；在折痕上拖拽可折叠，松开时对齐目标则掉落，否则回弹。');
 }
 return `${coordinate}: ${[...new Set(details)].join(' ')||[...new Set(nodes.map(node=>nameFor(node.prefabId)))].join('、')+'。可站立的方块承载玩家和道具。'}`;
}
