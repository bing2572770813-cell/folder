import {renderTreeNodes,renderTreeParents} from './ui/react/TreeInspector.jsx';
import {nodePermissions} from './entities/node-permissions.mjs';
import {copyTree,pasteTree} from './entities/tree-clipboard.mjs';
import {validateMap as normalizeMap} from './core/map-model.mjs';
import {moveNode,reparentNode,deleteNode,placeTreePrefab,configureNode,forkTreeDocument} from './entities/tree-commands.mjs';
import {renderTreeCells,mapForSurface} from './render/tree-render.mjs';
import {TreeDocument} from './entities/tree-document.mjs';
import {defaultComponents} from './entities/tree-runtime.mjs';
import {paperSurface} from './render/paper-surface.mjs';
import {entityType,entityChoices,entityHidden} from './entities/visibility-model.mjs';
import {legalKeyNames,renameKeyCells} from './tags/keys.mjs';
import {normalizeMapName,mapFilename} from './core/map-name.mjs';
import playerRuntime from './player.cjs';
import * as THREE from 'three';
import { normalizeTile, normalizePrefab, hasColor, foldsOf, blocked, tileHeight, tileThickness, tileGradualRate, columnLabel, applyFoldLine, foldsAt, normalizeFoldCells } from './entities/tile-model.mjs';
import { axisKey, uniqueFoldAxes, foldGroupAt, inFoldRange, foldStrokes } from './tags/fold-geometry.mjs';
import {migrateRegions,regionOf,regionNames,taggedCells,validateRegions,assignRegion,tagCell} from './tags/regions.mjs';
import {footprint,placeEntity,removeEntity} from './entities/placement-model.mjs';
import demoMap from '../outputs/fold-field-demo.json';
import { rectangle, region, pasteRegion,unionCells,cellBounds,selectionRegion } from './editor/selection-model.mjs';
import {inspectionCells,batchProperties,selectionDetails} from './editor/batch-inspection.mjs';
import {createEditSnapshot,trimHistory} from './editor/history-model.mjs';
import {clearMapCells} from './editor/clear-map.mjs';
import {inspectCell} from './entities/cell-entity.mjs';
import {EventBus} from './core/event-bus.mjs';
import {normalizeTagPrefab,assertTagAttachment,entityPropertySchema} from './tags/tag-model.mjs';
import {assertHiddenContentUnchanged} from './editor/visibility-policy.mjs';
import {projectProperties,updateProperty,mergeSerializableProperties,debugChanges} from './core/property-model.mjs';
import {DebugState} from './editor/debug-state.mjs';
import {renderEntityGrid,renderEntityChecklist,renderNameChecklist,renderRegionChecklist,renderMechanismText} from './ui/react/catalogs.jsx';
import {renderPropertyInspector,clearPropertyInspector} from './ui/property-inspector.mjs';
import { createTerrainState, canEnterTerrain, enterTerrain, finishAction, validateTerrains } from './entities/mechanism-rules.mjs';
import { Copy, ClipboardPaste, Redo2, FlameKindling, Snowflake, Flame, Mountain, KeyRound } from 'lucide';
import {Trash2} from 'lucide';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import { createElement, Origami, FilePlus2, FolderOpen, Download, Pencil, Play, Paintbrush, SquarePlus, Eraser, Split, Navigation, Flag, Grid2x2, X, RotateCcw, RotateCw, Scaling, Waypoints, Box, Layers2, Plus, Minus, Scan, Undo2, Compass, Square } from 'lucide';

const icons = { Trash2, Origami, FilePlus2, FolderOpen, Download, Pencil, Play, Paintbrush, SquarePlus, Eraser, Split, Navigation, Flag, Grid2x2, X, RotateCcw, RotateCw, Scaling, Waypoints, Box, Layers2, Plus, Minus, Scan, Undo2, Compass, Square, Copy, ClipboardPaste, Redo2 };
for (const node of document.querySelectorAll('[data-lucide]')) {
  const name=node.dataset.lucide.replace(/(^|-)([a-z0-9])/g,(_,prefix,char)=>char.toUpperCase());
  const svg=createElement(icons[name]);svg.setAttribute('aria-hidden','true');node.replaceWith(svg);
}
const $ = id => document.getElementById(id);
const onEditorTab=event=>{if(event.detail==='inspect'){setTool('select');scheduleInspection();}};
document.addEventListener('fold:editor-tab',onEditorTab);
const editorTabs={dispose:()=>document.removeEventListener('fold:editor-tab',onEditorTab)};
const GAME_ONLY = Boolean(window.__FOLD_FIELD_GAME_ONLY__);
if (GAME_ONLY) document.body.classList.add('game-only');
const COLORS = { white: '#f4f5ed', red: '#e97c73', yellow: '#e9cf72', blue: '#7ebed3', green: '#91bd83', purple: '#b6a0d0', black: '#303a38' };
const COLOR_NAMES = { white: '纸白', red: '珊瑚红', yellow: '麦穗黄', blue: '天空蓝', green: '叶绿', purple: '丁香紫', black: '炭黑' };
const FOLDS = ['h','v','d1','d2'];
const FOLD_NAMES = { h: '横向折线', v: '纵向折线', d1: '对角折线 ↘', d2: '对角折线 ↗' };
const FACE_NAMES = ['北','东北','东','东南','南','西南','西','西北'];
const TERRAIN_MARKERS={campfire:{name:'篝火',icon:FlameKindling},ice:{name:'冰河',icon:Snowflake},fire:{name:'火焰',icon:Flame},eruption:{name:'喷发',icon:Mountain},key:{name:'钥匙',icon:KeyRound}};
const hiddenEntities=new Set();
const STORAGE_KEY = 'fold-field-map-v1';
const EMBEDDED_MAP = window.__FOLD_FIELD_EXPORT_MAP__;
const clone = data => JSON.parse(JSON.stringify(data));
const previewCache=new Map();let previewRenderer;
const blankTile = () => normalizeTile({...prefabs.find(p=>p.id==='paper_ai')?.tile,fold:null,folds:[]});
let brushHeight=.09, prefabs=(window.__FOLD_FIELD_PREFABS__||[]).map(normalizePrefab);
let tagCatalog=(window.__FOLD_FIELD_TAGS__||[]).map(normalizeTagPrefab);
let selectedPrefabId=prefabs.find(p=>p.id==='paper_ai')?.id??prefabs[0]?.id??null;
function brushTile(){const selected=prefabs.find(p=>p.id===selectedPrefabId);if(selected&&!selected.tile)return {prefabId:selected.id};const value=Number($('blockHeight').value);if(!Number.isFinite(value)||value<.01||value>16)throw new Error('方块高度须为 0.01–16');brushHeight=value;const prefab=prefabs.find(p=>p.id===selectedPrefabId);if(!prefab)throw new Error('没有可用实体，请在后端提供 prefab JSON');return normalizeTile({...prefab.tile,...(prefab.tile.terrain==='key'?{keyName:$('keyName').value}:{}),...(hasColor(prefab.tile)?{color}:{}),height:brushHeight,thickness:Number($('blockThickness').value),gradualRate:Number($('blockGradualRate').value),prefabId:prefab.id});}
let documentModel=new TreeDocument(defaultMap());
let map=documentModel.view(),tool='place',color='white',foldType='h';
let hovered=null,showGrid=true;
let selectedTagTool=null;
let editHistory=[],saveTimer=null,tooltipTimer=null;
let selectionMode='single';
let selectedCells=[],directSelectedCells=[],selectionBase=[],hiddenRegions=new Set();
function setSelectedCells(direct){const selection=selectionDetails(map,direct,cellHidden);directSelectedCells=selection.direct;selectedCells=selection.cells;editRect=cellBounds(selectedCells);}
let redoHistory=[], editRect=null, clipboard=null, pendingRegion=null, gestureBefore=null;
let inspectedCell=null,selectedNodeId=null,lastClickTile=null;
let inspectionFrame=0;
const debugOverrides=new DebugState(),nodeDebug=new DebugState();
const editorBus=new EventBus();
const stopMapPersistence=editorBus.on('map:changed',()=>{clearTimeout(saveTimer);$('saveState').textContent='保存中';saveTimer=setTimeout(()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(savedMap()));$('saveState').textContent='本地已保存';}catch{$('saveState').textContent='仅当前会话';}},120);});
window.addEventListener('pagehide',event=>{if(!event.persisted){stopMapPersistence();editorTabs.dispose();}});

const P=playerRuntime.createPlayerState(map.spawn,GAME_ONLY?'play':'edit');
const controller=playerRuntime.createPlayerController({state:P,THREE,$,blocked,inside,walkable,canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,legalKeyNames,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord,FOLD_NAMES,clone,persist,toast,record,updateUI,buildPaper,renderPlayer,disposableClear,overlay,tileOutline,wx:c=>wx(c),wz:r=>wz(r),tileTop,resetDebugState:()=>{debugOverrides.clear();nodeDebug.clear();clearInspection();},getMap:()=>map,getEntityWorld:()=>documentModel.world,componentRegistry:defaultComponents(),getFoldAxes:()=>foldAxes,getPlayerGroup:()=>playerGroup,getEffectLayer:()=>effectLayer,getSelectionRing:()=>selectionRing,isHidden:cellHidden,invalidateAxes:()=>{axisViewKey=null;}});
const {canMoveTo,validateForPlay,exitIsValid,isAtExit,foldTargetFor,finishRun,checkRunEnd,clearSelection,selectPlayer,reflectPoint,foldTarget,selectFold,animatePlayer,transitionRegion,applyTerrainEntry,movePlayer,teleport,turn,resetRegions,setMode}=controller;
try { const saved = EMBEDDED_MAP || localStorage.getItem(STORAGE_KEY); if (saved) { restoreMap(typeof saved === 'string' ? JSON.parse(saved) : saved); controller.resetPosition(); } } catch { /* An invalid saved map falls back to the sample map. */ }

function defaultMap() {
  return validateMap(clone(demoMap),true);
}
function inside(r,c) { return Number.isInteger(r) && Number.isInteger(c) && r>=0 && c>=0 && r<map.height && c<map.width; }
function cellHidden(r,c){const name=documentModel.cellTags[r+','+c]?.regionTag??'默认区域';return P.mode==='edit'?hiddenRegions.has(name):!P.revealedRegions.has(name);}
function nodeHidden(node){return P.mode==='edit'&&hiddenEntities.has(node.prefabId);}
function walkable(r,c) { return inside(r,c)&&!cellHidden(r,c) && map.tiles[r][c] !== null && !blocked(map.tiles[r][c]) && map.tiles[r][c].terrain!=='campfire'; }

function coord(r,c) { return columnLabel(c)+(r+1); }
function validateMap(data,allowDraft=false){return normalizeMap(data,allowDraft);}

