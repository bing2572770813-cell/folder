const defaultPlayerPrefab=require('../assets/prefab/entity/player_ai.json');
function playerPrefabDefaults(prefab = defaultPlayerPrefab) {
  if (
    prefab.id !== "player_ai" ||
    prefab.behavior?.scriptId !== "player-controller" ||
    prefab.tile?.kind !== "player-token"
  )
    throw new Error(
      "player prefab 必须引用 player-controller 与 player-token 外观",
    );
  const moveHeight = prefab.behavior.parameters?.moveHeight,
    state = prefab.behavior.state;
  if (
    !moveHeight ||
    ![moveHeight.maxUp, moveHeight.maxDown].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 16,
    )
  )
    throw new Error("player prefab 可移动高度差须为 0–16");
  if (
    !state ||
    !Number.isSafeInteger(state.overheat) ||
    state.overheat < 0 ||
    !Number.isSafeInteger(state.actions) ||
    state.actions < 0 ||
    typeof state.frozen !== "boolean" ||
    !Array.isArray(state.collectedKeys) ||
    state.collectedKeys.some((k) => typeof k !== "string" || !k.trim())
  )
    throw new Error("player prefab 初始机制状态无效");
  const foldDrop = {
    vertical: 1,
    horizontal: 0.35,
    ...prefab.behavior.parameters?.foldDrop,
  };
  if (
    ![foldDrop.vertical, foldDrop.horizontal].every(
      (n) => Number.isFinite(n) && n > 0 && n <= 16,
    )
  )
    throw new Error("折纸落点阈值须大于 0 且不超过 16");
  return {
    foldDrop,
    moveHeight: { maxUp: moveHeight.maxUp, maxDown: moveHeight.maxDown },
    terrainState: {
      overheat: state.overheat,
      frozen: state.frozen,
      actions: state.actions,
      collectedKeys: [...new Set(state.collectedKeys)],
      hasKey: state.collectedKeys.length > 0,
      eruptionOpen: state.actions > 0 && state.actions % 3 === 2,
    },
  };
}
// Player state and all gameplay interaction live here; rendering is supplied by the scene adapter.
const Trigger=Object.freeze({Walk:'walk',Teleport:'teleport'});
const TurnPhase=Object.freeze({Idle:'idle',Validate:'validate',Snapshot:'snapshot',Leave:'leave',Action:'action',Enter:'enter',Settle:'settle',Outcome:'outcome',Present:'present',Complete:'complete'});
function initialTurn(){return {number:0,phase:TurnPhase.Idle,trigger:null,source:null,outcome:null};}

