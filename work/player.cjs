const defaultPlayerPrefab=require('../assets/prefab/entity/player_ai.json');
const rayEmitterConfig=require('./entities/ray-emitter-config.cjs');
const {isBrokenCell}=require('./entities/fragile-presence.cjs');
const firebirdRules=require('./mechanics/firebird.cjs');
const flameField=require('./mechanics/flame-field.cjs');
const {componentTriggerMatches}=require('./mechanics/trigger-list.cjs');
function rayCells(origin,direction,width,height){
 const delta=rayEmitterConfig.directions[direction];if(!delta)throw new Error('Invalid ray emitter direction');
 const cells=[];for(let step=1;step<=3;step++){const r=origin.r+delta.r*step,c=origin.c+delta.c*step;if(r>=0&&r<height&&c>=0&&c<width)cells.push({r,c});}return cells;
}
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
  const canDropOnFold=prefab.components?.physics?.canDropOnFold??true;
  if(typeof canDropOnFold!=='boolean')throw new Error('player 可在折叠时掉落须为布尔值');
  return {
    foldDrop,
    canDropOnFold,
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
   if(!hooks.validate(context.action)){state.turn=previous;return false;}
   phase(TurnPhase.Validate);
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
    canDropOnFold: playerPrefabDefaults().canDropOnFold,
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
    lastRegionTransition: null,
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
 const {THREE,$,blocked,inside,walkable,canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord,FOLD_NAMES,clone,persist,toast,record,updateUI,buildPaper,renderPlayer,disposableClear,overlay,tileOutline,wx,wz,tileTop,playSound,playMusic}=env;
 P.terrainState=createTerrainState();
function resetPrefabState() {
    const defaults = playerPrefabDefaults(
      env.getPlayerPrefab?.() ?? defaultPlayerPrefab,
    );
    P.moveHeight = defaults.moveHeight;
    P.foldDrop = defaults.foldDrop;
    P.canDropOnFold = defaults.canDropOnFold;
    P.terrainState = { ...createTerrainState(), ...defaults.terrainState };
  }
 resetPrefabState();
let validationWorld=null;
function world(){return validationWorld??env.getEntityWorld?.();}
function configuredMap(){return env.getConfiguredMap?.()??env.getMap();}
function withConfiguredWorld(callback,ignoreReplacements=false){const previous=validationWorld,tree=world();if(tree?.setSpawnedEntities){validationWorld=tree.clone();validationWorld.setSpawnedEntities(null);if(ignoreReplacements)validationWorld.replaceRuntimeEntities?.([]);}try{return callback();}finally{validationWorld=previous;}}
function syncRegionEntities(){
 const tree=world();if(!tree?.setSpawnedEntities)return;
 if(P.mode!=='play'){tree.setSpawnedEntities(null);return;}
 const map=env.getCellRegion?null:configuredMap(),regionAt=env.getCellRegion??((r,c)=>regionOf(map.tiles[r]?.[c]));
 const ids=new Set(tree.definitions().filter(node=>tree.transforms.worldCells(node.transformId).every(cell=>P.revealedRegions.has(regionAt(cell.r,cell.c)))).map(node=>node.id));
 tree.setSpawnedEntities(ids);
}
function revealRegion(name){if(P.revealedRegions.has(name))return;P.revealedRegions.add(name);syncRegionEntities();}
function activeAt(r,c){const tree=world(),nodes=tree.at(r,c);return isBrokenCell(tree,nodes)?[]:nodes;}
function switchesOpen(tags={}){const tree=world(),required=tags.requiredSwitches??[];if(!required.length)return true;if(!tree)return false;const nodes=new Map(tree.serialize().map(node=>[node.id,node]));return required.every(id=>{const node=nodes.get(id);return node?.components.foldSwitch&&(tree.runtime(id,'foldSwitch').state??node.components.foldSwitch.initialState)===1;});}
function updateFoldSwitches(action){
 const tree=world();if(!tree||action?.source!=='fold')return;
 const axis=action.axis,group=axis&&foldGroupAt(env.getFoldAxes(),axis.r,axis.c,axis.type);if(!group)return;
 const used=new Set(group.cells.map(cell=>cell.r+','+cell.c));
 for(const node of tree.serialize())if(node.components.foldSwitch&&componentTriggerMatches(node.components.foldSwitch,action?.trigger)&&tree.transforms.worldCells(node.transformId).some(cell=>used.has(cell.r+','+cell.c))){
  const state=tree.runtime(node.id,'foldSwitch').state??node.components.foldSwitch.initialState;tree.setRuntime(node.id,'foldSwitch',{state:state===1?0:1});playSound?.(state===1?'switch-close':'switch-open');
 }
}
function fireRayEmitters(){
 const tree=world(),map=env.getMap();if(!tree)return;
 const emitters=tree.serialize().filter(node=>node.components.rayEmitter);if(!emitters.length)return;
 let changed=false;
 for(const node of emitters){
  const origin=tree.cells(node.id)[0];if(!origin||!activeAt(origin.r,origin.c).some(owner=>owner.id===node.id))continue;
  const previous=tree.runtime(node.id,'rayEmitter'),triggered=componentTriggerMatches(node.components.rayEmitter,P.turn.trigger);
  if(!triggered&&!previous.fired)continue;
  const direction=triggered&&previous.fired?rayEmitterConfig.directions[previous.direction??node.components.rayEmitter.initialDirection].opposite:(previous.direction??node.components.rayEmitter.initialDirection);
  const danger=rayCells(origin,previous.direction??node.components.rayEmitter.initialDirection,map.width,map.height);
  if(triggered&&!env.isHidden(P.player.r,P.player.c)&&activeAt(P.player.r,P.player.c).some(owner=>owner.components.surface)&&danger.some(cell=>cell.r===P.player.r&&cell.c===P.player.c)){P.terrainState.gameOver=true;P.terrainState.message='被射线冻死';}
  if(triggered){tree.setRuntime(node.id,'rayEmitter',{direction,fired:true,lastShot:rayCells(origin,direction,map.width,map.height),shotDirection:direction});playSound?.('fire-spit');changed=true;}
 }
 if(changed){if(env.refreshMechanismSurfaces)env.refreshMechanismSurfaces();else buildPaper();}
}
// Notification deduplication is presentation-only; threat itself is derived from live entities.
let previousFirebirdThreat=new Map();
function firebirdThreat(){
 const tree=world();if(P.mode!=='play'||!tree)return [];
 return tree.serialize().filter(node=>node.components.firebird&&!tree.runtime(node.id,'firebird').replaced).flatMap(node=>{
  const origin=tree.position(node.id);if(!activeAt(origin.r,origin.c).some(owner=>owner.id===node.id))return [];
  return [{id:node.id,angry:firebirdRules.inWatchRange(origin,P.player,tree.transforms.get(node.transformId).footprint)}];
 });
}
function refreshFirebirdThreat(notify=true){
 const threats=firebirdThreat(),messages=[];
 if(notify&&threats.some(node=>!previousFirebirdThreat.has(node.id)))messages.push('火焰鸟的火焰子弹正在追踪你');
 if(notify&&threats.some(node=>node.angry&&previousFirebirdThreat.get(node.id)!==true))messages.push('火焰鸟发怒了');
 previousFirebirdThreat=new Map(threats.map(node=>[node.id,node.angry]));
 env.onFirebirdThreat?.(threats);
 if(messages.length)toast(messages.join('；'));
 return threats;
}
function updateFirebirds(action){
 const tree=world(),map=env.getMap();if(!tree||!action)return;
 let flames=flameField.spreadFlame(P.terrainState.flames??[],[],map.width,map.height);
 for(const node of tree.serialize())if(node.components.firebird&&componentTriggerMatches(node.components.firebird,action.trigger)&&!tree.runtime(node.id,'firebird').replaced){
  const origin=tree.position(node.id);if(!activeAt(origin.r,origin.c).some(owner=>owner.id===node.id))continue;
  const footprint=tree.transforms.get(node.transformId).footprint;
  for(const effect of firebirdRules.resolveFirebird({id:node.id,origin,footprint,config:node.components.firebird},action,P.player,map.width,map.height)){
   if(effect.type==='addFlame'){flames=flameField.addFlame(flames,effect.cells,map.width,map.height);playSound?.('phoenix-roar');}
   else if(effect.type==='replaceFirebird')tree.setRuntime(node.id,'firebird',{replaced:true});
  }
 }
 P.terrainState.flames=flames;
 if(flameField.contains(flames,P.player)){P.terrainState.gameOver=true;P.terrainState.message='被火焰覆盖，游戏结束';}
 env.refreshMechanismSurfaces?.();
}
function syncLiftHeights(){const tree=world(),map=env.getMap();if(!tree)return false;let changed=false;
 for(const node of tree.serialize())if(node.components.lift){const state=tree.runtime(node.id,'lift'),height=Number(state.height??node.components.lift.initialHeight);for(const cell of tree.transforms.worldCells(node.transformId)){const tile=map.tiles[cell.r]?.[cell.c];if(tile&&Math.abs((tile.height??0)-height)>1e-9){tile.height=height;changed=true;}}}
 return changed;
}
function updateLifts(advance=false){const tree=world(),map=env.getMap();if(!tree||P.mode!=='play')return false;let changed=false;
 for(const node of tree.serialize())if(node.components.lift&&componentTriggerMatches(node.components.lift,advance?P.turn.trigger:undefined)){const config=node.components.lift,cells=tree.transforms.worldCells(node.transformId),occupied=cells.some(cell=>cell.r===P.player.r&&cell.c===P.player.c);
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
 if(nodes.some(node=>Object.hasOwn(node.components,'rayEmitter')))return {valid:false,reason:'冰冻射线机关不可进入'};
 if(nodes.some(node=>Object.hasOwn(node.components,'foldSwitch')))return {valid:false,reason:'折线开关方块不可进入'};
 return {valid:true,reason:''};
}
function treeEvent(type,position,actor=P.terrainState,runtime=world().snapshotRuntime(),nodes=activeAt(position.r,position.c),trigger){
 return env.componentRegistry.dispatch({type,trigger,nodes,actor,runtime});
}
function treeEntryCheck(position,actor=P.terrainState,trigger){
 return env.componentRegistry.checkEntry({trigger,nodes:activeAt(position.r,position.c),actor,runtime:world().snapshotRuntime()});
}
function entryCheck(r,c,ignoreHidden=false,trigger){const tree=world();if(!tree)return canEnterTerrain(env.getMap(),{r,c},P.terrainState);
 if(flameField.contains(P.terrainState.flames,{r,c}))return {valid:false,reason:'火焰覆盖的方格不可进入'};
 if(!inside(r,c)||(!ignoreHidden&&env.isHidden(r,c)))return {valid:false,reason:'目标为空格或未揭示区域'};
 const nodes=activeAt(r,c);if(!nodes.some(node=>Object.hasOwn(node.components,'surface')))return {valid:false,reason:'目标为空格'};
 if(nodes.some(node=>node.static.walkable===false))return {valid:false,reason:'目标是阻挡方块'};
 return treeEntryCheck({r,c},P.terrainState,trigger);
}
function canFoldCell(r,c){return env.canFoldCell?.(r,c)??(env.getMap().tiles[r]?.[c]?.followFold!==false);}
function canMoveTo(r,c){const map=env.getMap();const delta=(map.tiles[r]?.[c]?.height??.09)-(map.tiles[P.player.r]?.[P.player.c]?.height??.09);return (world()?true:walkable(r,c))&&delta<=P.moveHeight.maxUp+1e-9&&-delta<=P.moveHeight.maxDown+1e-9&&entryCheck(r,c,false,Trigger.Walk).valid;}
function commitTreeEvent(type,position,nodes,trigger){const tree=world(),before=tree?.snapshotRuntime(),result=treeEvent(type,position,P.terrainState,tree.snapshotRuntime(),nodes,trigger);if(result.valid){P.terrainState={...result.actor,message:result.messages.join('；')};tree.restoreRuntime(result.runtime);if(type==='action'&&before){const broken=tree.serialize().some(node=>node.components.fragile&&!before[node.id]?.fragile?.broken&&result.runtime[node.id]?.fragile?.broken);if(broken)playSound?.('paper-fracture');}}return result;}
function broadcastAction(trigger){const tree=world();if(!tree)return {valid:true};const result=treeEvent('action',P.player,P.terrainState,tree.snapshotRuntime(),tree.serialize(),trigger);if(result.valid){P.terrainState={...result.actor,message:result.messages.length?result.messages.join('；'):P.terrainState.message};tree.restoreRuntime(result.runtime);}return result;}
function finalizeFragileBreaks(){const tree=world();if(!tree)return false;let changed=false,playerFalls=false;for(const node of tree.serialize())if(node.components.fragile&&tree.runtime(node.id,'fragile').breaking){for(const cell of tree.transforms.worldCells(node.transformId))if(cell.r===P.player.r&&cell.c===P.player.c)playerFalls=true;tree.setRuntime(node.id,'fragile',{remaining:0,broken:true});changed=true;}if(changed)env.refreshMechanismSurfaces?.();if(playerFalls){P.terrainState.gameOver=true;P.terrainState.message='从易碎方块上掉落，游戏结束';}return changed;}
function updateFragileBreakAnimation(progress){const tree=world(),ids=P.animation?.fragileBreaking??[];if(!tree||!ids.length)return;for(const id of ids){const state=tree.runtime(id,'fragile');if(state.breaking)tree.setRuntime(id,'fragile',{...state,progress});}env.refreshMechanismSurfaces?.();}
function leaveTree(position,trigger){if(world())commitTreeEvent('leave',position,undefined,trigger);}
function enterTree(trigger){P.terrainState={...P.terrainState,message:'',gameOver:false,won:false};const result=commitTreeEvent('enter',P.player,undefined,trigger);if(!result.valid)throw new Error(result.reason||'目标不可进入');if(P.terrainState.frozen&&!P.terrainState.gameOver){for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if((dr||dc)&&world().at(P.player.r+dr,P.player.c+dc).some(node=>Object.hasOwn(node.components,'campfire'))){P.terrainState.frozen=false;P.terrainState.message='篝火解除冰冻';return;}}}}
function interact(){
 if(!world()||P.mode!=='play'||P.moving||P.foldMotion||P.levelWon||P.stepLimitHit)return;
 const before=snapshot(),result=commitTreeEvent('interact',P.player),after=snapshot();
 if(JSON.stringify(before)!==JSON.stringify(after)){P.playHistory.push(before);if(P.playHistory.length>150)P.playHistory.shift();}
 if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);buildPaper();updateUI();checkRunEnd();return result;
}
function setPlayerProperties({r,c,dir,maxUp,maxDown,foldVertical=P.foldDrop.vertical,foldHorizontal=P.foldDrop.horizontal,canDropOnFold=P.canDropOnFold,overheat=P.terrainState.overheat,frozen=P.terrainState.frozen,actions=P.terrainState.actions,collectedKeys=P.terrainState.collectedKeys}) {
 if(P.mode!=='play'||P.moving||P.foldMotion)throw new Error('请在游玩模式且移动结束后修改玩家属性');
 if(!inside(r,c)||!Number.isInteger(dir)||dir<0||dir>7)throw new Error('玩家坐标或朝向无效');
 if(![maxUp,maxDown].every(n=>Number.isFinite(n)&&n>=0&&n<=16))throw new Error('可移动高度差须为 0–16');
 if(!Number.isSafeInteger(overheat)||overheat<0||!Number.isSafeInteger(actions)||actions<0||typeof frozen!=='boolean')throw new Error('过热与机制行动次数须为非负整数，冰冻须为布尔值');
 const keys=new Set(env.legalKeyNames?.(env.getMap(),world())??env.getMap().tiles.flat().filter(t=>t?.terrain==='key'&&!blocked(t)).map(t=>t.keyName?.trim()||'钥匙'));
 if(!Array.isArray(collectedKeys)||collectedKeys.some(k=>typeof k!=='string'||!keys.has(k)))throw new Error('已收集钥匙须为地图中合法钥匙名的 JSON 数组');
 const terrainState={...P.terrainState,overheat,frozen,actions,collectedKeys:[...new Set(collectedKeys)],hasKey:collectedKeys.length>0,eruptionOpen:actions>0&&actions%3===2};
 if(![foldVertical,foldHorizontal].every(n=>Number.isFinite(n)&&n>0&&n<=16))throw new Error('折纸落点阈值须大于 0 且不超过 16');
 if(typeof canDropOnFold!=='boolean')throw new Error('可在折叠时掉落须为布尔值');
 const tile=configuredMap().tiles[r]?.[c];if(!tile||(world()?!withConfiguredWorld(()=>treeEntryCheck({r,c},terrainState)).valid:blocked(tile)||((r!==P.player.r||c!==P.player.c)&&!canEnterTerrain(env.getMap(),{r,c},terrainState).valid)))throw new Error('玩家坐标需要可通行实体');
 record();P.player={r,c,dir};P.moveHeight={maxUp,maxDown};P.foldDrop={vertical:foldVertical,horizontal:foldHorizontal};P.canDropOnFold=canDropOnFold;P.terrainState=terrainState;revealRegion(regionOf(tile));clearSelection();buildPaper();renderPlayer();updateUI();refreshFirebirdThreat();
}
function validateForPlay(){return withConfiguredWorld(validateConfiguredPlay,true);}
function validateConfiguredPlay() {const map=configuredMap();
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
    const switchIds=new Set(world().serialize().filter(node=>node.components.foldSwitch).map(node=>node.id));
    const exits=[...taggedCells(map,'exitTo'),...(map.exit?[{tile:map.tiles[map.exit.r]?.[map.exit.c]}]:[])];
    for(const cell of exits)for(const id of cell.tile?.tags?.requiredSwitches??[])if(!switchIds.has(id))regionErrors.push('出口绑定的开关不存在：'+id);
    for(const cell of taggedCells(map,'entry')){const check=structuralEntryCheck(cell.r,cell.c);if(!check.valid)regionErrors.push('区域入口不可通行：'+regionOf(cell.tile)+'（'+check.reason+'）');}
  }
  const errors=[...validateTerrains(map),...new Set(regionErrors)];
  const start=map.tiles[map.spawn.r]?.[map.spawn.c];if(!start||(world()?!entryCheck(map.spawn.r,map.spawn.c,true).valid:blocked(start)||start.terrain==='campfire'))errors.push('玩家起点无效');
  if(map.exit&&!exitIsValid())errors.push('出口必须在可行走方块上');
  return {valid:errors.length===0,errors};
}
function exitIsValid() {const map=env.getMap();if(!map.exit||!inside(map.exit.r,map.exit.c)||!map.tiles[map.exit.r]?.[map.exit.c])return false;return world()?structuralEntryCheck(map.exit.r,map.exit.c).valid:walkable(map.exit.r,map.exit.c);}
function isAtExit() {const map=env.getMap();const atC20=inside(19,2)&&P.player.r===19&&P.player.c===2&&entryCheck(19,2,false,Trigger.Walk).valid;if(atC20)return true;return switchesOpen(map.exit?map.tiles[map.exit.r]?.[map.exit.c]?.tags:undefined)&&exitIsValid()&&P.player.r===map.exit.r&&P.player.c===map.exit.c; }
function foldTargetFor(axis,position=P.player) {const map=env.getMap();
  const t=reflectPoint(position.r,position.c,axis);const same=t.r===position.r&&t.c===position.c;let reason='';
  if(!P.canDropOnFold)reason='玩家不可在折叠时掉落';else if(!inFoldRange(foldGroupAt(env.getFoldAxes(),axis.r,axis.c,axis.type),position))reason='超出折线作用半径';else if(!inside(t.r,t.c))reason='目标超出地图';else if(!map.tiles[t.r][t.c])reason='目标为空格';else if(!(world()?entryCheck(t.r,t.c,false,Trigger.Teleport).valid:walkable(t.r,t.c)))reason=world()?entryCheck(t.r,t.c,false,Trigger.Teleport).reason:'目标是阻挡方块';else if(same)reason='玩家位于对称轴上';else if(P.mode==='play')reason=entryCheck(t.r,t.c,false,Trigger.Teleport).reason;
  return {...t,valid:!reason,reason};
}
function finishRun(kind) {const map=env.getMap();
  if(kind==='win'){
    playSound?.('level-complete');
    P.levelWon=true;P.stepLimitHit=false;
    if(map.bestSteps===null||P.steps<map.bestSteps){map.bestSteps=P.steps;persist();}
    $('resultTitle').textContent='通关！';
    $('resultDetail').textContent=`${map.name} · ${P.steps} 步${map.bestSteps===P.steps?' · 新纪录':''}`;
    toast(`通关！到达出口 ${coord(P.player.r,P.player.c)}`);
  } else if(kind==='terrain') {
    playSound?.('game-over');
    P.levelWon=false;P.stepLimitHit=true;
    $('resultTitle').textContent='挑战失败';
    $('resultDetail').textContent=P.terrainState.message;
    toast(P.terrainState.message,true);
  } else {
    playSound?.('game-over');
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
function animatePlayer(from,to,type,turnId,fromPosition){const map=env.getMap();P.moving=true;P.animation={start:performance.now(),duration:type==='teleport'?480:220,fromCell:{...from},toCell:{...to},fromPosition:fromPosition?.clone(),from:fromPosition?.clone()??new THREE.Vector3(wx(from.c),tileTop(from.r,from.c)+.018,wz(from.r)),to:new THREE.Vector3(wx(to.c),tileTop(to.r,to.c)+.018,wz(to.r)),type,turnId,checkEnd:true};updateUI();}
function prepareRegionTransition(){
 const tile=env.getMap().tiles[P.player.r]?.[P.player.c],target=tile?.tags?.exitTo;if(!target)return null;
 if(!switchesOpen(tile.tags)){P.terrainState.message='出口绑定的开关尚未开启';return null;}
 const missing=(tile.tags.requiredKeys??[]).filter(k=>!P.terrainState.collectedKeys.includes(k));if(missing.length){P.terrainState.message='出口还需要钥匙：'+missing.join('、');return null;}
 const entry=taggedCells(configuredMap(),'entry').find(p=>regionOf(p.tile)===target);
 if(!entry)return {target,entry:null};
 const check=withConfiguredWorld(()=>entryCheck(entry.r,entry.c,true,Trigger.Teleport),true);
 if(!check.valid){P.terrainState.message='无法进入区域：'+target+'（'+(check.reason||'入口不可通行')+'）';return null;}
 return {target,entry};
}
function commitRegionTransition(transition,{deferReveal=false}={}){
 if(!transition)return false;
 const {target,entry}=transition;
 const fromTile=configuredMap().tiles[P.player.r]?.[P.player.c],fromRegion=regionOf(fromTile);
 if(!entry){P.lastRegionTransition={fromRegion,exit:{r:P.player.r,c:P.player.c},toRegion:target};if(!deferReveal){revealRegion(target);buildPaper();toast('显示区域：'+target);}return false;}
 if(!deferReveal)revealRegion(target);
 P.lastRegionTransition={fromRegion,exit:{r:P.player.r,c:P.player.c},toRegion:target};
 leaveTree(P.player,Trigger.Teleport);P.player={r:entry.r,c:entry.c,dir:P.player.dir};
 if(!deferReveal){buildPaper();toast('进入区域：'+target);}
 return true;
}
function transitionRegion(){return commitRegionTransition(prepareRegionTransition());}
function collectKey(){if(world()){const tree=world(),nodes=tree.at(P.player.r,P.player.c).filter(node=>Object.hasOwn(node.components,'key')&&node.static.walkable!==false&&!node.components.collision?.blocked&&!tree.runtime(node.id,'key').collected).map(node=>({...node,components:{key:node.components.key}}));if(nodes.length)commitTreeEvent('enter',P.player,nodes);return;}const tile=env.getMap().tiles[P.player.r]?.[P.player.c];if(tile?.terrain!=='key'||blocked(tile))return;const name=tile.keyName?.trim()||'钥匙';P.terrainState.collectedKeys=[...new Set([...P.terrainState.collectedKeys,name])];P.terrainState.hasKey=true;P.terrainState.message='获得钥匙：'+name;}
function arrive(trigger){
 if(world())enterTree(trigger);
 else{P.terrainState=enterTerrain(env.getMap(),P.player,P.terrainState).state;collectKey();}
}
function settleAction(action={trigger:P.turn.trigger??Trigger.Walk}){
 updateFoldSwitches(action);
 P.terrainState=finishAction(P.terrainState);
 const transition=!P.terrainState.gameOver&&prepareRegionTransition();
 const actionResult=broadcastAction(action.trigger);if(!actionResult.valid)throw new Error(actionResult.reason||'行动广播失败');
 const transitioned=!P.terrainState.gameOver&&commitRegionTransition(transition,{deferReveal:true});
 fireRayEmitters();
 refreshFirebirdThreat();
 if(!P.terrainState.gameOver)updateFirebirds(action);
 refreshFirebirdThreat(false);
  if(transition){
   if(transition.entry){revealRegion(transition.target);buildPaper();toast('进入区域：'+transition.target);if(transitioned&&!P.terrainState.gameOver)arrive(Trigger.Teleport);}
   else commitRegionTransition(transition);
   // Region entities are spawned by the transition; refresh firebird tracking after arrival so destination birds can see the player immediately.
   refreshFirebirdThreat(false);
  }
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
  action.axis={r:axis.r,c:axis.c,type:axis.type};
  const t=foldTarget(axis);if(!t.valid){toast(t.reason+'，无法掉落',true);return false;}
  const forward=reflectPoint(P.player.r-Math.cos(P.player.dir*Math.PI/4),P.player.c+Math.sin(P.player.dir*Math.PI/4),axis);
  action.to={r:t.r,c:t.c,dir:(Math.round(Math.atan2(forward.c-t.c,t.r-forward.r)/(Math.PI/4))+8)%8};
 }else if(source==='test'&&trigger===Trigger.Teleport){
  if(!P.freeTeleport||!inside(r,c)||(r===P.player.r&&c===P.player.c))return false;
  const tile=configuredMap().tiles[r]?.[c];
  if(!tile||(!world()&&blocked(tile))||!withConfiguredWorld(()=>entryCheck(r,c,true,Trigger.Teleport)).valid){toast('测试传送需要可通行实体',true);return false;}
  action.to={r,c,dir:P.player.dir};
 }else return false;
 return true;
}
function applyEntityDrops(drops=[]){
 const tree=world();if(!tree||!drops.length)return 0;
 const moving=new Set(drops.map(drop=>drop.id));
 const movingTransforms=new Set(drops.map(drop=>tree.get(drop.id).transformId));
 const frozen=[];
 for(const node of tree.serialize()){
  if(moving.has(node.id))continue;
  let parent=tree.transforms.get(node.transformId).parentId;
  while(parent){if(movingTransforms.has(parent)){frozen.push({id:node.id,position:tree.position(node.id)});break;}parent=tree.transforms.get(parent).parentId;}
 }
 tree.setRuntimePositions([...frozen,...drops]);
 env.resetMapView?.();return drops.length;
}
const turnManager=createTurnManager({
 state:P,canExecute:()=>P.mode==='play'&&!P.moving&&!P.foldMotion&&!P.levelWon&&!P.stepLimitHit,
 validate:validateAction,
 snapshot:()=>({game:snapshot(),history:[...P.playHistory]}),record,
 restore:previous=>{P.playHistory=previous.history;restore(previous.game);},
 leave:context=>{P.moving=true;context.from={...P.player};context.fromPosition=env.getPlayerGroup().position.clone();leaveTree(context.from,context.action.trigger);},
 act:context=>{
  const {to,trigger,source}=context.action;
  P.player={...to};P.steps++;if(trigger===Trigger.Teleport)P.teleports++;
  playSound?.(trigger===Trigger.Teleport?'flip':'footstep');
  if(source==='test')revealRegion(regionOf(configuredMap().tiles[to.r][to.c]));
 },
 enter:context=>arrive(context.action.trigger),
 settle:context=>{
  if(context.action.dropFrom){context.droppedEntities=applyEntityDrops(context.action.entityDrops);if(context.droppedEntities)collectKey();}
  context.transitioned=settleAction({...context.action,from:context.from});
  context.fragileBreaking=world()?.serialize().filter(node=>node.components.fragile&&world().runtime(node.id,'fragile').breaking).map(node=>node.id)??[];
 },
 outcome:()=>{checkRunEnd();return P.levelWon?'win':P.stepLimitHit?(P.terrainState.gameOver?'terrain':'limit'):null;},
 present:context=>{
  clearSelection();if(context.action.source==='test'||context.droppedEntities)buildPaper();
  animatePlayer(context.from,P.player,context.action.trigger===Trigger.Teleport||context.transitioned?'teleport':'move',context.id,context.fromPosition);P.animation.fragileBreaking=context.fragileBreaking??[];
  if(context.action.dropFrom&&!context.transitioned){P.animation.type='drop';P.animation.from.fromArray(context.action.dropFrom);P.animation.duration=350;env.getPlayerGroup().position.copy(P.animation.from);}
  updateUI();if(context.action.source==='fold'&&!P.terrainState.message)toast('掉落 · '+coord(context.from.r,context.from.c)+' → '+coord(context.action.to.r,context.action.to.c));
 },
 onPhase:turn=>env.onTurnPhase?.(turn),
});
function movePlayer(r,c){return turnManager.execute({trigger:Trigger.Walk,source:'move',r,c});}
function teleport(axis=null){return turnManager.execute({trigger:Trigger.Teleport,source:'fold',axis});}
function turn(delta){const map=env.getMap();if(P.moving||P.foldMotion)return;record();P.player.dir=(P.player.dir+delta+8)%8;if(P.mode==='edit'){map.spawn.dir=P.player.dir;persist();}renderPlayer();updateUI();}
function resetRegions(){const map=configuredMap();const spawn=taggedCells(map,'spawn')[0];if(spawn){map.spawn={r:spawn.r,c:spawn.c,dir:map.spawn.dir};P.revealedRegions=new Set([regionOf(spawn.tile)]);}else P.revealedRegions=new Set();syncRegionEntities();}
function setMode(next){
 cancelFoldMotion();if(P.mode===next)return;
 if(next==='play'){const check=validateForPlay();if(!check.valid){toast(check.errors.join('；'),true);return;}}
 env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();turnManager.reset();world()?.resetRuntime();env.resetMapView?.();
  const map=env.getMap();env.getPlayerGroup().scale.setScalar(1);P.mode=next;if(next==='edit')P.freeTeleport=false;playMusic?.(next==='play'?'opening-bgm':'ending-bgm');
 resetRegions();P.lastRegionTransition=null;P.steps=0;P.teleports=0;P.playHistory=[];P.player={...map.spawn};resetPrefabState();
 if(P.mode==='play')collectKey();clearSelection();buildPaper();if(P.mode==='play')updateLifts();renderPlayer();updateUI();if(P.mode==='play')checkRunEnd();previousFirebirdThreat.clear();refreshFirebirdThreat();
}
function deathRecoveryPosition(){
 const map=configuredMap(),deathTile=map.tiles[P.player.r]?.[P.player.c],deathRegion=env.getCellRegion?.(P.player.r,P.player.c)??regionOf(deathTile);
 const entry=taggedCells(map,'entry').find(cell=>regionOf(cell.tile)===deathRegion);
 if(entry)return {r:entry.r,c:entry.c,dir:P.player.dir,region:deathRegion};
 const previous=P.lastRegionTransition;
 if(previous?.exit&&previous.exit.r===P.player.r&&previous.exit.c===P.player.c)return {r:previous.exit.r,c:previous.exit.c,dir:P.player.dir,region:previous.fromRegion};
 if(previous?.toRegion===deathRegion&&previous.exit)return {r:previous.exit.r,c:previous.exit.c,dir:P.player.dir,region:previous.fromRegion};
 return {r:map.spawn.r,c:map.spawn.c,dir:map.spawn.dir,region:regionOf(map.tiles[map.spawn.r]?.[map.spawn.c])};
}
function restart({afterDeath=false}={}){
 cancelFoldMotion();if(P.moving)return;const retryAfterDeath=afterDeath&&P.mode==='play'&&P.stepLimitHit&&P.terrainState.gameOver,recovery=retryAfterDeath?deathRecoveryPosition():null;env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();turnManager.reset();world()?.resetRuntime();env.resetMapView?.();
 const map=env.getMap();if(recovery){P.revealedRegions=new Set(P.revealedRegions);if(recovery.region)P.revealedRegions.add(recovery.region);syncRegionEntities();P.player={r:recovery.r,c:recovery.c,dir:recovery.dir};}else{resetRegions();P.player={...map.spawn};P.lastRegionTransition=null;}resetPrefabState();P.steps=P.teleports=0;P.playHistory=[];
 if(!recovery)collectKey();clearSelection();buildPaper();updateLifts();renderPlayer();updateUI();toast(recovery?'已按区域坐标复位':'已回到玩家起点');if(!recovery)checkRunEnd();previousFirebirdThreat.clear();refreshFirebirdThreat();
}
function retry(){return restart({afterDeath:true});}
function snapshot(){const map=env.getMap();return {player:{...P.player},lastRegionTransition:P.lastRegionTransition?clone(P.lastRegionTransition):null,moveHeight:{...P.moveHeight},foldDrop:{...P.foldDrop},canDropOnFold:P.canDropOnFold,steps:P.steps,teleports:P.teleports,turn:clone(P.turn),terrainState:clone(P.terrainState),revealedRegions:[...P.revealedRegions],...(world()?{entityRuntime:world().snapshotRuntime(),entityPositions:world().snapshotPositions(),entityReplacements:world().snapshotReplacements()}:{})};}
function restore(previous){
 cancelFoldMotion();P.revealedRegions=new Set(previous.revealedRegions);P.lastRegionTransition=previous.lastRegionTransition?clone(previous.lastRegionTransition):null;syncRegionEntities();
 if(world()){
  world().replaceRuntimeEntities([]);
  const matching={};for(const node of world().serialize()){const states=previous.entityRuntime?.[node.id];if(states){matching[node.id]={};for(const [id,state] of Object.entries(states))if(Object.hasOwn(node.components,id))matching[node.id][id]=state;}}
  world().restoreRuntime(matching);world().restorePositions(previous.entityPositions??{});world().replaceRuntimeEntities(previous.entityReplacements??[]);env.resetMapView?.();
 }
 P.player={...previous.player};P.moveHeight={...(previous.moveHeight??{maxUp:1,maxDown:1})};P.foldDrop={...(previous.foldDrop??playerPrefabDefaults().foldDrop)};P.canDropOnFold=previous.canDropOnFold??playerPrefabDefaults().canDropOnFold;
 P.steps=previous.steps;P.teleports=previous.teleports;P.terrainState=clone(previous.terrainState);P.revealedRegions=new Set(previous.revealedRegions);P.levelWon=false;P.stepLimitHit=false;P.animation=null;P.moving=false;turnManager.reset(previous.turn??initialTurn());
 env.getPlayerGroup().scale.setScalar(1);syncLiftHeights();clearSelection();buildPaper();renderPlayer();updateUI();checkRunEnd();refreshFirebirdThreat(false);
}
function cancelFoldMotion() {
    if (!P.foldMotion) return;
    env.foldView?.reset();
    P.foldMotion = null;
    renderPlayer();
    // Euler decomposition after reparenting can retain X/Z half-turns.
    // Restore the complete upright pose, not just the Y component.
    env.getPlayerGroup().rotation.set(0,-P.player.dir*Math.PI/4,0);
  }
function foldDragPlan(r, c) {
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
    const axisCells=new Set(group.cells.map(p=>p.r+','+p.c));
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
          axisCells.has(row+','+column)
        )
          creaseCells.push(p);
      }
    const hinge = env.getFoldHinge(group);
    hinge.side = playerSide;
    const axis = { ...P.chosenFold };
    return {axis,cells,creaseCells,hinge};
  }
