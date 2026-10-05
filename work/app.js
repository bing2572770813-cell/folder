import * as THREE from 'three';
import { normalizeTile, normalizePrefab, foldsOf, blocked, tileHeight, columnLabel, applyFoldLine } from './tile-model.mjs';
import demoMap from '../outputs/fold-field-demo.json';
import { rectangle, region, pasteRegion } from './editor-model.mjs';
import { Copy, ClipboardPaste, Redo2 } from 'lucide';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createElement, Origami, FilePlus2, FolderOpen, Download, Pencil, Play, Paintbrush, SquarePlus, Eraser, Split, Navigation, Flag, Grid2x2, X, RotateCcw, RotateCw, Scaling, Waypoints, Box, Layers2, Plus, Minus, Scan, Undo2, Compass, Square } from 'lucide';

const icons = { Origami, FilePlus2, FolderOpen, Download, Pencil, Play, Paintbrush, SquarePlus, Eraser, Split, Navigation, Flag, Grid2x2, X, RotateCcw, RotateCw, Scaling, Waypoints, Box, Layers2, Plus, Minus, Scan, Undo2, Compass, Square, Copy, ClipboardPaste, Redo2 };
for (const node of document.querySelectorAll('[data-lucide]')) {
  const name=node.dataset.lucide.replace(/(^|-)([a-z0-9])/g,(_,prefix,char)=>char.toUpperCase());
  const svg=createElement(icons[name]);svg.setAttribute('aria-hidden','true');node.replaceWith(svg);
}
const $ = id => document.getElementById(id);
const GAME_ONLY = Boolean(window.__FOLD_FIELD_GAME_ONLY__);
if (GAME_ONLY) document.body.classList.add('game-only');
const COLORS = { white: '#f4f5ed', red: '#e97c73', yellow: '#e9cf72', blue: '#7ebed3', green: '#91bd83', purple: '#b6a0d0', black: '#303a38' };
const COLOR_NAMES = { white: '纸白', red: '珊瑚红', yellow: '麦穗黄', blue: '天空蓝', green: '叶绿', purple: '丁香紫', black: '炭黑' };
const FOLDS = ['h','v','d1','d2'];
const FOLD_NAMES = { h: '横向折线', v: '纵向折线', d1: '对角折线 ↘', d2: '对角折线 ↗' };
const FACE_NAMES = ['北','东北','东','东南','南','西南','西','西北'];
const STORAGE_KEY = 'fold-field-map-v1';
const EMBEDDED_MAP = window.__FOLD_FIELD_EXPORT_MAP__;
const clone = data => JSON.parse(JSON.stringify(data));
const blankTile = () => normalizeTile({color:'white',fold:null});
let brushHeight=.09, selectedPrefabId=null, prefabs=(window.__FOLD_FIELD_PREFABS__||[]).map(normalizePrefab);
function brushTile(){const prefab=prefabs.find(p=>p.id===selectedPrefabId);return normalizeTile({...prefab?.tile,color,height:brushHeight,blocked:prefab?prefab.tile.blocked:color==='black',prefabId:prefab?.id??null});}
let map = defaultMap(), player = { ...map.spawn }, mode = GAME_ONLY ? 'play' : 'edit', tool = 'paint', color = 'white', foldType = 'h';
let steps = 0, teleports = 0, moving = false, levelWon = false, stepLimitHit = false, legalMoves = [], chosenFold = null, hovered = null, showGrid = true;
let editHistory = [], playHistory = [], animation = null, saveTimer = null, tooltipTimer = null;
let redoHistory=[], editRect=null, clipboard=null, pendingRegion=null, gestureBefore=null;
try { const saved = EMBEDDED_MAP || localStorage.getItem(STORAGE_KEY); if (saved) { map = validateMap(typeof saved === 'string' ? JSON.parse(saved) : saved,true); player = { ...map.spawn }; } } catch { /* An invalid saved map falls back to the sample map. */ }

