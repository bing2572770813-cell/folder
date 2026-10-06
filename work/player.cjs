// Player state and all gameplay interaction live here; rendering is supplied by the scene adapter.
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
    terrainState: null,
    revealedRegions: new Set(),
  };
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
function canMoveTo(r,c){const map=env.getMap();const delta=(map.tiles[r]?.[c]?.height??.09)-(map.tiles[P.player.r]?.[P.player.c]?.height??.09);return walkable(r,c)&&delta<=P.moveHeight.maxUp+1e-9&&-delta<=P.moveHeight.maxDown+1e-9&&canEnterTerrain(map,{r,c},P.terrainState).valid;}
function setPlayerProperties({
    r,
    c,
    dir,
    maxUp,
    maxDown,
    foldVertical = P.foldDrop.vertical,
    foldHorizontal = P.foldDrop.horizontal,
    overheat = P.terrainState.overheat,
    frozen = P.terrainState.frozen,
    actions = P.terrainState.actions,
    collectedKeys = P.terrainState.collectedKeys,
  }) {
 if(P.mode!=='play'||P.moving||P.foldMotion)throw new Error('请在游玩模式且移动结束后修改玩家属性');
 if(![foldVertical,foldHorizontal].every(n=>Number.isFinite(n)&&n>0&&n<=16))throw new Error('折纸落点阈值须大于 0 且不超过 16');
 if(!inside(r,c)||!Number.isInteger(dir)||dir<0||dir>7)throw new Error('玩家坐标或朝向无效');
 if(![maxUp,maxDown].every(n=>Number.isFinite(n)&&n>=0&&n<=16))throw new Error('可移动高度差须为 0–16');
 if(!Number.isSafeInteger(overheat)||overheat<0||!Number.isSafeInteger(actions)||actions<0||typeof frozen!=='boolean')throw new Error('过热与机制行动次数须为非负整数，冰冻须为布尔值');
 const keys=new Set(env.getMap().tiles.flat().filter(t=>t?.terrain==='key'&&!blocked(t)).map(t=>t.keyName?.trim()||'钥匙'));
 if(!Array.isArray(collectedKeys)||collectedKeys.some(k=>typeof k!=='string'||!keys.has(k)))throw new Error('已收集钥匙须为地图中合法钥匙名的 JSON 数组');
 const terrainState={...P.terrainState,overheat,frozen,actions,collectedKeys:[...new Set(collectedKeys)],hasKey:collectedKeys.length>0,eruptionOpen:actions>0&&actions%3===2};
 const tile=env.getMap().tiles[r]?.[c];if(!tile||blocked(tile)||((r!==P.player.r||c!==P.player.c)&&!canEnterTerrain(env.getMap(),{r,c},terrainState).valid))throw new Error('玩家坐标需要可通行实体');
 record();P.player={r,c,dir};P.moveHeight={maxUp,maxDown};P.foldDrop={vertical:foldVertical,horizontal:foldHorizontal};P.terrainState=terrainState;P.revealedRegions.add(regionOf(tile));clearSelection();buildPaper();renderPlayer();updateUI();
}
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
  }