/** Synchronous simulation followed by explicitly acknowledged presentation. */
function createTurnManager(hooks){
 const state=hooks.state;state.turn??=initialTurn();
 let executing=false,serial=0,pending=null;
 function phase(value){state.turn={...state.turn,phase:value};hooks.onPhase?.(structuredClone(state.turn));}
 function execute(input){
  if(!input||!Object.values(Trigger).includes(input.trigger))throw new Error('Unknown turn trigger');
  if(executing||pending!==null||!hooks.canExecute())return false;
  const previous=structuredClone(state.turn),context={action:structuredClone(input),id:++serial};
  let captured;
  executing=true;
  try{
   state.turn={number:previous.number+1,phase:TurnPhase.Validate,trigger:input.trigger,source:input.source??null,outcome:null};
   phase(TurnPhase.Validate);
   if(!hooks.validate(context.action)){state.turn=previous;return false;}
   // Capture the completed prior turn, never an in-progress lifecycle phase.
   state.turn=previous;captured=hooks.snapshot();hooks.record();
   state.turn={number:previous.number+1,phase:TurnPhase.Snapshot,trigger:input.trigger,source:input.source??null,outcome:null};
   phase(TurnPhase.Snapshot);
   for(const [value,hook] of [[TurnPhase.Leave,'leave'],[TurnPhase.Action,'act'],[TurnPhase.Enter,'enter'],[TurnPhase.Settle,'settle']]){
    phase(value);hooks[hook](context);
   }
   phase(TurnPhase.Outcome);state.turn.outcome=hooks.outcome(context)??null;
   pending=context.id;phase(TurnPhase.Present);hooks.present(context);
   return true;
  }catch(error){
   pending=null;state.turn=previous;
   if(captured!==undefined)hooks.restore(captured);
   throw error;
  }finally{executing=false;}
 }
 function complete(id){if(executing||pending===null||id!==pending)return false;pending=null;phase(TurnPhase.Complete);return true;}
 function reset(turn=initialTurn()){pending=null;state.turn=structuredClone(turn);}
 return Object.freeze({execute,complete,reset});
}
function createPlayerState(spawn, mode = "edit") {
  return {
    player: { ...spawn },
    prefabId: defaultPlayerPrefab.id,
    moveHeight: playerPrefabDefaults().moveHeight,
    foldDrop: playerPrefabDefaults().foldDrop,
    foldMotion: null,
    mode,
    steps: 0,
    teleports: 0,
    moving: false,
    levelWon: false,
    stepLimitHit: false,
    legalMoves: [],
    legalFoldMoves: [],
    chosenFold: null,
    foldHints: true,
    freeTeleport: false,
    playHistory: [],
    animation: null,
    terrainState: null,turn:initialTurn(),
    revealedRegions: new Set(),
  };
}
function liftInitial(config){return {height:Number(config.initialHeight),direction:Number(config.maxHeight)>Number(config.minHeight)?1:0,occupied:false};}
function advanceLift(state,config,occupied=state.occupied){
 const min=Number(config.minHeight),max=Number(config.maxHeight),step=(max-min)/Number(config.turnsPerLeg??3);
 if(min===max)return {height:min,direction:0,occupied:!!occupied};
 let direction=state.direction||1;
 if(occupied)direction=-1;else if(state.height<=min+1e-9)direction=1;else if(state.height>=max-1e-9)direction=-1;
 let height=Math.max(min,Math.min(max,state.height+direction*step));
 if(height>=max-1e-9){height=max;direction=-1;}else if(height<=min+1e-9){height=min;direction=occupied?-1:1;}
 return {height,direction,occupied:!!occupied};
}
function createPlayerController(env){
 const P=env.state;
 const {THREE,$,blocked,inside,walkable,canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord,FOLD_NAMES,clone,persist,toast,record,updateUI,buildPaper,renderPlayer,disposableClear,overlay,tileOutline,wx,wz,tileTop}=env;
 P.terrainState=createTerrainState();
function resetPrefabState() {
    const defaults = playerPrefabDefaults(
      env.getPlayerPrefab?.() ?? defaultPlayerPrefab,
    );
    P.moveHeight = defaults.moveHeight;
    P.foldDrop = defaults.foldDrop;
    P.terrainState = { ...createTerrainState(), ...defaults.terrainState };
  }
 resetPrefabState();
function world(){return env.getEntityWorld?.();}
function syncLiftHeights(){const tree=world(),map=env.getMap();if(!tree)return false;let changed=false;
 for(const node of tree.serialize())if(node.components.lift){const state=tree.runtime(node.id,'lift'),height=Number(state.height??node.components.lift.initialHeight);for(const cell of tree.transforms.worldCells(node.transformId)){const tile=map.tiles[cell.r]?.[cell.c];if(tile&&Math.abs((tile.height??0)-height)>1e-9){tile.height=height;changed=true;}}}
 return changed;
}
function updateLifts(advance=false){const tree=world(),map=env.getMap();if(!tree||P.mode!=='play')return false;let changed=false;
 for(const node of tree.serialize())if(node.components.lift){const config=node.components.lift,cells=tree.transforms.worldCells(node.transformId),occupied=cells.some(cell=>cell.r===P.player.r&&cell.c===P.player.c);
  let state=tree.runtime(node.id,'lift');if(state.height===undefined)state=liftInitial(config);
  const next=advance?advanceLift(state,config,occupied):{...state,occupied,direction:occupied&&state.direction>0?-1:state.direction};tree.setRuntime(node.id,'lift',next);
  for(const cell of cells){const tile=map.tiles[cell.r]?.[cell.c];if(tile&&Math.abs((tile.height??0)-next.height)>1e-9){tile.height=next.height;changed=true;}}
 }
 if(changed){env.refreshLiftSurfaces?.();if(!P.animation)renderPlayer();}
 return changed;
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
function treeEvent(type,position,actor=P.terrainState,runtime=world().snapshotRuntime(),nodes=world().at(position.r,position.c),trigger){
 return env.componentRegistry.dispatch({type,trigger,nodes,actor,runtime});
}
function treeEntryCheck(position,actor=P.terrainState,trigger){
 return env.componentRegistry.checkEntry({trigger,nodes:world().at(position.r,position.c),actor,runtime:world().snapshotRuntime()});
}
function entryCheck(r,c,ignoreHidden=false,trigger){const tree=world();if(!tree)return canEnterTerrain(env.getMap(),{r,c},P.terrainState);
 if(!inside(r,c)||(!ignoreHidden&&env.isHidden(r,c)))return {valid:false,reason:'目标为空格或未揭示区域'};
 const nodes=tree.at(r,c);if(!nodes.some(node=>Object.hasOwn(node.components,'surface')))return {valid:false,reason:'目标为空格'};
 if(nodes.some(node=>node.static.walkable===false))return {valid:false,reason:'目标是阻挡方块'};
 return treeEntryCheck({r,c},P.terrainState,trigger);
}
function canFoldCell(r,c){return env.canFoldCell?.(r,c)??(env.getMap().tiles[r]?.[c]?.followFold!==false);}
function canMoveTo(r,c){const map=env.getMap();const delta=(map.tiles[r]?.[c]?.height??.09)-(map.tiles[P.player.r]?.[P.player.c]?.height??.09);return (world()?true:walkable(r,c))&&delta<=P.moveHeight.maxUp+1e-9&&-delta<=P.moveHeight.maxDown+1e-9&&entryCheck(r,c,false,Trigger.Walk).valid;}
function commitTreeEvent(type,position,nodes,trigger){const tree=world(),result=treeEvent(type,position,P.terrainState,tree.snapshotRuntime(),nodes,trigger);if(result.valid){P.terrainState={...result.actor,message:result.messages.join('；')};tree.restoreRuntime(result.runtime);}return result;}
function leaveTree(position,trigger){if(world())commitTreeEvent('leave',position,undefined,trigger);}
function enterTree(trigger){P.terrainState={...P.terrainState,message:'',gameOver:false,won:false};const result=commitTreeEvent('enter',P.player,undefined,trigger);if(!result.valid)throw new Error(result.reason||'目标不可进入');if(P.terrainState.frozen&&!P.terrainState.gameOver){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if((dr||dc)&&world().at(P.player.r+dr,P.player.c+dc).some(node=>Object.hasOwn(node.components,'campfire'))){P.terrainState.frozen=false;P.terrainState.message='篝火解除冰冻';return;}}}}
function interact(){if(!world()||P.mode!=='play'||P.moving||P.foldMotion||P.levelWon||P.stepLimitHit)return;record();const result=commitTreeEvent('interact',P.player);if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);buildPaper();updateUI();checkRunEnd();return result;}
function setPlayerProperties({r,c,dir,maxUp,maxDown,foldVertical=P.foldDrop.vertical,foldHorizontal=P.foldDrop.horizontal,overheat=P.terrainState.overheat,frozen=P.terrainState.frozen,actions=P.terrainState.actions,collectedKeys=P.terrainState.collectedKeys}) {
 if(P.mode!=='play'||P.moving||P.foldMotion)throw new Error('请在游玩模式且移动结束后修改玩家属性');
 if(!inside(r,c)||!Number.isInteger(dir)||dir<0||dir>7)throw new Error('玩家坐标或朝向无效');
 if(![maxUp,maxDown].every(n=>Number.isFinite(n)&&n>=0&&n<=16))throw new Error('可移动高度差须为 0–16');
 if(!Number.isSafeInteger(overheat)||overheat<0||!Number.isSafeInteger(actions)||actions<0||typeof frozen!=='boolean')throw new Error('过热与机制行动次数须为非负整数，冰冻须为布尔值');
 const keys=new Set(env.legalKeyNames?.(env.getMap(),world())??env.getMap().tiles.flat().filter(t=>t?.terrain==='key'&&!blocked(t)).map(t=>t.keyName?.trim()||'钥匙'));
 if(!Array.isArray(collectedKeys)||collectedKeys.some(k=>typeof k!=='string'||!keys.has(k)))throw new Error('已收集钥匙须为地图中合法钥匙名的 JSON 数组');
 const terrainState={...P.terrainState,overheat,frozen,actions,collectedKeys:[...new Set(collectedKeys)],hasKey:collectedKeys.length>0,eruptionOpen:actions>0&&actions%3===2};
 if(![foldVertical,foldHorizontal].every(n=>Number.isFinite(n)&&n>0&&n<=16))throw new Error('折纸落点阈值须大于 0 且不超过 16');
 const tile=env.getMap().tiles[r]?.[c];if(!tile||(world()?!treeEntryCheck({r,c},terrainState).valid:blocked(tile)||((r!==P.player.r||c!==P.player.c)&&!canEnterTerrain(env.getMap(),{r,c},terrainState).valid)))throw new Error('玩家坐标需要可通行实体');
 record();P.player={r,c,dir};P.moveHeight={maxUp,maxDown};P.foldDrop={vertical:foldVertical,horizontal:foldHorizontal};P.terrainState=terrainState;P.revealedRegions.add(regionOf(tile));clearSelection();buildPaper();renderPlayer();updateUI();
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
  if(!inFoldRange(foldGroupAt(env.getFoldAxes(),axis.r,axis.c,axis.type),position))reason='超出折线作用半径';else if(!inside(t.r,t.c))reason='目标超出地图';else if(!map.tiles[t.r][t.c])reason='目标为空格';else if(!(world()?entryCheck(t.r,t.c,false,Trigger.Teleport).valid:walkable(t.r,t.c)))reason=world()?entryCheck(t.r,t.c,false,Trigger.Teleport).reason:'目标是阻挡方块';else if(same)reason='玩家位于对称轴上';else if(P.mode==='play')reason=entryCheck(t.r,t.c,false,Trigger.Teleport).reason;
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
function clearSelection() {
    cancelFoldMotion();
    const map = env.getMap();
    env.invalidateAxes();
    disposableClear(env.getEffectLayer());
    P.legalMoves = [];
    P.legalFoldMoves = [];
    P.chosenFold = null;
    env.getSelectionRing().visible = false;
    if ($("foldTitle")) {
      $("foldTitle").textContent = "未选择折纸线";
      $("foldDetail").textContent = "—";
      $("teleportBtn").disabled = true;
    }
    env.onSelectionChanged?.();
  }
function selectPlayer(){const map=env.getMap();clearSelection();env.getSelectionRing().visible=true;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const r=P.player.r+dr,c=P.player.c+dc;if(canMoveTo(r,c)){P.legalMoves.push({r,c});overlay(r,c,'#bce772',.44);tileOutline(r,c,'#7a9b52');}}if(P.foldHints){const seen=new Set();for(const axis of env.getFoldAxes()){const target=foldTarget(axis),key=target.r+','+target.c;if(!target.valid||seen.has(key))continue;seen.add(key);P.legalFoldMoves.push({r:target.r,c:target.c,axis:{r:axis.r,c:axis.c,type:axis.type}});if(!P.legalMoves.some(p=>p.r===target.r&&p.c===target.c)){overlay(target.r,target.c,'#91d6c9',.4);tileOutline(target.r,target.c,'#4b967d');}}}$('toolStatus').textContent='玩家 '+coord(P.player.r,P.player.c);}
function reflectPoint(r,c,axis){const map=env.getMap();const dr=r-axis.r,dc=c-axis.c;if(axis.type==='h')return {r:axis.r-dr,c};if(axis.type==='v')return {r,c:axis.c-dc};if(axis.type==='d1')return {r:axis.r+dc,c:axis.c+dr};return {r:axis.r-dc,c:axis.c-dr};}
function foldTarget(axis){const map=env.getMap();return foldTargetFor(axis,P.player);}
function selectFold(r,c,preferredType=null){const map=env.getMap();const directions=foldsAt(map,r,c),previous=P.chosenFold;const index=previous?.r===r&&previous?.c===c?(directions.indexOf(previous.type)+1)%directions.length:0;clearSelection();P.chosenFold={r,c,type:preferredType??directions[index]};const t=foldTarget(P.chosenFold);overlay(r,c,'#e7ce67',.35);tileOutline(r,c,'#ac9456');
  const a=P.chosenFold;env.invalidateAxes();
  if(inside(t.r,t.c)){overlay(t.r,t.c,t.valid?'#91d6c9':'#de9b91',.4);tileOutline(t.r,t.c,t.valid?'#4b967d':'#b4594e');}
  $('foldTitle').textContent=coord(r,c)+' · '+FOLD_NAMES[a.type];$('foldDetail').textContent=t.valid?coord(P.player.r,P.player.c)+' → '+coord(t.r,t.c):t.reason;$('teleportBtn').disabled=!t.valid;$('toolStatus').textContent=t.valid?'再次点击 '+coord(t.r,t.c)+' 掉落':t.reason;
  env.onSelectionChanged?.();
}
// The preview uses the same radius and player-side partition as physical folds.
// Target tint describes geometry; the existing landing gate still decides drops.
function foldHighlightRegions(axis=P.chosenFold){
  const source=[],target=[],map=env.getMap();
  const group=axis&&foldGroupAt(env.getFoldAxes(),axis.r,axis.c,axis.type);
  if(!group||!inFoldRange(group,P.player))return {source,target};
  const d=group.type==='h'?{r:0,c:1}:group.type==='v'?{r:1,c:0}:group.type==='d1'?{r:1,c:1}:{r:1,c:-1};
  const side=p=>(p.c-group.center.c)*d.r-(p.r-group.center.r)*d.c;
  const playerSide=Math.sign(side(P.player));
  if(!playerSide)return {source,target};
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){
    const p={r,c};if(!map.tiles[r][c]||env.isHidden(r,c)||!inFoldRange(group,p))continue;
    const s=side(p)*playerSide;
    if(s>0&&canFoldCell(r,c))source.push(p);else if(s<0)target.push(p);
    else if(group.cells.some(q=>q.r===r&&q.c===c)){
      if(canFoldCell(r,c))source.push({...p,half:playerSide});target.push({...p,half:-playerSide});
    }
  }
  return {source,target};
}
function setFreeTeleport(enabled){P.freeTeleport=!!enabled;clearSelection();updateUI();}
function testTeleport(r,c){return turnManager.execute({trigger:Trigger.Teleport,source:'test',r,c});}
function setFoldHints(enabled){P.foldHints=!!enabled;const axis=P.chosenFold,selected=env.getSelectionRing().visible;if(axis)selectFold(axis.r,axis.c,axis.type);else if(selected)selectPlayer();updateUI();}
function animatePlayer(from,to,type,turnId){const map=env.getMap();P.moving=true;P.animation={start:performance.now(),duration:type==='teleport'?480:220,fromCell:{...from},toCell:{...to},from:new THREE.Vector3(wx(from.c),tileTop(from.r,from.c)+.018,wz(from.r)),to:new THREE.Vector3(wx(to.c),tileTop(to.r,to.c)+.018,wz(to.r)),type,turnId,checkEnd:true};updateUI();}
function transitionRegion(){const map=env.getMap();const tile=map.tiles[P.player.r]?.[P.player.c],target=tile?.tags?.exitTo;if(!target)return false;const missing=(tile.tags.requiredKeys??[]).filter(k=>!P.terrainState.collectedKeys.includes(k));if(missing.length){P.terrainState.message='出口还需要钥匙：'+missing.join('、');return false;}const entry=taggedCells(map,'entry').find(p=>regionOf(p.tile)===target);if(!entry){P.revealedRegions.add(target);buildPaper();toast('显示区域：'+target);return false;}const check=entryCheck(entry.r,entry.c,true,Trigger.Teleport);if(!check.valid){P.terrainState.message='无法进入区域：'+target+'（'+(check.reason||'入口不可通行')+'）';return false;}leaveTree(P.player,Trigger.Teleport);P.revealedRegions.add(target);P.player={r:entry.r,c:entry.c,dir:P.player.dir};buildPaper();toast('进入区域：'+target);return true;}
function collectKey(){if(world()){const nodes=world().at(P.player.r,P.player.c).filter(node=>Object.hasOwn(node.components,'key')&&node.static.walkable!==false&&!node.components.collision?.blocked).map(node=>({...node,components:{key:node.components.key}}));if(nodes.length)commitTreeEvent('enter',P.player,nodes);return;}const tile=env.getMap().tiles[P.player.r]?.[P.player.c];if(tile?.terrain!=='key'||blocked(tile))return;const name=tile.keyName?.trim()||'钥匙';P.terrainState.collectedKeys=[...new Set([...P.terrainState.collectedKeys,name])];P.terrainState.hasKey=true;P.terrainState.message='获得钥匙：'+name;}
function arrive(trigger){
 if(world())enterTree(trigger);
 else{P.terrainState=enterTerrain(env.getMap(),P.player,P.terrainState).state;collectKey();}
}
function settleAction(){
 P.terrainState=finishAction(P.terrainState);
 const transitioned=!P.terrainState.gameOver&&transitionRegion();
 if(transitioned)arrive(Trigger.Teleport);
 if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);
 updateLifts(true);return transitioned;
}
// Compatibility helper for direct terrain simulations; gameplay uses turnManager.
function applyTerrainEntry(trigger=Trigger.Walk){arrive(trigger);return settleAction();}
function validateAction(action){
 const {r,c,source,trigger}=action;
 if(source==='move'&&trigger===Trigger.Walk){
  if(!P.legalMoves.some(t=>t.r===r&&t.c===c)||!canMoveTo(r,c)){
   toast(entryCheck(r,c,false,Trigger.Walk).reason||(walkable(r,c)?'请先点击玩家查看可移动范围':'黑色或空格方块不可移动'),true);return false;
  }
  action.to={r,c,dir:(Math.round(Math.atan2(c-P.player.c,P.player.r-r)/(Math.PI/4))+8)%8};
 }else if(source==='fold'&&trigger===Trigger.Teleport){
  const axis=action.axis??P.chosenFold;if(!axis){toast('请先选择折纸线',true);return false;}
  const t=foldTarget(axis);if(!t.valid){toast(t.reason+'，无法掉落',true);return false;}
  const forward=reflectPoint(P.player.r-Math.cos(P.player.dir*Math.PI/4),P.player.c+Math.sin(P.player.dir*Math.PI/4),axis);
  action.to={r:t.r,c:t.c,dir:(Math.round(Math.atan2(forward.c-t.c,t.r-forward.r)/(Math.PI/4))+8)%8};
 }else if(source==='test'&&trigger===Trigger.Teleport){
  if(!P.freeTeleport||!inside(r,c)||(r===P.player.r&&c===P.player.c))return false;
  const tile=env.getMap().tiles[r]?.[c];
  if(!tile||(!world()&&blocked(tile))||!entryCheck(r,c,true,Trigger.Teleport).valid){toast('测试传送需要可通行实体',true);return false;}
  action.to={r,c,dir:P.player.dir};
 }else return false;
 return true;
}
const turnManager=createTurnManager({
 state:P,canExecute:()=>P.mode==='play'&&!P.moving&&!P.foldMotion&&!P.levelWon&&!P.stepLimitHit,
 validate:validateAction,
 snapshot:()=>({game:snapshot(),history:[...P.playHistory]}),record,
 restore:previous=>{P.playHistory=previous.history;restore(previous.game);},
 leave:context=>{P.moving=true;context.from={...P.player};leaveTree(context.from,context.action.trigger);},
 act:context=>{
  const {to,trigger,source}=context.action;
  P.player={...to};P.steps++;if(trigger===Trigger.Teleport)P.teleports++;
  if(source==='test')P.revealedRegions.add(regionOf(env.getMap().tiles[to.r][to.c]));
 },
 enter:context=>arrive(context.action.trigger),
 settle:context=>{context.transitioned=settleAction();},
 outcome:()=>{checkRunEnd();return P.levelWon?'win':P.stepLimitHit?(P.terrainState.gameOver?'terrain':'limit'):null;},
 present:context=>{
  clearSelection();if(context.action.source==='test')buildPaper();
  animatePlayer(context.from,P.player,context.action.trigger===Trigger.Teleport||context.transitioned?'teleport':'move',context.id);
  if(context.action.dropFrom&&!context.transitioned){P.animation.type='drop';P.animation.from.fromArray(context.action.dropFrom);P.animation.duration=350;env.getPlayerGroup().position.copy(P.animation.from);}
  updateUI();if(context.action.source==='fold'&&!P.terrainState.message)toast('掉落 · '+coord(context.from.r,context.from.c)+' → '+coord(context.action.to.r,context.action.to.c));
 },
 onPhase:turn=>env.onTurnPhase?.(turn),
});
function movePlayer(r,c){return turnManager.execute({trigger:Trigger.Walk,source:'move',r,c});}
function teleport(axis=null){return turnManager.execute({trigger:Trigger.Teleport,source:'fold',axis});}
function turn(delta){const map=env.getMap();if(P.moving||P.foldMotion)return;record();P.player.dir=(P.player.dir+delta+8)%8;if(P.mode==='edit'){map.spawn.dir=P.player.dir;persist();}renderPlayer();updateUI();}
function resetRegions(){const map=env.getMap();const spawn=taggedCells(map,'spawn')[0];if(spawn){map.spawn={r:spawn.r,c:spawn.c,dir:map.spawn.dir};P.revealedRegions=new Set([regionOf(spawn.tile)]);}else P.revealedRegions=new Set();}
function setMode(next){cancelFoldMotion();if(P.mode===next)return;if(next==='play'){const check=validateForPlay();if(!check.valid){toast(check.errors.join('；'),true);return;}}if(next==='edit')env.resetMapView?.();const map=env.getMap();env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();turnManager.reset();world()?.resetRuntime();env.getPlayerGroup().scale.setScalar(1);P.mode=next;if(next==='edit')P.freeTeleport=false;resetRegions();P.steps=0;P.teleports=0;P.playHistory=[];P.player={...map.spawn};resetPrefabState();if(P.mode==='play')collectKey();clearSelection();buildPaper();if(P.mode==='play'){updateLifts();}renderPlayer();updateUI();if(P.mode==='play')checkRunEnd();}
function restart(){cancelFoldMotion();const map=env.getMap();if(P.moving)return;env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();turnManager.reset();world()?.resetRuntime();resetRegions();P.player={...map.spawn};resetPrefabState();P.steps=P.teleports=0;P.playHistory=[];collectKey();clearSelection();buildPaper();updateLifts();renderPlayer();updateUI();toast('已回到玩家起点');checkRunEnd();}
function snapshot(){const map=env.getMap();return {player:{...P.player},moveHeight:{...P.moveHeight},foldDrop:{...P.foldDrop},steps:P.steps,teleports:P.teleports,turn:clone(P.turn),terrainState:clone(P.terrainState),revealedRegions:[...P.revealedRegions],...(world()?{entityRuntime:world().snapshotRuntime()}:{})};}
function restore(previous){cancelFoldMotion();const map=env.getMap();if(world()){const matching={};for(const node of world().serialize()){const states=previous.entityRuntime?.[node.id];if(states){matching[node.id]={};for(const [id,state] of Object.entries(states))if(Object.hasOwn(node.components,id))matching[node.id][id]=state;}}world().restoreRuntime(matching);}P.player={...previous.player};P.moveHeight={...(previous.moveHeight??{maxUp:1,maxDown:1})};P.foldDrop={...(previous.foldDrop??playerPrefabDefaults().foldDrop)};P.steps=previous.steps;P.teleports=previous.teleports;P.terrainState=clone(previous.terrainState);P.revealedRegions=new Set(previous.revealedRegions);P.levelWon=false;P.stepLimitHit=false;P.animation=null;P.moving=false;turnManager.reset(previous.turn??initialTurn());env.getPlayerGroup().scale.setScalar(1);syncLiftHeights();clearSelection();buildPaper();renderPlayer();updateUI();checkRunEnd();}
function cancelFoldMotion() {
    if (!P.foldMotion) return;
    env.foldView?.reset();
    P.foldMotion = null;
    renderPlayer();
    // Euler decomposition after reparenting can retain X/Z half-turns.
    // Restore the complete upright pose, not just the Y component.
    env.getPlayerGroup().rotation.set(0,-P.player.dir*Math.PI/4,0);
  }