function defaultMap() {
  return validateMap(clone(demoMap),true);
}
function inside(r,c) { return Number.isInteger(r) && Number.isInteger(c) && r>=0 && c>=0 && r<map.height && c<map.width; }
function walkable(r,c) { return inside(r,c) && map.tiles[r][c] !== null && !blocked(map.tiles[r][c]); }
function coord(r,c) { return columnLabel(c)+(r+1); }
function validateMap(data,allowDraft=false) {
  if (!data || data.version !== 1 || !Number.isInteger(data.width) || !Number.isInteger(data.height) || data.width<3 || data.width>128 || data.height<3 || data.height>128) throw new Error('地图尺寸须为 3–128，格式版本须为 1');
  if (!Array.isArray(data.tiles) || data.tiles.length!==data.height) throw new Error('地图数据不完整');
  const tiles = data.tiles.map(row => { if(!Array.isArray(row)||row.length!==data.width)throw new Error('地图行列不匹配'); return row.map(normalizeTile); });
  const s=data.spawn;
  if(!s || !Number.isInteger(s.r)||!Number.isInteger(s.c)||!Number.isInteger(s.dir)||s.r<0||s.c<0||s.r>=data.height||s.c>=data.width||s.dir<0||s.dir>7||(!allowDraft&&(!tiles[s.r][s.c]||blocked(tiles[s.r][s.c]))))throw new Error('玩家起点必须在可行走方块上');
  const exit=data.exit==null?null:data.exit;
  if(exit!==null&&(!Number.isInteger(exit.r)||!Number.isInteger(exit.c)||exit.r<0||exit.c<0||exit.r>=data.height||exit.c>=data.width||(!allowDraft&&(!tiles[exit.r][exit.c]||blocked(tiles[exit.r][exit.c])))))throw new Error('出口必须在可行走方块上');
  const maxSteps=data.maxSteps==null?0:Number(data.maxSteps);
  if(!Number.isInteger(maxSteps)||maxSteps<0||maxSteps>999)throw new Error('最大步数须为 0–999 的整数');
  const bestSteps=data.bestSteps==null?null:Number(data.bestSteps);
  if(bestSteps!==null&&(!Number.isInteger(bestSteps)||bestSteps<0||bestSteps>9999))throw new Error('最佳步数无效');
  return {version:1,width:data.width,height:data.height,tiles,spawn:{r:s.r,c:s.c,dir:s.dir},exit:exit?{r:exit.r,c:exit.c}:null,name:typeof data.name==='string'&&data.name.trim()?data.name.trim().slice(0,48):'未命名关卡',description:typeof data.description==='string'?data.description.slice(0,240):'',maxSteps,bestSteps};
}
function validateForPlay() {
  const errors=[];
  if(!walkable(map.spawn.r,map.spawn.c))errors.push('玩家起点无效');
  if(!map.exit)errors.push('请在编辑模式设置出口');
  else if(!walkable(map.exit.r,map.exit.c))errors.push('出口必须在可行走方块上');
  return {valid:errors.length===0,errors};
}
function exitIsValid() { return !!map.exit&&walkable(map.exit.r,map.exit.c); }
function isAtExit() { return exitIsValid()&&player.r===map.exit.r&&player.c===map.exit.c; }
function foldTargetFor(axis,position=player) {
  const t=reflectPoint(position.r,position.c,axis);const same=t.r===position.r&&t.c===position.c;let reason='';
  if(!inside(t.r,t.c))reason='目标超出地图';else if(!map.tiles[t.r][t.c])reason='目标为空格';else if(!walkable(t.r,t.c))reason='目标是阻挡方块';else if(same)reason='玩家位于对称轴上';
  return {...t,valid:!reason,reason};
}
function finishRun(kind) {
  if(kind==='win'){
    levelWon=true;stepLimitHit=false;
    if(map.bestSteps===null||steps<map.bestSteps){map.bestSteps=steps;persist();}
    $('resultTitle').textContent='通关！';
    $('resultDetail').textContent=`${map.name} · ${steps} 步${map.bestSteps===steps?' · 新纪录':''}`;
    toast(`通关！到达出口 ${coord(player.r,player.c)}`);
  } else {
    levelWon=false;stepLimitHit=true;
    $('resultTitle').textContent='步数超限';
    $('resultDetail').textContent=`本关最多 ${map.maxSteps} 步，当前已用 ${steps} 步。`;
    toast('步数超限，请重试',true);
  }
  updateUI();
}
function checkRunEnd() {
  if(mode!=='play'||levelWon||stepLimitHit)return;
  if(map.maxSteps>0&&steps>map.maxSteps){finishRun('limit');return;}
  if(isAtExit()){finishRun('win');return;}
}
function persist() { clearTimeout(saveTimer); $('saveState').textContent='保存中'; saveTimer=setTimeout(() => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(map)); $('saveState').textContent='本地已保存'; } catch { $('saveState').textContent='仅当前会话'; } },120); }
function toast(text,error=false) { $('toast').textContent=text; $('toast').classList.toggle('error',error); $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2400); }
function currentHistory() { return mode==='edit'?editHistory:playHistory; }
function trimHistory(history){let cells=history.reduce((total,item)=>total+(item.map?item.map.width*item.map.height:1),0);while(history.length>150||(history.length>1&&cells>100000)){const first=history.shift();cells-=first.map?first.map.width*first.map.height:1;}}
function editSnapshot(){return {map:clone(map),rect:editRect?{...editRect}:null};}
function record() { if(mode==='edit'&&gestureBefore)return; const history=currentHistory(); history.push(mode==='edit'?editSnapshot():{player:{...player},steps,teleports}); if(mode==='edit')redoHistory=[];trimHistory(history); updateUI(); }
function finishGesture(){if(!gestureBefore)return;const before=gestureBefore;gestureBefore=null;if(JSON.stringify(before.map)!==JSON.stringify(map)){editHistory.push(before);trimHistory(editHistory);redoHistory=[];updateUI();}}

const viewport=$('viewport');
const scene=new THREE.Scene(); scene.background=new THREE.Color('#cbd8d0');
let renderer;
try { renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); } catch {
  viewport.innerHTML='<div class="load-error"><div><strong>WebGL 暂不可用</strong><span>请在浏览器中启用硬件加速后重新打开。</span></div></div>';
  throw new Error('WebGL renderer unavailable');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
viewport.appendChild(renderer.domElement);
const camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,1200);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableRotate=false; controls.enableDamping=true; controls.dampingFactor=.12; controls.screenSpacePanning=true;
controls.minZoom=.3; controls.maxZoom=64; controls.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:THREE.MOUSE.PAN};
controls.touches={ONE:null,TWO:THREE.TOUCH.DOLLY_PAN};
let view='fixed', baseSpan=9, cameraOffset=new THREE.Vector3(), manualPan=false;
const paper=new THREE.Group(); scene.add(paper);
const ambient=new THREE.HemisphereLight('#ffffff','#708875',2.1); scene.add(ambient);
const sunlight=new THREE.DirectionalLight('#fff8e5',2.6); sunlight.position.set(-9,18,8); sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048); sunlight.shadow.camera.left=-20;sunlight.shadow.camera.right=20;sunlight.shadow.camera.top=20;sunlight.shadow.camera.bottom=-20;sunlight.shadow.camera.near=1;sunlight.shadow.camera.far=55;sunlight.shadow.bias=-.0006;sunlight.shadow.normalBias=.025; sunlight.shadow.radius=4;scene.add(sunlight);
const fill=new THREE.DirectionalLight('#d1e8ee',1.1); fill.position.set(12,5,-8); scene.add(fill);
const tileGeo=new THREE.BoxGeometry(1,1,1);
const markerGeo=new THREE.PlaneGeometry(.94,.94);
const materials=Object.fromEntries(Object.entries(COLORS).map(([k,v])=>[k,new THREE.MeshStandardMaterial({color:v,roughness:.86,flatShading:true})]));
const gridMaterial=new THREE.LineBasicMaterial({color:'#b9bdbb',transparent:true,opacity:.8});
const sharedGeometries=new Set([tileGeo,markerGeo]);
const sharedMaterials=new Set([...Object.values(materials),gridMaterial]);
let tileLayer=new THREE.Group(), foldLayer=new THREE.Group(), boardLayer=new THREE.Group(), gridLayer=new THREE.Group(), effectLayer=new THREE.Group();
paper.add(boardLayer,gridLayer,tileLayer,foldLayer,effectLayer);

const visibility={coords:true,tiles:true,folds:true,player:true};
const wx=c=>c-(map.width-1)/2, wz=r=>r-(map.height-1)/2;
function disposableClear(group) { for(const child of [...group.children]) { child.traverse(o=>{if(o.userData.ownedTexture)o.userData.ownedTexture.dispose();if(o.isInstancedMesh)o.dispose();if(o.geometry&&!sharedGeometries.has(o.geometry))o.geometry.dispose(); if(o.material&&!sharedMaterials.has(o.material)){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}}); group.remove(child); } }