function selectPlayer(){const map=env.getMap();clearSelection();env.getSelectionRing().visible=true;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const r=P.player.r+dr,c=P.player.c+dc;if(canMoveTo(r,c)){P.legalMoves.push({r,c});overlay(r,c,'#bce772',.44);tileOutline(r,c,'#7a9b52');}}if(P.foldHints){const seen=new Set();for(const axis of env.getFoldAxes()){const target=foldTarget(axis),key=target.r+','+target.c;if(!target.valid||seen.has(key))continue;seen.add(key);P.legalFoldMoves.push({r:target.r,c:target.c,axis:{r:axis.r,c:axis.c,type:axis.type}});if(!P.legalMoves.some(p=>p.r===target.r&&p.c===target.c)){overlay(target.r,target.c,'#91d6c9',.4);tileOutline(target.r,target.c,'#4b967d');}}}$('toolStatus').textContent='玩家 '+coord(P.player.r,P.player.c);}
function reflectPoint(r,c,axis){const map=env.getMap();const dr=r-axis.r,dc=c-axis.c;if(axis.type==='h')return {r:axis.r-dr,c};if(axis.type==='v')return {r,c:axis.c-dc};if(axis.type==='d1')return {r:axis.r+dc,c:axis.c+dr};return {r:axis.r-dc,c:axis.c-dr};}
function foldTarget(axis){const map=env.getMap();return foldTargetFor(axis,P.player);}
function selectFold(r,c,preferredType=null){const map=env.getMap();const directions=foldsAt(map,r,c),previous=P.chosenFold;const index=previous?.r===r&&previous?.c===c?(directions.indexOf(previous.type)+1)%directions.length:0;clearSelection();P.chosenFold={r,c,type:preferredType??directions[index]};const t=foldTarget(P.chosenFold);overlay(r,c,'#e7ce67',.35);tileOutline(r,c,'#ac9456');
  const a=P.chosenFold;env.invalidateAxes();
  if(inside(t.r,t.c)){overlay(t.r,t.c,t.valid?'#91d6c9':'#de9b91',.4);tileOutline(t.r,t.c,t.valid?'#4b967d':'#b4594e');}
  $('foldTitle').textContent=coord(r,c)+' · '+FOLD_NAMES[a.type];$('foldDetail').textContent=t.valid?coord(P.player.r,P.player.c)+' → '+coord(t.r,t.c):t.reason;$('teleportBtn').disabled=!t.valid;$('toolStatus').textContent=t.valid?'再次点击 '+coord(t.r,t.c)+' 传送':t.reason;
}
function setFreeTeleport(enabled){P.freeTeleport=!!enabled;clearSelection();updateUI();}
function testTeleport(r, c) {
    const map = env.getMap();
    if (
      P.mode !== "play" ||
      !P.freeTeleport ||
      P.moving ||
      P.foldMotion ||
      P.levelWon ||
      P.stepLimitHit ||
      !inside(r, c)
    )
      return;
    const tile = map.tiles[r]?.[c];
    if (
      !tile ||
      blocked(tile) ||
      !canEnterTerrain(map, { r, c }, P.terrainState).valid
    ) {
      toast("测试传送需要可通行实体", true);
      return;
    }
    if (r === P.player.r && c === P.player.c) return;
    record();
    const prev = { ...P.player };
    P.revealedRegions.add(regionOf(tile));
    P.player = { r, c, dir: P.player.dir };
    P.steps++;
    P.teleports++;
    applyTerrainEntry();
    clearSelection();
    buildPaper();
    animatePlayer(prev, P.player, "teleport");
    updateUI();
  }
