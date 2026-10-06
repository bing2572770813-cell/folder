// Player state and all gameplay interaction live here; rendering is supplied by the scene adapter.
function createPlayerState(spawn,mode='edit'){return {player:{...spawn},moveHeight:{maxUp:1,maxDown:1},mode,steps:0,teleports:0,moving:false,levelWon:false,stepLimitHit:false,legalMoves:[],legalFoldMoves:[],chosenFold:null,foldHints:true,freeTeleport:false,playHistory:[],animation:null,terrainState:null,revealedRegions:new Set()};}
function liftInitial(config){return {height:Number(config.initialHeight),direction:Number(config.maxHeight)>Number(config.minHeight)?1:0,occupied:false,lastTime:null};}
function advanceLift(state,config,now,occupied=state.occupied){
 const min=Number(config.minHeight),max=Number(config.maxHeight),duration=Number(config.durationMs);
 let direction=state.direction||1;if(occupied&&direction>0)direction=-1;
 if(min===max)return {height:min,direction:0,occupied:!!occupied,lastTime:now};
 if(state.lastTime===null||!Number.isFinite(state.lastTime))return {...state,direction,occupied:!!occupied,lastTime:now};
 const fraction=Math.max(0,Math.min(1,(state.height-min)/(max-min)));
 // Recover time progress from the eased height, rather than easing an eased value again.
 const phase=Math.acos(1-2*fraction)/Math.PI,elapsed=Math.max(0,now-state.lastTime)/duration;
 let travel=direction>0?phase:2-phase;
 if(occupied){travel=Math.min(2,travel+elapsed);direction=-1;}
 else{travel=(travel+elapsed)%2;direction=travel<1?1:-1;}
 const height=min+(max-min)*(1-Math.cos(travel*Math.PI))/2;
 return {height,direction,occupied:!!occupied,lastTime:now};
}
function createPlayerController(env){
 const P=env.state;
 const {THREE,$,blocked,inside,walkable,canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord,FOLD_NAMES,clone,persist,toast,record,updateUI,buildPaper,renderPlayer,disposableClear,overlay,tileOutline,wx,wz,tileTop}=env;
 P.terrainState=createTerrainState();
function world(){return env.getEntityWorld?.();}
function syncLiftHeights(){const tree=world(),map=env.getMap();if(!tree)return false;let changed=false;
 for(const node of tree.serialize())if(node.components.lift){const state=tree.runtime(node.id,'lift'),height=Number(state.height??node.components.lift.initialHeight);for(const cell of tree.transforms.worldCells(node.transformId)){const tile=map.tiles[cell.r]?.[cell.c];if(tile&&Math.abs((tile.height??0)-height)>1e-9){tile.height=height;changed=true;}}}
 return changed;
}
function updateLifts(now){const tree=world(),map=env.getMap();if(!tree||P.mode!=='play')return false;let changed=false;
 for(const node of tree.serialize())if(node.components.lift){const config=node.components.lift,cells=tree.transforms.worldCells(node.transformId),occupied=cells.some(cell=>cell.r===P.player.r&&cell.c===P.player.c);let state=tree.runtime(node.id,'lift');if(state.lastTime===undefined||state.lastTime===null&&state.height===undefined)state=liftInitial(config);const next=advanceLift(state,config,now,occupied);tree.setRuntime(node.id,'lift',next);for(const cell of cells){const tile=map.tiles[cell.r]?.[cell.c];if(tile&&Math.abs((tile.height??0)-next.height)>1e-9){tile.height=next.height;changed=true;}}}
 if(changed){env.refreshLiftSurfaces?.();if(!P.animation)renderPlayer();
  if(!P.moving){const axis=P.chosenFold,selected=env.getSelectionRing().visible;if(axis)selectFold(axis.r,axis.c,axis.type);else if(selected)selectPlayer();}
 }return changed;
}
// Structural checks ignore temporary mechanisms such as the eruption cycle.
function structuralEntryCheck(r,c){
 if(!inside(r,c))return {valid:false,reason:'目标超出地图'};
 const nodes=world().at(r,c);
 if(!nodes.some(node=>Object.hasOwn(node.components,'surface')))return {valid:false,reason:'目标为空格'};
 if(nodes.some(node=>node.static.walkable===false||node.components.collision?.blocked))return {valid:false,reason:'目标是阻挡方块'};
 if(nodes.some(node=>Object.hasOwn(node.components,'campfire')))return {valid:false,reason:'篝火方块不可进入'};
 return {valid:true,reason:''};
}
function treeEvent(type,position,actor=P.terrainState,runtime=world().snapshotRuntime(),nodes=world().at(position.r,position.c)){
 return env.componentRegistry.dispatch({type,nodes,actor,runtime});
}
function entryCheck(r,c,ignoreHidden=false){const tree=world();if(!tree)return canEnterTerrain(env.getMap(),{r,c},P.terrainState);
 if(!inside(r,c)||(!ignoreHidden&&env.isHidden(r,c)))return {valid:false,reason:'目标为空格或未揭示区域'};
 const nodes=tree.at(r,c);if(!nodes.some(node=>Object.hasOwn(node.components,'surface')))return {valid:false,reason:'目标为空格'};
 if(nodes.some(node=>node.static.walkable===false))return {valid:false,reason:'目标是阻挡方块'};
 return treeEvent('enter',{r,c});
}
function canMoveTo(r,c){const map=env.getMap();const delta=(map.tiles[r]?.[c]?.height??.09)-(map.tiles[P.player.r]?.[P.player.c]?.height??.09);return (world()?true:walkable(r,c))&&delta<=P.moveHeight.maxUp+1e-9&&-delta<=P.moveHeight.maxDown+1e-9&&entryCheck(r,c).valid;}
function commitTreeEvent(type,position,nodes){const tree=world(),result=treeEvent(type,position,P.terrainState,tree.snapshotRuntime(),nodes);if(result.valid){P.terrainState={...result.actor,message:result.messages.join('；')};tree.restoreRuntime(result.runtime);}return result;}
function leaveTree(position){if(world())commitTreeEvent('leave',position);}
function enterTree(){P.terrainState={...P.terrainState,message:'',gameOver:false,won:false};commitTreeEvent('enter',P.player);if(P.terrainState.frozen&&!P.terrainState.gameOver){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if((dr||dc)&&world().at(P.player.r+dr,P.player.c+dc).some(node=>Object.hasOwn(node.components,'campfire'))){P.terrainState.frozen=false;P.terrainState.message='篝火解除冰冻';return;}}}}
function interact(){if(!world()||P.mode!=='play'||P.moving||P.levelWon||P.stepLimitHit)return;record();const result=commitTreeEvent('interact',P.player);if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);buildPaper();updateUI();checkRunEnd();return result;}
function setPlayerProperties({r,c,dir,maxUp,maxDown,overheat=P.terrainState.overheat,frozen=P.terrainState.frozen,actions=P.terrainState.actions,collectedKeys=P.terrainState.collectedKeys}) {
 if(P.mode!=='play'||P.moving)throw new Error('请在游玩模式且移动结束后修改玩家属性');
 if(!inside(r,c)||!Number.isInteger(dir)||dir<0||dir>7)throw new Error('玩家坐标或朝向无效');
 if(![maxUp,maxDown].every(n=>Number.isFinite(n)&&n>=0&&n<=16))throw new Error('可移动高度差须为 0–16');
 if(!Number.isSafeInteger(overheat)||overheat<0||!Number.isSafeInteger(actions)||actions<0||typeof frozen!=='boolean')throw new Error('过热与机制行动次数须为非负整数，冰冻须为布尔值');
 const keys=new Set(env.legalKeyNames?.(env.getMap(),world())??env.getMap().tiles.flat().filter(t=>t?.terrain==='key'&&!blocked(t)).map(t=>t.keyName?.trim()||'钥匙'));
 if(!Array.isArray(collectedKeys)||collectedKeys.some(k=>typeof k!=='string'||!keys.has(k)))throw new Error('已收集钥匙须为地图中合法钥匙名的 JSON 数组');
 const terrainState={...P.terrainState,overheat,frozen,actions,collectedKeys:[...new Set(collectedKeys)],hasKey:collectedKeys.length>0,eruptionOpen:actions>0&&actions%3===2};
 const tile=env.getMap().tiles[r]?.[c];if(!tile||(world()?!treeEvent('enter',{r,c},terrainState).valid:blocked(tile)||((r!==P.player.r||c!==P.player.c)&&!canEnterTerrain(env.getMap(),{r,c},terrainState).valid)))throw new Error('玩家坐标需要可通行实体');
 record();P.player={r,c,dir};P.moveHeight={maxUp,maxDown};P.terrainState=terrainState;P.revealedRegions.add(regionOf(tile));clearSelection();buildPaper();renderPlayer();updateUI();
}
function validateForPlay() {const map=env.getMap();
  let regionErrors=validateRegions(map);
  if(world()){
    const componentErrors=[];for(const node of world().serialize())try{env.componentRegistry.validate(node);}catch(error){componentErrors.push(error.message);}if(componentErrors.length)return {valid:false,errors:[...regionErrors,...componentErrors]};
    regionErrors=regionErrors.filter(error=>!error.startsWith('出口所需钥匙不存在或不可收集：'));
    const keys=new Set(env.legalKeyNames?.(map,world())??[]);
    if(!env.legalKeyNames)for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){
      const nodes=world().at(r,c);
      if(!nodes.some(node=>Object.hasOwn(node.components,'surface'))||nodes.some(node=>node.static.walkable===false||node.components.collision?.blocked||Object.hasOwn(node.components,'campfire')))continue;
      for(const node of nodes)if(Object.hasOwn(node.components,'key')&&(!Array.isArray(node.static.events)||node.static.events.includes('enter')))keys.add(String(node.components.key.name??'钥匙').trim());
    }
    for(const cell of taggedCells(map,'exitTo'))for(const key of cell.tile.tags.requiredKeys??[])if(!keys.has(key))regionErrors.push('出口所需钥匙不存在或不可收集：'+key);
    for(const cell of taggedCells(map,'entry')){const check=structuralEntryCheck(cell.r,cell.c);if(!check.valid)regionErrors.push('区域入口不可通行：'+regionOf(cell.tile)+'（'+check.reason+'）');}
  }
  const errors=[...validateTerrains(map),...new Set(regionErrors)];
  const start=map.tiles[map.spawn.r]?.[map.spawn.c];if(!start||(world()?!entryCheck(map.spawn.r,map.spawn.c,true).valid:blocked(start)||start.terrain==='campfire'))errors.push('玩家起点无效');
  if(map.exit&&!exitIsValid())errors.push('出口必须在可行走方块上');
  return {valid:errors.length===0,errors};
}
function exitIsValid() {const map=env.getMap();if(!map.exit||!inside(map.exit.r,map.exit.c)||!map.tiles[map.exit.r]?.[map.exit.c])return false;return world()?structuralEntryCheck(map.exit.r,map.exit.c).valid:walkable(map.exit.r,map.exit.c);}
function isAtExit() {const map=env.getMap(); return exitIsValid()&&P.player.r===map.exit.r&&P.player.c===map.exit.c; }
function foldTargetFor(axis,position=P.player) {const map=env.getMap();
  const t=reflectPoint(position.r,position.c,axis);const same=t.r===position.r&&t.c===position.c;let reason='';
  if(!inFoldRange(foldGroupAt(env.getFoldAxes(),axis.r,axis.c,axis.type),position))reason='超出折线作用半径';else if(!inside(t.r,t.c))reason='目标超出地图';else if(!map.tiles[t.r][t.c])reason='目标为空格';else if(!(world()?entryCheck(t.r,t.c).valid:walkable(t.r,t.c)))reason=world()?entryCheck(t.r,t.c).reason:'目标是阻挡方块';else if(same)reason='玩家位于对称轴上';else if(P.mode==='play')reason=entryCheck(t.r,t.c).reason;
  return {...t,valid:!reason,reason};
}
function finishRun(kind) {const map=env.getMap();
  if(kind==='win'){
    P.levelWon=true;P.stepLimitHit=false;
    if(map.bestSteps===null||P.steps<map.bestSteps){map.bestSteps=P.steps;persist();}
    $('resultTitle').textContent='通关！';
    $('resultDetail').textContent=`${map.name} · ${P.steps} 步${map.bestSteps===P.steps?' · 新纪录':''}`;
    toast(`通关！到达出口 ${coord(P.player.r,P.player.c)}`);
  } else if(kind==='terrain') {
    P.levelWon=false;P.stepLimitHit=true;
    $('resultTitle').textContent='挑战失败';
    $('resultDetail').textContent=P.terrainState.message;
    toast(P.terrainState.message,true);
  } else {
    P.levelWon=false;P.stepLimitHit=true;
    $('resultTitle').textContent='步数超限';
    $('resultDetail').textContent=`本关最多 ${map.maxSteps} 步，当前已用 ${P.steps} 步。`;
    toast('步数超限，请重试',true);
  }
  updateUI();
}
function checkRunEnd() {const map=env.getMap();
  if(P.mode!=='play'||P.levelWon||P.stepLimitHit)return;
  if(P.terrainState.gameOver){finishRun('terrain');return;}
  if(map.maxSteps>0&&P.steps>map.maxSteps){finishRun('limit');return;}
  if(isAtExit()){finishRun('win');return;}
}
function clearSelection(){const map=env.getMap();env.invalidateAxes();disposableClear(env.getEffectLayer());P.legalMoves=[];P.legalFoldMoves=[];P.chosenFold=null;env.getSelectionRing().visible=false;if($('foldTitle')){$('foldTitle').textContent='未选择折纸线';$('foldDetail').textContent='—';$('teleportBtn').disabled=true;}}
function selectPlayer(){const map=env.getMap();clearSelection();env.getSelectionRing().visible=true;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const r=P.player.r+dr,c=P.player.c+dc;if(canMoveTo(r,c)){P.legalMoves.push({r,c});overlay(r,c,'#bce772',.44);tileOutline(r,c,'#7a9b52');}}if(P.foldHints){const seen=new Set();for(const axis of env.getFoldAxes()){const target=foldTarget(axis),key=target.r+','+target.c;if(!target.valid||seen.has(key))continue;seen.add(key);P.legalFoldMoves.push({r:target.r,c:target.c,axis:{r:axis.r,c:axis.c,type:axis.type}});if(!P.legalMoves.some(p=>p.r===target.r&&p.c===target.c)){overlay(target.r,target.c,'#91d6c9',.4);tileOutline(target.r,target.c,'#4b967d');}}}$('toolStatus').textContent='玩家 '+coord(P.player.r,P.player.c);}
function reflectPoint(r,c,axis){const map=env.getMap();const dr=r-axis.r,dc=c-axis.c;if(axis.type==='h')return {r:axis.r-dr,c};if(axis.type==='v')return {r,c:axis.c-dc};if(axis.type==='d1')return {r:axis.r+dc,c:axis.c+dr};return {r:axis.r-dc,c:axis.c-dr};}
function foldTarget(axis){const map=env.getMap();return foldTargetFor(axis,P.player);}
function selectFold(r,c,preferredType=null){const map=env.getMap();const directions=foldsAt(map,r,c),previous=P.chosenFold;const index=previous?.r===r&&previous?.c===c?(directions.indexOf(previous.type)+1)%directions.length:0;clearSelection();P.chosenFold={r,c,type:preferredType??directions[index]};const t=foldTarget(P.chosenFold);overlay(r,c,'#e7ce67',.35);tileOutline(r,c,'#ac9456');
  const a=P.chosenFold;env.invalidateAxes();
  if(inside(t.r,t.c)){overlay(t.r,t.c,t.valid?'#91d6c9':'#de9b91',.4);tileOutline(t.r,t.c,t.valid?'#4b967d':'#b4594e');}
  $('foldTitle').textContent=coord(r,c)+' · '+FOLD_NAMES[a.type];$('foldDetail').textContent=t.valid?coord(P.player.r,P.player.c)+' → '+coord(t.r,t.c):t.reason;$('teleportBtn').disabled=!t.valid;$('toolStatus').textContent=t.valid?'再次点击 '+coord(t.r,t.c)+' 传送':t.reason;
}
function setFreeTeleport(enabled){P.freeTeleport=!!enabled;clearSelection();updateUI();}
function testTeleport(r,c){const map=env.getMap();if(P.mode!=='play'||!P.freeTeleport||P.moving||P.levelWon||P.stepLimitHit||!inside(r,c))return;const tile=map.tiles[r]?.[c];if(!tile||!(world()?entryCheck(r,c,true).valid:!blocked(tile)&&entryCheck(r,c).valid)){toast('测试传送需要可通行实体',true);return;}if(r===P.player.r&&c===P.player.c)return;record();const prev={...P.player};leaveTree(prev);P.revealedRegions.add(regionOf(tile));P.player={r,c,dir:P.player.dir};P.steps++;P.teleports++;applyTerrainEntry();clearSelection();buildPaper();animatePlayer(prev,P.player,'teleport');updateUI();}
function setFoldHints(enabled){P.foldHints=!!enabled;const axis=P.chosenFold,selected=env.getSelectionRing().visible;if(axis)selectFold(axis.r,axis.c,axis.type);else if(selected)selectPlayer();updateUI();}
function animatePlayer(from,to,type){const map=env.getMap();P.moving=true;P.animation={start:performance.now(),duration:type==='teleport'?480:220,fromCell:{...from},toCell:{...to},from:new THREE.Vector3(wx(from.c),tileTop(from.r,from.c)+.018,wz(from.r)),to:new THREE.Vector3(wx(to.c),tileTop(to.r,to.c)+.018,wz(to.r)),type,checkEnd:true};updateUI();}
function transitionRegion(){const map=env.getMap();const tile=map.tiles[P.player.r]?.[P.player.c],target=tile?.tags?.exitTo;if(!target)return false;const missing=(tile.tags.requiredKeys??[]).filter(k=>!P.terrainState.collectedKeys.includes(k));if(missing.length){P.terrainState.message='出口还需要钥匙：'+missing.join('、');return false;}const entry=taggedCells(map,'entry').find(p=>regionOf(p.tile)===target);if(!entry){P.terrainState.message='跳转区域缺少入口：'+target;return false;}const check=entryCheck(entry.r,entry.c,true);if(!check.valid){P.terrainState.message='无法进入区域：'+target+'（'+(check.reason||'入口不可通行')+'）';return false;}leaveTree(P.player);P.revealedRegions.add(target);P.player={r:entry.r,c:entry.c,dir:P.player.dir};buildPaper();toast('进入区域：'+target);return true;}
function collectKey(){if(world()){const nodes=world().at(P.player.r,P.player.c).filter(node=>Object.hasOwn(node.components,'key')&&node.static.walkable!==false&&!node.components.collision?.blocked).map(node=>({...node,components:{key:node.components.key}}));if(nodes.length)commitTreeEvent('enter',P.player,nodes);return;}const tile=env.getMap().tiles[P.player.r]?.[P.player.c];if(tile?.terrain!=='key'||blocked(tile))return;const name=tile.keyName?.trim()||'钥匙';P.terrainState.collectedKeys=[...new Set([...P.terrainState.collectedKeys,name])];P.terrainState.hasKey=true;P.terrainState.message='获得钥匙：'+name;}
function applyTerrainEntry(){const map=env.getMap();if(world()){enterTree();P.terrainState=finishAction(P.terrainState);const transitioned=!P.terrainState.gameOver&&transitionRegion();if(transitioned)enterTree();if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);return transitioned;}const result=enterTerrain(map,P.player,P.terrainState);P.terrainState=finishAction(result.state);collectKey();const transitioned=!P.terrainState.gameOver&&transitionRegion();if(transitioned){P.terrainState=enterTerrain(map,P.player,P.terrainState).state;collectKey();}if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);return transitioned;}
function movePlayer(r,c){const map=env.getMap();if(P.mode!=='play'||P.moving||P.levelWon||P.stepLimitHit)return;if(!P.legalMoves.some(t=>t.r===r&&t.c===c)||!canMoveTo(r,c)){toast(entryCheck(r,c).reason||(walkable(r,c)?'请先点击玩家查看可移动范围':'黑色或空格方块不可移动'),true);return;}record();const prev={...P.player},dr=r-P.player.r,dc=c-P.player.c;leaveTree(prev);P.player.r=r;P.player.c=c;P.player.dir=(Math.round(Math.atan2(dc,-dr)/(Math.PI/4))+8)%8;P.steps++;const transitioned=applyTerrainEntry();clearSelection();animatePlayer(prev,P.player,transitioned?'teleport':'move');updateUI();}
function teleport(axis=null){const map=env.getMap();if(P.mode!=='play'||P.moving||P.levelWon||P.stepLimitHit)return;if(!axis&&!P.chosenFold){toast('请先选择折纸线',true);return;}const chosen=axis??P.chosenFold;const t=foldTarget(chosen);if(!t.valid){toast(t.reason+'，无法传送',true);return;}record();const prev={...P.player},a={...chosen};leaveTree(prev);const forward=reflectPoint(P.player.r-Math.cos(P.player.dir*Math.PI/4),P.player.c+Math.sin(P.player.dir*Math.PI/4),a);const dr=forward.r-t.r,dc=forward.c-t.c;P.player={r:t.r,c:t.c,dir:(Math.round(Math.atan2(dc,-dr)/(Math.PI/4))+8)%8};P.steps++;P.teleports++;applyTerrainEntry();clearSelection();animatePlayer(prev,P.player,'teleport');updateUI();if(!P.terrainState.message)toast('折纸传送 · '+coord(prev.r,prev.c)+' → '+coord(t.r,t.c));}
function turn(delta){const map=env.getMap();if(P.moving)return;record();P.player.dir=(P.player.dir+delta+8)%8;if(P.mode==='edit'){map.spawn.dir=P.player.dir;persist();}renderPlayer();updateUI();}
function resetRegions(){const map=env.getMap();const spawn=taggedCells(map,'spawn')[0];if(spawn){map.spawn={r:spawn.r,c:spawn.c,dir:map.spawn.dir};P.revealedRegions=new Set([regionOf(spawn.tile)]);}else P.revealedRegions=new Set();}
function setMode(next){if(P.mode===next)return;if(next==='play'){const check=validateForPlay();if(!check.valid){toast(check.errors.join('；'),true);return;}}if(next==='edit')env.resetMapView?.();const map=env.getMap();env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();world()?.resetRuntime();env.getPlayerGroup().scale.setScalar(1);P.mode=next;if(next==='edit')P.freeTeleport=false;resetRegions();P.steps=0;P.teleports=0;P.playHistory=[];P.player={...map.spawn};P.moveHeight={maxUp:1,maxDown:1};if(P.mode==='play')collectKey();clearSelection();buildPaper();if(P.mode==='play'){updateLifts(performance.now());}renderPlayer();updateUI();if(P.mode==='play')checkRunEnd();}
function restart(){const map=env.getMap();if(P.moving)return;env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();world()?.resetRuntime();resetRegions();P.player={...map.spawn};P.moveHeight={maxUp:1,maxDown:1};P.steps=P.teleports=0;P.playHistory=[];collectKey();clearSelection();buildPaper();updateLifts(performance.now());renderPlayer();updateUI();toast('已回到玩家起点');checkRunEnd();}
function snapshot(){const map=env.getMap();return {player:{...P.player},moveHeight:{...P.moveHeight},steps:P.steps,teleports:P.teleports,terrainState:clone(P.terrainState),revealedRegions:[...P.revealedRegions],...(world()?{entityRuntime:world().snapshotRuntime()}:{})};}
function restore(previous){const map=env.getMap();if(world()){const matching={};for(const node of world().serialize()){const states=previous.entityRuntime?.[node.id];if(states){matching[node.id]={};for(const [id,state] of Object.entries(states))if(Object.hasOwn(node.components,id))matching[node.id][id]=state;}}for(const states of Object.values(matching))if(states.lift)states.lift.lastTime=null;world().restoreRuntime(matching);}P.player={...previous.player};P.moveHeight={...(previous.moveHeight??{maxUp:1,maxDown:1})};P.steps=previous.steps;P.teleports=previous.teleports;P.terrainState=clone(previous.terrainState);P.revealedRegions=new Set(previous.revealedRegions);P.levelWon=false;P.stepLimitHit=false;P.animation=null;P.moving=false;syncLiftHeights();clearSelection();buildPaper();renderPlayer();updateUI();checkRunEnd();}
function tick(now){const map=env.getMap();updateLifts(now);if(!P.animation)return;const animation=P.animation;if(animation.fromCell)animation.from.y=tileTop(animation.fromCell.r,animation.fromCell.c)+.018;if(animation.toCell)animation.to.y=tileTop(animation.toCell.r,animation.toCell.c)+.018;const t=Math.min(1,(now-P.animation.start)/P.animation.duration),smooth=t*t*(3-2*t);if(P.animation.type==='teleport'){if(t<.5){env.getPlayerGroup().position.copy(P.animation.from);env.getPlayerGroup().scale.setScalar(Math.max(.03,1-t*2));}else{env.getPlayerGroup().position.copy(P.animation.to);env.getPlayerGroup().scale.setScalar(Math.max(.03,(t-.5)*2));}}else env.getPlayerGroup().position.lerpVectors(P.animation.from,P.animation.to,smooth);env.getPlayerGroup().rotation.y=-P.player.dir*Math.PI/4;if(t>=1){P.animation=null;P.moving=false;env.getPlayerGroup().scale.setScalar(1);renderPlayer();checkRunEnd();click(P.player.r,P.player.c);updateUI();}}
function click(r,c){const map=env.getMap();if(P.mode!=='play'||P.moving||P.levelWon||P.stepLimitHit )return;if(P.freeTeleport&&(r!==P.player.r||c!==P.player.c)){testTeleport(r,c);return;}if(env.isHidden(r,c))return;if(P.chosenFold){const target=foldTarget(P.chosenFold);if(target.valid&&target.r===r&&target.c===c){teleport();return;}}if(r===P.player.r&&c===P.player.c){if(env.getSelectionRing().visible)clearSelection();else selectPlayer();return;}if(P.legalMoves.some(t=>t.r===r&&t.c===c)){movePlayer(r,c);return;}const foldMove=P.legalFoldMoves.find(t=>t.r===r&&t.c===c);if(foldMove){teleport(foldMove.axis);return;}if(foldsAt(map,r,c).length){selectFold(r,c);return;}if(P.legalMoves.length){toast(walkable(r,c)?'该方块不在可移动范围内':'黑色或空格方块不可移动',true);}else if(!walkable(r,c)){toast('黑色或空格方块不可移动',true);}clearSelection();}
function resetPosition(){P.player={...env.getMap().spawn};}
function resetProgress(){P.steps=P.teleports=0;P.playHistory=[];resetRegions();resetPosition();}
function recordPlay(){P.playHistory.push(snapshot());if(P.playHistory.length>150)P.playHistory.shift();}
function undo(){if(P.moving||P.mode!=='play')return;const previous=P.playHistory.pop();if(previous)restore(previous);}
return {setPlayerProperties,interact,setFreeTeleport,testTeleport,setFoldHints,recordPlay,undo,resetPosition,resetProgress,canMoveTo,validateForPlay,exitIsValid,isAtExit,foldTargetFor,finishRun,checkRunEnd,clearSelection,selectPlayer,reflectPoint,foldTarget,selectFold,animatePlayer,transitionRegion,applyTerrainEntry,movePlayer,teleport,turn,resetRegions,setMode,restart,snapshot,restore,tick,click,updateLifts};
}
module.exports={createPlayerState,createPlayerController,initialLiftState:liftInitial,advanceLift};