function applyMap(next,saveHistory=false){if(P?.mode==='edit')assertHiddenContentUnchanged(documentModel.view(),next,visibility);if(P?.mode==='edit'){const before=documentModel.view();for(let r=0;r<before.height;r++)for(let c=0;c<before.width;c++)if(JSON.stringify(before.tiles[r][c])!==JSON.stringify(next.tiles[r]?.[c]??null)||JSON.stringify(foldsAt(before,r,c))!==JSON.stringify(r<next.height&&c<next.width?foldsAt(next,r,c):[])){if(cellHidden(r,c)||documentModel.world.at(r,c).some(nodeHidden))throw new Error('不能间接修改隐藏实体或区域');}}const candidate=forkTreeDocument(documentModel);candidate.applyLegacy(next);if(saveHistory)record();documentModel=candidate;map=candidate.view();}
function restoreMap(data){const next=new TreeDocument(data);documentModel=next;map=next.view();}
function savedMap(){return documentModel.serialize({projectProperties,schemaFor:node=>nodeSchema(node),schemaForCell:(r,c)=>entityPropertySchema(map.tiles[r]?.[c]??{prefabId:'void_ai'},tagCatalog)});}
function persist() {applyMap(map);for(const error of editorBus.emit('map:changed',{map}))console.error('地图状态通知失败',error);}
function toast(text,error=false) { $('toast').textContent=text; $('toast').classList.toggle('error',error); $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2400); }
function currentHistory() { return P.mode==='edit'?editHistory:P.playHistory; }
function editSnapshot(){return {...createEditSnapshot(documentModel.serialize(),editRect,selectedCells),directSelectedCells:clone(directSelectedCells)};}
function record() {if(P.mode==='play'){controller.recordPlay();updateUI();return;}if(gestureBefore)return;editHistory.push(editSnapshot());redoHistory=[];trimHistory(editHistory);updateUI();}
function finishGesture(){if(!gestureBefore)return;const before=gestureBefore;gestureBefore=null;if(JSON.stringify(before.map)!==JSON.stringify(documentModel.serialize())){editHistory.push(before);trimHistory(editHistory);redoHistory=[];updateUI();}}

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
let tileLayer=new THREE.Group(), foldLayer=new THREE.Group(), boardLayer=new THREE.Group(), gridLayer=new THREE.Group(), effectLayer=new THREE.Group(), entityEdgeLayer=new THREE.Group(), foldAxisLayer=new THREE.Group();
paper.add(boardLayer,gridLayer,tileLayer,foldLayer,effectLayer,entityEdgeLayer,foldAxisLayer);
let foldAxes=[],foldAxisMesh=null,axisViewKey=null;
const terrainLayer=new THREE.Group(),staticTokenLayer=new THREE.Group(),tagLayer=new THREE.Group(),placementLayer=new THREE.Group();paper.add(terrainLayer,staticTokenLayer,tagLayer,placementLayer);

const visibility={coords:true,folds:true,player:true};
const wx=c=>c-(map.width-1)/2, wz=r=>r-(map.height-1)/2;
function disposableClear(group) { for(const child of [...group.children]) { child.traverse(o=>{if(o.userData.ownedTexture)o.userData.ownedTexture.dispose();if(o.isInstancedMesh)o.dispose();if(o.geometry&&!sharedGeometries.has(o.geometry))o.geometry.dispose(); if(o.material&&!sharedMaterials.has(o.material)){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}}); group.remove(child); } }