function setFoldHints(enabled){P.foldHints=!!enabled;const axis=P.chosenFold,selected=env.getSelectionRing().visible;if(axis)selectFold(axis.r,axis.c,axis.type);else if(selected)selectPlayer();updateUI();}
function animatePlayer(from,to,type){const map=env.getMap();P.moving=true;P.animation={start:performance.now(),duration:type==='teleport'?480:220,from:new THREE.Vector3(wx(from.c),tileTop(from.r,from.c)+.018,wz(from.r)),to:new THREE.Vector3(wx(to.c),tileTop(to.r,to.c)+.018,wz(to.r)),type,checkEnd:true};updateUI();}
function transitionRegion(){const map=env.getMap();const tile=map.tiles[P.player.r]?.[P.player.c],target=tile?.tags?.exitTo;if(!target)return false;const missing=(tile.tags.requiredKeys??[]).filter(k=>!P.terrainState.collectedKeys.includes(k));if(missing.length){P.terrainState.message='出口还需要钥匙：'+missing.join('、');return false;}const entry=taggedCells(map,'entry').find(p=>regionOf(p.tile)===target);P.revealedRegions.add(target);if(!entry){buildPaper();toast('显示区域：'+target);return false;}P.player={r:entry.r,c:entry.c,dir:P.player.dir};buildPaper();toast('进入区域：'+target);return true;}
function collectKey(){const tile=env.getMap().tiles[P.player.r]?.[P.player.c];if(tile?.terrain!=='key'||blocked(tile))return;const name=tile.keyName?.trim()||'钥匙';P.terrainState.collectedKeys=[...new Set([...P.terrainState.collectedKeys,name])];P.terrainState.hasKey=true;P.terrainState.message='获得钥匙：'+name;}
function applyTerrainEntry(){const map=env.getMap();const result=enterTerrain(map,P.player,P.terrainState);P.terrainState=finishAction(result.state);collectKey();const transitioned=!P.terrainState.gameOver&&transitionRegion();if(transitioned){P.terrainState=enterTerrain(map,P.player,P.terrainState).state;collectKey();}if(P.terrainState.message)toast(P.terrainState.message,P.terrainState.gameOver);return transitioned;}
function movePlayer(r, c) {
    const map = env.getMap();
    if (P.mode !== "play" || P.moving || P.foldMotion || P.levelWon || P.stepLimitHit) return;
    if (!P.legalMoves.some((t) => t.r === r && t.c === c) || !canMoveTo(r, c)) {
      toast(
        canEnterTerrain(map, { r, c }, P.terrainState).reason ||
          (walkable(r, c)
            ? "请先点击玩家查看可移动范围"
            : "黑色或空格方块不可移动"),
        true,
      );
      return;
    }
    record();
    const prev = { ...P.player },
      dr = r - P.player.r,
      dc = c - P.player.c;
    P.player.r = r;
    P.player.c = c;
    P.player.dir = (Math.round(Math.atan2(dc, -dr) / (Math.PI / 4)) + 8) % 8;
    P.steps++;
    const transitioned = applyTerrainEntry();
    clearSelection();
    animatePlayer(prev, P.player, transitioned ? "teleport" : "move");
    updateUI();
  }
function teleport(axis = null) {
    const map = env.getMap();
    if (P.mode !== "play" || P.moving || P.foldMotion || P.levelWon || P.stepLimitHit) return;
    if (!axis && !P.chosenFold) {
      toast("请先选择折纸线", true);
      return;
    }
    const chosen = axis ?? P.chosenFold;
    const t = foldTarget(chosen);
    if (!t.valid) {
      toast(t.reason + "，无法传送", true);
      return;
    }
    record();
    const prev = { ...P.player },
      a = { ...chosen };
    const forward = reflectPoint(
      P.player.r - Math.cos((P.player.dir * Math.PI) / 4),
      P.player.c + Math.sin((P.player.dir * Math.PI) / 4),
      a,
    );
    const dr = forward.r - t.r,
      dc = forward.c - t.c;
    P.player = {
      r: t.r,
      c: t.c,
      dir: (Math.round(Math.atan2(dc, -dr) / (Math.PI / 4)) + 8) % 8,
    };
    P.steps++;
    P.teleports++;
    applyTerrainEntry();
    clearSelection();
    animatePlayer(prev, P.player, "teleport");
    updateUI();
    if (!P.terrainState.message)
      toast("折纸传送 · " + coord(prev.r, prev.c) + " → " + coord(t.r, t.c));
  }
function turn(delta) {
    const map = env.getMap();
    if (P.moving || P.foldMotion) return;
    record();
    P.player.dir = (P.player.dir + delta + 8) % 8;
    if (P.mode === "edit") {
      map.spawn.dir = P.player.dir;
      persist();
    }
    renderPlayer();
    updateUI();
  }