function beginFoldDrag(r, c, startY) {
    if (
      P.mode !== "play" ||
      P.moving ||
      P.foldMotion ||
      P.levelWon ||
      P.stepLimitHit ||
      !P.chosenFold ||
      !env.foldView
    )
      return false;
    const group = foldGroupAt(
      env.getFoldAxes(),
      P.chosenFold.r,
      P.chosenFold.c,
      P.chosenFold.type,
    );
    if (!group || !inFoldRange(group, P.player)||!canFoldCell(P.player.r,P.player.c)) return false;
    const direction =
      group.type === "h"
        ? { r: 0, c: 1 }
        : group.type === "v"
          ? { r: 1, c: 0 }
          : group.type === "d1"
            ? { r: 1, c: 1 }
            : { r: 1, c: -1 };
    const side = (p) =>
      (p.c - group.center.c) * direction.r -
      (p.r - group.center.r) * direction.c;
    const playerSide = Math.sign(side(P.player)),
      map = env.getMap();
    if (
      !playerSide ||
      !map.tiles[r]?.[c] ||
      env.isHidden(r, c) ||
      !canFoldCell(r,c) ||
      side({ r, c }) * playerSide <= 0 ||
      !inFoldRange(group, { r, c })
    )
      return false;
    const cells = [],
      creaseCells = [];
    for (let row = 0; row < map.height; row++)
      for (let column = 0; column < map.width; column++) {
        const p = { r: row, c: column };
        if (
          !map.tiles[row][column] || !canFoldCell(row,column) ||
          env.isHidden(row, column) ||
          !inFoldRange(group, p)
        )
          continue;
        if (side(p) * playerSide > 0) cells.push(p);
        else if (
          side(p) === 0 &&
          group.cells.some((q) => q.r === row && q.c === column)
        )
          creaseCells.push(p);
      }
    const hinge = env.getFoldHinge(group);
    hinge.side = playerSide;
    const axis = { ...P.chosenFold };
    // Snapshot the selection so a rejected fold can hand control back to it.
    const previousSelection = {
      fold: P.chosenFold ? { ...P.chosenFold } : null,
      player: env.getSelectionRing().visible,
    };
    disposableClear(env.getEffectLayer());
    P.legalMoves = [];
    P.legalFoldMoves = [];
    env.getSelectionRing().visible = false;
    env.foldView.begin(cells, hinge, creaseCells);
    P.foldMotion = {
      axis,
      cells,
      creaseCells,
      hinge,
      previousSelection,
      startY,
      angle: 0,
      dragAngle: 0,
      lastTick: null,
      sign: playerSide,
      phase: "drag",
      ready: false,
    };
    $("toolStatus").textContent =
      "向上拖拽折叠 · 松开落到蓝色目标，未对齐则回弹";
    updateUI();
    return true;
  }