function canvasTexture(draw,size=256) { const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t; }
const foldTextures=Object.fromEntries(FOLDS.map(f=>[f,canvasTexture((ctx,s)=>{ctx.strokeStyle='#ffffff';ctx.lineWidth=8;ctx.setLineDash([18,13]);ctx.beginPath();const a=14,b=s-14,m=s/2;if(f==='h'){ctx.moveTo(a,m);ctx.lineTo(b,m)}if(f==='v'){ctx.moveTo(m,a);ctx.lineTo(m,b)}if(f==='d1'){ctx.moveTo(a,a);ctx.lineTo(b,b)}if(f==='d2'){ctx.moveTo(a,b);ctx.lineTo(b,a)}ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(m,m,5,0,Math.PI*2);ctx.fill();})]));
const exitTexture=canvasTexture((ctx,s)=>{ctx.translate(s/2,s/2);ctx.fillStyle='#fff4b1';ctx.beginPath();ctx.arc(0,0,s*.32,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8b7635';ctx.lineWidth=8;ctx.stroke();ctx.fillStyle='#6a5a2c';ctx.beginPath();ctx.moveTo(-s*.16,s*.2);ctx.lineTo(-s*.16,-s*.13);ctx.lineTo(0,-s*.25);ctx.lineTo(s*.16,-s*.13);ctx.lineTo(s*.16,s*.2);ctx.closePath();ctx.fill();ctx.fillStyle='#fff4b1';ctx.beginPath();ctx.arc(s*.07,0,4,0,Math.PI*2);ctx.fill();});
const playerTexture=canvasTexture((ctx,s)=>{ctx.translate(s/2,s/2);ctx.fillStyle='#ddea90';ctx.beginPath();ctx.arc(0,0,87,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#425c3b';ctx.lineWidth=7;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-65);ctx.lineTo(41,45);ctx.lineTo(0,22);ctx.lineTo(-41,45);ctx.closePath();ctx.fillStyle='#3b5033';ctx.fill();ctx.strokeStyle='#eff5c9';ctx.lineWidth=3;ctx.stroke();});
const playerDecal=new THREE.Mesh(new THREE.PlaneGeometry(.81,.81),new THREE.MeshBasicMaterial({map:playerTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
playerDecal.rotation.x=-Math.PI/2;
const playerGroup=new THREE.Group(); playerGroup.add(playerDecal);paper.add(playerGroup);
const ringTexture=canvasTexture((ctx,s)=>{ctx.strokeStyle='#415e37';ctx.lineWidth=7;ctx.setLineDash([16,12]);ctx.beginPath();ctx.arc(s/2,s/2,s*.43,0,Math.PI*2);ctx.stroke();});
const selectionRing=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),new THREE.MeshBasicMaterial({map:ringTexture,transparent:true,depthWrite:false}));selectionRing.rotation.x=-Math.PI/2;selectionRing.position.y=.006;selectionRing.visible=false;playerGroup.add(selectionRing);
const hoverOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.94,.94)),new THREE.LineBasicMaterial({color:'#537340',depthTest:false,transparent:true,opacity:.75}));hoverOutline.rotation.x=-Math.PI/2;hoverOutline.visible=false;paper.add(hoverOutline);
function tileTop(r,c) { return map.tiles[r]?.[c]?tileHeight(map.tiles[r][c]):0; }
function renderPlayer() {playerGroup.position.set(wx(player.c),tileTop(player.r,player.c)+.018,wz(player.r));playerGroup.rotation.y=-player.dir*Math.PI/4;}

function buildPaper() {
  disposableClear(tileLayer);disposableClear(foldLayer);disposableClear(gridLayer);clearSelection();hovered=null;hoverOutline.visible=false;
  const buckets=new Map(),axes=new Map(FOLDS.map(f=>[f,[]])),edges=[];let maxHeight=0;
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){
    const tile=map.tiles[r][c];if(!tile)continue;
    const cell={r,c};if(!buckets.has(tile.color))buckets.set(tile.color,[]);buckets.get(tile.color).push(cell);
    const y=tileTop(r,c),x=wx(c),z=wz(r);maxHeight=Math.max(maxHeight,y);
    for(const direction of foldsOf(tile))axes.get(direction).push(cell);
    edges.push(x-.5,y+.002,z-.5,x+.5,y+.002,z-.5,x+.5,y+.002,z-.5,x+.5,y+.002,z+.5,x+.5,y+.002,z+.5,x-.5,y+.002,z+.5,x-.5,y+.002,z+.5,x-.5,y+.002,z-.5);
  }
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const [color,cells] of buckets){
    const mesh=new THREE.InstancedMesh(tileGeo,materials[color],cells.length);mesh.userData.cells=cells;
    cells.forEach(({r,c},i)=>{const height=tileTop(r,c);position.set(wx(c),height/2,wz(r));scale.set(1,height,1);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();tileLayer.add(mesh);
  }
  for(const [direction,cells] of axes){
    if(!cells.length)continue;
    const material=new THREE.MeshBasicMaterial({map:foldTextures[direction],color:'#49664f',transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
    const mesh=new THREE.InstancedMesh(markerGeo,material,cells.length);
    const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    cells.forEach(({r,c},i)=>{position.set(wx(c),tileTop(r,c)+.007,wz(r));matrix.compose(position,tilt,new THREE.Vector3(1,1,1));mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();foldLayer.add(mesh);
  }
  if(map.exit&&map.tiles[map.exit.r]?.[map.exit.c]){
    const marker=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({map:exitTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));marker.rotation.x=-Math.PI/2;marker.position.set(wx(map.exit.c),tileTop(map.exit.r,map.exit.c)+.012,wz(map.exit.r));foldLayer.add(marker);
  }
  const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(edges,3)),gridMaterial);gridLayer.add(grid);
  if(boardLayer.userData.size!==map.width+'x'+map.height){disposableClear(boardLayer);addAxisLabels(0);boardLayer.userData.size=map.width+'x'+map.height;}renderPlayer();applyVisibility();updateUI();
}
function addAxisLabels(maxHeight){
  const w=map.width,h=map.height,size=Math.min(4096,Math.max(w,h)*32+64);
  const texture=canvasTexture((ctx,s)=>{
    const sx=s/(w+2),sy=s/(h+2);ctx.fillStyle='#50665a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 '+Math.max(10,Math.min(sx,sy)*.42)+'px Segoe UI';
    for(let c=0;c<w;c++){ctx.fillText(columnLabel(c),(c+1.5)*sx,.5*sy);ctx.fillText(columnLabel(c),(c+1.5)*sx,(h+1.5)*sy);}
    for(let r=0;r<h;r++){ctx.fillText(String(r+1),.5*sx,(r+1.5)*sy);ctx.fillText(String(r+1),(w+1.5)*sx,(r+1.5)*sy);}
  },size);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(w+2,h+2),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false}));label.rotation.x=-Math.PI/2;label.position.y=maxHeight+.03;label.userData.ownedTexture=texture;boardLayer.add(label);
}
function applyVisibility(){
  const editing=mode==='edit';boardLayer.visible=!editing||visibility.coords;tileLayer.visible=!editing||visibility.tiles;gridLayer.visible=showGrid&&(!editing||visibility.tiles);foldLayer.visible=!editing||visibility.folds;playerGroup.visible=!editing||visibility.player;
}
for(const [id,key] of [['coordsVisible','coords'],['tilesVisible','tiles'],['foldsVisible','folds'],['playerVisible','player']])$(id).onchange=()=>{visibility[key]=$(id).checked;applyVisibility();};

function fitCamera(resetZoom=true) {
  controls.target.set(0,0,0);const distance=Math.max(24,Math.max(map.width,map.height)*2);cameraOffset.set(view==='top'?0:distance*.5,view==='top'?distance:distance*.71,view==='top'?.001:distance*.625);camera.position.copy(cameraOffset);camera.lookAt(controls.target);camera.updateMatrixWorld(true);
  const rect=viewport.getBoundingClientRect(),aspect=Math.max(.1,rect.width/rect.height);
  const corners=[];for(const x of [-map.width/2-.7,map.width/2+.7])for(const z of [-map.height/2-.7,map.height/2+.7])corners.push(new THREE.Vector3(x,0,z).applyMatrix4(camera.matrixWorldInverse));
  const ex=Math.max(...corners.map(p=>Math.abs(p.x))),ey=Math.max(...corners.map(p=>Math.abs(p.y)));
  baseSpan=Math.max(ey/.7,ex/(aspect*.79));if(resetZoom)camera.zoom=1;resize();controls.update();
}
function resize(){const {width:w,height:h}=viewport.getBoundingClientRect();renderer.setSize(w,h,false);const aspect=w/Math.max(1,h);camera.left=-baseSpan*aspect;camera.right=baseSpan*aspect;camera.top=baseSpan;camera.bottom=-baseSpan;camera.updateProjectionMatrix();}
new ResizeObserver(()=>{fitCamera(false);}).observe(viewport);
function changeView(next){view=next;for(const [id,value]of [['fixedView','fixed'],['topView','top']]){$(id).classList.toggle('active',view===value);$(id).setAttribute('aria-pressed',String(view===value));}document.querySelector('.viewport-corner span').textContent=view==='top'?'TOP VIEW':'ISOMETRIC';fitCamera();}
$('fixedView').onclick=()=>changeView('fixed');$('topView').onclick=()=>changeView('top');$('fitView').onclick=()=>fitCamera();
$('zoomIn').onclick=()=>{camera.zoom=Math.min(64,camera.zoom*1.16);camera.updateProjectionMatrix();};$('zoomOut').onclick=()=>{camera.zoom=Math.max(.3,camera.zoom/1.16);camera.updateProjectionMatrix();};

function clearSelection(){disposableClear(effectLayer);legalMoves=[];chosenFold=null;selectionRing.visible=false;if($('foldTitle')){$('foldTitle').textContent='未选择折纸线';$('foldDetail').textContent='—';$('teleportBtn').disabled=true;}}
function overlay(r,c,hex,opacity=.35){const m=new THREE.Mesh(new THREE.PlaneGeometry(.89,.89),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(wx(c),tileTop(r,c)+.016,wz(r));effectLayer.add(m);return m;}
function tileOutline(r,c,hex){const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.9,.9)),new THREE.LineBasicMaterial({color:hex,depthTest:false}));line.rotation.x=-Math.PI/2;line.position.set(wx(c),tileTop(r,c)+.024,wz(r));effectLayer.add(line);}
function selectPlayer(){clearSelection();selectionRing.visible=true;for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){if(!dr&&!dc)continue;const r=player.r+dr,c=player.c+dc;if(walkable(r,c)){legalMoves.push({r,c});overlay(r,c,'#bce772',.44);tileOutline(r,c,'#7a9b52');}}$('toolStatus').textContent='玩家 '+coord(player.r,player.c);}
function reflectPoint(r,c,axis){const dr=r-axis.r,dc=c-axis.c;if(axis.type==='h')return {r:axis.r-dr,c};if(axis.type==='v')return {r,c:axis.c-dc};if(axis.type==='d1')return {r:axis.r+dc,c:axis.c+dr};return {r:axis.r-dc,c:axis.c-dr};}
function foldTarget(axis){return foldTargetFor(axis,player);}
function selectFold(r,c){const directions=foldsOf(map.tiles[r][c]),previous=chosenFold;const index=previous?.r===r&&previous?.c===c?(directions.indexOf(previous.type)+1)%directions.length:0;clearSelection();chosenFold={r,c,type:directions[index]};const t=foldTarget(chosenFold);overlay(r,c,'#e7ce67',.35);tileOutline(r,c,'#ac9456');
  const a=chosenFold,span=Math.max(map.width,map.height)*1.6;let dx=0,dz=0;if(a.type==='h')dx=span;if(a.type==='v')dz=span;if(a.type==='d1')dx=dz=span;if(a.type==='d2'){dx=span;dz=-span;}
  const axis=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(wx(c)-dx,.33,wz(r)-dz),new THREE.Vector3(wx(c)+dx,.33,wz(r)+dz)]),new THREE.LineDashedMaterial({color:'#7d9761',dashSize:.18,gapSize:.14,transparent:true,opacity:.55,depthTest:false}));axis.computeLineDistances();effectLayer.add(axis);
  if(inside(t.r,t.c)){overlay(t.r,t.c,t.valid?'#91d6c9':'#de9b91',.4);tileOutline(t.r,t.c,t.valid?'#4b967d':'#b4594e');}
  $('foldTitle').textContent=coord(r,c)+' · '+FOLD_NAMES[a.type];$('foldDetail').textContent=t.valid?coord(player.r,player.c)+' → '+coord(t.r,t.c):t.reason;$('teleportBtn').disabled=!t.valid;$('toolStatus').textContent=t.valid?'再次点击 '+coord(t.r,t.c)+' 传送':t.reason;
}
function animatePlayer(from,to,type){moving=true;animation={start:performance.now(),duration:type==='teleport'?480:220,from:new THREE.Vector3(wx(from.c),tileTop(from.r,from.c)+.018,wz(from.r)),to:new THREE.Vector3(wx(to.c),tileTop(to.r,to.c)+.018,wz(to.r)),type,checkEnd:true};updateUI();}
function movePlayer(r,c){if(mode!=='play'||moving||levelWon||stepLimitHit)return;if(!legalMoves.some(t=>t.r===r&&t.c===c)||!walkable(r,c)){toast(walkable(r,c)?'请先点击玩家查看可移动范围':'黑色或空格方块不可移动',true);return;}record();const prev={...player},dr=r-player.r,dc=c-player.c;player.r=r;player.c=c;player.dir=(Math.round(Math.atan2(dc,-dr)/(Math.PI/4))+8)%8;steps++;clearSelection();animatePlayer(prev,player,'move');updateUI();}
function teleport(){if(mode!=='play'||moving||levelWon||stepLimitHit)return;if(!chosenFold){toast('请先选择折纸线',true);return;}const t=foldTarget(chosenFold);if(!t.valid){toast(t.reason+'，无法传送',true);return;}record();const prev={...player},a={...chosenFold};const forward=reflectPoint(player.r-Math.cos(player.dir*Math.PI/4),player.c+Math.sin(player.dir*Math.PI/4),a);const dr=forward.r-t.r,dc=forward.c-t.c;player={r:t.r,c:t.c,dir:(Math.round(Math.atan2(dc,-dr)/(Math.PI/4))+8)%8};steps++;teleports++;clearSelection();animatePlayer(prev,player,'teleport');updateUI();toast('折纸传送 · '+coord(prev.r,prev.c)+' → '+coord(t.r,t.c));}
$('teleportBtn').onclick=teleport;
$('blockHeight').onchange=()=>{const n=Number($('blockHeight').value);if(!Number.isFinite(n)||n<.01||n>16){toast('方块高度须为 0.01–16',true);$('blockHeight').value=brushHeight;return;}brushHeight=n;if(tool!=='place')setTool('paint');};