function prepareFoldMotion(){
    if(!env.foldView?.prepare)return false;
    const plan=foldDragPlan(P.player.r,P.player.c);
    return !!plan&&env.foldView.prepare(plan.cells,plan.hinge,plan.creaseCells);
  }
function beginFoldDrag(r,c,startY){
    const plan=foldDragPlan(r,c);
    if(!plan)return false;
    const {axis,cells,creaseCells,hinge}=plan;
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
      sign: hinge.side,
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
function maxFoldAngle(){
    const value=env.getLighting?.()?.foldMaxAngle??179;
    return Math.max(0,Math.min(180,Number.isFinite(value)?value:179))*Math.PI/180;
  }
function updateFoldMotion(now){
    const motion=P.foldMotion;
    if(!motion||motion.phase!=='drag')return;
    const maxSpeed=env.getLighting?.()?.foldMaxSpeed??Math.PI*2;
    const previousAngle=motion.angle,limit=maxFoldAngle();
    motion.dragAngle=Math.min(motion.dragAngle,limit);
    motion.angle=Math.min(motion.angle,limit);
    const last=motion.lastTick??now;
    let dt=(now-last)/1000;
    if(!(dt>0))dt=1/60;
    if(dt>.1)dt=.1;
    motion.lastTick=now;
    const diff=motion.dragAngle-motion.angle;
    const step=Math.sign(diff)*Math.min(Math.abs(diff),maxSpeed*dt);
    motion.angle+=step;
    if(motion.angle!==previousAngle){
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
        maxFoldAngle(),
        ((motion.startY - clientY) / Math.max(1, dragSpan)) * Math.PI,
      ),
    );
    updateFoldMotion(performance.now());
    return motion.ready;
  }