function canvasTexture(draw,size=256) { const c=document.createElement('canvas');c.width=c.height=size;draw(c.getContext('2d'),size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return t; }
const terrainTextures=Object.fromEntries(Object.entries(TERRAIN_MARKERS).map(([type,marker])=>{
  const texture=canvasTexture((ctx,s)=>{ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(s/2,s/2,s*.46,0,Math.PI*2);ctx.fill();});
  const svg=createElement(marker.icon,{width:256,height:256,stroke:'#263b35','stroke-width':2.5});
  const image=new Image();image.onload=()=>{texture.image.getContext('2d').drawImage(image,40,40,176,176);texture.needsUpdate=true;refreshPrefabPreviews(type);};
  image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg.outerHTML);
  return [type,texture];
}));
const exitTexture=canvasTexture((ctx,s)=>{ctx.translate(s/2,s/2);ctx.fillStyle='#fff4b1';ctx.beginPath();ctx.arc(0,0,s*.32,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8b7635';ctx.lineWidth=8;ctx.stroke();ctx.fillStyle='#6a5a2c';ctx.beginPath();ctx.moveTo(-s*.16,s*.2);ctx.lineTo(-s*.16,-s*.13);ctx.lineTo(0,-s*.25);ctx.lineTo(s*.16,-s*.13);ctx.lineTo(s*.16,s*.2);ctx.closePath();ctx.fill();ctx.fillStyle='#fff4b1';ctx.beginPath();ctx.arc(s*.07,0,4,0,Math.PI*2);ctx.fill();});
const playerTexture=canvasTexture((ctx,s)=>{ctx.translate(s/2,s/2);ctx.fillStyle='#ddea90';ctx.beginPath();ctx.arc(0,0,87,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#425c3b';ctx.lineWidth=7;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-65);ctx.lineTo(41,45);ctx.lineTo(0,22);ctx.lineTo(-41,45);ctx.closePath();ctx.fillStyle='#3b5033';ctx.fill();ctx.strokeStyle='#eff5c9';ctx.lineWidth=3;ctx.stroke();});
const playerDecal=new THREE.Mesh(new THREE.PlaneGeometry(.81,.81),new THREE.MeshBasicMaterial({map:playerTexture,transparent:true,depthWrite:false,depthTest:false}));
playerDecal.rotation.x=-Math.PI/2;playerDecal.renderOrder=7;
const playerGroup=new THREE.Group();const activeToken=makeToken('white');playerGroup.add(activeToken);paper.add(playerGroup);const spawnMarkerGroup=new THREE.Group();spawnMarkerGroup.add(playerDecal);paper.add(spawnMarkerGroup);
const ringTexture=canvasTexture((ctx,s)=>{ctx.strokeStyle='#415e37';ctx.lineWidth=7;ctx.setLineDash([16,12]);ctx.beginPath();ctx.arc(s/2,s/2,s*.43,0,Math.PI*2);ctx.stroke();});
const selectionRing=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),new THREE.MeshBasicMaterial({map:ringTexture,transparent:true,depthWrite:false}));selectionRing.rotation.x=-Math.PI/2;selectionRing.position.y=.006;selectionRing.visible=false;playerGroup.add(selectionRing);
const hoverOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.94,.94)),new THREE.LineBasicMaterial({color:'#537340',depthTest:false,transparent:true,opacity:.75}));hoverOutline.rotation.x=-Math.PI/2;hoverOutline.visible=false;paper.add(hoverOutline);
function tileTop(r,c) { return map.tiles[r]?.[c]?tileHeight(map.tiles[r][c]):0; }
function renderPlayer() {spawnMarkerGroup.position.set(wx(map.spawn.c),tileTop(map.spawn.r,map.spawn.c)+.018,wz(map.spawn.r));spawnMarkerGroup.rotation.y=-map.spawn.dir*Math.PI/4;playerGroup.position.set(wx(P.player.c),tileTop(P.player.r,P.player.c)+.018,wz(P.player.r));playerGroup.rotation.y=-P.player.dir*Math.PI/4;}

function entityEdgeColor(tile){return tile.edgeColor??(!tile.prefabId&&!blocked(tile)?prefabs.find(p=>p.id==='paper_ai')?.tile?.edgeColor:undefined);}
function makeToken(color){
 const g=new THREE.Group(),body=new THREE.Mesh(new THREE.DodecahedronGeometry(.36,0),new THREE.MeshStandardMaterial({color:COLORS[color]??COLORS.white,roughness:.8}));body.position.y=.42;g.add(body);
 for(const x of [-.11,.11]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:'#ffffff'}));eye.position.set(x,.5,-.29);g.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.029,10,8),new THREE.MeshBasicMaterial({color:'#182721'}));pupil.position.set(x,.5,-.346);g.add(pupil);}return g;
}
function buildPaper() {
  disposableClear(placementLayer);disposableClear(staticTokenLayer);disposableClear(tagLayer);disposableClear(terrainLayer);disposableClear(tileLayer);disposableClear(foldLayer);disposableClear(gridLayer);disposableClear(entityEdgeLayer);clearSelection();hovered=null;hoverOutline.visible=false;
  const surfaces=new Map(),buckets=new Map(),edges=[],styleEdges=new Map(),terrains=new Map();
  const treeCells=renderTreeCells(documentModel,{nodeHidden,cellHidden}),surfaceMaps=new Map();
  for(const projection of treeCells.surfaceCells){
    const {r,c,tile,nodeId}=projection;
    const cell={r,c,nodeId,tile},surface=paperSurface(projection.primary?map:(surfaceMaps.get(nodeId)??(surfaceMaps.set(nodeId,mapForSurface(documentModel,nodeId)),surfaceMaps.get(nodeId))),r,c,cellHidden);if(surface){if(!surfaces.has(tile.color))surfaces.set(tile.color,{positions:[],triangleCells:[],cells:[]});const bucket=surfaces.get(tile.color);bucket.cells.push(cell);for(let i=0;i<surface.positions.length;i+=3)bucket.positions.push(surface.positions[i]+wx(c),surface.positions[i+1],surface.positions[i+2]+wz(r));for(let i=0;i<surface.positions.length/9;i++)bucket.triangleCells.push(cell);}else{if(!buckets.has(tile.color))buckets.set(tile.color,[]);buckets.get(tile.color).push(cell);}
    const y=tileHeight(tile),x=wx(c),z=wz(r);
    if(tile.kind==='player-token'){const token=makeToken(tile.color);token.rotation.y=-Math.PI/2;token.position.set(x,y,z);staticTokenLayer.add(token);}


    const edgeColor=entityEdgeColor(tile);
    if(edgeColor&&surface){if(!styleEdges.has(edgeColor))styleEdges.set(edgeColor,[]);const lines=styleEdges.get(edgeColor);for(const segment of surface.boundarySegments)for(const p of segment)lines.push(x+p[0],p[1]+.004,z+p[2]);}
    if(edgeColor&&!surface){
      if(!styleEdges.has(edgeColor))styleEdges.set(edgeColor,[]);const lines=styleEdges.get(edgeColor);
      const bottom=y-tileThickness(tile);const corners=[[x-.5,bottom,z-.5],[x+.5,bottom,z-.5],[x+.5,bottom,z+.5],[x-.5,bottom,z+.5],[x-.5,y+.004,z-.5],[x+.5,y+.004,z-.5],[x+.5,y+.004,z+.5],[x-.5,y+.004,z+.5]];
      for(const [a,b] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]])lines.push(...corners[a],...corners[b]);
    }

    if(surface){for(const segment of surface.boundarySegments)for(const p of segment)edges.push(x+p[0],p[1]+.002,z+p[2]);}else edges.push(x-.5,y+.002,z-.5,x+.5,y+.002,z-.5,x+.5,y+.002,z-.5,x+.5,y+.002,z+.5,x+.5,y+.002,z+.5,x-.5,y+.002,z+.5,x-.5,y+.002,z+.5,x-.5,y+.002,z-.5);
  }
  for(const marker of treeCells.terrainCells){if(!terrains.has(marker.type))terrains.set(marker.type,[]);terrains.get(marker.type).push(marker);}
  for(const [color,bucket] of surfaces){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(bucket.positions,3));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,materials[color??'white']);mesh.userData.triangleCells=bucket.triangleCells;mesh.userData.surfaceCells=bucket.cells;tileLayer.add(mesh);}
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const [color,cells] of buckets){
    const mesh=new THREE.InstancedMesh(tileGeo,materials[color??'white'],cells.length);mesh.userData.cells=cells;
    cells.forEach(({r,c,tile},i)=>{const height=tileHeight(tile);const thickness=tileThickness(tile);position.set(wx(c),height-thickness/2,wz(r));scale.set(1,thickness,1);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();tileLayer.add(mesh);
  }
  for(const [type,cells] of terrains){
    const material=new THREE.MeshBasicMaterial({map:terrainTextures[type],transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});
    const mesh=new THREE.InstancedMesh(markerGeo,material,cells.length);
    const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    mesh.userData.cells=cells;cells.forEach(({r,c,index,total,surfaceTop},i)=>{position.set(wx(c)+(total>1?(index-(total-1)/2)*.22:0),Math.max(tileTop(r,c),surfaceTop)+.025+index*.005,wz(r));matrix.compose(position,tilt,new THREE.Vector3(total>1?.4:.72,total>1?.4:.72,1));mesh.setMatrixAt(i,matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();terrainLayer.add(mesh);
  }
  for(const cell of treeCells.tagCells){if(!cell.tags.entry&&!cell.tags.exitTo)continue;const texture=canvasTexture((ctx,size)=>{ctx.fillStyle=cell.tags.exitTo?'#d1ac42':'#478d77';ctx.beginPath();ctx.arc(size/2,size/2,size*.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.font=`bold ${size*.4}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(cell.tags.exitTo?'→':'↓',size/2,size/2);});const marker=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false}));marker.renderOrder=6;marker.rotation.x=-Math.PI/2;marker.position.set(wx(cell.c)-.27,Math.max(tileTop(cell.r,cell.c),cell.surfaceTop)+.045,wz(cell.r));marker.scale.setScalar(.4);marker.userData.ownedTexture=texture;marker.userData.cell=cell;tagLayer.add(marker);}
  if(map.exit&&map.tiles[map.exit.r]?.[map.exit.c]&&!cellHidden(map.exit.r,map.exit.c)){
    const marker=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({map:exitTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));marker.rotation.x=-Math.PI/2;marker.position.set(wx(map.exit.c),tileTop(map.exit.r,map.exit.c)+.012,wz(map.exit.r));foldLayer.add(marker);
  }
  for(const [edgeColor,positions] of styleEdges){const outline=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial({color:edgeColor,toneMapped:false}));outline.renderOrder=4;entityEdgeLayer.add(outline);}
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if(!map.tiles[r][c]||cellHidden(r,c)){const x=wx(c),z=wz(r);edges.push(x-.5,.002,z-.5,x+.5,.002,z-.5,x+.5,.002,z-.5,x+.5,.002,z+.5,x+.5,.002,z+.5,x-.5,.002,z+.5,x-.5,.002,z+.5,x-.5,.002,z-.5);}
  const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(edges,3)),gridMaterial);gridLayer.add(grid);
  rebuildFoldAxes();
  renderRegionControls();renderEntityVisibility();refreshTreePanel();
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
  const editing=P.mode==='edit';boardLayer.visible=!editing||visibility.coords;tileLayer.visible=true;entityEdgeLayer.visible=tileLayer.visible;gridLayer.visible=showGrid;foldLayer.visible=!editing||visibility.folds;foldAxisLayer.visible=foldLayer.visible;playerGroup.visible=!editing;spawnMarkerGroup.visible=(!editing||visibility.player)&&!cellHidden(map.spawn.r,map.spawn.c)&&!!map.tiles[map.spawn.r]?.[map.spawn.c]?.tags?.spawn;staticTokenLayer.visible=tileLayer.visible;tagLayer.visible=!editing||visibility.player;
  terrainLayer.visible=true;
}
for(const [id,key] of [['coordsVisible','coords'],['foldsVisible','folds'],['playerVisible','player']])$(id).onchange=()=>{visibility[key]=$(id).checked;applyVisibility();syncState();};

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


function overlay(r,c,hex,opacity=.35){const m=new THREE.Mesh(new THREE.PlaneGeometry(.89,.89),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(wx(c),tileTop(r,c)+.016,wz(r));effectLayer.add(m);return m;}
function tileOutline(r,c,hex){const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.9,.9)),new THREE.LineBasicMaterial({color:hex,depthTest:false}));line.rotation.x=-Math.PI/2;line.position.set(wx(c),tileTop(r,c)+.024,wz(r));effectLayer.add(line);}









$('teleportBtn').onclick=()=>teleport();$('interactBtn').onclick=()=>controller.interact();
for(const id of ['blockThickness','blockGradualRate'])$(id).onchange=()=>{try{brushTile();if(tool!=='place')setTool('place');syncState();}catch(e){toast(e.message,true);}};
$('blockHeight').oninput=()=>{const n=Number($('blockHeight').value);if(Number.isFinite(n)&&n>=.01&&n<=16){brushHeight=n;syncState();}};
$('blockHeight').onchange=()=>{const n=Number($('blockHeight').value);if(!Number.isFinite(n)||n<.01||n>16){toast('方块高度须为 0.01–16',true);$('blockHeight').value=brushHeight;return;}brushHeight=n;if(tool!=='place')setTool('place');};

function setTool(next){if(next==='paint')next='place';pendingRegion=null;tool=next;$('foldDirectionPanel').hidden=tool!=='fold';const tagNames={player:"玩家起点",entry:"设置区域入口","region-exit":"设置区域出口","clear-tags":"清除方块标签"};if(tagNames[tool])selectedTagTool=tool;
const tagSummary=$('tagSummary'),tagName=document.createElement('span');tagName.textContent=tagNames[selectedTagTool]||'选择方块标签';
const tagIcon=selectedTagTool?document.querySelector('[data-tool="'+selectedTagTool+'"] svg').cloneNode(true):createElement(Box);tagIcon.setAttribute('aria-hidden','true');tagSummary.replaceChildren(tagIcon,tagName);$("exitRegionPanel").hidden=tool!=="region-exit";disposableClear(placementLayer);drawEditSelection();document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});updateUI();}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{if(b.dataset.tool==='select'){selectionMode=tool==='select'&&selectionMode==='single'?'multi':'single';if(selectionMode==='single'&&selectedCells.length>1){setSelectedCells(directSelectedCells.slice(0,1));}b.setAttribute('aria-label','选区 · '+(selectionMode==='single'?'单选':'多选'));b.dataset.tip='选区 · '+(selectionMode==='single'?'单选':'多选');b.querySelector('.selection-mode-label').textContent=b.dataset.tip;}setTool(b.dataset.tool);scheduleInspection();});
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{if(!hasColor(prefabs.find(p=>p.id===selectedPrefabId)?.tile))return;color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(s=>{const active=s===b;s.classList.toggle('active',active);s.setAttribute('aria-pressed',String(active));});$('colorName').textContent=COLOR_NAMES[color];$('colorType').textContent=prefabs.find(p=>p.id===selectedPrefabId)?.tile?.blocked?'阻挡实体':'可通行实体';if(tool!=='place')setTool('place');});
document.querySelectorAll('[data-fold]').forEach(b=>b.onclick=()=>{foldType=b.dataset.fold==='none'?null:b.dataset.fold;document.querySelectorAll('[data-fold]').forEach(s=>{s.classList.toggle('active',s===b);s.setAttribute('aria-pressed',String(s===b));});setTool('fold');});
$('gridToggle').onclick=()=>{showGrid=!showGrid;$('gridToggle').setAttribute('aria-pressed',String(showGrid));$('gridToggle').classList.toggle('active',showGrid);applyVisibility();syncState();};
$('clearMap').onclick=()=>{try{const legacy=clearMapCells(map,cellHidden,visibility);for(const node of documentModel.world.serialize()){if(nodeHidden(node)||documentModel.world.transforms.worldCells(node.transformId).some(p=>cellHidden(p.r,p.c)))throw new Error('清空会删除隐藏实体，请先显示全部实体与区域');if(documentModel.world.transforms.referenceOwners(node.transformId).some(owner=>!documentModel.world.serialize().some(item=>'entity:'+item.id===owner)))throw new Error('Transform has external references');}const snapshot=documentModel.serialize();snapshot.entities=[];snapshot.transforms=[];snapshot.legacyMetadata={...snapshot.legacyMetadata,exit:legacy.exit};commitTree(new TreeDocument(snapshot));setSelectedCells([]);editRect=null;pendingRegion=null;debugOverrides.clear();nodeDebug.clear();clearInspection();controller.resetProgress();buildPaper();persist();toast('地图已清空 · 可撤销');}catch(error){toast(error.message,true);}};
function editAt(r,c){
  if(cellHidden(r,c)){toast('隐藏区域或实体禁止编辑',true);return;}
  if(tool==='inspect'){try{inspectAtCell(r,c);}catch(error){toast(error.message,true);}return;}
  if(tool==='select'){setSelectedCells(selectionMode==='multi'?unionCells(directSelectedCells,rectangle({r,c},{r,c})): [{r,c}]);drawEditSelection();syncState();return;}
  if(['player','entry','region-exit','clear-tags'].includes(tool)){
    try{
      if(!visibility.player)throw new Error('隐藏标签禁止编辑');
      if(!walkable(r,c))throw new Error('标签需要可行走方块');
      const tag=tool==='player'?'spawn':tool==='entry'?'entry':'exitTo';
      if(tool!=='clear-tags')assertTagAttachment(tagCatalog,tool==='player'?'tag-spawn':tool==='entry'?'tag-entry':'tag-exit',map,r,c);
      if(tool==='player'&&taggedCells(map,'spawn').some(p=>cellHidden(p.r,p.c))||tool==='entry'&&taggedCells(map,'entry').some(p=>regionOf(p.tile)===regionOf(map.tiles[r][c])&&cellHidden(p.r,p.c)))throw new Error('不能修改隐藏区域标签');
      const next=clone(map);if(tool==='clear-tags')next.tiles[r][c].tags={};else {tagCell(next,r,c,tag,tool==='region-exit'?$('exitRegion').value:true);if(tool==='region-exit')next.tiles[r][c].tags.requiredKeys=[...document.querySelectorAll('#requiredKeyList input:checked')].map(i=>i.value);}
      applyMap(next,true);controller.resetPosition();buildPaper();persist();
    }catch(e){toast(e.message,true);}return;
  }
  if(tool==='paste'){pasteAt(r,c);return;}
  if(tool==='place'){try{if(entityHidden(brushTile(),hiddenEntities))throw new Error('请先显示该实体类型');}catch(error){toast(error.message,true);return;}}
  const t=map.tiles[r][c];const isSpawn=r===map.spawn.r&&c===map.spawn.c;const isExit=map.exit&&r===map.exit.r&&c===map.exit.c;
  if(tool==='erase'){if(!t)return;if(isSpawn){toast('先把玩家起点移到其他方块',true);return;}}
  if(tool==='place'&&blocked(brushTile())&&isSpawn){toast('玩家起点不能设为阻挡方块',true);return;}
  if(tool==='place'&&blocked(brushTile())&&isExit){toast('出口不能设为阻挡方块，请先移动出口',true);return;}
  

  
  if(tool==='place'){try{const prefab=prefabs.find(p=>p.id===selectedPrefabId);if($('stackPlacement').checked||!prefab.tile){commitTree(placeTreePrefab(documentModel,prefab,brushTile(),r,c,{stack:true,isHidden:cellHidden,nodeHidden,resolve:id=>prefabs.find(p=>p.id===id)}));}else{if(documentModel.world.at(r,c).some(nodeHidden))throw new Error('不能覆盖隐藏实体');const result=placeEntity(map,prefab,brushTile(),r,c,cellHidden);applyMap(result.map,true);buildPaper();persist();}}catch(e){toast(e.message,true);}return;}
  if(tool==='fold'){try{if(!visibility.folds)throw new Error('隐藏折线禁止编辑');if(foldType)assertTagAttachment(tagCatalog,'tag-fold',map,r,c);const next=clone(map);if(!applyFoldLine(next,r,c,foldType))return;validateMap(next,true);applyMap(next,true);buildPaper();persist();}catch(error){toast(error.message,true);}return;}
  if(tool==='erase'){try{const cells=removeEntity(map,r,c,cellHidden);if(!visibility.player&&cells.some(p=>Object.keys(map.tiles[p.r][p.c]?.tags??{}).length))throw new Error('删除实体会改变隐藏标签');if(cells.some(p=>map.tiles[p.r][p.c]?.tags?.spawn))throw new Error('先移动玩家起点标签');const next=clone(map);for(const p of cells){const tile=next.tiles[p.r][p.c];next.foldCells.push(...foldsOf(tile).map(type=>({...p,type})));next.tiles[p.r][p.c]=null;}applyMap(next,true);buildPaper();persist();}catch(e){toast(e.message,true);}return;}
  buildPaper();persist();updateUI();
}

function clearInspection(){cancelAnimationFrame(inspectionFrame);inspectionFrame=0;inspectedCell=null;clearPropertyInspector($('propertyInspector'));clearPropertyInspector($('cellPropertyInspector'));$('inspectedCellProperties').textContent='尚未选择方格';$('inspectedEntity').textContent='使用地图工具的选区选择方格';$('inspectedProperties').textContent='尚未选择';$('propertyEditStatus').textContent='';renderMechanismText($('mechanismDescriptions'),['选择实体以查看机制说明']);}
function scheduleInspection(){cancelAnimationFrame(inspectionFrame);inspectionFrame=requestAnimationFrame(()=>{inspectionFrame=0;try{inspectSelection();}catch(error){clearInspection();$('propertyEditStatus').textContent=error.message;}});}
function inspectionKey(r,c,tile){return r+','+c+':'+(tile?.instance?.id??'')+':'+(tile?.prefabId??'void_ai');}
function inspectAtCell(r,c){setSelectedCells([{r,c}]);drawEditSelection();inspectSelection();}
function inspectedPropertySchema(r,c,tile){
  const node=documentModel.primaryAt(r,c);
  return node?nodeSchema(node):entityPropertySchema(tile,tagCatalog);
}
function inspectSelection(){
  const cells=inspectionCells(map,selectedCells);if(!cells.length){clearInspection();return;}
  const entries=cells.map(({r,c})=>{
    const entity=inspectCell(map,r,c,cellHidden);
    const values=entity.properties??{transparent:entity.transparent,placeable:entity.placeable,blocked:entity.blocked,folds:entity.folds};
    const schema=entity.properties?inspectedPropertySchema(r,c,entity.properties):Object.fromEntries(Object.keys(values).map(key=>[key,{tempEditable:false}]));
    return {values:entity.properties?debugOverrides.values(inspectionKey(r,c,entity.properties),values,schema):values,schema};
  });
  const descriptions={key:'钥匙：钥匙是通过区域出口进入下一个区域的可选条件。玩家收集钥匙后，满足出口配置的全部所需钥匙才能传送；未设置所需钥匙的出口无需钥匙。',campfire:'篝火：玩家不能进入篝火方块。玩家进入篝火八向相邻的方格时，解除冰冻状态。',ice:'冰河：首次进入使玩家冰冻，并清空过热层数。冰冻状态下再次进入冰河，游戏结束。',fire:'火焰：每次进入增加一层过热；达到六层时游戏结束。',eruption:'喷发：按玩家行动次数周期切换，第 2、5、8……次行动后开放，其余时刻禁止进入。'};
  renderMechanismText($('mechanismDescriptions'),[...new Set(cells.map(p=>map.tiles[p.r][p.c]?.terrain??'none'))].map(type=>descriptions[type]||(type==='none'?'无机制：该实体没有配置机制类型。':'未登记机制：'+type)));
  inspectedCell=cells[0];
  const cellKeys=new Set(['tags','folds','fold']);
  const wholeEntries=entries.map(entry=>({...entry,values:Object.fromEntries(Object.entries(entry.values).filter(([key])=>!cellKeys.has(key)))}));
  const {values,schema,mixed}=batchProperties(wholeEntries);
  const directKeys=new Set(directSelectedCells.map(p=>p.r+','+p.c));
  const cellEntries=entries.filter((entry,i)=>directKeys.has(cells[i].r+','+cells[i].c)).map(entry=>({...entry,values:Object.fromEntries(Object.entries(entry.values).filter(([key])=>cellKeys.has(key)))}));
  const independent=batchProperties(cellEntries);
  $('inspectedCellProperties').textContent=directSelectedCells.map(p=>coord(p.r,p.c)).join('、')+' · 区域与外观按整个实体修改，位置标签和折线按直接选中格修改';
  $('inspectedEntity').textContent=cells.length===1?coord(cells[0].r,cells[0].c)+' · '+(map.tiles[cells[0].r][cells[0].c]?(prefabs.find(p=>p.id===entityType(map.tiles[cells[0].r][cells[0].c]))?.name||'实体方块'):'虚空'):'批量检视 · '+selectedCells.length+' 个选中格 / '+cells.length+' 个实体占用格';
  $('inspectedProperties').textContent=JSON.stringify({entity:projectProperties(values,schema,'readable'),cells:projectProperties(independent.values,independent.schema,'readable')},null,2);
  renderPropertyInspector($('propertyInspector'),values,schema,applyInspectedProperty,error=>toast(error.message,true),mixed);
  renderPropertyInspector($('cellPropertyInspector'),independent.values,independent.schema,(path,value)=>applyInspectedProperty(path,value,'cell'),error=>toast(error.message,true),independent.mixed);
}
function applyInspectedProperty(path,value,scope='entity'){
  if(P.mode!=='edit'||!selectedCells.length)throw new Error('请先选择方格');
  let candidate=clone(map);const pendingDebug=[],targets=scope==='cell'&&path[0]!=='regionTag'?directSelectedCells:inspectionCells(map,selectedCells);
  if(path[0]==='tags'&&value===true&&(path[1]==='spawn'&&targets.length>1||path[1]==='entry'&&new Set(targets.map(p=>regionOf(map.tiles[p.r][p.c]))).size<targets.length))throw new Error('唯一位置标签不能批量设置到多个方格');
  for(const {r,c} of targets){
    if(cellHidden(r,c))throw new Error('隐藏实体禁止编辑');
  const tile=candidate.tiles[r]?.[c];if(!tile)throw new Error('虚空实体属性只读');
  const schema=inspectedPropertySchema(r,c,tile),key=inspectionKey(r,c,tile),source=debugOverrides.values(key,tile,schema);
  const edited=updateProperty(source,schema,path,value),merged=mergeSerializableProperties(tile,edited,schema);
  if((merged.tags?.spawn||merged.tags?.entry)&&(blocked(merged)||merged.terrain==='campfire'))throw new Error('起点或入口不能设为不可通行');
  if(JSON.stringify(merged)!==JSON.stringify(tile)){
    let next=clone(candidate);next.tiles[r][c]=normalizeTile(merged);
    if(path[0]==='keyName'){next=renameKeyCells(candidate,[{r,c}],merged.keyName,cellHidden);next.tiles[r][c]=normalizeTile(merged);}
    if(path[0]==='regionTag'){assertTagAttachment(tagCatalog,'tag-region',candidate,r,c);next=assignRegion(candidate,[{r,c}],merged.regionTag,regionNames(candidate,documentModel.cellTags).includes(merged.regionTag),documentModel.cellTags);}
    if(path[0]==='tags'){
      const tag=path[1];if(['spawn','entry','exitTo'].includes(tag)&&merged.tags[tag]){assertTagAttachment(tagCatalog,tag==='spawn'?'tag-spawn':tag==='entry'?'tag-entry':'tag-exit',candidate,r,c);tagCell(next,r,c,tag,merged.tags[tag]);}
      const checkedTree=forkTreeDocument(documentModel);checkedTree.applyLegacy(next);const errors=validateRegions(next,checkedTree.world).filter(message=>message.startsWith('区域入口不能')||message.startsWith('区域只能')||message.startsWith('出口所需钥匙不存在'));if(errors.length)throw new Error(errors.join('；'));
    }
    if(path[0]==='folds'||path[0]==='fold')assertTagAttachment(tagCatalog,'tag-fold',candidate,r,c);
    assertHiddenContentUnchanged(candidate,next,visibility);
    for(let y=0;y<candidate.height;y++)for(let x=0;x<candidate.width;x++)if(cellHidden(y,x)&&JSON.stringify(candidate.tiles[y][x])!==JSON.stringify(next.tiles[y][x]))throw new Error('不能改写隐藏实体的引用');
    candidate=validateMap(next,true);
  }
  for(const change of debugChanges(source,edited,schema))pendingDebug.push({key,...change});

  }
  if(JSON.stringify(candidate)!==JSON.stringify(map)){applyMap(candidate,true);controller.resetPosition();buildPaper();persist();}
  for(const change of pendingDebug)debugOverrides.set(change.key,change.path,change.value);
  $('propertyEditStatus').textContent='属性已应用 · 批量修改可一次撤销';updateUI();scheduleInspection();
}

document.querySelectorAll('.rotate-left').forEach(b=>b.onclick=()=>turn(-1));document.querySelectorAll('.rotate-right').forEach(b=>b.onclick=()=>turn(1));
$('applyPlayerProperties').onclick=()=>{try{controller.setPlayerProperties({r:Number($('playerRow').value)-1,c:Number($('playerColumn').value)-1,dir:Number($('playerDirection').value),maxUp:Number($('playerMaxUp').value),maxDown:Number($('playerMaxDown').value),overheat:Number($('playerOverheat').value),frozen:$('playerFrozen').checked,actions:Number($('playerActions').value),collectedKeys:JSON.parse($('playerCollectedKeys').value)});$('playerPropertyStatus').textContent='玩家属性已应用 · 可撤销，重启后重置';}catch(error){$('playerPropertyStatus').textContent=error.message;toast(error.message,true);}};


$('editMode').onclick=()=>setMode('edit');$('playMode').onclick=()=>setMode('play');$('startBtn').onclick=()=>setMode(P.mode==='edit'?'play':'edit');
$('restartBtn').onclick=()=>controller.restart();
$('resultRetry').onclick=()=>{$('restartBtn').click();$('resultOverlay').hidden=true;};$('resultEdit').onclick=()=>{$('resultOverlay').hidden=true;setMode('edit');};
function undo(){if(P.mode==='play'){controller.undo();return;}if(P.moving)return;const previous=editHistory.pop();if(!previous)return;clearSelection();redoHistory.push(editSnapshot());restoreMap(previous.map);editRect=previous.rect;setSelectedCells(previous.directSelectedCells??previous.selectedCells??[]);controller.resetPosition();buildPaper();fitCamera(false);persist();updateUI();}
$('undoBtn').onclick=undo;
$('redoBtn').onclick=()=>{if(P.mode!=='edit'||P.moving)return;const next=redoHistory.pop();if(!next)return;editHistory.push(editSnapshot());restoreMap(next.map);editRect=next.rect;setSelectedCells(next.directSelectedCells??next.selectedCells??[]);controller.resetPosition();buildPaper();persist();};
const editSelectionLayer=new THREE.Group();paper.add(editSelectionLayer);
function selectionOutline(width,height,color){
  const x=width/2,y=height/2;
  const geometry=new LineSegmentsGeometry().setPositions([-x,-y,0,x,-y,0,x,-y,0,x,y,0,x,y,0,-x,y,0,-x,y,0,-x,-y,0]);
  return new LineSegments2(geometry,new LineMaterial({color,linewidth:3,depthTest:false,depthWrite:false}));
}
function drawEditSelection(){
  disposableClear(editSelectionLayer);const rect=pendingRegion;
  setSelectedCells(directSelectedCells);const directKeys=new Set(directSelectedCells.map(p=>p.r+','+p.c));
  if(P.mode==='edit')for(const p of selectedCells){const direct=directKeys.has(p.r+','+p.c),line=selectionOutline(.96,.96,direct?'#447db0':'#ce554c');line.rotation.x=-Math.PI/2;line.position.set(wx(p.c),tileTop(p.r,p.c)+.04,wz(p.r));line.renderOrder=direct?11:10;line.userData={cell:p,direct};editSelectionLayer.add(line);}
  if(rect&&P.mode==='edit'){
    const valid=rect.r>=0&&rect.c>=0&&rect.r+rect.h<=map.height&&rect.c+rect.w<=map.width;
    const line=selectionOutline(rect.w,rect.h,valid?'#447db0':'#ce554c');
    line.rotation.x=-Math.PI/2;line.position.set(wx(rect.c+(rect.w-1)/2),.4,wz(rect.r+(rect.h-1)/2));line.renderOrder=10;editSelectionLayer.add(line);
  }
  $('regionStatus').textContent=pendingRegion?'点击粘贴落点 · Esc 取消':editRect?coord(editRect.r,editRect.c)+' · '+editRect.w+' × '+editRect.h:'左键拖拽框选';
  $('copyRegion').disabled=!selectedCells.length;$('pasteRegion').disabled=!clipboard;scheduleInspection();
}
$('copyRegion').onclick=()=>{if(!editRect)return;try{clipboard=copyTree(documentModel,selectedCells,{isHidden:cellHidden,nodeHidden});}catch(error){toast(error.message,true);return;}drawEditSelection();toast('选区已复制');};
$('pasteRegion').onclick=()=>{if(!clipboard)return;setTool('paste');pendingRegion={r:0,c:0,h:clipboard.height??clipboard.length,w:clipboard.width??clipboard[0].length};drawEditSelection();};
function pasteAt(r,c){try{if(clipboard.kind==='tree'){commitTree(pasteTree(documentModel,clipboard,r,c,{isHidden:cellHidden,nodeHidden}));pendingRegion=null;setTool('select');return;}if(clipboard.flat().some(t=>entityHidden(t,hiddenEntities)))throw new Error('不能粘贴隐藏的实体类型');for(let dr=0;dr<clipboard.length;dr++)for(let dc=0;dc<clipboard[0].length;dc++)if((!clipboard.mask||clipboard.mask[dr][dc])&&cellHidden(r+dr,c+dc))throw new Error('不能粘贴到隐藏区域');const result=pasteRegion(map,clipboard,r,c,cellHidden);assertHiddenContentUnchanged(map,result.map,visibility);applyMap(result.map,true);editRect=result.rect;setSelectedCells(unionCells([],editRect,(y,x)=>(!clipboard.mask||clipboard.mask[y-r][x-c])&&!cellHidden(y,x)));pendingRegion=null;tool='select';controller.resetPosition();buildPaper();persist();setTool('select');}catch(err){toast(err.message,true);}}

function updateUI(){
  if(document.activeElement!==$('mapName'))$('mapName').value=map.name;
  $('sceneMapName').textContent=map.name;document.title=map.name+' · FOLD FIELD';
  applyVisibility();const playing=P.mode==='play';$('playHints').textContent=P.freeTeleport?'测试传送已开启：点击任意可通行实体即可传送；目标区域会自动显示。':P.foldHints?'点击玩家显示行走与所有合法折纸传送落点；点击高亮方块即可移动。':'点击玩家显示行走范围；点击折纸线仍会高亮传送落点，也可按 F 传送。';$('freeTeleportToggle').setAttribute('aria-pressed',String(P.freeTeleport));$('freeTeleportToggle').querySelector('span').textContent=P.freeTeleport?'开启':'关闭';$('foldHintsToggle').setAttribute('aria-pressed',String(P.foldHints));$('foldHintsToggle').querySelector('span').textContent=P.foldHints?'开启':'关闭';$('editPanel').hidden=playing;$('playPanel').hidden=!playing;$('editMode').classList.toggle('active',!playing);$('playMode').classList.toggle('active',playing);$('canvasMode').textContent=playing?'游玩编辑':'编辑';$('statusMode').textContent=playing?'PLAY MODE':'EDIT MODE';$('startLabel').textContent=playing?'返回编辑':'开始游玩';
  $('startBtn').setAttribute('aria-label',playing?'返回编辑':'开始游玩');$('editMode').setAttribute('aria-pressed',String(!playing));$('playMode').setAttribute('aria-pressed',String(playing));
  $('startBtn').querySelector('svg').replaceWith(createElement(playing?Pencil:Play));
  const names={inspect:'点击实体或虚空检视 · 不修改地图',select:selectionMode==='single'?'单选 · 点击选择方格':'多选 · 点击累加 / 拖拽替换 / Shift 拖拽累加',paste:'点击粘贴落点',paint:'方块工具 · '+(COLOR_NAMES[color]||'无颜色属性')+' / 高度 '+brushHeight,place:'放置方块 · '+(prefabs.find(p=>p.id===selectedPrefabId)?.name||'无可用实体'),erase:'删除方块',fold:foldType?FOLD_NAMES[foldType]:'移除折纸线',player:'设置玩家起点',entry:'设置区域入口','region-exit':'设置区域出口','clear-tags':'清除方块标签'};if(!P.chosenFold)$('toolStatus').textContent=playing?'玩家 '+coord(P.player.r,P.player.c):names[tool];
  $('steps').textContent=$('canvasSteps').textContent=String(P.steps).padStart(2,'0');$('teleports').textContent=String(P.teleports).padStart(2,'0');$('playerCoord').textContent=coord(P.player.r,P.player.c)+' · 朝'+FACE_NAMES[P.player.dir]+(playing?' · '+(P.terrainState.frozen?'冰冻 · ':'')+'过热 '+P.terrainState.overheat+(P.terrainState.hasKey?' · 持有钥匙':''):'');$('facingLabel').textContent=$('playFacingLabel').textContent='朝向：'+FACE_NAMES[P.player.dir];
  for(const [id,value] of Object.entries({playerRow:P.player.r+1,playerColumn:P.player.c+1,playerDirection:P.player.dir,playerMaxUp:P.moveHeight.maxUp,playerMaxDown:P.moveHeight.maxDown}))if(document.activeElement!==$(id))$(id).value=value;
  for(const [id,value] of Object.entries({playerOverheat:P.terrainState.overheat,playerActions:P.terrainState.actions,playerCollectedKeys:JSON.stringify(P.terrainState.collectedKeys)}))if(document.activeElement!==$(id))$(id).value=value;
  if(document.activeElement!==$('playerFrozen'))$('playerFrozen').checked=P.terrainState.frozen;
  $('playerRow').max=map.height;$('playerColumn').max=map.width;$('applyPlayerProperties').disabled=!playing||P.moving;
  $('mapWidth').value=map.width;$('mapHeight').value=map.height;$('selectionText').textContent=map.width+' × '+map.height+' TILEMAP';
  $('gameTitle').textContent=map.name;$('gameDescription').textContent=map.description||'到达黄色出口即可通关。';$('gameHint').textContent=playing?'点击玩家查看八方向移动；点击折纸线高亮目标，再次点击目标方块传送。':'编辑模式：设置起点和出口后开始游玩。';$('gameHud').hidden=!playing;
  $('resultOverlay').hidden=!(playing&&(P.levelWon||P.stepLimitHit));
  let tiles=0,blocks=0,folds=0;for(const row of map.tiles)for(const t of row){if(!t)continue;tiles++;if(blocked(t))blocks++;folds+=foldsOf(t).length;}folds+=(map.foldCells??[]).length;$('tileCount').textContent=tiles+' TILES';$('mapStats').textContent=(tiles-blocks)+' 可通行 / '+blocks+' 阻挡 / '+folds+' 折纸线';
  $('undoBtn').disabled=!currentHistory().length||P.moving;$('restartBtn').disabled=!playing||P.moving;document.querySelectorAll('.rotate-left,.rotate-right').forEach(b=>b.disabled=P.moving);$('teleportBtn').disabled=P.moving||!P.chosenFold||!foldTarget(P.chosenFold).valid;
  $('redoBtn').disabled=P.mode!=='edit'||!redoHistory.length||P.moving;drawEditSelection();
  scheduleInspection();
  syncState();
}

function replaceMap(next,save=true){const validated=new TreeDocument(next);record();debugOverrides.clear();nodeDebug.clear();clearInspection();editRect=null;setSelectedCells([]);pendingRegion=null;hiddenRegions.clear();documentModel=validated;map=validated.view();controller.resetPosition();controller.resetProgress();buildPaper();fitCamera();if(save)persist();updateUI();}
let renaming=false;
$('mapName').oninput=()=>{if(!renaming){editHistory.push(editSnapshot());trimHistory(editHistory);redoHistory=[];renaming=true;}map.name=normalizeMapName($('mapName').value);persist();updateUI();};
$('mapName').onblur=()=>{renaming=false;$('mapName').value=map.name;};
$('mapName').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('mapName').blur();}};
$('newMap').onclick=()=>{setMode('edit');const tiles=Array.from({length:map.height},()=>Array.from({length:map.width},blankTile));replaceMap({version:1,width:map.width,height:map.height,tiles,spawn:{r:Math.floor(map.height/2),c:Math.floor(map.width/2),dir:0},exit:null,name:'未命名关卡',description:'',maxSteps:0,bestSteps:null});toast('已新建空白地图');};
$('resizeMap').onclick=()=>{const width=Number($('mapWidth').value),height=Number($('mapHeight').value);if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width>128||height>128){toast('宽度和高度须为 3–128 的整数',true);return;}if(width===map.width&&height===map.height)return;for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if((r>=height||c>=width)&&cellHidden(r,c)){toast('缩小地图会删除隐藏区域，请先显示该区域',true);return;}const tiles=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>r<map.height&&c<map.width?clone(map.tiles[r][c]):blankTile()));const spawn={r:Math.min(map.spawn.r,height-1),c:Math.min(map.spawn.c,width-1),dir:map.spawn.dir};if(!tiles[spawn.r][spawn.c]||blocked(tiles[spawn.r][spawn.c]))tiles[spawn.r][spawn.c]=blankTile();const exit=map.exit&&map.exit.r<height&&map.exit.c<width?{...map.exit}:null;try{applyMap({...map,version:1,width,height,tiles,foldCells:(map.foldCells??[]).filter(p=>p.r<height&&p.c<width),spawn,exit,name:map.name,description:map.description,maxSteps:map.maxSteps,bestSteps:map.bestSteps},true);controller.resetPosition();buildPaper();fitCamera();persist();updateUI();toast('地图尺寸已更新');}catch(error){toast(error.message,true);}};
$('exportMap').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(savedMap(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=mapFilename(map.name);a.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('地图已导出');};
$('importMap').onclick=()=>$('mapFile').click();$('mapFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>16000000)throw new Error('地图文件过大');const next=JSON.parse(await file.text());new TreeDocument(next);setMode('edit');replaceMap(next);toast('地图导入完成');}catch(err){toast('导入失败：'+err.message,true);}e.target.value='';};


function exportGameHtml(){
  const check=validateForPlay();
  if(!check.valid){toast(check.errors.join('；'),true);return;}
  const documentCopy=document.documentElement.cloneNode(true);
  const exportedViewport=documentCopy.querySelector('#viewport');exportedViewport.replaceChildren();for(const attribute of [...exportedViewport.attributes])if(attribute.name.startsWith('data-'))exportedViewport.removeAttribute(attribute.name);
  documentCopy.querySelector('#resultOverlay').setAttribute('hidden','');
  const current=documentCopy.outerHTML;
  const boot='<script>window.__FOLD_FIELD_TAGS__='+JSON.stringify(tagCatalog).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_PREFABS__='+JSON.stringify(prefabs).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_EXPORT_MAP__='+JSON.stringify(savedMap()).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_GAME_ONLY__=true;</script>';
  const html='<!doctype html>\n'+current.replace(/<script>/i,boot+'<script>');
  const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
  const a=document.createElement('a');a.href=url;a.download='game.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('独立游戏已导出为 game.html');
}
$('exportGame').onclick=exportGameHtml;

const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerDown=null,lastEditKey=null,dragEdited=false,multiTouch=false;const activePointers=new Set();
function hitAt(clientX,clientY){
  const b=renderer.domElement.getBoundingClientRect();mouse.set((clientX-b.left)/b.width*2-1,-(clientY-b.top)/b.height*2+1);raycaster.setFromCamera(mouse,camera);
  const surface=raycaster.intersectObjects([...tagLayer.children,...terrainLayer.children,...tileLayer.children],false)[0];
  if(surface?.object.userData.cell)return surface.object.userData.cell;
  if(surface?.object.userData.triangleCells)return surface.object.userData.triangleCells[surface.faceIndex];
  if(surface?.instanceId!==undefined)return surface.object.userData.cells[surface.instanceId];
  const point=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!point)return null;
  const local=paper.worldToLocal(point),c=Math.floor(local.x+map.width/2),r=Math.floor(local.z+map.height/2);return inside(r,c)?{r,c}:null;
}
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{activePointers.add(e.pointerId);if(activePointers.size>1)multiTouch=true;selectionBase=e.shiftKey?clone(directSelectedCells):[];pointerDown={x:e.clientX,y:e.clientY,button:e.button,pointerType:e.pointerType,shift:e.shiftKey};lastEditKey=null;dragEdited=false;manualPan=e.button===2;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointermove',e=>{
  if(manualPan){hoverOutline.visible=false;disposableClear(placementLayer);return;}const hit=hitAt(e.clientX,e.clientY);hovered=hit;
  if(hit){hoverOutline.visible=true;hoverOutline.position.set(wx(hit.c),tileTop(hit.r,hit.c)+.035,wz(hit.r));const groups=P.mode==='edit'&&visibility.folds?foldAxes.filter(g=>g.cells.some(p=>p.r===hit.r&&p.c===hit.c)):[];$('foldRadiusHint').hidden=!groups.length;$('foldRadiusHint').textContent=groups.map(g=>FOLD_NAMES[g.type]+' · 作用半径 '+g.radius+'（切比雪夫距离）').join(' / ');$('hoverCoord').textContent=groups.length?groups.map(g=>FOLD_NAMES[g.type]+' · 作用半径 '+g.radius+'（切比雪夫距离）').join(' / '):coord(hit.r,hit.c)+' · '+(map.tiles[hit.r][hit.c]?(COLOR_NAMES[map.tiles[hit.r][hit.c].color]||'无颜色属性')+' · '+regionOf(map.tiles[hit.r][hit.c])+(map.tiles[hit.r][hit.c].tags?.exitTo?' → '+map.tiles[hit.r][hit.c].tags.exitTo:''):'空格');}else{hoverOutline.visible=false;$('foldRadiusHint').hidden=true;$('hoverCoord').textContent='—';}
  drawPlacementPreview(hit);
  if(P.mode==='edit'&&tool==='paste'&&hit&&clipboard){pendingRegion={r:hit.r,c:hit.c,h:clipboard.height??clipboard.length,w:clipboard.width??clipboard[0].length};drawEditSelection();}
  if(P.mode==='edit'&&tool==='select'&&selectionMode==='multi'&&pointerDown?.button===0&&!multiTouch&&hit&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6){const start=hitAt(pointerDown.x,pointerDown.y);if(start){const rect=rectangle(start,hit);setSelectedCells(unionCells(selectionBase,rect,(r,c)=>!cellHidden(r,c)));dragEdited=true;drawEditSelection();}return;}
  const dragTools=new Set(['place','erase']);
  if(P.mode==='edit'&&pointerDown?.button===0&&!multiTouch&&!dragEdited&&dragTools.has(tool)&&hit&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6){
    gestureBefore=editSnapshot();const start=hitAt(pointerDown.x,pointerDown.y);
    if(start){editAt(start.r,start.c);lastEditKey=start.r+','+start.c;}
    dragEdited=true;
  }
  if(P.mode==='edit'&&pointerDown?.button===0&&!multiTouch&&dragEdited&&dragTools.has(tool)&&hit){
    const key=hit.r+','+hit.c;
    if(key!==lastEditKey){editAt(hit.r,hit.c);lastEditKey=key;}
  }
});
renderer.domElement.addEventListener('pointerleave',()=>{disposableClear(placementLayer);hoverOutline.visible=false;hovered=null;$('foldRadiusHint').hidden=true;$('hoverCoord').textContent='—';});
renderer.domElement.addEventListener('pointercancel',e=>{finishGesture();activePointers.delete(e.pointerId);if(!activePointers.size)multiTouch=false;pointerDown=null;lastEditKey=null;dragEdited=false;manualPan=false;});
renderer.domElement.addEventListener('pointerup',e=>{finishGesture();activePointers.delete(e.pointerId);const down=pointerDown;pointerDown=null;const wasPan=manualPan,wasMultiTouch=multiTouch,wasDrag=dragEdited;manualPan=false;lastEditKey=null;dragEdited=false;syncState();if(!activePointers.size)multiTouch=false;if(activePointers.size||wasMultiTouch||!down||down.button!==0||wasPan||wasDrag||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||P.moving)return;const hit=hitAt(e.clientX,e.clientY);if(!hit){setSelectedCells([]);editRect=null;clearSelection();drawEditSelection();syncState();return;}const {r,c}=hit;selectedNodeId=hit.nodeId??documentModel.primaryAt(r,c)?.id??null;refreshTreePanel();lastClickTile={r,c};if(P.mode==='edit'){if(!map.tiles[r][c]&&!documentModel.world.at(r,c).length&&tool!=='inspect'){setSelectedCells([]);editRect=null;drawEditSelection();syncState();if(tool==='select')return;}editAt(r,c);return;}controller.click(r,c);});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||e.target.isContentEditable||e.ctrlKey&&e.key.toLowerCase()!=='z')return;if(e.repeat&&e.key.toLowerCase()==='f')return;if(e.key.toLowerCase()==='f'){e.preventDefault();teleport();}if(e.key==='Escape'){pendingRegion=null;editRect=null;setSelectedCells([]);clearSelection();drawEditSelection();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}});

const tooltip=$('tooltip');document.querySelectorAll('[data-tip]').forEach(el=>{el.addEventListener('mouseenter',()=>{tooltipTimer=setTimeout(()=>{const r=el.getBoundingClientRect();tooltip.textContent=el.dataset.tip;tooltip.classList.add('show');tooltip.style.left=Math.max(5,Math.min(window.innerWidth-tooltip.offsetWidth-5,r.left+r.width/2-tooltip.offsetWidth/2))+'px';tooltip.style.top=(r.bottom+7+tooltip.offsetHeight>window.innerHeight?r.top-tooltip.offsetHeight-7:r.bottom+7)+'px';},250);});el.addEventListener('mouseleave',()=>{clearTimeout(tooltipTimer);tooltip.classList.remove('show');});el.addEventListener('click',()=>{clearTimeout(tooltipTimer);tooltip.classList.remove('show');});});

let renderedFrames=0;
function syncState(){viewport.dataset.state=JSON.stringify({map,player:P.player,mode:P.mode,foldHints:P.foldHints,freeTeleport:P.freeTeleport,tool,color,foldType,steps:P.steps,teleports:P.teleports,moving:P.moving,legalMoves:P.legalMoves,legalFoldMoves:P.legalFoldMoves,chosenFold:P.chosenFold,view,editRect,pendingRegion,brushHeight,selectedPrefabId,visibility,showGrid,selectionMode,selectedCells,directSelectedCells,moveHeight:P.moveHeight,hiddenEntities:[...hiddenEntities],hiddenRegions:[...hiddenRegions],revealedRegions:[...P.revealedRegions],terrainState:P.terrainState});}
function screenPoints(){
  viewport.dataset.frames=String(renderedFrames);viewport.dataset.render=JSON.stringify({foldAxes:foldAxes.length,foldGroups:foldAxes.map(({center,radius,type,cells})=>({center,radius,type,cells})),entityEdgeStyles:entityEdgeLayer.children.length,visibleTiles:tileLayer.children.reduce((n,o)=>n+(o.count??o.userData.surfaceCells?.length??0),0),staticTokens:staticTokenLayer.children.length,gridSegments:gridLayer.children[0]?.geometry.attributes.position.count/2,tokenShape:activeToken.children[0].geometry.type,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),target:controls.target.toArray(),layers:{coords:boardLayer.visible,tiles:tileLayer.visible,folds:foldLayer.visible,player:playerGroup.visible,grid:gridLayer.visible,entityEdges:entityEdgeLayer.visible,axes:foldAxisLayer.visible}});
  if(map.width*map.height<=512){const b=renderer.domElement.getBoundingClientRect(),points={};for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){const p=new THREE.Vector3(wx(c),tileTop(r,c)+.01,wz(r)).project(camera);points[r+','+c]={x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};}viewport.dataset.points=JSON.stringify(points);}else delete viewport.dataset.points;
}
function tick(now){requestAnimationFrame(tick);controls.update();updateFoldAxes();
  controller.tick(now);
  $('zoomLabel').textContent=Math.round(camera.zoom*100)+'%';renderer.render(scene,camera);renderedFrames++;if(renderedFrames%10===0){screenPoints();}
}
resetRegions();setupPrefabs();setTool(tool);buildPaper();fitCamera();if(P.mode==='play')checkRunEnd();requestAnimationFrame(tick);
// Read-only diagnostics support visual and interaction checks without bypassing the UI.
window.foldField={getState:()=>clone({map,player:P.player,mode:P.mode,tool,color,foldType,steps:P.steps,teleports:P.teleports,moving:P.moving,legalMoves:P.legalMoves,chosenFold:P.chosenFold,view,renderedFrames,terrainState:P.terrainState}),screenPoint:(r,c)=>{const p=new THREE.Vector3(wx(c),tileTop(r,c)+paper.position.y+.01,wz(r)).project(camera);const b=renderer.domElement.getBoundingClientRect();return {x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};},reflect:reflectPoint};

function setupPrefabs(){
  $('prefabSummary').parentElement.addEventListener('toggle',()=>{$('blockColorPanel').hidden=!$('prefabSummary').parentElement.open||!hasColor(prefabs.find(p=>p.id===selectedPrefabId)?.tile);});
  let fingerprint='',loading=false;
  function applyPrefabBrush(){
    const prefab=prefabs.find(p=>p.id===selectedPrefabId),colored=hasColor(prefab?.tile);
    $('keyNamePanel').hidden=prefab?.tile?.terrain!=='key';$('blockColorPanel').hidden=!colored||!$('prefabSummary').parentElement.open;
    const summary=$('prefabSummary'),name=document.createElement('span');name.textContent=prefab?.name||'无可用实体';summary.replaceChildren();
    if(prefab){const img=document.createElement('img');img.src=prefabPreview(prefab);img.alt='';summary.append(img);}
    summary.append(name);
    $('stackPlacement').disabled=!!prefab&&!prefab.tile;if(prefab&&!prefab.tile)$('stackPlacement').checked=true;for(const id of ['blockHeight','blockThickness','blockGradualRate'])$(id).disabled=!prefab?.tile;$('footprintInfo').textContent=prefab?prefab.size.width+' × '+prefab.size.height+' · 占用 '+prefab.occupied.filter(Boolean).length+' 格':'';renderEntityGrid($('prefabGrid'),prefabs.map(p=>({...p,preview:prefabPreview(p)})),selectedPrefabId,id=>{selectedPrefabId=id;$('prefabType').value=id;applyPrefabBrush();setTool('place');});
    if(prefab?.tile){color=colored?prefab.tile.color:null;brushHeight=prefab.tile.height;$('blockHeight').value=brushHeight;$('blockThickness').value=tileThickness(prefab.tile);$('blockGradualRate').value=tileGradualRate(prefab.tile);}
    document.querySelectorAll('[data-color]').forEach(b=>{const active=colored&&b.dataset.color===color;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('colorName').textContent=colored?COLOR_NAMES[color]:'';$('colorType').textContent=prefab?.tile?.blocked?'阻挡实体':'可通行实体';
  }
  function renderCatalog(){
    const select=$('prefabType');select.replaceChildren();
    for(const prefab of prefabs)select.add(new Option(prefab.name,prefab.id));
    if(!prefabs.some(p=>p.id===selectedPrefabId))selectedPrefabId=prefabs.find(p=>p.id==='paper_ai')?.id??prefabs[0]?.id??null;
    if(!prefabs.length)select.add(new Option('无可用实体',''));
    select.value=selectedPrefabId||'';applyPrefabBrush();renderEntityVisibility();
  }
  async function refresh(){
    if(loading||document.hidden||GAME_ONLY||!/^https?:$/.test(location.protocol))return;
    loading=true;
    try{const response=await fetch('/api/prefabs',{cache:'no-store'});if(!response.ok)throw new Error('服务未提供实体目录');const catalog=await response.json();
      const next=catalog.prefabs.map(normalizePrefab),nextTags=(catalog.tags??[]).map(normalizeTagPrefab),key=JSON.stringify([next,nextTags]);
      if(key!==fingerprint){prefabs=next;tagCatalog=nextTags;fingerprint=key;renderCatalog();}
      $('prefabStatus').textContent=catalog.errors.length?catalog.errors.map(e=>e.file+'：'+e.message).join('；'):'实时读取 assets/prefab · '+prefabs.length+' 种实体';
    }catch(error){$('prefabStatus').textContent='使用内置实体目录 · '+error.message;}finally{loading=false;}
  }
  renderCatalog();$('prefabStatus').textContent='内置实体目录 · 本地服务支持实时更新';
  $('prefabType').oninput=$('prefabType').onchange=()=>{
    selectedPrefabId=$('prefabType').value||null;applyPrefabBrush();if(tool!=='place')setTool('place');else updateUI();
  };
  refresh();if(!GAME_ONLY)setInterval(refresh,2000);document.addEventListener('visibilitychange',refresh);
}

function rebuildFoldAxes(){
 disposableClear(foldAxisLayer);foldAxes=uniqueFoldAxes({...map,tiles:map.tiles.map((row,r)=>row.map((t,c)=>cellHidden(r,c)?null:t)),foldCells:map.foldCells.filter(p=>!cellHidden(p.r,p.c))});axisViewKey=null;
 const positions=[],colors=[],dots=[];
 for(const g of foldAxes)for(const [a,b] of foldStrokes(g)){
  if(Math.hypot(b.r-a.r,b.c-a.c)<.04){const r=Math.max(0,Math.min(map.height-1,Math.floor(a.r+.5))),c=Math.max(0,Math.min(map.width-1,Math.floor(a.c+.5)));dots.push(wx((a.c+b.c)/2),tileTop(r,c)+.018,wz((a.r+b.r)/2));continue;}
  for(const p of [a,b]){const r=Math.max(0,Math.min(map.height-1,Math.floor(p.r+.5))),c=Math.max(0,Math.min(map.width-1,Math.floor(p.c+.5)));positions.push(wx(p.c),tileTop(r,c)+.018,wz(p.r));colors.push(.28,.4,.3);}
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
 foldAxisMesh=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,depthWrite:false,toneMapped:false}));foldAxisMesh.renderOrder=5;foldAxisLayer.add(foldAxisMesh);
 // World-space circles share the tiles' projection, including orthographic zoom.
 if(dots.length){
  const dotMesh=new THREE.InstancedMesh(new THREE.CircleGeometry(.035/3,12),new THREE.MeshBasicMaterial({color:'#48664d',depthTest:false,depthWrite:false,toneMapped:false}),dots.length/3);
  const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),matrix=new THREE.Matrix4();
  for(let i=0;i<dots.length;i+=3){matrix.compose(new THREE.Vector3(dots[i],dots[i+1],dots[i+2]),rotation,new THREE.Vector3(1,1,1));dotMesh.setMatrixAt(i/3,matrix);}
  dotMesh.instanceMatrix.needsUpdate=true;dotMesh.computeBoundingSphere();dotMesh.renderOrder=5;foldAxisLayer.add(dotMesh);
 }
}
function updateFoldAxes(){}

function renderRegionControls(){
 const keyList=$('requiredKeyList'),chosenKeys=new Set([...keyList.querySelectorAll('input:checked')].map(i=>i.value));renderNameChecklist(keyList,legalKeyNames(map,documentModel.world),chosenKeys,'所需钥匙 ',null,'地图上没有可收集的钥匙');
 const names=regionNames(map,documentModel.cellTags);
 const regionChoice=$('regionChoice'),previousRegion=regionChoice.value;regionChoice.replaceChildren(new Option('新建区域',''));for(const name of names)regionChoice.add(new Option(name,name));if(names.includes(previousRegion))regionChoice.value=previousRegion;$('newRegionPanel').hidden=!!regionChoice.value;
 const container=$('regionVisibility'),current=$('exitRegion').value;$('exitRegion').replaceChildren();
 for(const name of names)$('exitRegion').add(new Option(name,name));
 renderRegionChecklist(container,names,new Set(names.filter(name=>!hiddenRegions.has(name))),(name,checked)=>{if(checked)hiddenRegions.delete(name);else hiddenRegions.add(name);setSelectedCells(directSelectedCells);buildPaper();});
 if(names.includes(current))$('exitRegion').value=current;
}
$('assignRegion').onclick=()=>{try{if(!selectedCells.length)throw new Error('先选择区域方格');if(selectedCells.some(p=>cellHidden(p.r,p.c)))throw new Error('不能修改隐藏区域');for(const p of selectedCells)if(map.tiles[p.r]?.[p.c])assertTagAttachment(tagCatalog,'tag-region',map,p.r,p.c);const next=assignRegion(map,selectedCells,$('regionChoice').value||$('regionName').value,!!$('regionChoice').value,documentModel.cellTags);for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if(cellHidden(r,c)&&JSON.stringify(map.tiles[r][c])!==JSON.stringify(next.tiles[r][c]))throw new Error('区域更名会改变隐藏方块的出口标签，请先显示该区域');applyMap(next,true);buildPaper();persist();}catch(e){toast(e.message,true);}};
function prefabPreview(prefab){
 const key=JSON.stringify(prefab);if(previewCache.has(key))return previewCache.get(key);
 previewRenderer??=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});previewRenderer.setSize(100,80);previewRenderer.setClearColor('#e1e8e0',1);
 const world=new THREE.Scene();world.add(new THREE.HemisphereLight('#ffffff','#526254',2));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(2,5,-3);world.add(light);
 const previewTile=prefab.tile??normalizeTile({...prefab.components?.surface,...(Object.hasOwn(prefab.components??{},'surface')?{}:{height:.09})}),height=previewTile.height,span=Math.max(prefab.size.width,prefab.size.height,height+(previewTile.kind==='player-token'?.8:0))*.7+.3;
 const cam=new THREE.OrthographicCamera(-span,span,span*.8,-span*.8,.1,100);cam.position.set(span*1.5,span*1.6+height/2,span*2);cam.lookAt(0,height/2,0);
 for(const p of footprint(prefab,0,0)){
   const tile=new THREE.Mesh(new THREE.BoxGeometry(.98,tileThickness(previewTile),.98),new THREE.MeshStandardMaterial({color:COLORS[previewTile.color]??COLORS.white}));tile.position.set(p.c-(prefab.size.width-1)/2,height-tileThickness(previewTile)/2,p.r-(prefab.size.height-1)/2);if(prefab.tile||Object.hasOwn(prefab.components??{},'surface'))world.add(tile);
   if(previewTile.edgeColor){const edge=new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry),new THREE.LineBasicMaterial({color:previewTile.edgeColor}));edge.position.copy(tile.position);world.add(edge);}
   if(previewTile.kind==='player-token'){const token=makeToken(previewTile.color);token.rotation.y=-Math.PI*.75;token.position.copy(tile.position);token.position.y=height;world.add(token);}
   for(const type of (prefab.tile?.terrain?[prefab.tile.terrain]:['campfire','ice','fire','eruption','key'].filter(type=>Object.hasOwn(prefab.components??{},type)))){const marker=new THREE.Mesh(new THREE.PlaneGeometry(.72,.72),new THREE.MeshBasicMaterial({map:terrainTextures[type],transparent:true,depthWrite:false}));marker.rotation.x=-Math.PI/2;marker.position.copy(tile.position);marker.position.y=height+.012;world.add(marker);}
 }
 previewRenderer.render(world,cam);const url=previewRenderer.domElement.toDataURL('image/png');world.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});previewCache.set(key,url);return url;
}

function refreshPrefabPreviews(type){for(const prefab of prefabs.filter(p=>p.tile?.terrain===type||Object.hasOwn(p.components??{},type))){previewCache.delete(JSON.stringify(prefab));const img=document.querySelector('[data-prefab="'+prefab.id+'"] img');if(img)img.src=prefabPreview(prefab);}}

function drawPlacementPreview(hit){
 disposableClear(placementLayer);if(P.mode!=='edit'||tool!=='place'||!hit)return;
 const prefab=prefabs.find(p=>p.id===selectedPrefabId);if(!prefab)return;
 const cells=footprint(prefab,hit.r,hit.c),invalid=cells.some(p=>{const instance=map.tiles[p.r]?.[p.c]?.instance;return !inside(p.r,p.c)||cellHidden(p.r,p.c)||instance&&(instance.width>1||instance.height>1);});
 for(const p of cells){const geometry=new THREE.PlaneGeometry(.94,.94),line=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:invalid?'#ce554c':'#59966d',depthTest:false}));geometry.dispose();line.rotation.x=-Math.PI/2;line.position.set(wx(p.c),inside(p.r,p.c)&&!cellHidden(p.r,p.c)?tileTop(p.r,p.c)+.04:.04,wz(p.r));line.renderOrder=12;placementLayer.add(line);}
 $('hoverCoord').textContent=(invalid?'无法放置 · ':'占格预览 · ')+prefab.name+' · '+prefab.size.width+' × '+prefab.size.height+' / '+cells.length+' 格';
}

$('applyKeyName').onclick=()=>{try{const next=renameKeyCells(map,selectedCells,$('keyName').value,cellHidden);applyMap(next,true);buildPaper();persist();}catch(e){toast(e.message,true);}};

$('regionChoice').onchange=()=>{$('newRegionPanel').hidden=!!$('regionChoice').value;};

function treeEntityChoices(){const choices=entityChoices(prefabs,map),ids=new Set(choices.map(p=>p.id));for(const node of documentModel.world.serialize())if(!ids.has(node.prefabId)){ids.add(node.prefabId);choices.push(normalizePrefab({version:1,id:node.prefabId,name:node.prefabId,tile:node.configuration??{color:"white"}}));}return choices;}
function renderEntityVisibility(){renderEntityChecklist($('entityVisibility'),treeEntityChoices().map(p=>({...p,preview:prefabPreview(p)})),hiddenEntities,(id,checked)=>{if(checked)hiddenEntities.delete(id);else hiddenEntities.add(id);refreshEntityVisibility();});}
function refreshEntityVisibility(){setSelectedCells(directSelectedCells);buildPaper();syncState();}
$('showAllEntities').onclick=()=>{hiddenEntities.clear();refreshEntityVisibility();};
$('hideAllEntities').onclick=()=>{for(const prefab of treeEntityChoices())hiddenEntities.add(prefab.id);refreshEntityVisibility();};

$('foldHintsToggle').onclick=()=>controller.setFoldHints(!P.foldHints);

$('freeTeleportToggle').onclick=()=>controller.setFreeTeleport(!P.freeTeleport);

function commitTree(next){const signature=(doc,kind)=>doc.world.serialize().filter(node=>kind==='fold'?node.components.fold:Object.keys(node.tags).length).map(node=>({id:node.id,values:kind==='fold'?node.components.fold:node.tags,cells:doc.world.transforms.worldCells(node.transformId)}));if(!visibility.folds&&JSON.stringify(signature(documentModel,'fold'))!==JSON.stringify(signature(next,'fold')))throw new Error('隐藏折线禁止编辑');if(!visibility.player&&JSON.stringify(signature(documentModel,'tags'))!==JSON.stringify(signature(next,'tags')))throw new Error('隐藏标签禁止编辑');if(JSON.stringify(next.serialize())===JSON.stringify(documentModel.serialize())){refreshTreePanel();return;}record();documentModel=next;map=next.view();if(selectedNodeId&&!next.world.serialize().some(node=>node.id===selectedNodeId))selectedNodeId=null;controller.resetPosition();buildPaper();persist();updateUI();}
function refreshTreePanel(){
 const panel=$('treeNodes');if(!panel)return;const nodes=documentModel.world.serialize();const point=lastClickTile??selectedCells[0];
 renderTreeNodes(panel,nodes.map(node=>{const transform=documentModel.world.transforms.get(node.transformId),world=documentModel.world.transforms.world(node.transformId);return {id:node.id,label:(transform.parentId?'↳ ':'')+node.prefabId+' · '+coord(world.r,world.c)+(point&&documentModel.world.at(point.r,point.c).some(item=>item.id===node.id)?' · 同格':''),disabled:nodeHidden(node)||documentModel.world.transforms.worldCells(node.transformId).some(p=>cellHidden(p.r,p.c)),selected:selectedNodeId===node.id};}),id=>{selectedNodeId=id;refreshTreePanel();});
 const node=nodes.find(item=>item.id===selectedNodeId);$('treeFields').hidden=!node;if(!node)return;const transform=documentModel.world.transforms.get(node.transformId);$('nodeLocalR').value=transform.local.r;$('nodeLocalC').value=transform.local.c;$('nodeLocalDir').value=transform.local.dir;renderTreeParents($('nodeParent'),nodes.filter(other=>other.id!==node.id));$('nodeParent').value=nodes.find(item=>item.transformId===transform.parentId)?.id??'';const readable=projectProperties(nodeDebug.values(node.id,node,nodeSchema(node)),nodeSchema(node),'readable');$('nodeComponents').value=JSON.stringify(readable.components??{},null,2);$('nodeTags').value=JSON.stringify(readable.tags??{},null,2);$('nodeIdentity').textContent=node.id;
}
function treeAction(action){try{if(P.mode!=='edit'||!selectedNodeId)throw new Error('先选择实体节点');commitTree(action());}catch(error){toast(error.message,true);}}
$('moveNode').onclick=()=>treeAction(()=>moveNode(documentModel,selectedNodeId,{r:Number($('nodeLocalR').value),c:Number($('nodeLocalC').value),dir:Number($('nodeLocalDir').value)},cellHidden,nodeHidden));
$('reparentNode').onclick=()=>treeAction(()=>reparentNode(documentModel,selectedNodeId,$('nodeParent').value||null,$('preserveWorld').checked,cellHidden,nodeHidden));
$('deleteNode').onclick=()=>treeAction(()=>deleteNode(documentModel,selectedNodeId,cellHidden,nodeHidden));
function nodeSchema(node){return nodePermissions(node,entityPropertySchema(node.configuration??{prefabId:node.prefabId},tagCatalog));}
$('applyNodeConfig').onclick=()=>treeAction(()=>{const node=documentModel.world.get(selectedNodeId),schema=nodeSchema(node),shown=projectProperties(nodeDebug.values(node.id,node,schema),schema,'readable'),after={...shown,components:JSON.parse($('nodeComponents').value),tags:JSON.parse($('nodeTags').value)};if(!visibility.folds&&JSON.stringify(shown.components?.fold)!==JSON.stringify(after.components?.fold))throw new Error('隐藏折线禁止编辑');if(!visibility.player&&JSON.stringify(shown.tags)!==JSON.stringify(after.tags))throw new Error('隐藏标签禁止编辑');updateProperty(shown,schema,['components'],after.components);updateProperty(shown,schema,['tags'],after.tags);const next=configureNode(documentModel,selectedNodeId,after.components,after.tags,cellHidden,nodeHidden,schema);for(const change of debugChanges(shown,after,schema))nodeDebug.set(node.id,change.path,change.value);return next;});