function setTool(next){pendingRegion=null;tool=next;drawEditSelection();document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});updateUI();}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>setTool(b.dataset.tool));
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(s=>{const active=s===b;s.classList.toggle('active',active);s.setAttribute('aria-pressed',String(active));});$('colorName').textContent=COLOR_NAMES[color];$('colorType').textContent=color==='black'?'阻挡方块':'普通方块';if(tool!=='place')setTool('paint');});
document.querySelectorAll('[data-fold]').forEach(b=>b.onclick=()=>{foldType=b.dataset.fold==='none'?null:b.dataset.fold;document.querySelectorAll('[data-fold]').forEach(s=>{s.classList.toggle('active',s===b);s.setAttribute('aria-pressed',String(s===b));});setTool('fold');});
$('gridToggle').onclick=()=>{showGrid=!showGrid;$('gridToggle').setAttribute('aria-pressed',String(showGrid));$('gridToggle').classList.toggle('active',showGrid);applyVisibility();};
function editAt(r,c){
  if(tool==='select'){editRect=rectangle({r,c},{r,c});drawEditSelection();return;}
  if(tool==='paste'){pasteAt(r,c);return;}
  const t=map.tiles[r][c];const isSpawn=r===map.spawn.r&&c===map.spawn.c;const isExit=map.exit&&r===map.exit.r&&c===map.exit.c;
  if(tool==='erase'){if(!t)return;if(isSpawn){toast('先把玩家起点移到其他方块',true);return;}}
  if(tool==='paint'&&!t){toast('此处为空格，请先放置方块',true);return;}
  if((tool==='paint'||tool==='place')&&blocked(brushTile())&&isSpawn){toast('玩家起点不能设为阻挡方块',true);return;}
  if((tool==='paint'||tool==='place')&&color==='black'&&isExit){toast('出口不能设为阻挡方块，请先移动出口',true);return;}
  
  if(tool==='fold'&&!t){toast('折纸线需要放在方块上',true);return;}
  
  if(tool==='player'&&!walkable(r,c)){toast('玩家起点需要可行走方块',true);return;}
  if(tool==='exit'&&!walkable(r,c)){toast('出口需要放在可行走方块上',true);return;}
  if(tool==='place'&&t||tool==='player'&&isSpawn)return;
  if(tool==='paint'&&JSON.stringify({...brushTile(),fold:t.fold,folds:foldsOf(t)})===JSON.stringify(t))return;
  if(tool==='fold'){const next=clone(map);if(!applyFoldLine(next,r,c,foldType))return;record();map=next;buildPaper();persist();return;}
  if(tool==='exit'&&isExit)return;
  record();if(tool==='erase'){map.tiles[r][c]=null;if(isExit)map.exit=null;}if(tool==='place')map.tiles[r][c]=brushTile();if(tool==='paint')map.tiles[r][c]={...brushTile(),fold:t.fold,folds:foldsOf(t)};if(tool==='player'){map.spawn={r,c,dir:map.spawn.dir};player={...map.spawn};}if(tool==='exit')map.exit={r,c};
  buildPaper();persist();updateUI();
}
function turn(delta){if(moving)return;record();player.dir=(player.dir+delta+8)%8;if(mode==='edit'){map.spawn.dir=player.dir;persist();}renderPlayer();updateUI();}
document.querySelectorAll('.rotate-left').forEach(b=>b.onclick=()=>turn(-1));document.querySelectorAll('.rotate-right').forEach(b=>b.onclick=()=>turn(1));
function setMode(next){if(mode===next)return;if(next==='play'){const check=validateForPlay();if(!check.valid){toast(check.errors.join('；'),true);return;}}animation=null;moving=false;levelWon=false;stepLimitHit=false;playerGroup.scale.setScalar(1);mode=next;steps=0;teleports=0;playHistory=[];player={...map.spawn};clearSelection();renderPlayer();updateUI();if(mode==='play')checkRunEnd();}
$('editMode').onclick=()=>setMode('edit');$('playMode').onclick=()=>setMode('play');$('startBtn').onclick=()=>setMode(mode==='edit'?'play':'edit');
$('restartBtn').onclick=()=>{if(moving)return;animation=null;moving=false;levelWon=false;stepLimitHit=false;player={...map.spawn};steps=teleports=0;playHistory=[];clearSelection();renderPlayer();updateUI();toast('已回到玩家起点');};
$('resultRetry').onclick=()=>{$('restartBtn').click();$('resultOverlay').hidden=true;};$('resultEdit').onclick=()=>{$('resultOverlay').hidden=true;setMode('edit');};
function undo(){if(moving)return;const previous=currentHistory().pop();if(!previous)return;clearSelection();if(mode==='edit'){redoHistory.push(editSnapshot());map=previous.map;editRect=previous.rect;player={...map.spawn};buildPaper();fitCamera(false);persist();}else{player=previous.player;steps=previous.steps;teleports=previous.teleports;levelWon=false;stepLimitHit=false;renderPlayer();}updateUI();}
$('undoBtn').onclick=undo;
$('redoBtn').onclick=()=>{if(mode!=='edit'||moving)return;const next=redoHistory.pop();if(!next)return;editHistory.push(editSnapshot());map=next.map;editRect=next.rect;player={...map.spawn};buildPaper();persist();};
const editSelectionLayer=new THREE.Group();paper.add(editSelectionLayer);
function drawEditSelection(){
  disposableClear(editSelectionLayer);const rect=pendingRegion||editRect;
  if(rect&&mode==='edit'){
    const geo=new THREE.PlaneGeometry(rect.w,rect.h);const valid=rect.r>=0&&rect.c>=0&&rect.r+rect.h<=map.height&&rect.c+rect.w<=map.width;
    const line=new THREE.LineSegments(new THREE.EdgesGeometry(geo),new THREE.LineBasicMaterial({color:valid?'#447db0':'#ce554c',depthTest:false}));geo.dispose();
    line.rotation.x=-Math.PI/2;line.position.set(wx(rect.c+(rect.w-1)/2),.4,wz(rect.r+(rect.h-1)/2));line.renderOrder=10;editSelectionLayer.add(line);
  }
  $('regionStatus').textContent=pendingRegion?'点击粘贴落点 · Esc 取消':editRect?coord(editRect.r,editRect.c)+' · '+editRect.w+' × '+editRect.h:'左键拖拽框选';
  $('copyRegion').disabled=!editRect;$('pasteRegion').disabled=!clipboard;
}
$('copyRegion').onclick=()=>{if(!editRect)return;clipboard=region(map,editRect);drawEditSelection();toast('选区已复制');};
$('pasteRegion').onclick=()=>{if(!clipboard)return;setTool('paste');pendingRegion={r:0,c:0,h:clipboard.length,w:clipboard[0].length};drawEditSelection();};
function pasteAt(r,c){try{const result=pasteRegion(map,clipboard,r,c);record();map=result.map;editRect=result.rect;pendingRegion=null;tool='select';player={...map.spawn};buildPaper();persist();setTool('select');}catch(err){toast(err.message,true);}}