function resetRegions(){const map=env.getMap();const spawn=taggedCells(map,'spawn')[0];if(spawn){map.spawn={r:spawn.r,c:spawn.c,dir:map.spawn.dir};P.revealedRegions=new Set([regionOf(spawn.tile)]);}else P.revealedRegions=new Set();}
function setMode(next){const map=env.getMap();if(P.mode===next)return;if(next==='play'){const check=validateForPlay();if(!check.valid){toast(check.errors.join('；'),true);return;}}env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();env.getPlayerGroup().scale.setScalar(1);P.mode=next;if(next==='edit')P.freeTeleport=false;resetRegions();P.steps=0;P.teleports=0;P.playHistory=[];P.player={...map.spawn};resetPrefabState();if(P.mode==='play')collectKey();clearSelection();buildPaper();renderPlayer();updateUI();if(P.mode==='play')checkRunEnd();}
function restart(){const map=env.getMap();if(P.moving)return;env.resetDebugState?.();P.animation=null;P.moving=false;P.levelWon=false;P.stepLimitHit=false;P.terrainState=createTerrainState();resetRegions();P.player={...map.spawn};resetPrefabState();P.steps=P.teleports=0;P.playHistory=[];collectKey();clearSelection();buildPaper();renderPlayer();updateUI();toast('已回到玩家起点');checkRunEnd();}
function snapshot() {
    const map = env.getMap();
    return {
      player: { ...P.player },
      moveHeight: { ...P.moveHeight },
      foldDrop: { ...P.foldDrop },
      steps: P.steps,
      teleports: P.teleports,
      terrainState: clone(P.terrainState),
      revealedRegions: [...P.revealedRegions],
    };
  }
function restore(previous) {
    cancelFoldMotion();
    const map = env.getMap();
    P.player = { ...previous.player };
    P.moveHeight = { ...(previous.moveHeight ?? { maxUp: 1, maxDown: 1 }) };
    P.foldDrop = {
      ...(previous.foldDrop ?? { vertical: 1, horizontal: 0.35 }),
    };
    P.steps = previous.steps;
    P.teleports = previous.teleports;
    P.terrainState = clone(previous.terrainState);
    P.revealedRegions = new Set(previous.revealedRegions);
    P.levelWon = false;
    P.stepLimitHit = false;
    P.animation = null;
    P.moving = false;
    clearSelection();
    buildPaper();
    renderPlayer();
    updateUI();
    checkRunEnd();
  }
function cancelFoldMotion() {
    if (!P.foldMotion) return;
    env.foldView?.reset();
    P.foldMotion = null;
    renderPlayer();
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
    if (!group || !inFoldRange(group, P.player)) return false;
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
          !map.tiles[row][column] ||
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
      startY,
      angle: 0,
      sign: playerSide,
      phase: "drag",
      ready: false,
    };
    $("toolStatus").textContent =
      "向上拖拽折叠 · 松开落到蓝色目标，未对齐则回弹";
    updateUI();
    return true;
  }