function foldEntityDrops(motion){
    const tree=world();if(!tree)return [];
    const source=new Set(motion.cells.map(cell=>cell.r+','+cell.c)),result=[];
    for(const node of tree.serialize()){
      if(node.prefabId==='player_ai')continue;
      const category=node.static.entityType??(node.components.key||node.prefabId==='player_token_ai'?'item':'terrain');
      const enabled=env.canDropEntity?.(node)??(['item','creature'].includes(category)&&node.components.physics?.canDropOnFold!==false);
      if(!enabled||node.components.key&&tree.runtime(node.id,'key').collected)continue;
      const cells=tree.cells(node.id);
      if(!cells.length||cells.some(cell=>!source.has(cell.r+','+cell.c)))continue;
      const reflected=cells.map(cell=>reflectPoint(cell.r,cell.c,motion.axis));
      const anchor=tree.position(node.id),offsets=cells.map(cell=>({r:cell.r-anchor.r,c:cell.c-anchor.c}));
      const target={r:reflected[0].r-offsets[0].r,c:reflected[0].c-offsets[0].c,dir:anchor.dir};
      const expected=new Set(offsets.map(offset=>(target.r+offset.r)+','+(target.c+offset.c)));
      if(reflected.some(cell=>!expected.has(cell.r+','+cell.c)))continue;
      const bases=env.getEntityPrefab?.(node.prefabId)?.BaseEntity;
      if(reflected.some(cell=>{
        if(!inside(cell.r,cell.c)||env.isHidden(cell.r,cell.c))return true;
        const support=tree.at(cell.r,cell.c).filter(other=>other.components.surface&&!other.static.transparent);
        return !support.length||Array.isArray(bases)&&!support.some(other=>bases.includes(other.prefabId));
      }))continue;
      result.push({id:node.id,position:target});
    }
    return result;
  }