function updateUI(){
  applyVisibility();const playing=mode==='play';$('editPanel').hidden=playing;$('playPanel').hidden=!playing;$('editMode').classList.toggle('active',!playing);$('playMode').classList.toggle('active',playing);$('canvasMode').textContent=playing?'游玩':'编辑';$('statusMode').textContent=playing?'PLAY MODE':'EDIT MODE';$('startLabel').textContent=playing?'返回编辑':'开始游玩';
  $('startBtn').setAttribute('aria-label',playing?'返回编辑':'开始游玩');$('editMode').setAttribute('aria-pressed',String(!playing));$('playMode').setAttribute('aria-pressed',String(playing));
  $('startBtn').querySelector('svg').replaceWith(createElement(playing?Pencil:Play));
  const names={select:'左键拖拽框选 · 右键拖拽平移',paste:'点击粘贴落点',paint:'方块工具 · '+COLOR_NAMES[color]+' / 高度 '+brushHeight,place:'放置方块 · '+COLOR_NAMES[color],erase:'删除方块',fold:foldType?FOLD_NAMES[foldType]:'移除折纸线',player:'设置玩家起点',exit:'设置出口'};if(!chosenFold)$('toolStatus').textContent=playing?'玩家 '+coord(player.r,player.c):names[tool];
  $('steps').textContent=$('canvasSteps').textContent=String(steps).padStart(2,'0');$('teleports').textContent=String(teleports).padStart(2,'0');$('playerCoord').textContent=coord(player.r,player.c)+' · 朝'+FACE_NAMES[player.dir];$('facingLabel').textContent=$('playFacingLabel').textContent='朝向：'+FACE_NAMES[player.dir];
  $('mapWidth').value=map.width;$('mapHeight').value=map.height;$('selectionText').textContent=map.width+' × '+map.height+' TILEMAP';
  $('gameTitle').textContent=map.name;$('gameDescription').textContent=map.description||'到达黄色出口即可通关。';$('gameHint').textContent=playing?'点击玩家查看八方向移动；点击折纸线高亮目标，再次点击目标方块传送。':'编辑模式：设置起点和出口后开始游玩。';$('gameHud').hidden=!playing;
  $('resultOverlay').hidden=!(playing&&(levelWon||stepLimitHit));
  let tiles=0,blocks=0,folds=0;for(const row of map.tiles)for(const t of row){if(!t)continue;tiles++;if(blocked(t))blocks++;folds+=foldsOf(t).length;}$('tileCount').textContent=tiles+' TILES';$('mapStats').textContent=(tiles-blocks)+' 可通行 / '+blocks+' 阻挡 / '+folds+' 折纸线';
  $('undoBtn').disabled=!currentHistory().length||moving;$('restartBtn').disabled=!playing||moving;document.querySelectorAll('.rotate-left,.rotate-right').forEach(b=>b.disabled=moving);$('teleportBtn').disabled=moving||!chosenFold||!foldTarget(chosenFold).valid;
  $('redoBtn').disabled=mode!=='edit'||!redoHistory.length||moving;drawEditSelection();
  syncState();
}

