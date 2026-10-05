// Player state and all gameplay interaction live here; rendering is supplied by the scene adapter.
function createPlayerState(spawn,mode='edit'){return {player:{...spawn},mode,steps:0,teleports:0,moving:false,levelWon:false,stepLimitHit:false,legalMoves:[],chosenFold:null,playHistory:[],animation:null,terrainState:null,revealedRegions:new Set()};}
function createPlayerController(env){
 const P=env.state;
 const {THREE,$,blocked,inside,walkable,canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord,FOLD_NAMES,clone,persist,toast,record,updateUI,buildPaper,renderPlayer,disposableClear,overlay,tileOutline,wx,wz,tileTop}=env;
 P.terrainState=createTerrainState();
function canMoveTo(r,c){const map=env.getMap();return walkable(r,c)&&canEnterTerrain(map,{r,c},P.terrainState).valid;}
function validateForPlay() {const map=env.getMap();
  const errors=[...validateTerrains(map),...validateRegions(map)];
  const start=map.tiles[map.spawn.r]?.[map.spawn.c];if(!start||blocked(start)||start.terrain==='campfire')errors.push('玩家起点无效');
  if(map.exit&&(!inside(map.exit.r,map.exit.c)||!map.tiles[map.exit.r][map.exit.c]||blocked(map.tiles[map.exit.r][map.exit.c])))errors.push('出口必须在可行走方块上');
  return {valid:errors.length===0,errors};
}
function exitIsValid() {const map=env.getMap(); return !!map.exit&&walkable(map.exit.r,map.exit.c); }
function isAtExit() {const map=env.getMap(); return exitIsValid()&&P.player.r===map.exit.r&&P.player.c===map.exit.c; }
function foldTargetFor(axis,position=P.player) {const map=env.getMap();
  const t=reflectPoint(position.r,position.c,axis);const same=t.r===position.r&&t.c===position.c;let reason='';
  if(!inFoldRange(foldGroupAt(env.getFoldAxes(),axis.r,axis.c,axis.type),position))reason='超出折线作用半径';else if(!inside(t.r,t.c))reason='目标超出地图';else if(!map.tiles[t.r][t.c])reason='目标为空格';else if(!walkable(t.r,t.c))reason='目标是阻挡方块';else if(same)reason='玩家位于对称轴上';else if(P.mode==='play')reason=canEnterTerrain(map,t,P.terrainState).reason;
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
function clearSelection(){const map=env.getMap();env.invalidateAxes();disposableClear(env.getEffectLayer());P.legalMoves=[];P.chosenFold=null;env.getSelectionRing().visible=false;if($('foldTitle')){$('foldTitle').textContent='未选择折纸线';$('foldDetail').textContent='—';$('teleportBtn').disabled=true;}}
function selectPlayer(){const map=env.getMap();clearSelection();env.getSelectionRing().visible=true;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const r=P.player.r+dr,c=P.player.c+dc;if(canMoveTo(r,c)){P.legalMoves.push({r,c});overlay(r,c,'#bce772',.44);tileOutline(r,c,'#7a9b52');}}$('toolStatus').textContent='玩家 '+coord(P.player.r,P.player.c);}
function reflectPoint(r,c,axis){const map=env.getMap();const dr=r-axis.r,dc=c-axis.c;if(axis.type==='h')return {r:axis.r-dr,c};if(axis.type==='v')return {r,c:axis.c-dc};if(axis.type==='d1')return {r:axis.r+dc,c:axis.c+dr};return {r:axis.r-dc,c:axis.c-dr};}
function foldTarget(axis){const map=env.getMap();return foldTargetFor(axis,P.player);}
function selectFold(r,c){const map=env.getMap();const directions=foldsAt(map,r,c),previous=P.chosenFold;const index=previous?.r===r&&previous?.c===c?(directions.indexOf(previous.type)+1)%directions.length:0;clearSelection();P.chosenFold={r,c,type:directions[index]};const t=foldTarget(P.chosenFold);overlay(r,c,'#e7ce67',.35);tileOutline(r,c,'#ac9456');
  const a=P.chosenFold;env.invalidateAxes();
  if(inside(t.r,t.c)){overlay(t.r,t.c,t.valid?'#91d6c9':'#de9b91',.4);tileOutline(t.r,t.c,t.valid?'#4b967d':'#b4594e');}
  $('foldTitle').textContent=coord(r,c)+' · '+FOLD_NAMES[a.type];$('foldDetail').textContent=t.valid?coord(P.player.r,P.player.c)+' → '+coord(t.r,t.c):t.reason;$('teleportBtn').disabled=!t.valid;$('toolStatus').textContent=t.valid?'再次点击 '+coord(t.r,t.c)+' 传送':t.reason;
}
function animatePlayer(from,to,type){const map=env.getMap();P.moving=true;P.animation={start:performance.now(),duration:type==='teleport'?480:220,from:new THREE.Vector3(wx(from.c),tileTop(from.r,from.c)+.018,wz(from.r)),to:new THREE.Vector3(wx(to.c),tileTop(to.r,to.c)+.018,wz(to.r)),type,checkEnd:true};updateUI();}
function transitionRegion(){const map=env.getMap();const tile=map.tiles[P.player.r]?.[P.player.c],target=tile?.tags?.exitTo;if(!target)return false;const missing=(tile.tags.requiredKeys??[]).filter(k=>!P.terrainState.collectedKeys.includes(k));if(missing.length){P.terrainState.message='出口还需要钥匙：'+missing.join('、');return false;}const entry=taggedCells(map,'entry').find(p=>regionOf(p.tile)===target);if(!entry)return false;P.revealedRegions.add(target);P.player={r:entry.r,c:entry.c,dir:P.player.dir};buildPaper();toast('进入区域：'+target);return true;}
function collectKey(){const tile=env.getMap().tiles[P.player.r]?.[P.player.c];if(tile?.terrain!=='key'||blocked(tile))return;const name=tile.keyName?.trim()||'钥匙';P.terrainState.collectedKeys=[...new Set([...P.terrainState.collectedKeys,name])];P.terrainState.hasKey=true;P.terrainState.message='获得钥匙：'+name;}
function applyTerrainEntry(){const map=env.getMap();const result=enterTerrain(map,P.player,P.terrainState);P.terrainState=finishAction(result.state);collectKey();const transitioned=!P.terrainState.gameOver&&transitionRegion();if(transitioned){P.terrainState=enterTerrain(map,P.player,P.terrainState).state;collectKey();}if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);return transitioned;}
function movePlayer(r,c){const map=env.getMap();if(P.mode!=='play'||P.moving||P.levelWon||P.stepLimitHit)return;if(!P.legalMoves.some(t=>t.r===r&&t.c===c)||!canMoveTo(r,c)){toast(canEnterTerrain(map,{r,c},P.terrainState).reason||(walkable(r,c)?'请先点击玩家查看可移动范围':'黑色或空格方块不可移动'),true);return;}record();const prev={...P.player},dr=r-P.player.r,dc=c-P.player.c;P.player.r=r;P.player.c=c;P.player.dir=(Math.round(Math.atan2(dc,-dr)/(Math.PI/4))+8)%8;P.steps++;const transitioned=applyTerrainEntry();clearSelection();animatePlayer(prev,P.player,transitioned?'teleport':'move');updateUI();}
function teleport(){const map=env.getMap();if(P.mode!=='play'||P.moving||P.levelWon||P.stepLimitHit)return;if(!P.chosenFold){toast('请先选择折纸线',true);return;}const t=foldTarget(P.chosenFold);if(!t.valid){toast(t.reason+'，无法传送',true);return;}record();const prev={...P.player},a={...P.chosenFold};const forward=reflectPoint(P.player.r-Math.cos(P.player.dir*Math.PI/4),P.player.c+Math.sin(P.player.dir*Math.PI/4),a);const dr=forward.r-t.r,dc=forward.c-t.c;P.player={r:t.r,c:t.c,dir:(Math.round(Math.atan2(dc,-dr)/(Math.PI/4))+8)%8};P.steps++;P.teleports++;applyTerrainEntry();clearSelection();animatePlayer(prev,P.player,'teleport');updateUI();if(!P.terrainState.message)toast('折纸传送 · '+coord(prev.r,prev.c)+' → '+coord(t.r,t.c));}
function turn(delta){const map=env.getMap();if(P.moving)return;record();P.player.dir=(P.player.dir+delta+8)%8;if(P.mode==='edit'){map.spawn.dir=P.player.dir;persist();}renderPlayer();updateUI();}
function resetRegions(){const map=env.getMap();const spawn=taggedCells(map,'spawn')[0];if(spawn){map.spawn={r:spawn.r,c:spawn.c,dir:map.spawn.dir};P.revealedRegions=new Set([regionOf(spawn.tile)]);}else P.revealedRegions=new Set();}
function setMode(next){const map=env.getMap();if(P.mode===next)return;if(next==='play'){const check=validateForPlay();if(!check.valid){toast(check.errors.join('；'),true);return;}}P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();env.getPlayerGroup().scale.setScalar(1);P.mode=next;resetRegions();P.steps=0;P.teleports=0;P.playHistory=[];P.player={...map.spawn};clearSelection();buildPaper();renderPlayer();updateUI();if(P.mode==='play')checkRunEnd();}
function restart(){const map=env.getMap();if(P.moving)return;P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();resetRegions();P.player={...map.spawn};P.steps=P.teleports=0;P.playHistory=[];clearSelection();buildPaper();renderPlayer();updateUI();toast('已回到玩家起点');checkRunEnd();}
function snapshot(){const map=env.getMap();return {player:{...P.player},steps:P.steps,teleports:P.teleports,terrainState:clone(P.terrainState),revealedRegions:[...P.revealedRegions]};}
function restore(previous){const map=env.getMap();P.player={...previous.player};P.steps=previous.steps;P.teleports=previous.teleports;P.terrainState=clone(previous.terrainState);P.revealedRegions=new Set(previous.revealedRegions);P.levelWon=false;P.stepLimitHit=false;P.animation=null;P.moving=false;clearSelection();buildPaper();renderPlayer();updateUI();checkRunEnd();}
function tick(now){const map=env.getMap();if(!P.animation)return;const t=Math.min(1,(now-P.animation.start)/P.animation.duration),smooth=t*t*(3-2*t);if(P.animation.type==='teleport'){if(t<.5){env.getPlayerGroup().position.copy(P.animation.from);env.getPlayerGroup().scale.setScalar(Math.max(.03,1-t*2));}else{env.getPlayerGroup().position.copy(P.animation.to);env.getPlayerGroup().scale.setScalar(Math.max(.03,(t-.5)*2));}}else env.getPlayerGroup().position.lerpVectors(P.animation.from,P.animation.to,smooth);env.getPlayerGroup().rotation.y=-P.player.dir*Math.PI/4;if(t>=1){P.animation=null;P.moving=false;env.getPlayerGroup().scale.setScalar(1);renderPlayer();updateUI();checkRunEnd();}}
function click(r,c){const map=env.getMap();if(P.mode!=='play'||P.moving||P.levelWon||P.stepLimitHit||env.isHidden(r,c))return;if(P.chosenFold){const target=foldTarget(P.chosenFold);if(target.valid&&target.r===r&&target.c===c){teleport();return;}}if(r===P.player.r&&c===P.player.c){selectPlayer();return;}if(P.legalMoves.some(t=>t.r===r&&t.c===c)){movePlayer(r,c);return;}if(foldsAt(map,r,c).length){selectFold(r,c);return;}if(P.legalMoves.length){toast(walkable(r,c)?'该方块不在可移动范围内':'黑色或空格方块不可移动',true);}else if(!walkable(r,c)){toast('黑色或空格方块不可移动',true);}clearSelection();}
function resetPosition(){P.player={...env.getMap().spawn};}
function resetProgress(){P.steps=P.teleports=0;P.playHistory=[];resetRegions();resetPosition();}
function recordPlay(){P.playHistory.push(snapshot());if(P.playHistory.length>150)P.playHistory.shift();}
function undo(){if(P.moving||P.mode!=='play')return;const previous=P.playHistory.pop();if(previous)restore(previous);}
return {recordPlay,undo,resetPosition,resetProgress,canMoveTo,validateForPlay,exitIsValid,isAtExit,foldTargetFor,finishRun,checkRunEnd,clearSelection,selectPlayer,reflectPoint,foldTarget,selectFold,animatePlayer,transitionRegion,applyTerrainEntry,movePlayer,teleport,turn,resetRegions,setMode,restart,snapshot,restore,tick,click};
}
module.exports={createPlayerState,createPlayerController};