function refreshFoldTarget(motion){
    const target = foldTarget(motion.axis),
      position = env.foldView.footPosition?.()??env.foldView.playerPosition();
    const horizontal = Math.hypot(position[0]-wx(target.c),position[2]-wz(target.r)),
      vertical = position[1] - (env.getTabletopHeight?.() ?? motion.hinge.origin[1]);
    const ready =
      target.valid &&
      horizontal <= P.foldDrop.horizontal &&
      vertical >= -1e-5 &&
      vertical < P.foldDrop.vertical;
    motion.target = { ...target };
    motion.ready = ready;
    motion.worldPosition = env.foldView.playerPosition();
    disposableClear(env.getEffectLayer());
    if (ready) {
      overlay(target.r, target.c, "#579bff", 0.55);
      tileOutline(target.r, target.c, "#2477e8");
    }
    $("foldDetail").textContent = ready
      ? "松开掉落到 " + coord(target.r, target.c)
      : `折叠 ${Math.round((motion.angle * 180) / Math.PI)}° · ${target.valid ? "尚未对齐目标" : target.reason}`;
    $("teleportBtn").disabled = true;
    env.syncFoldState?.();
  }
function updateFoldMotion(now){
    const motion=P.foldMotion;
    if(!motion||motion.phase!=='drag')return;
    const maxSpeed=env.getLighting?.()?.foldMaxSpeed??Math.PI*2;
    const last=motion.lastTick??now;
    let dt=(now-last)/1000;
    if(!(dt>0))dt=1/60;
    if(dt>.1)dt=.1;
    motion.lastTick=now;
    const diff=motion.dragAngle-motion.angle;
    const step=Math.sign(diff)*Math.min(Math.abs(diff),maxSpeed*dt);
    if(step){
      motion.angle+=step;
      env.foldView.setAngle(motion.angle*motion.sign);
    }
    refreshFoldTarget(motion);
  }