function replaceMap(next,save=true){record();editRect=null;pendingRegion=null;map=validateMap(next);player={...map.spawn};steps=teleports=0;playHistory=[];buildPaper();fitCamera();if(save)persist();updateUI();}
$('newMap').onclick=()=>{setMode('edit');const tiles=Array.from({length:map.height},()=>Array.from({length:map.width},blankTile));replaceMap({version:1,width:map.width,height:map.height,tiles,spawn:{r:Math.floor(map.height/2),c:Math.floor(map.width/2),dir:0},exit:null,name:'未命名关卡',description:'',maxSteps:0,bestSteps:null});toast('已新建空白地图');};
$('resizeMap').onclick=()=>{const width=Number($('mapWidth').value),height=Number($('mapHeight').value);if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width>128||height>128){toast('宽度和高度须为 3–128 的整数',true);return;}if(width===map.width&&height===map.height)return;const tiles=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>r<map.height&&c<map.width?clone(map.tiles[r][c]):blankTile()));const spawn={r:Math.min(map.spawn.r,height-1),c:Math.min(map.spawn.c,width-1),dir:map.spawn.dir};if(!tiles[spawn.r][spawn.c]||blocked(tiles[spawn.r][spawn.c]))tiles[spawn.r][spawn.c]=blankTile();const exit=map.exit&&map.exit.r<height&&map.exit.c<width?{...map.exit}:null;replaceMap({version:1,width,height,tiles,spawn,exit,name:map.name,description:map.description,maxSteps:map.maxSteps,bestSteps:map.bestSteps});toast('地图尺寸已更新');};
$('exportMap').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(map,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='fold-field-map.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('地图已导出');};
$('importMap').onclick=()=>$('mapFile').click();$('mapFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>16000000)throw new Error('地图文件过大');const next=validateMap(JSON.parse(await file.text()));setMode('edit');replaceMap(next);toast('地图导入完成');}catch(err){toast('导入失败：'+err.message,true);}e.target.value='';};


function exportGameHtml(){
  const check=validateForPlay();
  if(!check.valid){toast(check.errors.join('；'),true);return;}
  const current=document.documentElement.outerHTML;
  const boot='<script>window.__FOLD_FIELD_PREFABS__='+JSON.stringify(prefabs).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_EXPORT_MAP__='+JSON.stringify(map).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_GAME_ONLY__=true;</script>';
  const html='<!doctype html>\n'+current.replace(/<script>/i,boot+'<script>');
  const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
  const a=document.createElement('a');a.href=url;a.download='game.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('独立游戏已导出为 game.html');
}
$('exportGame').onclick=exportGameHtml;

const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerDown=null,lastClickTile=null,lastEditKey=null,dragEdited=false,multiTouch=false;const activePointers=new Set();
function hitAt(clientX,clientY){
  const b=renderer.domElement.getBoundingClientRect();mouse.set((clientX-b.left)/b.width*2-1,-(clientY-b.top)/b.height*2+1);raycaster.setFromCamera(mouse,camera);
  const surface=raycaster.intersectObjects(tileLayer.children,false)[0];
  if(surface?.instanceId!==undefined)return surface.object.userData.cells[surface.instanceId];
  const point=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!point)return null;
  const local=paper.worldToLocal(point),c=Math.floor(local.x+map.width/2),r=Math.floor(local.z+map.height/2);return inside(r,c)?{r,c}:null;
}
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{activePointers.add(e.pointerId);if(activePointers.size>1)multiTouch=true;pointerDown={x:e.clientX,y:e.clientY,button:e.button,pointerType:e.pointerType};lastEditKey=null;dragEdited=false;manualPan=e.button===2;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{
  if(manualPan){hoverOutline.visible=false;return;}const hit=hitAt(e.clientX,e.clientY);hovered=hit;
  if(hit){hoverOutline.visible=true;hoverOutline.position.set(wx(hit.c),tileTop(hit.r,hit.c)+.035,wz(hit.r));$('hoverCoord').textContent=coord(hit.r,hit.c)+' · '+(map.tiles[hit.r][hit.c]?COLOR_NAMES[map.tiles[hit.r][hit.c].color]:'空格');}else{hoverOutline.visible=false;$('hoverCoord').textContent='—';}
  if(mode==='edit'&&tool==='paste'&&hit&&clipboard){pendingRegion={r:hit.r,c:hit.c,h:clipboard.length,w:clipboard[0].length};drawEditSelection();}
  if(mode==='edit'&&tool==='select'&&pointerDown?.button===0&&!multiTouch&&hit){const start=hitAt(pointerDown.x,pointerDown.y);if(start){editRect=rectangle(start,hit);dragEdited=true;drawEditSelection();}return;}
  const dragTools=new Set(['paint','place','erase','fold']);
  if(mode==='edit'&&pointerDown?.button===0&&!multiTouch&&!dragEdited&&dragTools.has(tool)&&hit&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6){
    gestureBefore=editSnapshot();const start=hitAt(pointerDown.x,pointerDown.y);
    if(start){editAt(start.r,start.c);lastEditKey=start.r+','+start.c;}
    dragEdited=true;
  }
  if(mode==='edit'&&pointerDown?.button===0&&!multiTouch&&dragEdited&&dragTools.has(tool)&&hit){
    const key=hit.r+','+hit.c;
    if(key!==lastEditKey){editAt(hit.r,hit.c);lastEditKey=key;}
  }
});
renderer.domElement.addEventListener('pointerleave',()=>{hoverOutline.visible=false;hovered=null;$('hoverCoord').textContent='—';});
renderer.domElement.addEventListener('pointercancel',e=>{finishGesture();activePointers.delete(e.pointerId);if(!activePointers.size)multiTouch=false;pointerDown=null;lastEditKey=null;dragEdited=false;manualPan=false;});
renderer.domElement.addEventListener('pointerup',e=>{finishGesture();activePointers.delete(e.pointerId);const down=pointerDown;pointerDown=null;const wasPan=manualPan,wasMultiTouch=multiTouch,wasDrag=dragEdited;manualPan=false;lastEditKey=null;dragEdited=false;if(!activePointers.size)multiTouch=false;if(activePointers.size||wasMultiTouch||!down||down.button!==0||wasPan||wasDrag||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||moving)return;const hit=hitAt(e.clientX,e.clientY);if(!hit){clearSelection();return;}const {r,c}=hit;lastClickTile={r,c};if(mode==='edit'){editAt(r,c);return;}if(chosenFold){const target=foldTarget(chosenFold);if(target.valid&&target.r===r&&target.c===c){teleport();return;}}if(r===player.r&&c===player.c){selectPlayer();return;}if(legalMoves.some(t=>t.r===r&&t.c===c)){movePlayer(r,c);return;}if(foldsOf(map.tiles[r][c]).length){selectFold(r,c);return;}if(legalMoves.length){toast(walkable(r,c)?'该方块不在可移动范围内':'黑色或空格方块不可移动',true);}else if(!walkable(r,c)){toast('黑色或空格方块不可移动',true);}clearSelection();});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.ctrlKey&&e.key.toLowerCase()!=='z')return;if(e.repeat&&e.key.toLowerCase()==='f')return;if(e.key.toLowerCase()==='f'){e.preventDefault();teleport();}if(e.key==='Escape'){pendingRegion=null;editRect=null;clearSelection();drawEditSelection();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}});