function endFoldDrag(cancelled = false) {
    const motion = P.foldMotion;
    if (!motion || motion.phase !== "drag") return false;
    // Recheck gates and spatial alignment at release, never trust a stale highlight.
    updateFoldDrag(motion.startY - (motion.angle / Math.PI) * 240, 240);
    if (!cancelled && motion.ready) {
      const from = new THREE.Vector3().fromArray(motion.worldPosition),
        entityDrops=foldEntityDrops(motion);
      cancelFoldMotion();
      return turnManager.execute({trigger:Trigger.Teleport,source:'fold',axis:motion.axis,dropFrom:from.toArray(),entityDrops});

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
const map=env.getMap();if(!P.animation)return;const animation=P.animation;if(animation.fromCell&&animation.type!=='drop'&&!animation.fromPosition)animation.from.y=tileTop(animation.fromCell.r,animation.fromCell.c)+.018;if(animation.toCell)animation.to.y=tileTop(animation.toCell.r,animation.toCell.c)+.018;const t=Math.min(1,(now-P.animation.start)/P.animation.duration),smooth=t*t*(3-2*t);updateFragileBreakAnimation(t);if(P.animation.type==='teleport'){if(t<.5){env.getPlayerGroup().position.copy(P.animation.from);env.getPlayerGroup().scale.setScalar(Math.max(.03,1-t*2));}else{env.getPlayerGroup().position.copy(P.animation.to);env.getPlayerGroup().scale.setScalar(Math.max(.03,(t-.5)*2));}}else if(animation.type==='drop'){env.getPlayerGroup().position.lerpVectors(animation.from,animation.to,smooth);env.getPlayerGroup().position.y=animation.from.y+(animation.to.y-animation.from.y)*t*t;}else env.getPlayerGroup().position.lerpVectors(P.animation.from,P.animation.to,smooth);env.getPlayerGroup().rotation.set(0,-P.player.dir*Math.PI/4,0);if(t>=1){finalizeFragileBreaks();P.animation=null;P.moving=false;env.getPlayerGroup().scale.setScalar(1);renderPlayer();checkRunEnd();if(animation.turnId!==undefined)turnManager.complete(animation.turnId);click(P.player.r,P.player.c);updateUI();}}
function click(r,c){const map=env.getMap();if(P.mode!=='play'||P.moving||P.foldMotion||P.levelWon||P.stepLimitHit )return;if(P.freeTeleport&&(r!==P.player.r||c!==P.player.c)){testTeleport(r,c);return;}if(env.isHidden(r,c))return;if(r===P.player.r&&c===P.player.c){if(env.getSelectionRing().visible)clearSelection();else selectPlayer();return;}if(P.legalMoves.some(t=>t.r===r&&t.c===c)){movePlayer(r,c);return;}if(foldsAt(map,r,c).length){selectFold(r,c);return;}if(P.legalMoves.length){toast(walkable(r,c)?'该方块不在可移动范围内':'黑色或空格方块不可移动',true);}else if(!walkable(r,c)){toast('黑色或空格方块不可移动',true);}clearSelection();}
function resetPosition(){P.player={...env.getMap().spawn};}
function resetProgress(){P.lastRegionTransition=null;turnManager.reset();P.steps=P.teleports=0;P.playHistory=[];resetRegions();resetPosition();}
function recordPlay(){P.playHistory.push(snapshot());if(P.playHistory.length>150)P.playHistory.shift();}
function undo(){cancelFoldMotion();if(P.moving||P.mode!=='play')return;const previous=P.playHistory.pop();if(previous)restore(previous);}
return {firebirdThreat,refreshFirebirdThreat,foldHighlightRegions,prepareFoldMotion,beginFoldDrag,updateFoldDrag,endFoldDrag,cancelFoldMotion,turnManager,setPlayerProperties,interact,setFreeTeleport,testTeleport,setFoldHints,recordPlay,undo,resetPosition,resetProgress,canMoveTo,validateForPlay,exitIsValid,isAtExit,foldTargetFor,finishRun,checkRunEnd,clearSelection,selectPlayer,reflectPoint,foldTarget,selectFold,animatePlayer,transitionRegion,applyTerrainEntry,movePlayer,teleport,turn,resetRegions,setMode,restart,retry,snapshot,restore,tick,click,updateLifts};
}
module.exports={playerPrefabDefaults,Trigger,TurnPhase,createTurnManager,createPlayerState,createPlayerController,initialLiftState:liftInitial,advanceLift,rayCells};