function updateFoldDrag(clientY, dragSpan = 240) {
    const motion = P.foldMotion;
    if (!motion || motion.phase !== "drag") return false;
    // Pointer motion only moves the desired angle; tick() eases the rendered
    // angle toward it under a bounded angular speed (rad/s), so the fold
    // rotation never snaps instantaneously.
    motion.dragAngle = Math.max(
      0,
      Math.min(
        Math.PI,
        ((motion.startY - clientY) / Math.max(1, dragSpan)) * Math.PI,
      ),
    );
    updateFoldMotion(performance.now());
    return motion.ready;
  }
function endFoldDrag(cancelled = false) {
    const motion = P.foldMotion;
    if (!motion || motion.phase !== "drag") return false;
    // Recheck gates and spatial alignment at release, never trust a stale highlight.
    updateFoldDrag(motion.startY - (motion.angle / Math.PI) * 240, 240);
    if (!cancelled && motion.ready) {
      const target = foldTarget(motion.axis),
        from = new THREE.Vector3().fromArray(motion.worldPosition),
        prev = { ...P.player };
      cancelFoldMotion();
      return turnManager.execute({trigger:Trigger.Teleport,source:'fold',axis:motion.axis,dropFrom:from.toArray()});

    }
    motion.phase = "return";
    motion.returnStart = performance.now();
    motion.returnAngle = motion.angle * motion.sign;
    motion.ready = false;
    disposableClear(env.getEffectLayer());
    $("foldDetail").textContent = "折纸回弹";
    updateUI();
    return false;
  }