const tooltip=$('tooltip');document.querySelectorAll('[data-tip]').forEach(el=>{el.addEventListener('mouseenter',()=>{tooltipTimer=setTimeout(()=>{const r=el.getBoundingClientRect();tooltip.textContent=el.dataset.tip;tooltip.classList.add('show');tooltip.style.left=Math.max(5,Math.min(window.innerWidth-tooltip.offsetWidth-5,r.left+r.width/2-tooltip.offsetWidth/2))+'px';tooltip.style.top=(r.bottom+7+tooltip.offsetHeight>window.innerHeight?r.top-tooltip.offsetHeight-7:r.bottom+7)+'px';},250);});el.addEventListener('mouseleave',()=>{clearTimeout(tooltipTimer);tooltip.classList.remove('show');});el.addEventListener('click',()=>{clearTimeout(tooltipTimer);tooltip.classList.remove('show');});});

let renderedFrames=0;
function syncState(){viewport.dataset.state=JSON.stringify({map,player,mode,tool,color,foldType,steps,teleports,moving,legalMoves,chosenFold,view,editRect,pendingRegion,brushHeight,selectedPrefabId,visibility,showGrid});}
function screenPoints(){
  viewport.dataset.frames=String(renderedFrames);viewport.dataset.render=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),target:controls.target.toArray(),layers:{coords:boardLayer.visible,tiles:tileLayer.visible,folds:foldLayer.visible,player:playerGroup.visible,grid:gridLayer.visible}});
  if(map.width*map.height<=512){const b=renderer.domElement.getBoundingClientRect(),points={};for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){const p=new THREE.Vector3(wx(c),tileTop(r,c)+.01,wz(r)).project(camera);points[r+','+c]={x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};}viewport.dataset.points=JSON.stringify(points);}else delete viewport.dataset.points;
}
function tick(now){requestAnimationFrame(tick);controls.update();
  if(animation){const t=Math.min(1,(now-animation.start)/animation.duration),smooth=t*t*(3-2*t);if(animation.type==='teleport'){if(t<.5){playerGroup.position.copy(animation.from);playerGroup.scale.setScalar(Math.max(.03,1-t*2));}else{playerGroup.position.copy(animation.to);playerGroup.scale.setScalar(Math.max(.03,(t-.5)*2));}}else{playerGroup.position.lerpVectors(animation.from,animation.to,smooth);}playerGroup.rotation.y=-player.dir*Math.PI/4;if(t>=1){animation=null;moving=false;playerGroup.scale.setScalar(1);renderPlayer();updateUI();checkRunEnd();}}
  $('zoomLabel').textContent=Math.round(camera.zoom*100)+'%';renderer.render(scene,camera);renderedFrames++;if(renderedFrames%10===0){screenPoints();}
}
setupPrefabs();buildPaper();fitCamera();if(mode==='play')checkRunEnd();requestAnimationFrame(tick);
// Read-only diagnostics support visual and interaction checks without bypassing the UI.
window.foldField={getState:()=>clone({map,player,mode,tool,color,foldType,steps,teleports,moving,legalMoves,chosenFold,view,renderedFrames}),screenPoint:(r,c)=>{const p=new THREE.Vector3(wx(c),tileTop(r,c)+paper.position.y+.01,wz(r)).project(camera);const b=renderer.domElement.getBoundingClientRect();return {x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};},reflect:reflectPoint};