function updateFoldDrag(clientY, dragSpan = 240) {
    const motion = P.foldMotion;
    if (!motion || motion.phase !== "drag") return false;
    motion.angle = Math.max(
      0,
      Math.min(
        Math.PI,
        ((motion.startY - clientY) / Math.max(1, dragSpan)) * Math.PI,
      ),
    );
    // For this axis convention, positive angle lifts the positive side.
    env.foldView.setAngle(motion.angle * motion.sign);
    const target = foldTarget(motion.axis),
      position = env.foldView.footPosition?.()??env.foldView.playerPosition();
    const horizontal = Math.hypot(
        position[0] - wx(target.c),
        position[2] - wz(target.r),
      ),
      vertical = position[1] - tileTop(target.r, target.c);
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
    return ready;
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
      record();
      const forward = reflectPoint(
        prev.r - Math.cos((prev.dir * Math.PI) / 4),
        prev.c + Math.sin((prev.dir * Math.PI) / 4),
        motion.axis,
      );
      P.player = {
        r: target.r,
        c: target.c,
        dir:
          (Math.round(
            Math.atan2(forward.c - target.c, -(forward.r - target.r)) /
              (Math.PI / 4),
          ) +
            8) %
          8,
      };
      P.steps++;
      P.teleports++;
      applyTerrainEntry();
      clearSelection();
      buildPaper();
      animatePlayer(prev, P.player, "drop");
      P.animation.from = from;
      P.animation.duration = 350;
      env.getPlayerGroup().position.copy(from);
      updateUI();
      return true;
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
function tick(now) {
    if (P.foldMotion) {
      const motion = P.foldMotion;
      if (motion.phase === "return") {
        const t = Math.min(1, (now - motion.returnStart) / 350);
        env.foldView.setAngle(motion.returnAngle * (1 - t * t * (3 - 2 * t)));
        if (t >= 1) {
          cancelFoldMotion();
          clearSelection();
          renderPlayer();
          updateUI();
        }
      }
      return;
    }
    const map = env.getMap();
    if (!P.animation) return;
    const t = Math.min(1, (now - P.animation.start) / P.animation.duration),
      smooth = t * t * (3 - 2 * t);
    if (P.animation.type === "teleport") {
      if (t < 0.5) {
        env.getPlayerGroup().position.copy(P.animation.from);
        env.getPlayerGroup().scale.setScalar(Math.max(0.03, 1 - t * 2));
      } else {
        env.getPlayerGroup().position.copy(P.animation.to);
        env.getPlayerGroup().scale.setScalar(Math.max(0.03, (t - 0.5) * 2));
      }
    } else if(P.animation.type==='drop'){
      const position=env.getPlayerGroup().position;
      position.lerpVectors(P.animation.from,P.animation.to,smooth);
      position.y=P.animation.from.y+(P.animation.to.y-P.animation.from.y)*t*t;
    } else
      env
        .getPlayerGroup()
        .position.lerpVectors(P.animation.from, P.animation.to, smooth);
    env.getPlayerGroup().rotation.y = (-P.player.dir * Math.PI) / 4;
    if (t >= 1) {
      P.animation = null;
      P.moving = false;
      env.getPlayerGroup().scale.setScalar(1);
      renderPlayer();
      checkRunEnd();
      click(P.player.r, P.player.c);
      updateUI();
    }
  }
function click(r, c) {
    const map = env.getMap();
    if (
      P.mode !== "play" ||
      P.moving ||
      P.foldMotion ||
      P.levelWon ||
      P.stepLimitHit
    )
      return;
    if (P.freeTeleport && (r !== P.player.r || c !== P.player.c)) {
      testTeleport(r, c);
      return;
    }
    if (env.isHidden(r, c)) return;
    if (P.chosenFold) {
      const target = foldTarget(P.chosenFold);
      if (target.valid && target.r === r && target.c === c) {
        teleport();
        return;
      }
    }
    if (r === P.player.r && c === P.player.c) {
      if (env.getSelectionRing().visible) clearSelection();
      else selectPlayer();
      return;
    }
    if (P.legalMoves.some((t) => t.r === r && t.c === c)) {
      movePlayer(r, c);
      return;
    }
    const foldMove = P.legalFoldMoves.find((t) => t.r === r && t.c === c);
    if (foldMove) {
      teleport(foldMove.axis);
      return;
    }
    if (foldsAt(map, r, c).length) {
      selectFold(r, c);
      return;
    }
    if (P.legalMoves.length) {
      toast(
        walkable(r, c) ? "该方块不在可移动范围内" : "黑色或空格方块不可移动",
        true,
      );
    } else if (!walkable(r, c)) {
      toast("黑色或空格方块不可移动", true);
    }
    clearSelection();
  }
function resetPosition(){P.player={...env.getMap().spawn};}
function resetProgress(){P.steps=P.teleports=0;P.playHistory=[];resetRegions();resetPosition();}
function recordPlay(){P.playHistory.push(snapshot());if(P.playHistory.length>150)P.playHistory.shift();}
function undo() {
    cancelFoldMotion();
    if (P.moving || P.mode !== "play") return;
    const previous = P.playHistory.pop();
    if (previous) restore(previous);
  }
return {beginFoldDrag,updateFoldDrag,endFoldDrag,cancelFoldMotion,setPlayerProperties,setFreeTeleport,testTeleport,setFoldHints,recordPlay,undo,resetPosition,resetProgress,canMoveTo,validateForPlay,exitIsValid,isAtExit,foldTargetFor,finishRun,checkRunEnd,clearSelection,selectPlayer,reflectPoint,foldTarget,selectFold,animatePlayer,transitionRegion,applyTerrainEntry,movePlayer,teleport,turn,resetRegions,setMode,restart,snapshot,restore,tick,click};
}
module.exports={createPlayerState,createPlayerController,playerPrefabDefaults};