function tick(now){    if (P.foldMotion) {
      const motion = P.foldMotion;
      if (motion.phase === "drag") {
        updateFoldMotion(now);
        return;
      }
      if (motion.phase === "return") {
        const t = Math.min(1, (now - motion.returnStart) / 350);
        env.foldView.setAngle(motion.returnAngle * (1 - t * t * (3 - 2 * t)));
        if (t >= 1) {
          cancelFoldMotion();
          clearSelection();
          // A rebound means the fold was rejected, so restore what was selected.
          if (motion.previousSelection?.fold) {
            const back = motion.previousSelection.fold;
            selectFold(back.r, back.c, back.type);
          } else if (motion.previousSelection?.player) selectPlayer();
          renderPlayer();
          updateUI();
        }
      }
      return;
    }
const map=env.getMap();if(!P.animation)return;const animation=P.animation;if(animation.fromCell&&animation.type!=='drop')animation.from.y=tileTop(animation.fromCell.r,animation.fromCell.c)+.018;if(animation.toCell)animation.to.y=tileTop(animation.toCell.r,animation.toCell.c)+.018;const t=Math.min(1,(now-P.animation.start)/P.animation.duration),smooth=t*t*(3-2*t);if(P.animation.type==='teleport'){if(t<.5){env.getPlayerGroup().position.copy(P.animation.from);env.getPlayerGroup().scale.setScalar(Math.max(.03,1-t*2));}else{env.getPlayerGroup().position.copy(P.animation.to);env.getPlayerGroup().scale.setScalar(Math.max(.03,(t-.5)*2));}}else if(animation.type==='drop'){env.getPlayerGroup().position.lerpVectors(animation.from,animation.to,smooth);env.getPlayerGroup().position.y=animation.from.y+(animation.to.y-animation.from.y)*t*t;}else env.getPlayerGroup().position.lerpVectors(P.animation.from,P.animation.to,smooth);env.getPlayerGroup().rotation.set(0,-P.player.dir*Math.PI/4,0);if(t>=1){P.animation=null;P.moving=false;env.getPlayerGroup().scale.setScalar(1);renderPlayer();if(animation.turnId!==undefined)turnManager.complete(animation.turnId);else checkRunEnd();click(P.player.r,P.player.c);updateUI();}}
function click(r,c){const map=env.getMap();if(P.mode!=='play'||P.moving||P.foldMotion||P.levelWon||P.stepLimitHit )return;if(P.freeTeleport&&(r!==P.player.r||c!==P.player.c)){testTeleport(r,c);return;}if(env.isHidden(r,c))return;if(P.chosenFold){const target=foldTarget(P.chosenFold);if(target.valid&&target.r===r&&target.c===c){teleport();return;}}if(r===P.player.r&&c===P.player.c){if(env.getSelectionRing().visible)clearSelection();else selectPlayer();return;}if(P.legalMoves.some(t=>t.r===r&&t.c===c)){movePlayer(r,c);return;}const foldMove=P.legalFoldMoves.find(t=>t.r===r&&t.c===c);if(foldMove){teleport(foldMove.axis);return;}if(foldsAt(map,r,c).length){selectFold(r,c);return;}if(P.legalMoves.length){toast(walkable(r,c)?'该方块不在可移动范围内':'黑色或空格方块不可移动',true);}else if(!walkable(r,c)){toast('黑色或空格方块不可移动',true);}clearSelection();}
function resetPosition(){P.player={...env.getMap().spawn};}
function resetProgress(){turnManager.reset();P.steps=P.teleports=0;P.playHistory=[];resetRegions();resetPosition();}
function recordPlay(){P.playHistory.push(snapshot());if(P.playHistory.length>150)P.playHistory.shift();}
function undo(){cancelFoldMotion();if(P.moving||P.mode!=='play')return;const previous=P.playHistory.pop();if(previous)restore(previous);}
return {foldHighlightRegions,beginFoldDrag,updateFoldDrag,endFoldDrag,cancelFoldMotion,turnManager,setPlayerProperties,interact,setFreeTeleport,testTeleport,setFoldHints,recordPlay,undo,resetPosition,resetProgress,canMoveTo,validateForPlay,exitIsValid,isAtExit,foldTargetFor,finishRun,checkRunEnd,clearSelection,selectPlayer,reflectPoint,foldTarget,selectFold,animatePlayer,transitionRegion,applyTerrainEntry,movePlayer,teleport,turn,resetRegions,setMode,restart,snapshot,restore,tick,click,updateLifts};
}
module.exports={playerPrefabDefaults,Trigger,TurnPhase,createTurnManager,createPlayerState,createPlayerController,initialLiftState:liftInitial,advanceLift};