function setupPrefabs(){
  let fingerprint='',loading=false;
  function renderCatalog(){
    const select=$('prefabType');select.replaceChildren(new Option('普通方块（自定义）',''));
    for(const prefab of prefabs)select.add(new Option(prefab.name,prefab.id));
    if(selectedPrefabId&&!prefabs.some(p=>p.id===selectedPrefabId)){selectedPrefabId=null;toast('当前实体文件已移除，切换为自定义方块');}
    select.value=selectedPrefabId||'';
  }
  async function refresh(){
    if(loading||document.hidden||GAME_ONLY||!/^https?:$/.test(location.protocol))return;
    loading=true;
    try{const response=await fetch('/api/prefabs',{cache:'no-store'});if(!response.ok)throw new Error('服务未提供实体目录');const catalog=await response.json();
      const next=catalog.prefabs.map(normalizePrefab),key=JSON.stringify(next);
      if(key!==fingerprint){prefabs=next;fingerprint=key;renderCatalog();}
      $('prefabStatus').textContent=catalog.errors.length?catalog.errors.map(e=>e.file+'：'+e.message).join('；'):'实时读取 assets/prefab · '+prefabs.length+' 种实体';
    }catch(error){$('prefabStatus').textContent='使用内置实体目录 · '+error.message;}finally{loading=false;}
  }
  renderCatalog();$('prefabStatus').textContent='内置实体目录 · 本地服务支持实时更新';
  $('prefabType').onchange=()=>{
    selectedPrefabId=$('prefabType').value||null;const prefab=prefabs.find(p=>p.id===selectedPrefabId);
    if(prefab){color=prefab.tile.color;brushHeight=prefab.tile.height;$('blockHeight').value=brushHeight;$('prefabName').value=prefab.name;
      document.querySelectorAll('[data-color]').forEach(b=>{const active=b.dataset.color===color;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});$('colorName').textContent=COLOR_NAMES[color];$('colorType').textContent=prefab.tile.blocked?'阻挡实体':'可通行实体';}
    if(tool!=='place')setTool('paint');
  };
  $('savePrefab').onclick=async()=>{
    const name=$('prefabName').value.trim();if(!name){toast('请输入实体名称',true);return;}
    const data={version:1,id:'entity_'+Date.now()+'_ai',name,tile:brushTile()};data.tile.prefabId=data.id;
    if(!/^https?:$/.test(location.protocol)){
      const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=data.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('实体已导出，请放入 assets/prefab 后启动本地服务');return;
    }
    $('savePrefab').disabled=true;
    try{const response=await fetch('/api/prefabs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const result=await response.json();if(!response.ok)throw new Error(result.error||'保存失败');await refresh();toast('实体已保存至 assets/prefab');}catch(error){toast('实体保存失败：'+error.message,true);}finally{$('savePrefab').disabled=false;}
  };
  refresh();if(!GAME_ONLY)setInterval(refresh,2000);document.addEventListener('visibilitychange',refresh);
}
