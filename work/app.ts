// @ts-nocheck
// Composition boundary: app.ts wires the typed entry point to focused domain modules.
// Narrowing this file is a later migration step; do not add new domain rules here.

import {nodeFollowsFold,nodeCanDropOnFold} from './entities/fold-properties.mjs';
import {renderTreeNodes,renderTreeParents} from './ui/react/TreeInspector.jsx';
import {renderTestModifiers} from './ui/react/PlayPanel.jsx';
import {entityTreeContext,entityParentChoices} from './ui/entity-tree-context.mjs';
import {nodePermissions} from './entities/node-permissions.mjs';
import {copyTree,pasteTree} from './entities/tree-clipboard.mjs';
import {validateMap as normalizeMap} from './core/map-model.mjs';
import {moveNode,reparentNode,deleteNode,placeTreePrefab,replaceTreePrefab,placeCategorizedPrefab,configureNode,forkTreeDocument,renameTreeKeys,validateTreeDocument} from './entities/tree-commands.mjs';
import {renderTreeCells,mapForSurface} from './render/tree-render.mjs';
import {describeViewportCell} from './render/viewport-cell.mjs';
import {TreeDocument} from './entities/tree-document.mjs';
import {previewPlacement,previewFootprint} from './entities/placement-preview.mjs';
import {defaultComponents} from './entities/tree-runtime.mjs';
import {createLiftBlock,setLiftBlockHeight} from './render/lift-block.mjs';
import {createSurfacePreview} from './render/placement-preview.mjs';
import {mechanismMarker,shotMarker} from './render/directional-mechanisms.mjs';
import {paperSurface,isPaper,hasConnectedLiftNearby,createPaperSurfaceCache} from './render/paper-surface.mjs';
import {entityCategory,isPlaceableEntity} from './entities/entity-category.mjs';
import {withEmitterDirection} from './entities/emitter-placement.mjs';
import {createTagMarkerBatches,updateTagMarkerBatch} from './render/tag-markers.mjs';
import {createSpatialInstances,createSurfaceBatchCollector} from './render/spatial-batches.mjs';
import {refreshFlatPaperPlacement} from './render/flat-placement.mjs';
import {entityEdgeSegments} from './render/entity-edges.mjs';
import {squareViewSpan,followTarget,boundedFollowTarget} from './render/follow-camera.mjs';
import {lightingDefaults,lightingFields,applyLighting} from './render/lighting.mjs';
import {createFoldMotionView,hingeFor,tabletopHeight} from './render/fold-motion.mjs';
import {createTableScene} from './render/table-scene.mjs';
import {createModelLibrary} from './render/model-library.mjs';
import {createModelView} from './render/model-view.mjs';
import {createPlayerVisualView} from './render/player-visual.mjs';
import {createFbxModelLoader} from './render/fbx-model-loader.mjs';
import {createVisualAssetSource} from './resources/visual-assets.mjs';
import {collectModelDescriptors} from './render/model-descriptors.mjs';
import {creaseGuides,creaseSelection,creaseRegionOutline} from './render/crease-guides.mjs';
import {entityType,entityChoices,entityHidden} from './entities/visibility-model.mjs';
import {legalKeyNames,renameKeyCells} from './tags/keys.mjs';
import {normalizeMapName,mapFilename} from './core/map-name.mjs';
import playerRuntime from './player.cjs';
import * as THREE from 'three';
import { normalizeTile, normalizePrefab, hasColor, foldsOf, blocked, tileHeight, tileThickness, tileGradualRate, columnLabel, applyFoldLine, foldsAt, normalizeFoldCells } from './entities/tile-model.mjs';
import { uniqueFoldAxes, foldGroupAt, inFoldRange, axisKey } from './tags/fold-geometry.mjs';
import {regionOf,regionNames,taggedCells,validateRegions,assignRegion,tagCell} from './tags/regions.mjs';
import {footprint,removeEntity} from './entities/placement-model.mjs';
import demoMap from '../outputs/fold-field-demo.json';
import { rectangle, region, pasteRegion,unionCells,cellBounds,selectionRegion } from './editor/selection-model.mjs';
import {inspectionCells,batchProperties,selectionDetails} from './editor/batch-inspection.mjs';
import {projectedCellSchema,assertNodePropertyChanges} from './editor/node-edit-permissions.mjs';
import {createEditSnapshot,trimHistory} from './editor/history-model.mjs';
import {createEditRefresh} from './editor/edit-refresh.mjs';
import {clearMapCells} from './editor/clear-map.mjs';
import {inspectCell} from './entities/cell-entity.mjs';
import {EventBus} from './core/event-bus.mjs';
import {createFrameTask} from './core/frame-task.mjs';
import {normalizeTagPrefab,assertTagAttachment,entityPropertySchema} from './tags/tag-model.mjs';
import {assertHiddenContentUnchanged} from './editor/visibility-policy.mjs';
import {projectProperties,updateProperty,mergeSerializableProperties,debugChanges} from './core/property-model.mjs';
import {DebugState} from './editor/debug-state.mjs';
import {renderEntityGrid,renderEntityChecklist,renderNameChecklist,renderRegionChecklist,renderMechanismText} from './ui/react/catalogs.jsx';
import {renderPropertyInspector,clearPropertyInspector} from './ui/property-inspector.mjs';
import {triggerEditorChoiceMap} from './ui/trigger-editor-options.mjs';
import {normalizeComponentTriggers} from './mechanics/trigger-list.cjs';
import {createAudioSystem} from './audio-system.mjs';
import { createTerrainState, canEnterTerrain, enterTerrain, finishAction, validateTerrains } from './entities/mechanism-rules.mjs';
import { Copy, ClipboardPaste, Redo2, FlameKindling, Snowflake, Flame, Mountain, KeyRound, MoveVertical } from 'lucide';
import {Trash2} from 'lucide';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {LineSegments2} from 'three/examples/jsm/lines/LineSegments2.js';
import {LineSegmentsGeometry} from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import {LineMaterial} from 'three/examples/jsm/lines/LineMaterial.js';
import { createElement, Origami, FilePlus2, FolderOpen, Download, Pencil, Play, Paintbrush, SquarePlus, Eraser, Split, Navigation, Flag, Grid2x2, X, RotateCcw, RotateCw, Scaling, Waypoints, Box, Layers2, Plus, Minus, Scan, Undo2, Compass, Square, Table2, Volume2, VolumeX } from 'lucide';

const icons = { Trash2, Origami, FilePlus2, FolderOpen, Download, Pencil, Play, Paintbrush, SquarePlus, Eraser, Split, Navigation, Flag, Grid2x2, X, RotateCcw, RotateCw, Scaling, Waypoints, Box, Layers2, Plus, Minus, Scan, Undo2, Compass, Square, Table2, Volume2, VolumeX, Copy, ClipboardPaste, Redo2 };
for (const node of document.querySelectorAll<HTMLElement>('[data-lucide]')) {
  const name=(node.dataset.lucide??'').replace(/(^|-)([a-z0-9])/g,(_,prefix,char)=>char.toUpperCase());
  const icon=icons[name as keyof typeof icons];
  if(!icon)continue;
  const svg=createElement(icon);svg.setAttribute('aria-hidden','true');node.replaceWith(svg);
}
type EditorInput = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
interface EditorElements {
  viewport: HTMLDivElement;
  blockHeight: HTMLInputElement;
  blockThickness: HTMLInputElement;
  blockGradualRate: HTMLInputElement;
  keyName: HTMLInputElement;
  playerRow: HTMLInputElement;
  playerColumn: HTMLInputElement;
  playerDirection: HTMLSelectElement;
  playerMaxUp: HTMLInputElement;
  playerMaxDown: HTMLInputElement;
  playerFoldVertical: HTMLInputElement;
  playerFoldHorizontal: HTMLInputElement;
  playerCanDropOnFold: HTMLInputElement;
  playerOverheat: HTMLInputElement;
  playerFrozen: HTMLInputElement;
  playerActions: HTMLInputElement;
  playerCollectedKeys: HTMLTextAreaElement;
  mapName: HTMLInputElement;
  mapWidth: HTMLInputElement;
  mapHeight: HTMLInputElement;
  regionChoice: HTMLSelectElement;
  regionName: HTMLInputElement;
  nodeLocalR: HTMLInputElement;
  nodeLocalC: HTMLInputElement;
  nodeLocalDir: HTMLSelectElement;
  nodeParent: HTMLSelectElement;
  preserveWorld: HTMLInputElement;
  nodeComponents: HTMLTextAreaElement;
  nodeTags: HTMLTextAreaElement;
  requiredKeyList: HTMLDivElement;
  requiredSwitchList: HTMLDivElement;
  playerKeyChoices: HTMLDivElement;
}
function $(id: keyof EditorElements): EditorElements[typeof id];
function $(id: string): HTMLElement;
function $(id: string): HTMLElement {
  const element=document.getElementById(id);
  if(!element)throw new Error(`缺少编辑器元素：${id}`);
  return element;
}
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
const TERRAIN_MARKERS={campfire:{name:'篝火',icon:FlameKindling},ice:{name:'冰块',icon:Snowflake},fire:{name:'火焰',icon:Flame},eruption:{name:'喷发',icon:Mountain},key:{name:'钥匙',icon:KeyRound}};
const hiddenEntities=new Set();
const STORAGE_KEY = 'fold-field-map-v1';
const EMBEDDED_MAP = window.__FOLD_FIELD_EXPORT_MAP__;
const EMBEDDED_ASSETS = window.__FOLD_FIELD_EXPORT_ASSETS__;
const clone = data => JSON.parse(JSON.stringify(data));
const previewCache=new Map();let previewRenderer,placementRenderCache=null,paperSurfaceCache=createPaperSurfaceCache();
const blankTile = () => normalizeTile({...prefabs.find(p=>p.id==='paper_ai')?.tile,fold:null,folds:[]});
let brushHeight=.09, prefabs=(window.__FOLD_FIELD_PREFABS__||[]).map(normalizePrefab);
let tagCatalog=(window.__FOLD_FIELD_TAGS__||[]).map(normalizeTagPrefab);
let selectedPrefabId=prefabs.find(p=>p.id==='paper_ai')?.id??prefabs.find(isPlaceableEntity)?.id??null;
const getPlayerPrefab=()=>prefabs.find(p=>p.id==='player_ai');
const audio=createAudioSystem(window.__FOLD_FIELD_AUDIO_ASSETS__||{});
function brushTile(){const selected=prefabs.find(p=>p.id===selectedPrefabId);if(selected&&!selected.tile)return {prefabId:selected.id};const value=Number($('blockHeight').value);if(!Number.isFinite(value)||value<.01||value>16)throw new Error('方块高度须为 0.01–16');brushHeight=value;const prefab=prefabs.find(p=>p.id===selectedPrefabId);if(!prefab)throw new Error('没有可用实体，请在后端提供 prefab JSON');return normalizeTile({...prefab.tile,...(prefab.tile.terrain==='key'?{keyName:$('keyName').value}:{}),...(hasColor(prefab.tile)?{color}:{}),height:brushHeight,...(prefab.tile.lift?{lift:{...prefab.tile.lift,initialHeight:brushHeight}}:{}),thickness:Number($('blockThickness').value),gradualRate:Number($('blockGradualRate').value),prefabId:prefab.id});}
let documentModel=new TreeDocument(defaultMap());
let map=documentModel.view(),tool='place',color='white',foldType='h';
let hovered=null,showGrid=true,showTable=true,showCreaseDashes=true;
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
window.addEventListener('pagehide',event=>{if(!event.persisted){stopMapPersistence();editorTabs.dispose();playerVisual.dispose();modelView.dispose();modelLibrary.dispose();}});

const foldableCells=new Set();
let placementTagCells=[];
const P=playerRuntime.createPlayerState(map.spawn,GAME_ONLY?'play':'edit');
const controller=playerRuntime.createPlayerController({state:P,THREE,$,blocked,inside,walkable,canEnterTerrain,enterTerrain,finishAction,createTerrainState,validateTerrains,validateRegions,legalKeyNames,taggedCells,regionOf,foldsAt,inFoldRange,foldGroupAt,coord,FOLD_NAMES,clone,persist,toast,record,updateUI,buildPaper,renderPlayer,disposableClear,overlay,tileOutline,wx:c=>wx(c),wz:r=>wz(r),tileTop,playSound:audio.play,playMusic:audio.playMusic,resetDebugState:()=>{debugOverrides.clear();nodeDebug.clear();clearInspection();},foldView:{prepare:(...args)=>foldMotionView.prepare(...args),begin:(...args)=>foldMotionView.begin(...args),setAngle:angle=>foldMotionView.setAngle(angle),playerPosition:()=>foldMotionView.playerPosition(),footPosition:()=>foldMotionView.footPosition(),reset:()=>foldMotionView.reset()},getFoldHinge:group=>hingeFor(map,group,wx,wz,sceneryTop),getTabletopHeight:()=>sceneryTop,canFoldCell:(r,c)=>foldableCells.has(r+','+c),canDropEntity:node=>nodeCanDropOnFold(node),getEntityPrefab:id=>prefabs.find(prefab=>prefab.id===id),syncFoldState:()=>syncState(),onSelectionChanged:()=>refreshFoldSelection(),getLighting:()=>lighting,getPlayerPrefab,getMap:()=>map,getConfiguredMap:()=>documentModel.view(),getCellRegion:(r,c)=>documentModel.cellTags[r+','+c]?.regionTag??'默认区域',refreshLiftSurfaces,refreshMechanismSurfaces,resetMapView:()=>{map=documentModel.view();},getEntityWorld:()=>documentModel.world,onFirebirdThreat:threats=>{firebirdHalo.visible=threats.length>0;refreshFirebirdRangeLines();},componentRegistry:defaultComponents(),getFoldAxes:()=>foldAxes,getPlayerGroup:()=>playerGroup,getEffectLayer:()=>effectLayer,getSelectionRing:()=>selectionRing,isHidden:cellHidden,invalidateAxes:()=>{axisViewKey=null;}});
const {canMoveTo,validateForPlay,exitIsValid,isAtExit,foldTargetFor,finishRun,checkRunEnd,clearSelection,selectPlayer,reflectPoint,foldTarget,selectFold,animatePlayer,transitionRegion,applyTerrainEntry,movePlayer,teleport,turn,resetRegions,setMode}=controller;
try { const saved = EMBEDDED_MAP || localStorage.getItem(STORAGE_KEY); if (saved) { restoreMap(typeof saved === 'string' ? JSON.parse(saved) : saved); controller.resetPosition(); } } catch { /* An invalid saved map falls back to the sample map. */ }

function defaultMap() {
  return clone(demoMap);
}
function inside(r,c) { return Number.isInteger(r) && Number.isInteger(c) && r>=0 && c>=0 && r<map.height && c<map.width; }
function cellHidden(r,c){const name=documentModel.cellTags[r+','+c]?.regionTag??'默认区域';return P.mode==='edit'?hiddenRegions.has(name):!P.revealedRegions.has(name);}
function nodeHidden(node){return P.mode==='edit'&&hiddenEntities.has(node.prefabId);}
function walkable(r,c) { return inside(r,c)&&!cellHidden(r,c) && map.tiles[r][c] !== null && !blocked(map.tiles[r][c]) && map.tiles[r][c].terrain!=='campfire'; }

function coord(r,c) { return columnLabel(c)+(r+1); }
const voidPlaneTop=(r,c)=>Math.max(tileTop(r,c),sceneryTop);
function validateMap(data,allowDraft=false){return normalizeMap(data,allowDraft);}

function candidateForMap(next){if(P?.mode==='edit')assertHiddenContentUnchanged(documentModel.view(),next,visibility);if(P?.mode==='edit'){const before=documentModel.view();for(let r=0;r<before.height;r++)for(let c=0;c<before.width;c++)if(JSON.stringify(before.tiles[r][c])!==JSON.stringify(next.tiles[r]?.[c]??null)||JSON.stringify(foldsAt(before,r,c))!==JSON.stringify(r<next.height&&c<next.width?foldsAt(next,r,c):[])){if(cellHidden(r,c)||documentModel.world.at(r,c).some(nodeHidden))throw new Error('不能间接修改隐藏实体或区域');}}const candidate=forkTreeDocument(documentModel);candidate.applyProjection(next);return validateTreeDocument(candidate);}
function applyMap(next,saveHistory=false){const candidate=candidateForMap(next);if(saveHistory)record();documentModel=candidate;map=candidate.view();}
function restoreMap(data){const next=new TreeDocument(data);documentModel=next;map=next.view();}
function savedMap(){return documentModel.serialize({projectProperties,schemaFor:node=>nodeSchema(node),schemaForCell:(r,c)=>entityPropertySchema(map.tiles[r]?.[c]??{prefabId:'void_ai'},tagCatalog)});}
function notifyMapChanged(){for(const error of editorBus.emit('map:changed',{map}))console.error('地图状态通知失败',error);}
function persist() {documentModel.metadata=documentModel.cleanMetadata(map);editRefresh.request({save:true},!!gestureBefore);}
function toast(text,error=false) { $('toast').textContent=text; $('toast').classList.toggle('error',error); $('toast').classList.add('show'); clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('toast').classList.remove('show'),2400); }
function currentHistory() { return P.mode==='edit'?editHistory:P.playHistory; }
function editSnapshot(snapshot=documentModel.serialize()){return {...createEditSnapshot(snapshot,editRect,selectedCells),directSelectedCells:clone(directSelectedCells)};}
function record({snapshot,refresh=true}={}) {if(P.mode==='play'){controller.recordPlay();if(refresh)updateUI();return;}if(gestureBefore)return;editHistory.push(editSnapshot(snapshot));redoHistory=[];trimHistory(editHistory);if(refresh)updateUI();}
function finishGesture(){if(!gestureBefore)return;editRefresh.flush();const before=gestureBefore;gestureBefore=null;if(JSON.stringify(before.map)!==JSON.stringify(documentModel.serialize())){editHistory.push(before);trimHistory(editHistory);redoHistory=[];updateUI();}}

const viewport=$('viewport');
const scene=new THREE.Scene(); scene.background=new THREE.Color('#cbd8d0');
let renderer;
try { renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'}); } catch {
  viewport.innerHTML='<div class="load-error"><div><strong>WebGL 暂不可用</strong><span>请在浏览器中启用硬件加速后重新打开。</span></div></div>';
  throw new Error('WebGL renderer unavailable');
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
viewport.appendChild(renderer.domElement);
const camera=new THREE.OrthographicCamera(-10,10,8,-8,.1,1200);
const controls=new OrbitControls(camera,renderer.domElement);
controls.enableRotate=false; controls.enableDamping=true; controls.dampingFactor=.12; controls.screenSpacePanning=true;
controls.minZoom=.3; controls.maxZoom=64; controls.mouseButtons={LEFT:null,MIDDLE:null,RIGHT:THREE.MOUSE.PAN};
controls.touches={ONE:null,TWO:THREE.TOUCH.DOLLY_PAN};
const cameraInteraction={active:false,kind:null,revision:0};
let latestPointerEvent=null;
controls.addEventListener('start',()=>{cameraInteraction.active=true;cameraInteraction.kind='pan';cameraInteraction.revision++;hoverTask.cancel();cancelPlacementPreview();hoverOutline.visible=false;});
controls.addEventListener('change',()=>{cameraInteraction.revision++;});
controls.addEventListener('end',()=>{cameraInteraction.active=false;cameraInteraction.kind=null;if(latestPointerEvent)hoverTask.request(latestPointerEvent);});
let view='fixed', baseSpan=9, cameraOffset=new THREE.Vector3(), manualPan=false;
let cameraMode='edit',editorCameraSnapshot=null;
const cameraFollowTarget=new THREE.Vector3();
const lastFollowPosition=new THREE.Vector3();let lastFollowSteps=0;
// Follow the support plane, not the crumbling surface animation.
function getCameraFollowPosition(target){
 playerGroup.getWorldPosition(target);
 const nodes=documentModel.world.at(P.player.r,P.player.c);
 if(nodes.some(node=>{if(!node.components.fragile)return false;const state=documentModel.world.runtime(node.id,'fragile');return state.breaking||state.broken;})){
  const supports=nodes.filter(node=>node.components.surface);
  if(supports.length)target.y=Math.max(...supports.map(node=>Number(node.components.surface.height??.09)))+.018+paper.position.y;
 }
 return target;
}
function correctFollowCamera(){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;getCameraFollowPosition(lastFollowPosition);lastFollowSteps=P.steps;cameraFollowTarget.copy(boundedFollowTarget(lastFollowPosition,map.width,map.height,9/camera.zoom));followTarget(camera,controls,cameraFollowTarget,cameraOffset);}
const paper=new THREE.Group(); scene.add(paper);
const tableScenery=createTableScene(); scene.add(tableScenery.group);
function paperUnderside(){return tabletopHeight(map,cellHidden); }
// The tabletop always rests under the lowest visible paper underside.
let sceneryTop=0;
function layoutScenery(){sceneryTop=paperUnderside();tableScenery.layout(map.width,map.height,sceneryTop);boardLayer.position.y=sceneryTop;}
// Void-plane overlays sit on the tabletop while the table is visible.
const voidY=offset=>sceneryTop+offset;
const ambient=new THREE.HemisphereLight('#ffffff','#708875',2.1); scene.add(ambient);
const sunlight=new THREE.DirectionalLight('#fff8e5',2.6); sunlight.position.set(-9,18,8); sunlight.castShadow=true;
sunlight.shadow.mapSize.set(2048,2048); sunlight.shadow.camera.left=-20;sunlight.shadow.camera.right=20;sunlight.shadow.camera.top=20;sunlight.shadow.camera.bottom=-20;sunlight.shadow.camera.near=1;sunlight.shadow.camera.far=55;sunlight.shadow.bias=-.0006;sunlight.shadow.normalBias=.025; sunlight.shadow.radius=4;scene.add(sunlight);
const fill=new THREE.DirectionalLight('#d1e8ee',1.1); fill.position.set(12,5,-8); scene.add(fill);
let lighting={...lightingDefaults};
function updateLighting(){lighting=applyLighting({sunlight,ambient,fill,renderer},lighting,map.width,map.height);}
for(const [key] of lightingFields)$('lighting-'+key).oninput=()=>{try{const proposal={...lighting,[key]:Number($('lighting-'+key).value)};applyLighting({sunlight,ambient,fill,renderer},proposal,map.width,map.height);lighting=proposal;if(key==='creaseDepth')buildPaper();$('lightingStatus').textContent='光照预览已更新';}catch(e){$('lightingStatus').textContent=e.message;}};
$('resetLighting').onclick=()=>{const previousDepth=lighting.creaseDepth;lighting={...lightingDefaults};for(const [key] of lightingFields)$('lighting-'+key).value=lighting[key];updateLighting();if(previousDepth!==lighting.creaseDepth)buildPaper();$('lightingStatus').textContent='已恢复默认光照';};
const tileGeo=new THREE.BoxGeometry(1,1,1);
const markerGeo=new THREE.PlaneGeometry(.94,.94);
const materials=Object.fromEntries(Object.entries(COLORS).map(([k,v])=>[k,new THREE.MeshStandardMaterial({color:v,roughness:.86,flatShading:true})]));
const gridMaterial=new THREE.LineBasicMaterial({color:'#b9bdbb',transparent:true,opacity:.8});
const creaseDashMaterial=new THREE.LineBasicMaterial({color:'#48664d',toneMapped:false});
const creaseDotMaterial=new THREE.MeshBasicMaterial({color:'#48664d',toneMapped:false});
const highlightMaterial=(color,opacity)=>new THREE.MeshBasicMaterial({color,toneMapped:false,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide});
const creaseSelectionMaterial=highlightMaterial('#174f50',1);
const creaseHaloMaterial=highlightMaterial('#fff9df',.9);
const foldSourceMaterial=highlightMaterial('#b17d2d',.95);
const foldTargetMaterial=highlightMaterial('#2477e8',.95);
const sharedGeometries=new Set([tileGeo,markerGeo]);
const sharedMaterials=new Set([...Object.values(materials),gridMaterial,creaseDashMaterial,creaseDotMaterial,creaseSelectionMaterial,creaseHaloMaterial,foldSourceMaterial,foldTargetMaterial]);
let tileLayer=new THREE.Group(), foldLayer=new THREE.Group(), boardLayer=new THREE.Group(), gridLayer=new THREE.Group(), effectLayer=new THREE.Group(), entityEdgeLayer=new THREE.Group(), foldAxisLayer=new THREE.Group(), creaseGuideLayer=new THREE.Group(), foldSelectionLayer=new THREE.Group();
let foldSelectionSignature='',foldPrepareHandle=null;
function scheduleFoldPreparation(){
 if(foldPrepareHandle!==null){if(window.cancelIdleCallback)cancelIdleCallback(foldPrepareHandle);else clearTimeout(foldPrepareHandle);foldPrepareHandle=null;}
 if(!selectedFold()||P.foldMotion||P.moving)return;
 const prepare=()=>{foldPrepareHandle=null;controller.prepareFoldMotion();};
 foldPrepareHandle=window.requestIdleCallback?requestIdleCallback(prepare):setTimeout(prepare,0);
}
paper.add(boardLayer,gridLayer,tileLayer,foldLayer,effectLayer,entityEdgeLayer,foldAxisLayer,creaseGuideLayer,foldSelectionLayer);
let foldAxes=[],axisViewKey=null;
const terrainLayer=new THREE.Group(),staticTokenLayer=new THREE.Group(),tagLayer=new THREE.Group(),placementLayer=new THREE.Group();paper.add(terrainLayer,staticTokenLayer,tagLayer,placementLayer);
const mechanismLayer=new THREE.Group(),rayLayer=new THREE.Group(),firebirdRangeLayer=new THREE.Group();paper.add(mechanismLayer,rayLayer,firebirdRangeLayer);
const modelLayer=new THREE.Group();paper.add(modelLayer);
const visualAssetSource=createVisualAssetSource({offline:Boolean(EMBEDDED_ASSETS),embedded:{...(window.__FOLD_FIELD_BUILTIN_ASSETS__??{}),...(EMBEDDED_ASSETS??{})}});
const modelLibrary=createModelLibrary({load:createFbxModelLoader(visualAssetSource)});
let modelErrorKey='';
const modelView=createModelView({layer:modelLayer,library:modelLibrary,onChange:()=>buildPaper(),onError:(descriptor,error)=>{const key=descriptor.id+':'+error.message;if(key!==modelErrorKey){modelErrorKey=key;console.warn('模型加载失败',descriptor.id,error);}}});
let brokenViewKey='';

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
const liftTexture=canvasTexture((ctx,s)=>{ctx.fillStyle='#fff4cf';ctx.beginPath();ctx.arc(s/2,s/2,s*.46,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#5f6e52';ctx.lineWidth=8;ctx.stroke();ctx.fillStyle='#5f6e52';ctx.font=`bold ${s*.62}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('↕',s/2,s*.52);});
const exitTexture=canvasTexture((ctx,s)=>{ctx.translate(s/2,s/2);ctx.fillStyle='#fff4b1';ctx.beginPath();ctx.arc(0,0,s*.32,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#8b7635';ctx.lineWidth=8;ctx.stroke();ctx.fillStyle='#6a5a2c';ctx.beginPath();ctx.moveTo(-s*.16,s*.2);ctx.lineTo(-s*.16,-s*.13);ctx.lineTo(0,-s*.25);ctx.lineTo(s*.16,-s*.13);ctx.lineTo(s*.16,s*.2);ctx.closePath();ctx.fill();ctx.fillStyle='#fff4b1';ctx.beginPath();ctx.arc(s*.07,0,4,0,Math.PI*2);ctx.fill();});
const tagTextures=Object.fromEntries(['entry','exit'].map(kind=>[kind,canvasTexture((ctx,size)=>{ctx.fillStyle=kind==='exit'?'#d1ac42':'#478d77';ctx.beginPath();ctx.arc(size/2,size/2,size*.35,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.font=`bold ${size*.4}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(kind==='exit'?'→':'↓',size/2,size/2);})]));
const playerTexture=canvasTexture((ctx,s)=>{ctx.translate(s/2,s/2);ctx.fillStyle='#ddea90';ctx.beginPath();ctx.arc(0,0,87,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#425c3b';ctx.lineWidth=7;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-65);ctx.lineTo(41,45);ctx.lineTo(0,22);ctx.lineTo(-41,45);ctx.closePath();ctx.fillStyle='#3b5033';ctx.fill();ctx.strokeStyle='#eff5c9';ctx.lineWidth=3;ctx.stroke();});
const playerDecal=new THREE.Mesh(new THREE.PlaneGeometry(.81,.81),new THREE.MeshBasicMaterial({map:playerTexture,transparent:true,depthWrite:false,depthTest:false}));
playerDecal.rotation.x=-Math.PI/2;playerDecal.renderOrder=7;
const playerGroup=new THREE.Group(),activeTokenHost=new THREE.Group();playerGroup.add(activeTokenHost);paper.add(playerGroup);const firebirdHalo=new THREE.Group();firebirdHalo.visible=false;
for(const [radius,y,opacity] of [[.43,.05,.9],[.48,.09,.35]]){
 const glow=new THREE.Mesh(new THREE.TorusGeometry(radius,.025,8,48),new THREE.MeshBasicMaterial({color:'#ff653b',transparent:true,opacity,depthWrite:false}));
 glow.rotation.x=Math.PI/2;glow.position.y=y;firebirdHalo.add(glow);
}
playerGroup.add(firebirdHalo);
function refreshFirebirdRangeLines(){
  disposableClear(firebirdRangeLayer);
  const tree=documentModel.world;
  for(const node of tree.serialize().filter(node=>node.components.firebird)){
    const origin=tree.position(node.id),footprint=tree.transforms.get(node.transformId).footprint??{width:1,height:1};
    const center={r:origin.r+Math.floor((footprint.height-1)/2),c:origin.c+Math.floor((footprint.width-1)/2)};
    if(Math.abs(center.r-P.player.r)>4||Math.abs(center.c-P.player.c)>4)continue;
    const y=tileTop(center.r,center.c)+.055,half=4.5;
    const points=[[wx(center.c-half),y,wz(center.r-half)],[wx(center.c+half),y,wz(center.r-half)],[wx(center.c+half),y,wz(center.r+half)],[wx(center.c-half),y,wz(center.r+half)],[wx(center.c-half),y,wz(center.r-half)]];
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(([x,py,z])=>new THREE.Vector3(x,py,z)));
    const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#d13a3a',transparent:true,opacity:.9,depthTest:false,toneMapped:false}));
    line.userData.firebirdRange=true;firebirdRangeLayer.add(line);
  }
}
const spawnMarkerGroup=new THREE.Group();spawnMarkerGroup.add(playerDecal);paper.add(spawnMarkerGroup);
const ringTexture=canvasTexture((ctx,s)=>{ctx.strokeStyle='#415e37';ctx.lineWidth=7;ctx.setLineDash([16,12]);ctx.beginPath();ctx.arc(s/2,s/2,s*.43,0,Math.PI*2);ctx.stroke();});
const selectionRing=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),new THREE.MeshBasicMaterial({map:ringTexture,transparent:true,depthWrite:false}));selectionRing.rotation.x=-Math.PI/2;selectionRing.position.y=.006;selectionRing.visible=false;playerGroup.add(selectionRing);
const hoverOutline=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.94,.94)),new THREE.LineBasicMaterial({color:'#537340',depthTest:false,transparent:true,opacity:.75}));hoverOutline.rotation.x=-Math.PI/2;hoverOutline.visible=false;paper.add(hoverOutline);
const foldMotionView=createFoldMotionView({paper,layers:[tileLayer,entityEdgeLayer,terrainLayer,staticTokenLayer,mechanismLayer,rayLayer,modelLayer],fixedLayers:[gridLayer,foldAxisLayer,creaseGuideLayer,foldSelectionLayer,boardLayer,tagLayer,spawnMarkerGroup,firebirdRangeLayer],playerGroup,wx,wz,canFold:cell=>nodeFollowsFold(cell?.nodeId?documentModel.world.get(cell.nodeId):null)});
function tileTop(r,c) { return map.tiles[r]?.[c]?tileHeight(map.tiles[r][c]):0; }
const playerVisual=createPlayerVisualView({host:activeTokenHost,library:modelLibrary,createFallback:makeToken,clearFallback:disposableClear,onChange:()=>{renderer.shadowMap.needsUpdate=true;},onError:(descriptor,error)=>console.warn('玩家模型加载失败',descriptor.visual.model,error)});
function renderPlayer() {renderer.shadowMap.needsUpdate=true;playerVisual.update(getPlayerPrefab(),P.mode==='play');playerGroup.userData.prefabId='player_ai';spawnMarkerGroup.position.set(wx(map.spawn.c),tileTop(map.spawn.r,map.spawn.c)+.018,wz(map.spawn.r));spawnMarkerGroup.rotation.y=-map.spawn.dir*Math.PI/4;if(!P.animation){playerGroup.position.set(wx(P.player.c),tileTop(P.player.r,P.player.c)+.018,wz(P.player.r));playerGroup.rotation.set(0,-P.player.dir*Math.PI/4,0);}}

function entityEdgeColor(tile){return tile.edgeColor??(!tile.prefabId&&!blocked(tile)?prefabs.find(p=>p.id==='paper_ai')?.tile?.edgeColor:undefined);}
function makeToken(color){
 const g=new THREE.Group(),body=new THREE.Mesh(new THREE.DodecahedronGeometry(.36,0),new THREE.MeshStandardMaterial({color:COLORS[color]??COLORS.white,roughness:.8}));body.position.y=.42;g.add(body);
 for(const x of [-.11,.11]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.065,12,8),new THREE.MeshBasicMaterial({color:'#ffffff'}));eye.position.set(x,.5,-.29);g.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.029,10,8),new THREE.MeshBasicMaterial({color:'#182721'}));pupil.position.set(x,.5,-.346);g.add(pupil);}g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});return g;
}
let liftLineRanges=[],dynamicSurfaceEntries=[];
const editRefresh=createEditRefresh({rebuild:rebuildPaper,notify:notifyMapChanged,requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:handle=>cancelAnimationFrame(handle)});
function buildPaper(){editRefresh.request({scene:true},!!gestureBefore);}
function rebuildPaper() {
  if(P.mode==='play')map=documentModel.view({runtime:true});
  hoverDescriptionKey=null;
  if(P.foldMotion)controller.cancelFoldMotion();
  foldMotionView.invalidatePrepared();
  foldableCells.clear();
  placementTagCells=[];
  for(const node of documentModel.world.serialize()){
   const cells=documentModel.world.cells(node.id);
   if(node.tags.spawn||node.tags.entry)placementTagCells.push(...cells);
   if(nodeFollowsFold(node))for(const cell of cells)foldableCells.add(cell.r+','+cell.c);
  }
  updateLighting();
  cancelPlacementPreview();
  liftLineRanges=[];dynamicSurfaceEntries=[];
  disposableClear(placementLayer);disposableClear(staticTokenLayer);disposableClear(tagLayer);disposableClear(terrainLayer);disposableClear(tileLayer);disposableClear(foldLayer);disposableClear(gridLayer);disposableClear(entityEdgeLayer);clearSelection();hovered=null;hoverOutline.visible=false;
  const surfaces=createSurfaceBatchCollector({wx,wz}),buckets=new Map(),edges=[],styleEdges=new Map(),styleCells=new Map(),terrains=new Map();
	 const treeCells=renderTreeCells(documentModel,{nodeHidden,cellHidden,runtime:P.mode==='play'}),baseProjection=map,surfaceMaps=new Map();
  refreshModels();
  paperSurfaceCache.begin();
  for(const projection of treeCells.surfaceCells){
    const {r,c,tile,nodeId}=projection;
    const cell={r,c,nodeId,tile},surfaceMap=projection.primary?map:(surfaceMaps.get(nodeId)??(surfaceMaps.set(nodeId,mapForSurface(documentModel,nodeId,P.mode==='play',baseProjection)),surfaceMaps.get(nodeId)));
    const dynamic=hasConnectedLiftNearby(surfaceMap,r,c,cellHidden);
    const surface=paperSurface(surfaceMap,r,c,cellHidden,P.mode!=='edit'||visibility.folds,lighting.creaseDepth,dynamic);
    let dynamicEntry=null;
    if(surface){
      if(dynamic){
        const geometry=new THREE.BufferGeometry(),positions=[];
        for(let i=0;i<surface.positions.length;i+=3)positions.push(surface.positions[i]+wx(c),surface.positions[i+1],surface.positions[i+2]+wz(r));
        geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
        const mesh=new THREE.Mesh(geometry,materials[tile.color??'white']);mesh.userData.triangleCells=Array.from({length:positions.length/9},()=>cell);mesh.userData.surfaceCells=[cell];tileLayer.add(mesh);
        dynamicEntry={r,c,nodeId,primary:projection.primary,cell,mesh};dynamicSurfaceEntries.push(dynamicEntry);
        if(tile.lift){const marker=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({map:liftTexture,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3}));marker.rotation.x=-Math.PI/2;marker.position.set(wx(c),tileHeight(tile)+.035,wz(r));marker.scale.setScalar(.58);marker.raycast=()=>{};marker.userData.cell=cell;marker.userData.dynamicLiftMarker=true;tileLayer.add(marker);dynamicEntry.marker=marker;}
      }else surfaces.add(cell,surface);
    }else if(tile.lift){
      const body=createLiftBlock(THREE,tile,materials[tile.color??'white']);body.position.x=wx(c);body.position.z=wz(r);body.userData.cell=cell;body.userData.surfaceCells=[cell];
      const marker=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({map:liftTexture,transparent:true,depthWrite:false,depthTest:true,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3}));
      marker.rotation.x=-Math.PI/2;marker.position.y=tileThickness(tile)/2+.035;marker.scale.setScalar(.58);marker.raycast=()=>{};marker.userData.liftMarker=true;body.add(marker);tileLayer.add(body);
    }else{if(!buckets.has(tile.color))buckets.set(tile.color,[]);buckets.get(tile.color).push(cell);}
    const y=tileHeight(tile),x=wx(c),z=wz(r),edgeStart=edges.length;
    const styleStart=styleEdges.get(entityEdgeColor(tile))?.length??0;



    const edgeColor=entityEdgeColor(tile);
    if(edgeColor){
      if(!styleEdges.has(edgeColor))styleEdges.set(edgeColor,[]);const lines=styleEdges.get(edgeColor);
      for(const segment of entityEdgeSegments(tile,surface))for(const p of segment)lines.push(x+p[0],p[1],z+p[2]);
    }

    if(edgeColor){if(!styleCells.has(edgeColor))styleCells.set(edgeColor,[]);const count=((styleEdges.get(edgeColor)?.length??0)-styleStart)/6;for(let i=0;i<count;i++)styleCells.get(edgeColor).push(cell);}
    if(surface){for(const segment of surface.boundarySegments)for(const p of segment)edges.push(x+p[0],p[1]+.002,z+p[2]);}else edges.push(x-.5,y+.002,z-.5,x+.5,y+.002,z-.5,x+.5,y+.002,z-.5,x+.5,y+.002,z+.5,x+.5,y+.002,z+.5,x-.5,y+.002,z+.5,x-.5,y+.002,z+.5,x-.5,y+.002,z-.5);
    if(dynamicEntry){dynamicEntry.gridStart=edgeStart;dynamicEntry.gridEnd=edges.length;dynamicEntry.style=entityEdgeColor(tile);dynamicEntry.styleStart=styleStart;dynamicEntry.styleEnd=dynamicEntry.style?styleEdges.get(dynamicEntry.style).length:styleStart;}
    if(documentModel.world.get(nodeId).components.lift&&!dynamicEntry){
      liftLineRanges.push({r,c,height:y,start:edgeStart,end:edges.length,style:null});
      const style=entityEdgeColor(tile);if(style)liftLineRanges.push({r,c,height:y,start:styleStart,end:styleEdges.get(style)?.length??styleStart,style});
    }
  }
  paperSurfaceCache.end();
  refreshMechanismMarkers(treeCells);
  for(const cell of treeCells.tokenCells){const token=makeToken(cell.tile.color);token.rotation.y=-Math.PI/2;token.position.set(wx(cell.c),Math.max(cell.surfaceTop,cell.tile.height??0),wz(cell.r));token.userData.cell=cell;staticTokenLayer.add(token);}
  for(const marker of treeCells.terrainCells){if(!terrains.has(marker.type))terrains.set(marker.type,[]);terrains.get(marker.type).push(marker);}
  for(const mesh of surfaces.meshes(THREE,color=>materials[color]))tileLayer.add(mesh);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(const [color,cells] of buckets){
    for(const mesh of createSpatialInstances(THREE,{cells,geometry:tileGeo,material:materials[color??'white'],matrixFor:({r,c,tile})=>{const height=tileHeight(tile),thickness=tileThickness(tile);position.set(wx(c),height-thickness/2,wz(r));scale.set(1,thickness,1);return matrix.compose(position,rotation,scale);}}))tileLayer.add(mesh);
  }
  for(const [type,cells] of terrains){
    const material=new THREE.MeshBasicMaterial({map:terrainTextures[type],transparent:true,depthWrite:false,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-2});
    const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
    for(const mesh of createSpatialInstances(THREE,{cells,geometry:markerGeo,material,matrixFor:({r,c,index,total,surfaceTop})=>{position.set(wx(c)+(total>1?(index-(total-1)/2)*.22:0),Math.max(tileTop(r,c),surfaceTop)+.025+index*.005,wz(r));return matrix.compose(position,tilt,new THREE.Vector3(total>1?.4:.72,total>1?.4:.72,1));}}))terrainLayer.add(mesh);
  }
  for(const mesh of createTagMarkerBatches(THREE,treeCells.tagCells,{geometry:markerGeo,textures:tagTextures,wx,wz,top:cell=>Math.max(tileTop(cell.r,cell.c),cell.surfaceTop)}))tagLayer.add(mesh);
  if(map.exit&&map.tiles[map.exit.r]?.[map.exit.c]&&!cellHidden(map.exit.r,map.exit.c)){
    const marker=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({map:exitTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));marker.rotation.x=-Math.PI/2;marker.position.set(wx(map.exit.c),tileTop(map.exit.r,map.exit.c)+.012,wz(map.exit.r));marker.userData.exitCell={...map.exit};foldLayer.add(marker);
  }
  for(const [edgeColor,positions] of styleEdges){const outline=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3)),new THREE.LineBasicMaterial({color:edgeColor,toneMapped:false}));outline.renderOrder=4;outline.userData.edgeColor=edgeColor;outline.userData.segmentCells=styleCells.get(edgeColor);entityEdgeLayer.add(outline);}
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if(!map.tiles[r][c]||cellHidden(r,c)){const x=wx(c),z=wz(r);edges.push(x-.5,voidY(.002),z-.5,x+.5,voidY(.002),z-.5,x+.5,voidY(.002),z-.5,x+.5,voidY(.002),z+.5,x+.5,voidY(.002),z+.5,x-.5,voidY(.002),z+.5,x-.5,voidY(.002),z+.5,x-.5,voidY(.002),z-.5);}
  const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(edges,3)),gridMaterial);gridLayer.add(grid);
  for(const range of liftLineRanges){range.attribute=range.style===null?grid.geometry.attributes.position:entityEdgeLayer.children.find(line=>line.userData.edgeColor===range.style)?.geometry.attributes.position;}
  for(const entry of dynamicSurfaceEntries){entry.gridAttribute=grid.geometry.attributes.position;entry.styleAttribute=entry.style?entityEdgeLayer.children.find(line=>line.userData.edgeColor===entry.style)?.geometry.attributes.position:null;}
  rebuildFoldAxes();layoutScenery();buildCreaseGuides();buildFoldSelection();
  for(const layer of [tileLayer,staticTokenLayer,playerGroup])layer.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
  renderRegionControls();renderEntityVisibility();refreshTreePanel();
  if(boardLayer.userData.size!==map.width+'x'+map.height){disposableClear(boardLayer);addAxisLabels(0);boardLayer.userData.size=map.width+'x'+map.height;}renderPlayer();applyVisibility();updateUI();scheduleFoldPreparation();
}
// Update existing geometry only; gameplay selection and editor controls are untouched.
function refreshLiftSurfaces(){
 renderer.shadowMap.needsUpdate=true;
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 for(const mesh of tileLayer.children){
  if(mesh.userData.liftThickness!==undefined){const {r,c}=mesh.userData.cell;setLiftBlockHeight(mesh,tileTop(r,c));continue;}
  if(!mesh.isInstancedMesh)continue;
  mesh.userData.cells.forEach(({r,c,tile},i)=>{const height=tileTop(r,c),thickness=tileThickness(tile);position.set(wx(c),height-thickness/2,wz(r));scale.set(1,thickness,1);matrix.compose(position,rotation,scale);mesh.setMatrixAt(i,matrix);});
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
 }
 for(const range of liftLineRanges){const delta=tileTop(range.r,range.c)-range.height;if(!delta||!range.attribute)continue;
  for(let i=range.start+1;i<range.end;i+=3)range.attribute.array[i]+=delta;
  range.height+=delta;range.attribute.needsUpdate=true;
 }
 const surfaceMaps=new Map();
 for(const entry of dynamicSurfaceEntries){
  const surfaceMap=entry.primary?map:(surfaceMaps.get(entry.nodeId)??(surfaceMaps.set(entry.nodeId,mapForSurface(documentModel,entry.nodeId,true,map)),surfaceMaps.get(entry.nodeId)));
  const surface=paperSurface(surfaceMap,entry.r,entry.c,cellHidden,P.mode!=='edit'||visibility.folds,lighting.creaseDepth,true);
  if(!surface)continue;
  const points=entry.mesh.geometry.attributes.position;
  for(let i=0;i<surface.positions.length;i+=3){points.array[i]=surface.positions[i]+wx(entry.c);points.array[i+1]=surface.positions[i+1];points.array[i+2]=surface.positions[i+2]+wz(entry.r);}
  points.needsUpdate=true;entry.mesh.geometry.computeVertexNormals();entry.mesh.geometry.computeBoundingSphere();
  const writeEdges=(attribute,start,segments,raise=0)=>{if(!attribute)return;let i=start;for(const segment of segments)for(const point of segment){attribute.array[i++]=wx(entry.c)+point[0];attribute.array[i++]=point[1]+raise;attribute.array[i++]=wz(entry.r)+point[2];}attribute.needsUpdate=true;};
  writeEdges(entry.gridAttribute,entry.gridStart,surface.boundarySegments,.002);
  if(entry.styleAttribute)writeEdges(entry.styleAttribute,entry.styleStart,entityEdgeSegments(entry.cell.tile,surface));
  if(entry.marker)entry.marker.position.y=surface.height+.035;
 }
 for(const layer of [gridLayer,entityEdgeLayer])for(const mesh of layer.children){mesh.geometry?.computeBoundingSphere();}
 const tilt=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 for(const mesh of terrainLayer.children){
  if(mesh.isInstancedMesh){mesh.userData.cells.forEach(({r,c,index,total},i)=>{position.set(wx(c)+(total>1?(index-(total-1)/2)*.22:0),tileTop(r,c)+.025+index*.005,wz(r));matrix.compose(position,tilt,new THREE.Vector3(total>1?.4:.72,total>1?.4:.72,1));mesh.setMatrixAt(i,matrix);});mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();}
 }
 for(const mesh of tagLayer.children)updateTagMarkerBatch(THREE,mesh,{wx,wz,top:cell=>tileTop(cell.r,cell.c)});
 for(const mesh of foldLayer.children)if(mesh.userData.exitCell){const {r,c}=mesh.userData.exitCell;mesh.position.y=tileTop(r,c)+.012;}
 axisViewKey=null;rebuildFoldAxes();buildCreaseGuides();buildFoldSelection();
 if(dynamicSurfaceEntries.length){foldMotionView.invalidatePrepared();scheduleFoldPreparation();}
 if(hovered&&hoverOutline.visible)hoverOutline.position.y=tileTop(hovered.r,hovered.c)+.035;
 refreshMechanismMarkers();
}
function refreshMechanismSurfaces(){
 const key=documentModel.world.serialize().filter(node=>node.components.fragile&&documentModel.world.runtime(node.id,'fragile').broken).map(node=>node.id).sort().join('|');
 if(key!==brokenViewKey){brokenViewKey=key;buildPaper();}else refreshMechanismMarkers();
}
function refreshModels(){return modelView.update(P.mode==='play'?collectModelDescriptors(documentModel,{getPrefab:id=>prefabs.find(prefab=>prefab.id===id),nodeHidden,cellHidden,runtime:true,wx,wz,tileTop}):[]);}
function refreshMechanismMarkers(cells=renderTreeCells(documentModel,{nodeHidden,cellHidden,runtime:P.mode==='play'})){
 refreshModels();
 disposableClear(mechanismLayer);disposableClear(rayLayer);
 brokenViewKey=P.mode==='play'?documentModel.world.serialize().filter(node=>node.components.fragile&&documentModel.world.runtime(node.id,'fragile').broken).map(node=>node.id).sort().join('|'):'';
 const enemyCells=documentModel.world.serialize().filter(node=>node.static.entityType==='creature'&&(node.components.rayEmitter||node.components.firebird)&&!nodeHidden(node)).flatMap(node=>{
  const occupied=documentModel.world.cells(node.id),cell=occupied[Math.floor(occupied.length/2)];
  return cell&&!cellHidden(cell.r,cell.c)?[{...cell,nodeId:node.id,tile:map.tiles[cell.r]?.[cell.c]??{height:.09}}]:[];
 });
 for(const cell of [...cells.surfaceCells,...enemyCells]){
  const node=documentModel.world.get(cell.nodeId),components=node.components;
  if(!components.rayEmitter&&!components.foldSwitch&&!components.fragile&&!components.firebird)continue;
  const runtime=P.mode==='play'?{rayEmitter:documentModel.world.runtime(node.id,'rayEmitter'),foldSwitch:documentModel.world.runtime(node.id,'foldSwitch'),fragile:documentModel.world.runtime(node.id,'fragile'),firebird:documentModel.world.runtime(node.id,'firebird')}:{};
  const marker=mechanismMarker(THREE,components,runtime);marker.position.set(wx(cell.c),tileHeight(cell.tile)+.04,wz(cell.r));marker.userData.cell=cell;mechanismLayer.add(marker);
  if(components.rayEmitter){
   const direction=runtime.rayEmitter?.direction??components.rayEmitter.initialDirection;
   for(const shot of playerRuntime.rayCells(cell,direction,map.width,map.height)){
    if(cellHidden(shot.r,shot.c))continue;const mesh=shotMarker(THREE);mesh.userData.cell={r:shot.r,c:shot.c};mesh.userData.emitterId=node.id;mesh.position.set(wx(shot.c),tileTop(shot.r,shot.c)+.025,wz(shot.r));rayLayer.add(mesh);
   }
  }
 }
 if(P.mode==='play')for(const cell of P.terrainState.flames??[]){
  if(cellHidden(cell.r,cell.c))continue;
  const marker=mechanismMarker(THREE,{flame:{}});marker.position.set(wx(cell.c),tileTop(cell.r,cell.c)+.045,wz(cell.r));mechanismLayer.add(marker);
 }
}
function addAxisLabels(maxHeight){
  const w=map.width,h=map.height,size=Math.min(4096,Math.max(w,h)*32+64);
  const texture=canvasTexture((ctx,s)=>{
    const sx=s/(w+2),sy=s/(h+2);ctx.fillStyle='#50665a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 '+Math.max(10,Math.min(sx,sy)*.42)+'px Segoe UI';
    for(let c=0;c<w;c++){ctx.fillText(columnLabel(c),(c+1.5)*sx,.5*sy);ctx.fillText(columnLabel(c),(c+1.5)*sx,(h+1.5)*sy);}
    for(let r=0;r<h;r++){ctx.fillText(String(r+1),.5*sx,(r+1.5)*sy);ctx.fillText(String(r+1),(w+1.5)*sx,(r+1.5)*sy);}
  },size);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(w+2,h+2),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,depthTest:true}));label.rotation.x=-Math.PI/2;label.position.y=maxHeight+.003;label.userData.ownedTexture=texture;boardLayer.add(label);
}
function applyVisibility(){
  renderer.shadowMap.needsUpdate=true;
  const editing=P.mode==='edit';modelLayer.visible=!editing;boardLayer.visible=!editing||visibility.coords;tileLayer.visible=true;entityEdgeLayer.visible=tileLayer.visible;gridLayer.visible=showGrid;foldLayer.visible=!editing||visibility.folds;foldAxisLayer.visible=foldLayer.visible;playerGroup.visible=!editing;spawnMarkerGroup.visible=(!editing||visibility.player)&&!cellHidden(map.spawn.r,map.spawn.c)&&!!map.tiles[map.spawn.r]?.[map.spawn.c]?.tags?.spawn;staticTokenLayer.visible=tileLayer.visible;tagLayer.visible=!editing||visibility.player;
  terrainLayer.visible=true;tableScenery.group.visible=showTable;creaseGuideLayer.visible=showCreaseDashes&&foldLayer.visible;foldSelectionLayer.visible=foldLayer.visible&&P.mode==='play'&&!!P.chosenFold;
}
for(const [id,key] of [['coordsVisible','coords'],['foldsVisible','folds'],['playerVisible','player']])$(id).onchange=()=>{visibility[key]=$(id).checked;if(key==='folds')buildPaper();else applyVisibility();syncState();};

function fitCamera(resetZoom=true) {
  if(P.mode==='play'){
    getCameraFollowPosition(lastFollowPosition);lastFollowSteps=P.steps;
    if(resetZoom)camera.zoom=1;
    cameraFollowTarget.copy(boundedFollowTarget(lastFollowPosition,map.width,map.height,9/camera.zoom));
    cameraOffset.set(view==='top'?0:12,view==='top'?24:17.04,view==='top'?.001:15);
    followTarget(camera,controls,cameraFollowTarget,cameraOffset);
    const rect=viewport.getBoundingClientRect();baseSpan=squareViewSpan(camera,cameraFollowTarget,9,rect.width/Math.max(1,rect.height));
    if(resetZoom)camera.zoom=1;resize();return;
  }
  controls.target.set(0,0,0);const distance=Math.max(24,Math.max(map.width,map.height)*2);cameraOffset.set(view==='top'?0:distance*.5,view==='top'?distance:distance*.71,view==='top'?.001:distance*.625);camera.position.copy(cameraOffset);camera.lookAt(controls.target);camera.updateMatrixWorld(true);
  const rect=viewport.getBoundingClientRect(),aspect=Math.max(.1,rect.width/rect.height);
  const corners=[];for(const x of [-map.width/2-.7,map.width/2+.7])for(const z of [-map.height/2-.7,map.height/2+.7])corners.push(new THREE.Vector3(x,0,z).applyMatrix4(camera.matrixWorldInverse));
  const ex=Math.max(...corners.map(p=>Math.abs(p.x))),ey=Math.max(...corners.map(p=>Math.abs(p.y)));
  baseSpan=Math.max(ey/.7,ex/(aspect*.79));if(resetZoom)camera.zoom=1;resize();controls.update();
}
function resize(){const {width:w,height:h}=viewport.getBoundingClientRect();renderer.setSize(w,h,false);const aspect=w/Math.max(1,h);camera.left=-baseSpan*aspect;camera.right=baseSpan*aspect;camera.top=baseSpan;camera.bottom=-baseSpan;camera.updateProjectionMatrix();}
function updateCameraMode(){
  if(cameraMode===P.mode)return;
  cameraMode=P.mode;
  if(P.mode==='play'){
    editorCameraSnapshot={position:camera.position.clone(),target:controls.target.clone(),zoom:camera.zoom,span:baseSpan,view};
    controls.enablePan=true;const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;fitCamera();
  }else{
    controls.enablePan=true;
    if(editorCameraSnapshot){const saved=editorCameraSnapshot;changeView(saved.view);camera.position.copy(saved.position);controls.target.copy(saved.target);camera.zoom=saved.zoom;baseSpan=saved.span;resize();controls.update();editorCameraSnapshot=null;}else fitCamera();
  }
}
new ResizeObserver(()=>{fitCamera(false);}).observe(viewport);
function changeView(next){view=next;for(const [id,value]of [['fixedView','fixed'],['topView','top']]){$(id).classList.toggle('active',view===value);$(id).setAttribute('aria-pressed',String(view===value));}document.querySelector('.viewport-corner span').textContent=view==='top'?'TOP VIEW':'ISOMETRIC';fitCamera();}
$('fixedView').onclick=()=>changeView('fixed');$('topView').onclick=()=>changeView('top');$('fitView').onclick=()=>fitCamera();
function syncAudioControls(){const muted=audio.isMuted(),button=$('audioMute'),icon=button.querySelector('svg');button.setAttribute('aria-pressed',String(muted));button.setAttribute('aria-label',muted?'打开声音':'静音');button.dataset.tip=muted?'打开声音':'静音';if(icon)icon.replaceWith(createElement(muted?VolumeX:Volume2));}
$('audioMute').onclick=()=>{audio.setMuted(!audio.isMuted());syncAudioControls();};$('audioVolume').oninput=event=>{audio.setVolume(event.target.value);if(audio.isMuted())audio.setMuted(false);syncAudioControls();};syncAudioControls();
$('zoomIn').onclick=()=>{camera.zoom=Math.min(64,camera.zoom*1.16);camera.updateProjectionMatrix();};$('zoomOut').onclick=()=>{camera.zoom=Math.max(.3,camera.zoom/1.16);camera.updateProjectionMatrix();};


function overlay(r,c,hex,opacity=.35){const m=new THREE.Mesh(new THREE.PlaneGeometry(.89,.89),new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity,depthWrite:false}));m.rotation.x=-Math.PI/2;m.position.set(wx(c),tileTop(r,c)+.016,wz(r));effectLayer.add(m);return m;}
function tileOutline(r,c,hex){const line=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(.9,.9)),new THREE.LineBasicMaterial({color:hex,depthTest:false}));line.rotation.x=-Math.PI/2;line.position.set(wx(c),tileTop(r,c)+.024,wz(r));effectLayer.add(line);}









$('teleportBtn').onclick=()=>teleport();$('interactBtn').onclick=()=>controller.interact();
for(const id of ['blockThickness','blockGradualRate'])$(id).onchange=()=>{try{brushTile();if(tool!=='place')setTool('place');syncState();}catch(e){toast(e.message,true);}};
$('blockHeight').oninput=()=>{const n=Number($('blockHeight').value);if(Number.isFinite(n)&&n>=.01&&n<=16){brushHeight=n;syncState();}};
$('blockHeight').onchange=()=>{const n=Number($('blockHeight').value);if(!Number.isFinite(n)||n<.01||n>16){toast('方块高度须为 0.01–16',true);$('blockHeight').value=brushHeight;return;}brushHeight=n;if(tool!=='place')setTool('place');};

function setTool(next){if(next==='paint')next='place';pendingRegion=null;tool=next;$('foldDirectionPanel').hidden=tool!=='fold';const tagNames={player:"玩家起点",entry:"设置区域入口","region-exit":"设置区域出口","clear-tags":"清除方块标签"};if(tagNames[tool])selectedTagTool=tool;
const tagSummary=$('tagSummary'),tagName=document.createElement('span');tagName.textContent=tagNames[selectedTagTool]||'选择方块标签';
const tagIcon=selectedTagTool?document.querySelector('[data-tool="'+selectedTagTool+'"] svg').cloneNode(true):createElement(Box);tagIcon.setAttribute('aria-hidden','true');tagSummary.replaceChildren(tagIcon,tagName);$("exitRegionPanel").hidden=tool!=="region-exit";cancelPlacementPreview();drawEditSelection();document.querySelectorAll('[data-tool]').forEach(b=>{const active=b.dataset.tool===tool;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});updateUI();}
document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{if(b.dataset.tool==='select'){selectionMode=tool==='select'&&selectionMode==='single'?'multi':'single';if(selectionMode==='single'&&selectedCells.length>1){setSelectedCells(directSelectedCells.slice(0,1));}b.setAttribute('aria-label','选区 · '+(selectionMode==='single'?'单选':'多选'));b.dataset.tip='选区 · '+(selectionMode==='single'?'单选':'多选');b.querySelector('.selection-mode-label').textContent=b.dataset.tip;}setTool(b.dataset.tool);scheduleInspection();});
document.querySelectorAll('[data-color]').forEach(b=>b.onclick=()=>{if(!hasColor(prefabs.find(p=>p.id===selectedPrefabId)?.tile))return;color=b.dataset.color;document.querySelectorAll('[data-color]').forEach(s=>{const active=s===b;s.classList.toggle('active',active);s.setAttribute('aria-pressed',String(active));});$('colorName').textContent=COLOR_NAMES[color];$('colorType').textContent=prefabs.find(p=>p.id===selectedPrefabId)?.tile?.blocked?'阻挡实体':'可通行实体';if(tool!=='place')setTool('place');});
document.querySelectorAll('[data-fold]').forEach(b=>b.onclick=()=>{foldType=b.dataset.fold==='none'?null:b.dataset.fold;document.querySelectorAll('[data-fold]').forEach(s=>{s.classList.toggle('active',s===b);s.setAttribute('aria-pressed',String(s===b));});setTool('fold');});
$('gridToggle').onclick=()=>{showGrid=!showGrid;$('gridToggle').setAttribute('aria-pressed',String(showGrid));$('gridToggle').classList.toggle('active',showGrid);applyVisibility();syncState();};
$('tableToggle').onclick=()=>{showTable=!showTable;$('tableToggle').setAttribute('aria-pressed',String(showTable));$('tableToggle').classList.toggle('active',showTable);applyVisibility();syncState();};
$('creaseDashToggle').onclick=()=>{showCreaseDashes=!showCreaseDashes;$('creaseDashToggle').setAttribute('aria-pressed',String(showCreaseDashes));$('creaseDashToggle').classList.toggle('active',showCreaseDashes);applyVisibility();syncState();};
$('clearMap').onclick=()=>{try{const projection=clearMapCells(map,cellHidden,visibility);for(const node of documentModel.world.serialize()){if(nodeHidden(node)||documentModel.world.transforms.worldCells(node.transformId).some(p=>cellHidden(p.r,p.c)))throw new Error('清空会删除隐藏实体，请先显示全部实体与区域');if(documentModel.world.transforms.referenceOwners(node.transformId).some(owner=>!documentModel.world.serialize().some(item=>'entity:'+item.id===owner)))throw new Error('Transform has external references');}const snapshot=documentModel.serialize();snapshot.entities=[];snapshot.transforms=[];snapshot.metadata={...snapshot.metadata,exit:projection.exit};commitTree(new TreeDocument(snapshot));setSelectedCells([]);editRect=null;pendingRegion=null;debugOverrides.clear();nodeDebug.clear();clearInspection();controller.resetProgress();buildPaper();persist();toast('地图已清空 · 可撤销');}catch(error){toast(error.message,true);}};
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
      const next=clone(map);if(tool==='clear-tags')next.tiles[r][c].tags={};else {tagCell(next,r,c,tag,tool==='region-exit'?$('exitRegion').value:true);if(tool==='region-exit'){next.tiles[r][c].tags.requiredKeys=[...document.querySelectorAll('#requiredKeyList input:checked')].map(i=>i.value);next.tiles[r][c].tags.requiredSwitches=[...document.querySelectorAll('#requiredSwitchList input:checked')].map(i=>i.value);}}
      applyPropertyMap(next);controller.resetPosition();buildPaper();persist();
    }catch(e){toast(e.message,true);}return;
  }
  if(tool==='paste'){pasteAt(r,c);return;}
  if(tool==='place'){try{if(entityHidden(brushTile(),hiddenEntities))throw new Error('请先显示该实体类型');}catch(error){toast(error.message,true);return;}}
  const t=map.tiles[r][c];const isSpawn=r===map.spawn.r&&c===map.spawn.c;const isExit=map.exit&&r===map.exit.r&&c===map.exit.c;
  if(tool==='erase'){if(!t)return;if(isSpawn){toast('先把玩家起点移到其他方块',true);return;}}
  if(tool==='place'&&blocked(brushTile())&&isSpawn){toast('玩家起点不能设为阻挡方块',true);return;}
  if(tool==='place'&&blocked(brushTile())&&isExit){toast('出口不能设为阻挡方块，请先移动出口',true);return;}
  

  
  if(tool==='place'){try{commitTree(placementCandidate(r,c),{placement:true,cell:{r,c}});}catch(e){toast(e.message,true);}return;}
  if(tool==='fold'){try{if(!visibility.folds)throw new Error('隐藏折线禁止编辑');if(foldType)assertTagAttachment(tagCatalog,'tag-fold',map,r,c);const next=clone(map);if(!applyFoldLine(next,r,c,foldType))return;validateMap(next,true);applyPropertyMap(next);buildPaper();persist();}catch(error){toast(error.message,true);}return;}
  if(tool==='erase'){try{const cells=removeEntity(map,r,c,cellHidden);if(!visibility.player&&cells.some(p=>Object.keys(map.tiles[p.r][p.c]?.tags??{}).length))throw new Error('删除实体会改变隐藏标签');if(cells.some(p=>map.tiles[p.r][p.c]?.tags?.spawn))throw new Error('先移动玩家起点标签');const next=clone(map);for(const p of cells){const tile=next.tiles[p.r][p.c];next.foldCells.push(...foldsOf(tile).map(type=>({...p,type})));next.tiles[p.r][p.c]=null;}applyMap(next,true);buildPaper();persist();}catch(e){toast(e.message,true);}return;}
  buildPaper();persist();updateUI();
}

function clearInspection(){cancelAnimationFrame(inspectionFrame);inspectionFrame=0;inspectedCell=null;for(const id of ['propertyInspector','generalPropertyInspector','cellSpecialInspector','cellPropertyInspector'])clearPropertyInspector($(id));$('inspectedCellProperties').textContent='尚未选择方格';$('inspectedEntity').textContent='使用地图工具的选区选择方格';$('inspectedProperties').textContent='尚未选择';$('propertyEditStatus').textContent='';renderMechanismText($('mechanismDescriptions'),['选择实体以查看机制说明']);}
function scheduleInspection(){cancelAnimationFrame(inspectionFrame);inspectionFrame=requestAnimationFrame(()=>{inspectionFrame=0;try{inspectSelection();}catch(error){clearInspection();$('propertyEditStatus').textContent=error.message;}});}
function inspectionKey(r,c,tile){return r+','+c+':'+(tile?.instance?.id??'')+':'+(tile?.prefabId??'void_ai');}
function inspectAtCell(r,c){setSelectedCells([{r,c}]);drawEditSelection();inspectSelection();}
function inspectedPropertySchema(r,c,tile){
  const node=documentModel.primaryAt(r,c);
  return projectedCellSchema(node,documentModel.world.at(r,c),tile,nodeSchema,entityPropertySchema(tile,tagCatalog));
}
const MECHANISM_COMPONENTS=['lift','foldSwitch','rayEmitter','firebird','fragile'];
const mechanismNodeAt=(r,c)=>documentModel.world.at(r,c).find(node=>MECHANISM_COMPONENTS.find(id=>node.components?.[id]));
function mechanismInspection(node){
  if(!node)return null;
  const type=MECHANISM_COMPONENTS.find(id=>node.components?.[id]);
  if(!type)return null;
  if(type==='fragile')return {type,count:Number(node.components.fragile.count??1)};
  return {type,triggers:normalizeComponentTriggers(node.components[type])};
}
function applyPropertyMap(next){
 const checked=forkTreeDocument(documentModel);checked.applyProjection(next);
 assertNodePropertyChanges(documentModel,checked,nodeSchema);
 applyMap(next,true);
}
function inspectSelection(){
  const cells=inspectionCells(map,selectedCells);if(!cells.length){clearInspection();return;}
  const entries=cells.map(({r,c})=>{
    const entity=inspectCell(map,r,c,cellHidden);
    const values=entity.properties??{transparent:entity.transparent,placeable:entity.placeable,blocked:entity.blocked,folds:entity.folds};
    const mechanism=mechanismInspection(mechanismNodeAt(r,c));
    if(mechanism)values.mechanism=mechanism;
    const schema=entity.properties?inspectedPropertySchema(r,c,entity.properties):Object.fromEntries(Object.keys(values).map(key=>[key,{tempEditable:false}]));
    if(mechanism){schema.mechanism={label:mechanism.type==='fragile'?'易碎方块':'机制触发',children:mechanism.type==='fragile'?{type:{label:'机制类型',tempEditable:false},count:{label:'触发次数',tempEditable:true}}:{type:{label:'机制类型',tempEditable:false},triggers:{label:'触发方式',tempEditable:true}}};}
    return {values:entity.properties?debugOverrides.values(inspectionKey(r,c,entity.properties),values,schema):values,schema};
  });
  const descriptions={key:'钥匙：钥匙是通过区域出口进入下一个区域的可选条件。玩家收集钥匙后，满足出口配置的全部所需钥匙才能传送；未设置所需钥匙的出口无需钥匙。',campfire:'篝火：玩家不能进入篝火方块。玩家进入篝火八向相邻的方格时，解除冰冻状态。',ice:'冰块：蓝色阻挡地形，玩家不可进入；不改变冰冻、过热等状态。',rayEmitter:'冰冻射线：首次成功行动后临时替换初始方向前方三格地形；之后每次匹配所选触发方式的行动恢复原地形、反向并重新冻结，保留道具、生物及标签。命中玩家时提示被射线冻死并结束游戏。',fire:'火焰：每次进入增加一层过热；达到六层时游戏结束。',eruption:'喷发：按玩家行动次数周期切换，第 2、5、8……次行动后开放，其余时刻禁止进入。',lift:'升降纸张：每次成功行动推进高度；玩家站在上面时只下降，到最低后保持，离开后恢复往返。',fragile:'易碎方块：每次成功行走或传送都会减少一次触发次数，归零后播放破碎动画并变为空格。'};
  const mechanismTypes=[...new Set(cells.map(({r,c})=>mechanismInspection(mechanismNodeAt(r,c))?.type??(map.tiles[r][c]?.lift?'lift':map.tiles[r][c]?.terrain??'none')))];
  const mechanismLabels={lift:'升降纸张',foldSwitch:'折线开关',rayEmitter:'方向喷射',firebird:'火焰鸟'};
  renderMechanismText($('mechanismDescriptions'),mechanismTypes.map(type=>descriptions[type]||(mechanismLabels[type]?mechanismLabels[type]+'：支持行走触发与传送触发。':type==='none'?'无机制：该实体没有配置机制类型。':'未登记机制：'+type)));
  inspectedCell=cells[0];
  const cellKeys=new Set(['tags','folds','fold']);
  const wholeEntries=entries.map(entry=>({...entry,values:Object.fromEntries(Object.entries(entry.values).filter(([key])=>!cellKeys.has(key)))}));
  const {values,schema,mixed}=batchProperties(wholeEntries);
  const directKeys=new Set(directSelectedCells.map(p=>p.r+','+p.c));
  const cellEntries=entries.filter((entry,i)=>directKeys.has(cells[i].r+','+cells[i].c)).map(entry=>({...entry,values:Object.fromEntries(Object.entries(entry.values).filter(([key])=>cellKeys.has(key)))}));
  const independent=batchProperties(cellEntries);
  const generalKeys=new Set(['color','edgeColor','height','thickness','gradualRate','blocked','followFold','canDropOnFold','regionTag','prefabId','instance','kind','terrain']);
  const specialValues=Object.fromEntries(Object.entries(values).filter(([key])=>!generalKeys.has(key)));
  const generalValues=Object.fromEntries(Object.entries(values).filter(([key])=>generalKeys.has(key)&&key!=='regionTag'));
  const specialTags=Object.fromEntries(Object.entries(independent.values.tags??{}).filter(([key])=>key==='exitTo'||key==='requiredKeys'||key==='requiredSwitches'));
  const generalTags=Object.fromEntries(Object.entries(independent.values.tags??{}).filter(([key])=>key!=='exitTo'&&key!=='requiredKeys'&&key!=='requiredSwitches'));
  const cellSpecialValues=Object.keys(specialTags).length?{tags:specialTags}:{};
  const cellGeneralValues={...independent.values,...(values.regionTag!==undefined?{regionTag:values.regionTag}:{}),...(Object.keys(generalTags).length?{tags:generalTags}:{})};if(!Object.keys(generalTags).length)delete cellGeneralValues.tags;
  const cellGeneralSchema={...independent.schema,regionTag:schema.regionTag};
  const cellGeneralMixed=new Set([...independent.mixed,...mixed]);
  $('inspectedCellProperties').textContent=directSelectedCells.map(p=>coord(p.r,p.c)).join('、')+' · 纸张按单格编辑，多选可批量修改；标签、折线及区域属于选中格';
  $('inspectedEntity').textContent=cells.length===1?coord(cells[0].r,cells[0].c)+' · '+(map.tiles[cells[0].r][cells[0].c]?(prefabs.find(p=>p.id===entityType(map.tiles[cells[0].r][cells[0].c]))?.name||'实体方块'):'虚空'):'批量检视 · '+selectedCells.length+' 个选中格 / '+cells.length+' 个实体占用格';
  $('inspectedProperties').textContent=JSON.stringify({entity:projectProperties(values,schema,'readable'),cells:projectProperties(independent.values,independent.schema,'readable')},null,2);
  renderPropertyInspector($('propertyInspector'),specialValues,schema,applyInspectedProperty,error=>toast(error.message,true),mixed,{hideReadOnly:true,expanded:true});
  renderPropertyInspector($('generalPropertyInspector'),generalValues,schema,applyInspectedProperty,error=>toast(error.message,true),mixed,{hideReadOnly:true});
  renderPropertyInspector($('cellSpecialInspector'),cellSpecialValues,independent.schema,(path,value)=>applyInspectedProperty(path,value,'cell'),error=>toast(error.message,true),independent.mixed,{hideReadOnly:true,expanded:true});
  renderPropertyInspector($('cellPropertyInspector'),cellGeneralValues,cellGeneralSchema,(path,value)=>applyInspectedProperty(path,value,'cell'),error=>toast(error.message,true),cellGeneralMixed,{hideReadOnly:true});
}
function applyInspectedProperty(path,value,scope='entity'){
  if(P.mode!=='edit'||!selectedCells.length)throw new Error('请先选择方格');
  if(path[0]==='mechanism'){
    if(selectedCells.length!==1)throw new Error('机制属性只能单格编辑');
    const {r,c}=selectedCells[0],node=mechanismNodeAt(r,c);if(!node)throw new Error('当前方格没有机制实体');
    const type=MECHANISM_COMPONENTS.find(id=>node.components?.[id]);
    const components=clone(node.components);
    if(type==='fragile'){
      if(path[1]!=='count')throw new Error('易碎方块只支持编辑触发次数');
      components.fragile={...components.fragile,count:Number(value)};
    }else{
      if(path[1]!=='triggers')throw new Error('机制触发方式只能单格编辑');
      components[type]={...components[type],triggers:normalizeComponentTriggers(value)};
    }
    commitTree(configureNode(documentModel,node.id,components,node.tags,cellHidden,nodeHidden,nodeSchema(node)));
    persist();scheduleInspection();return;
  }
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
      const checkedTree=forkTreeDocument(documentModel);checkedTree.applyProjection(next);const errors=validateRegions(next,checkedTree.world).filter(message=>message.startsWith('区域入口不能')||message.startsWith('区域只能')||message.startsWith('出口所需钥匙不存在'));if(errors.length)throw new Error(errors.join('；'));
    }
    if(path[0]==='folds'||path[0]==='fold')assertTagAttachment(tagCatalog,'tag-fold',candidate,r,c);
    assertHiddenContentUnchanged(candidate,next,visibility);
    for(let y=0;y<candidate.height;y++)for(let x=0;x<candidate.width;x++)if(cellHidden(y,x)&&JSON.stringify(candidate.tiles[y][x])!==JSON.stringify(next.tiles[y][x]))throw new Error('不能改写隐藏实体的引用');
    candidate=validateMap(next,true);
  }
  for(const change of debugChanges(source,edited,schema))pendingDebug.push({key,...change});

  }
  if(JSON.stringify(candidate)!==JSON.stringify(map)){applyPropertyMap(candidate);controller.resetPosition();buildPaper();persist();}
  for(const change of pendingDebug)debugOverrides.set(change.key,change.path,change.value);
  $('propertyEditStatus').textContent='属性已应用 · 批量修改可一次撤销';updateUI();scheduleInspection();
}

document.querySelectorAll('.rotate-left').forEach(b=>b.onclick=()=>turn(-1));document.querySelectorAll('.rotate-right').forEach(b=>b.onclick=()=>turn(1));
$('applyPlayerProperties').onclick=()=>{try{controller.setPlayerProperties({r:Number($('playerRow').value)-1,c:Number($('playerColumn').value)-1,dir:Number($('playerDirection').value),maxUp:Number($('playerMaxUp').value),maxDown:Number($('playerMaxDown').value),foldVertical:Number($('playerFoldVertical').value),foldHorizontal:Number($('playerFoldHorizontal').value),canDropOnFold:$('playerCanDropOnFold').checked,overheat:Number($('playerOverheat').value),frozen:$('playerFrozen').checked,actions:Number($('playerActions').value),collectedKeys:JSON.parse($('playerCollectedKeys').value)});$('playerPropertyStatus').textContent='玩家属性已应用 · 可撤销，重启后重置';}catch(error){$('playerPropertyStatus').textContent=error.message;toast(error.message,true);}};


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
  updateCameraMode();
  renderTestModifiers($('testModifierControls'),{freeTeleport:P.freeTeleport,foldHints:P.foldHints},(kind,checked)=>{if(kind==='teleport')controller.setFreeTeleport(checked);else controller.setFoldHints(checked);});
  if(document.activeElement!==$('mapName'))$('mapName').value=map.name;
  $('sceneMapName').textContent=map.name;document.title=map.name+' · FOLD FIELD';
  applyVisibility();const playing=P.mode==='play';$('playHints').textContent=P.freeTeleport?'测试传送已开启：点击任意可通行实体即可传送；目标区域会自动显示。':P.foldHints?'点击玩家显示行走与所有合法掉落目标；点击高亮方块即可移动。':'点击玩家显示行走范围；点击折纸线仍会高亮掉落目标，也可按 F 掉落。';$('freeTeleportToggle').checked=P.freeTeleport;$('foldHintsToggle').checked=P.foldHints;$('freeTeleportToggle').setAttribute('aria-checked',String(P.freeTeleport));$('foldHintsToggle').setAttribute('aria-checked',String(P.foldHints));$('editPanel').hidden=playing;$('playPanel').hidden=!playing;$('editMode').classList.toggle('active',!playing);$('playMode').classList.toggle('active',playing);$('canvasMode').textContent=playing?'游玩编辑':'编辑';$('statusMode').textContent=playing?'PLAY MODE':'EDIT MODE';$('startLabel').textContent=playing?'返回编辑':'开始游玩';
  $('startBtn').setAttribute('aria-label',playing?'返回编辑':'开始游玩');$('editMode').setAttribute('aria-pressed',String(!playing));$('playMode').setAttribute('aria-pressed',String(playing));
  $('startBtn').querySelector('svg').replaceWith(createElement(playing?Pencil:Play));
  const names={inspect:'点击实体或虚空检视 · 不修改地图',select:selectionMode==='single'?'单选 · 点击选择方格':'多选 · 点击累加 / 拖拽替换 / Shift 拖拽累加',paste:'点击粘贴落点',paint:'方块工具 · '+(COLOR_NAMES[color]||'无颜色属性')+' / 高度 '+brushHeight,place:'放置方块 · '+(prefabs.find(p=>p.id===selectedPrefabId)?.name||'无可用实体'),erase:'删除方块',fold:foldType?FOLD_NAMES[foldType]:'移除折纸线',player:'设置玩家起点',entry:'设置区域入口','region-exit':'设置区域出口','clear-tags':'清除方块标签'};if(!P.chosenFold)$('toolStatus').textContent=playing?'玩家 '+coord(P.player.r,P.player.c):names[tool];
  $('steps').textContent=$('canvasSteps').textContent=String(P.steps).padStart(2,'0');$('teleports').textContent=String(P.teleports).padStart(2,'0');$('playerCoord').textContent=coord(P.player.r,P.player.c)+' · 朝'+FACE_NAMES[P.player.dir]+(playing?' · '+(P.terrainState.frozen?'冰冻 · ':'')+'过热 '+P.terrainState.overheat+(P.terrainState.hasKey?' · 持有钥匙':''):'');$('playFacingLabel').textContent='朝向：'+FACE_NAMES[P.player.dir];
  for(const [id,value] of Object.entries({playerRow:P.player.r+1,playerColumn:P.player.c+1,playerDirection:P.player.dir,playerMaxUp:P.moveHeight.maxUp,playerMaxDown:P.moveHeight.maxDown,playerFoldVertical:P.foldDrop.vertical,playerFoldHorizontal:P.foldDrop.horizontal}))if(document.activeElement!==$(id))$(id).value=value;
  for(const [id,value] of Object.entries({playerOverheat:P.terrainState.overheat,playerActions:P.terrainState.actions,playerCollectedKeys:JSON.stringify(P.terrainState.collectedKeys)}))if(document.activeElement!==$(id))$(id).value=value;
  if(document.activeElement!==$('playerFrozen'))$('playerFrozen').checked=P.terrainState.frozen;
  if(document.activeElement!==$('playerCanDropOnFold'))$('playerCanDropOnFold').checked=P.canDropOnFold;
  renderNameChecklist($('playerKeyChoices'),legalKeyNames(map,documentModel.world),new Set(P.terrainState.collectedKeys),'持有钥匙 ',(name,checked)=>{const keys=new Set(JSON.parse($('playerCollectedKeys').value));if(checked)keys.add(name);else keys.delete(name);$('playerCollectedKeys').value=JSON.stringify([...keys]);},'无可收集钥匙');
  $('playerRow').max=map.height;$('playerColumn').max=map.width;$('applyPlayerProperties').disabled=!playing||P.moving||!!P.foldMotion;if(P.foldMotion)$('teleportBtn').disabled=true;
  $('mapWidth').value=map.width;$('mapHeight').value=map.height;$('selectionText').textContent=map.width+' × '+map.height+' TILEMAP';
  $('gameTitle').textContent=map.name;$('gameDescription').textContent=map.description||'到达黄色出口即可通关。';$('gameHint').textContent=playing?'点击玩家查看八方向移动；点击折纸线高亮目标，再次点击目标方块掉落。':'编辑模式：设置起点和出口后开始游玩。';$('gameHud').hidden=!playing;
  $('resultOverlay').hidden=!(playing&&!P.moving&&(P.levelWon||P.stepLimitHit));
  let tiles=0,blocks=0,folds=0;for(const row of map.tiles)for(const t of row){if(!t)continue;tiles++;if(blocked(t))blocks++;folds+=foldsOf(t).length;}folds+=(map.foldCells??[]).length;$('tileCount').textContent=tiles+' TILES';$('mapStats').textContent=(tiles-blocks)+' 可通行 / '+blocks+' 阻挡 / '+folds+' 折纸线';
  $('undoBtn').disabled=!currentHistory().length||P.moving;$('restartBtn').disabled=!playing||P.moving;document.querySelectorAll('.rotate-left,.rotate-right').forEach(b=>b.disabled=P.moving);$('teleportBtn').disabled=P.moving||!P.chosenFold||!foldTarget(P.chosenFold).valid;
  $('redoBtn').disabled=P.mode!=='edit'||!redoHistory.length||P.moving;drawEditSelection();
  scheduleInspection();
  refreshFoldSelection();
  syncState();
}

function replaceMap(next,save=true){const validated=new TreeDocument(next);record();debugOverrides.clear();nodeDebug.clear();clearInspection();editRect=null;setSelectedCells([]);pendingRegion=null;hiddenRegions.clear();documentModel=validated;map=validated.view();controller.resetPosition();controller.resetProgress();buildPaper();fitCamera();if(save)persist();updateUI();}
let renaming=false;
$('mapName').oninput=()=>{if(!renaming){editHistory.push(editSnapshot());trimHistory(editHistory);redoHistory=[];renaming=true;}map.name=normalizeMapName($('mapName').value);persist();updateUI();};
$('mapName').onblur=()=>{renaming=false;$('mapName').value=map.name;};
$('mapName').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('mapName').blur();}};
$('newMap').onclick=()=>{setMode('edit');const snapshot=documentModel.serialize();snapshot.entities=[];snapshot.transforms=[];snapshot.cellTags={};snapshot.metadata={...snapshot.metadata,spawn:{r:Math.floor(map.height/2),c:Math.floor(map.width/2),dir:0},exit:null,name:'未命名关卡',description:'',maxSteps:0,bestSteps:null};replaceMap(snapshot);toast('已新建空白地图');};
$('resizeMap').onclick=()=>{const width=Number($('mapWidth').value),height=Number($('mapHeight').value);if(!Number.isInteger(width)||!Number.isInteger(height)||width<3||height<3||width>128||height>128){toast('宽度和高度须为 3–128 的整数',true);return;}if(width===map.width&&height===map.height)return;for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if((r>=height||c>=width)&&cellHidden(r,c)){toast('缩小地图会删除隐藏区域，请先显示该区域',true);return;}const tiles=Array.from({length:height},(_,r)=>Array.from({length:width},(_,c)=>r<map.height&&c<map.width?clone(map.tiles[r][c]):blankTile()));const spawn={r:Math.min(map.spawn.r,height-1),c:Math.min(map.spawn.c,width-1),dir:map.spawn.dir};if(!tiles[spawn.r][spawn.c]||blocked(tiles[spawn.r][spawn.c]))tiles[spawn.r][spawn.c]=blankTile();const exit=map.exit&&map.exit.r<height&&map.exit.c<width?{...map.exit}:null;try{applyMap({...map,version:1,width,height,tiles,foldCells:(map.foldCells??[]).filter(p=>p.r<height&&p.c<width),spawn,exit,name:map.name,description:map.description,maxSteps:map.maxSteps,bestSteps:map.bestSteps},true);controller.resetPosition();buildPaper();fitCamera();persist();updateUI();toast('地图尺寸已更新');}catch(error){toast(error.message,true);}};
$('exportMap').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(savedMap(),null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=mapFilename(map.name);a.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('地图已导出');};
$('importMap').onclick=()=>$('mapFile').click();$('mapFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>16000000)throw new Error('地图文件过大');const next=JSON.parse(await file.text());new TreeDocument(next);setMode('edit');replaceMap(next);toast('地图导入完成');}catch(err){toast('导入失败：'+err.message,true);}e.target.value='';};


async function exportGameHtml(){
  const check=validateForPlay();
  if(!check.valid){toast(check.errors.join('；'),true);return;}
  const visuals=[...collectModelDescriptors(documentModel,{getPrefab:id=>prefabs.find(prefab=>prefab.id===id)}).map(descriptor=>descriptor.visual),getPlayerPrefab()?.visual].filter(Boolean);
  let embeddedAssets={};
  try{embeddedAssets=await visualAssetSource.bundle(visuals);}catch(error){toast('模型资源无法随导出打包：'+error.message,true);return;}
  const documentCopy=document.documentElement.cloneNode(true);
  const exportedViewport=documentCopy.querySelector('#viewport');exportedViewport.replaceChildren();for(const attribute of [...exportedViewport.attributes])if(attribute.name.startsWith('data-'))exportedViewport.removeAttribute(attribute.name);
  documentCopy.querySelector('#resultOverlay').setAttribute('hidden','');
  const current=documentCopy.outerHTML;
  const boot='<script>window.__FOLD_FIELD_TAGS__='+JSON.stringify(tagCatalog).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_PREFABS__='+JSON.stringify(prefabs).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_EXPORT_MAP__='+JSON.stringify(savedMap()).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_EXPORT_ASSETS__='+JSON.stringify(embeddedAssets).replace(/</g,'\\u003c')+';window.__FOLD_FIELD_GAME_ONLY__=true;</script>';
  const html='<!doctype html>\n'+current.replace(/<script>/i,boot+'<script>');
  const url=URL.createObjectURL(new Blob([html],{type:'text/html'}));
  const a=document.createElement('a');a.href=url;a.download='game.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),500);toast('独立游戏已导出为 game.html');
}
$('exportGame').onclick=exportGameHtml;

const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerDown=null,lastEditKey=null,dragEdited=false,multiTouch=false,hoverDescriptionKey=null;const activePointers=new Set();
let placementPreviewFrame=0,pendingPlacementHit=null;
function schedulePlacementPreview(hit){
 if(cameraInteraction.active)return;
 if(P.mode==='edit'&&pointerDown?.button===0&&dragEdited){cancelPlacementPreview();return;}
 pendingPlacementHit=hit;
 if(placementPreviewFrame)return;
 placementPreviewFrame=requestAnimationFrame(()=>{placementPreviewFrame=0;const next=pendingPlacementHit;pendingPlacementHit=null;if(!cameraInteraction.active)drawPlacementPreview(next);});
}
function cancelPlacementPreview(){placementRenderCache=null;pendingPlacementHit=null;if(placementPreviewFrame){cancelAnimationFrame(placementPreviewFrame);placementPreviewFrame=0;}disposableClear(placementLayer);placementLayer.userData.preview=null;}
function hitAt(clientX,clientY){
  const b=renderer.domElement.getBoundingClientRect();mouse.set((clientX-b.left)/b.width*2-1,-(clientY-b.top)/b.height*2+1);raycaster.setFromCamera(mouse,camera);
  const surface=raycaster.intersectObjects([modelLayer,tagLayer,terrainLayer,tileLayer].filter(layer=>layer.visible).flatMap(layer=>layer.children.filter(object=>object.visible)),true)[0];
  let hitObject=surface?.object;
  while(hitObject&&!hitObject.userData.cell)hitObject=hitObject.parent;
  if(hitObject?.userData.cell)return hitObject.userData.cell;
  if(surface?.object.userData.triangleCells)return surface.object.userData.triangleCells[surface.faceIndex];
  if(surface?.instanceId!==undefined)return surface.object.userData.cells[surface.instanceId];
  const point=raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());if(!point)return null;
  const local=paper.worldToLocal(point),c=Math.floor(local.x+map.width/2),r=Math.floor(local.z+map.height/2);return inside(r,c)?{r,c}:null;
}
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{activePointers.add(e.pointerId);if(activePointers.size>1)multiTouch=true;selectionBase=e.shiftKey?clone(directSelectedCells):[];pointerDown={x:e.clientX,y:e.clientY,button:e.button,pointerType:e.pointerType,shift:e.shiftKey};lastEditKey=null;dragEdited=false;manualPan=e.button===2;renderer.domElement.setPointerCapture(e.pointerId);});
	function processPointerMove(e){
	  latestPointerEvent=e;
	  if(cameraInteraction.active){
	    hoverOutline.visible=false;
	    return;
	  }
  if(P.foldMotion?.phase==='drag'){hoverOutline.visible=false;controller.updateFoldDrag(e.clientY,Math.min(300,viewport.clientHeight*.45));return;}
  if(P.mode==='play'&&P.chosenFold&&pointerDown?.button===0&&!multiTouch&&Math.hypot(e.clientX-pointerDown.x,e.clientY-pointerDown.y)>6){const start=hitAt(pointerDown.x,pointerDown.y);if(start&&controller.beginFoldDrag(start.r,start.c,pointerDown.y)){controller.updateFoldDrag(e.clientY,Math.min(300,viewport.clientHeight*.45));return;}}
  if(manualPan){hoverOutline.visible=false;disposableClear(placementLayer);return;}const hit=hitAt(e.clientX,e.clientY);hovered=hit;
  if(hit){hoverOutline.visible=true;hoverOutline.position.set(wx(hit.c),tileTop(hit.r,hit.c)+.035,wz(hit.r));const groups=P.mode==='edit'&&visibility.folds?foldAxes.filter(g=>g.cells.some(p=>p.r===hit.r&&p.c===hit.c)):[];$('foldRadiusHint').hidden=!groups.length;$('foldRadiusHint').textContent=groups.map(g=>FOLD_NAMES[g.type]+' · 作用半径 '+g.radius+'（切比雪夫距离）').join(' / ');const descriptionKey=[hit.r,hit.c,P.mode,visibility.folds,[...hiddenEntities].sort().join(',')].join('|');if(descriptionKey!==hoverDescriptionKey){hoverDescriptionKey=descriptionKey;$('hoverCoord').textContent=cellHidden(hit.r,hit.c)?coord(hit.r,hit.c)+' · 隐藏区域':describeViewportCell(documentModel,hit.r,hit.c,{nodeHidden,runtime:P.mode==='play',nameFor:id=>prefabs.find(prefab=>prefab.id===id)?.name??id});}}else{hoverDescriptionKey=null;hoverOutline.visible=false;$('foldRadiusHint').hidden=true;$('hoverCoord').textContent='—';}
  schedulePlacementPreview(hit);
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
	}
const hoverTask=createFrameTask(e=>{if(!cameraInteraction.active&&!pointerDown)processPointerMove(e);},{requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:handle=>cancelAnimationFrame(handle)});
renderer.domElement.addEventListener('pointermove',e=>{
 latestPointerEvent=e;
 if(cameraInteraction.active)return;
 if(pointerDown||P.foldMotion?.phase==='drag'){hoverTask.cancel();processPointerMove(e);}
 else hoverTask.request(e);
});
renderer.domElement.addEventListener('pointerdown',()=>hoverTask.cancel());
renderer.domElement.addEventListener('pointerleave',()=>hoverTask.cancel());
renderer.domElement.addEventListener('pointercancel',()=>{latestPointerEvent=null;hoverTask.cancel();});
	renderer.domElement.addEventListener('pointerleave',()=>{latestPointerEvent=null;pendingPlacementHit=null;hoverDescriptionKey=null;if(placementPreviewFrame){cancelAnimationFrame(placementPreviewFrame);placementPreviewFrame=0;}disposableClear(placementLayer);placementLayer.userData.preview=null;hoverOutline.visible=false;hovered=null;$('foldRadiusHint').hidden=true;$('hoverCoord').textContent='—';});
renderer.domElement.addEventListener('pointercancel',e=>{controller.endFoldDrag(true);finishGesture();activePointers.delete(e.pointerId);if(!activePointers.size)multiTouch=false;pointerDown=null;lastEditKey=null;dragEdited=false;manualPan=false;});
renderer.domElement.addEventListener('pointerup',e=>{finishGesture();activePointers.delete(e.pointerId);const down=pointerDown;pointerDown=null;const wasPan=manualPan,wasMultiTouch=multiTouch,wasDrag=dragEdited;manualPan=false;lastEditKey=null;dragEdited=false;syncState();if(!activePointers.size)multiTouch=false;if(P.foldMotion?.phase==='drag'){controller.endFoldDrag(wasMultiTouch||down?.button!==0||e.button!==0);return;}if(activePointers.size||wasMultiTouch||!down||down.button!==0||wasPan||wasDrag||Math.hypot(e.clientX-down.x,e.clientY-down.y)>6||P.moving)return;const hit=hitAt(e.clientX,e.clientY);if(!hit){selectedNodeId=null;lastClickTile=null;refreshTreePanel();setSelectedCells([]);editRect=null;clearSelection();drawEditSelection();syncState();return;}const {r,c}=hit;selectedNodeId=hit.nodeId??documentModel.primaryAt(r,c)?.id??null;lastClickTile={r,c};refreshTreePanel();if(P.mode==='edit'){if(!map.tiles[r][c]&&!documentModel.world.at(r,c).length&&tool!=='inspect'){setSelectedCells([]);editRect=null;drawEditSelection();syncState();if(tool==='select')return;}editAt(r,c);return;}controller.click(r,c);});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||e.target.isContentEditable||e.ctrlKey&&e.key.toLowerCase()!=='z')return;if(e.repeat&&e.key.toLowerCase()==='f')return;if(e.key.toLowerCase()==='f'){e.preventDefault();teleport();}if(e.key==='Escape'){pendingRegion=null;editRect=null;setSelectedCells([]);clearSelection();drawEditSelection();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undo();}});

const tooltip=$('tooltip');document.querySelectorAll('[data-tip]').forEach(el=>{el.addEventListener('mouseenter',()=>{tooltipTimer=setTimeout(()=>{const r=el.getBoundingClientRect();tooltip.textContent=el.dataset.tip;tooltip.classList.add('show');tooltip.style.left=Math.max(5,Math.min(window.innerWidth-tooltip.offsetWidth-5,r.left+r.width/2-tooltip.offsetWidth/2))+'px';tooltip.style.top=(r.bottom+7+tooltip.offsetHeight>window.innerHeight?r.top-tooltip.offsetHeight-7:r.bottom+7)+'px';},250);});el.addEventListener('mouseleave',()=>{clearTimeout(tooltipTimer);tooltip.classList.remove('show');});el.addEventListener('click',()=>{clearTimeout(tooltipTimer);tooltip.classList.remove('show');});});

let renderedFrames=0,lastZoomLabel=null,diagnosticsEnabled=false;
function syncState(){viewport.dataset.state=JSON.stringify({map,player:P.player,mode:P.mode,foldHints:P.foldHints,freeTeleport:P.freeTeleport,tool,color,foldType,steps:P.steps,teleports:P.teleports,moving:P.moving,legalMoves:P.legalMoves,legalFoldMoves:P.legalFoldMoves,chosenFold:P.chosenFold,view,editRect,pendingRegion,brushHeight,selectedPrefabId,visibility,showGrid,showTable,showCreaseDashes,selectionMode,selectedCells,directSelectedCells,moveHeight:P.moveHeight,foldDrop:P.foldDrop,foldMotion:P.foldMotion,hiddenEntities:[...hiddenEntities],hiddenRegions:[...hiddenRegions],revealedRegions:[...P.revealedRegions],terrainState:P.terrainState,turn:P.turn});}
function screenPoints(){
  viewport.dataset.frames=String(renderedFrames);viewport.dataset.render=JSON.stringify({firebirdThreat:controller.firebirdThreat(),firebirdTrackingHighlight:firebirdHalo.visible,spawnedEntityIds:documentModel.world.serialize().map(node=>node.id),flameMarkers:mechanismLayer.children.filter(marker=>marker.userData.flame).length,replacedFirebirds:mechanismLayer.children.filter(marker=>marker.userData.replaced).length,firebirdRangeLines:firebirdRangeLayer.children.filter(line=>line.userData.firebirdRange).length,foldStart:foldMotionView.stats(),foldAxes:foldAxes.length,foldGroups:foldAxes.map(({center,radius,type,cells})=>({center,radius,type,cells})),entityEdgeStyles:entityEdgeLayer.children.length,visibleTiles:tileLayer.children.reduce((n,o)=>n+(o.isInstancedMesh?o.count:(o.userData.surfaceCells?.length??0)),0),staticTokens:staticTokenLayer.children.length,gridSegments:gridLayer.children[0]?.geometry.attributes.position.count/2,creaseSegments:creaseGuideLayer.children.reduce((n,o)=>n+(o.isLineSegments?o.geometry.attributes.position.count/2:0),0),creaseDots:creaseGuideLayer.children.reduce((n,o)=>n+(o.isLineSegments?0:o.geometry.attributes.position.count/3),0),emitterHighlights:rayLayer.children.map(mesh=>({emitterId:mesh.userData.emitterId,...mesh.userData.cell})),models:modelLayer.children.map(host=>({nodeId:host.userData.cell?.nodeId,model:host.userData.model,rotation:host.rotation.y,position:host.position.toArray()})),playerVisual:playerVisual.status(),tokenShape:activeTokenHost.children[0]?.children[0]?.children[0]?.geometry.type,followPlayer:P.mode==='play',defaultViewCells:9,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,camera:camera.position.toArray(),target:controls.target.toArray(),layers:{coords:boardLayer.visible,tiles:tileLayer.visible,folds:foldLayer.visible,player:playerGroup.visible,grid:gridLayer.visible,entityEdges:entityEdgeLayer.visible,axes:foldAxisLayer.visible}});
  if(map.width*map.height<=512){const b=renderer.domElement.getBoundingClientRect(),points={};for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){const p=new THREE.Vector3(wx(c),tileTop(r,c)+.01,wz(r)).project(camera);points[r+','+c]={x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};}viewport.dataset.points=JSON.stringify(points);}else delete viewport.dataset.points;
}
	function tick(now){requestAnimationFrame(tick);controls.update();const cameraBusy=cameraInteraction.active;if(!cameraBusy)updateFoldAxes();
	  const animating=P.moving||!!P.foldMotion;
	  controller.tick(now);
	  if(animating||P.moving||P.foldMotion)renderer.shadowMap.needsUpdate=true;
  if(P.mode==='play'&&!manualPan&&!P.foldMotion){getCameraFollowPosition(cameraFollowTarget);if(P.moving||cameraFollowTarget.distanceToSquared(lastFollowPosition)>1e-12||P.steps!==lastFollowSteps)correctFollowCamera();}
	  const zoomLabel=Math.round(camera.zoom*100)+'%';if(zoomLabel!==lastZoomLabel){lastZoomLabel=zoomLabel;$('zoomLabel').textContent=zoomLabel;}
	  renderer.render(scene,camera);renderedFrames++;if(diagnosticsEnabled&&!cameraBusy&&renderedFrames%10===0){screenPoints();}
}
resetRegions();setupPrefabs();setTool(tool);buildPaper();fitCamera();if(P.mode==='play')checkRunEnd();controller.refreshFirebirdThreat();requestAnimationFrame(tick);
// Read-only diagnostics support visual and interaction checks without bypassing the UI.
window.foldField={enableDiagnostics:(enabled=true)=>{diagnosticsEnabled=!!enabled;if(diagnosticsEnabled)screenPoints();else for(const key of ['frames','render','points'])delete viewport.dataset[key];},getState:()=>clone({map,player:P.player,mode:P.mode,tool,color,foldType,steps:P.steps,teleports:P.teleports,moving:P.moving,legalMoves:P.legalMoves,chosenFold:P.chosenFold,view,renderedFrames,placementPreview:placementLayer.userData.preview,terrainState:P.terrainState,turn:P.turn}),screenPoint:(r,c)=>{const p=new THREE.Vector3(wx(c),tileTop(r,c)+paper.position.y+.01,wz(r)).project(camera);const b=renderer.domElement.getBoundingClientRect();return {x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};},reflect:reflectPoint};

function setupPrefabs(){
  $('prefabSummary').parentElement.addEventListener('toggle',()=>{$('blockColorPanel').hidden=!$('prefabSummary').parentElement.open||!hasColor(prefabs.find(p=>p.id===selectedPrefabId)?.tile);});
  let fingerprint='',loading=false;
  function applyPrefabBrush(){
    const prefab=prefabs.find(p=>p.id===selectedPrefabId),colored=hasColor(prefab?.tile);
    $('emitterDirectionPanel').hidden=!prefab?.components?.rayEmitter;$('emitterInitialDirection').value=prefab?.components?.rayEmitter?.initialDirection??'north';
    $('keyNamePanel').hidden=prefab?.tile?.terrain!=='key';$('blockColorPanel').hidden=!colored||!$('prefabSummary').parentElement.open;
    const summary=$('prefabSummary'),name=document.createElement('span');name.textContent=prefab?.name||'无可用实体';summary.replaceChildren();
    if(prefab){const img=document.createElement('img');img.src=prefabPreview(prefab);img.alt='';summary.append(img);}
    summary.append(name);
    for(const id of ['blockHeight','blockThickness','blockGradualRate'])$(id).disabled=!prefab?.tile;$('blockHeightLabel').textContent=prefab?.tile?.lift?'初始高度':'方块高度';$('blockGradualRate').disabled=!prefab?.tile||!!prefab.tile.lift;$('blockHeight').min=prefab?.tile?.lift?.minHeight??.01;$('blockHeight').max=prefab?.tile?.lift?.maxHeight??16;$('footprintInfo').textContent=prefab?prefab.size.width+' × '+prefab.size.height+' · 占用 '+prefab.occupied.filter(Boolean).length+' 格':'';renderEntityGrid($('prefabGrid'),prefabs.map(p=>({...p,preview:prefabPreview(p)})),selectedPrefabId,id=>{selectedPrefabId=id;$('prefabType').value=id;applyPrefabBrush();setTool('place');});
    if(prefab?.tile){color=colored?prefab.tile.color:null;brushHeight=prefab.tile.lift?.initialHeight??prefab.tile.height;$('blockHeight').value=brushHeight;$('blockThickness').value=tileThickness(prefab.tile);$('blockGradualRate').value=tileGradualRate(prefab.tile);}
    document.querySelectorAll('[data-color]').forEach(b=>{const active=colored&&b.dataset.color===color;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('colorName').textContent=colored?COLOR_NAMES[color]:'';$('colorType').textContent=prefab?.tile?.blocked?'阻挡实体':'可通行实体';
  }
  function renderCatalog(){
    const select=$('prefabType');select.replaceChildren();
    for(const prefab of prefabs.filter(isPlaceableEntity))select.add(new Option(prefab.name,prefab.id));
    if(!prefabs.some(p=>p.id===selectedPrefabId&&isPlaceableEntity(p)))selectedPrefabId=prefabs.find(p=>p.id==='paper_ai')?.id??prefabs.find(isPlaceableEntity)?.id??null;
    if(!prefabs.length)select.add(new Option('无可用实体',''));
    select.value=selectedPrefabId||'';applyPrefabBrush();renderEntityVisibility();
  }
  async function refresh(){
    if(loading||document.hidden||GAME_ONLY||!/^https?:$/.test(location.protocol))return;
    loading=true;
    try{const response=await fetch('/api/prefabs',{cache:'no-store'});if(!response.ok)throw new Error('服务未提供实体目录');const catalog=await response.json();
      const next=catalog.prefabs.map(normalizePrefab),nextTags=(catalog.tags??[]).map(normalizeTagPrefab),key=JSON.stringify([next,nextTags]);
      if(key!==fingerprint){prefabs=next;tagCatalog=nextTags;fingerprint=key;renderCatalog();renderPlayer();refreshModels();}
      $('prefabStatus').textContent=catalog.errors.length?catalog.errors.map(e=>e.file+'：'+e.message).join('；'):'实时读取 assets/prefab · '+prefabs.length+' 种实体';
    }catch(error){$('prefabStatus').textContent='使用内置实体目录 · '+error.message;}finally{loading=false;}
  }
  renderCatalog();$('prefabStatus').textContent='内置实体目录 · 本地服务支持实时更新';
  $('emitterInitialDirection').onchange=()=>{if(tool!=='place')setTool('place');cancelPlacementPreview();if(latestPointerEvent)hoverTask.request(latestPointerEvent);syncState();};
  $('prefabType').oninput=$('prefabType').onchange=()=>{
    selectedPrefabId=$('prefabType').value||null;applyPrefabBrush();if(tool!=='place')setTool('place');else updateUI();
  };
  refresh();if(!GAME_ONLY)setInterval(refresh,2000);document.addEventListener('visibilitychange',refresh);
}

function rebuildFoldAxes(){
 disposableClear(foldAxisLayer);foldAxes=uniqueFoldAxes({...map,tiles:map.tiles.map((row,r)=>row.map((t,c)=>cellHidden(r,c)?null:t)),foldCells:map.foldCells.filter(p=>!cellHidden(p.r,p.c))});axisViewKey=null;
}
// Dash/dot hints ride the crease surface and fold together with the paper.
function buildCreaseGuides(){
 disposableClear(creaseGuideLayer);
 const guides=creaseGuides(map,foldAxes,{hidden:cellHidden,showFolds:P.mode!=='edit'||visibility.folds,creaseDepth:lighting.creaseDepth,voidPlane:(r,c)=>voidPlaneTop(r,c),selected:selectedFold()});
 if(guides.positions.length){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(guides.positions,3));
  const lines=new THREE.LineSegments(geometry,creaseDashMaterial);
  lines.userData.triangleCells=guides.lineCells;lines.renderOrder=8;creaseGuideLayer.add(lines);
 }
 const positions=guides.dots.flatMap(dot=>dot.positions),cells=guides.dots.flatMap(dot=>dot.positions.map((_,index)=>index).filter(index=>index%9===0).map(()=>dot.cell));
 if(positions.length){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const mesh=new THREE.Mesh(geometry,creaseDotMaterial);
  mesh.userData.triangleCells=cells;mesh.renderOrder=8;creaseGuideLayer.add(mesh);
 }
}
// Selected crease and outlined halves stay attached to their paper surfaces.
function selectedFold(){return P.mode==='play'&&P.chosenFold&&P.chosenFold.type?{r:P.chosenFold.r,c:P.chosenFold.c,type:P.chosenFold.type}:null;}
function refreshFoldSelection(){
 const chosen=selectedFold(),signature=chosen?`${chosen.type}:${chosen.r},${chosen.c}:${P.player.r},${P.player.c}`:'';
 if(signature!==foldSelectionSignature){foldSelectionSignature=signature;buildCreaseGuides();buildFoldSelection();scheduleFoldPreparation();}
 $('foldHighlightLegend').hidden=!chosen;
 syncState();
}
function buildFoldSelection(){
 disposableClear(foldSelectionLayer);
 foldSelectionLayer.visible=false;
 const chosen=selectedFold();
 if(!chosen)return;
 const group=foldGroupAt(foldAxes,chosen.r,chosen.c,chosen.type);
 if(!group)return;
 const options={hidden:cellHidden,showFolds:P.mode!=='edit'||visibility.folds,creaseDepth:lighting.creaseDepth,voidPlane:(r,c)=>map.tiles[r]?.[c]?tileTop(r,c):voidPlaneTop(r,c)};
 const add=(positions,cells,material,order)=>{
  if(!positions.length)return;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  const mesh=new THREE.Mesh(geometry,material);mesh.userData.triangleCells=cells;mesh.renderOrder=order;foldSelectionLayer.add(mesh);
 };
 const regions=controller.foldHighlightRegions(chosen);
 const source=creaseRegionOutline(map,regions.source,group,options);
 const target=creaseRegionOutline(map,regions.target,group,{...options,dashed:true});
 add(source.positions,source.cells,foldSourceMaterial,5);
 add(target.positions,target.cells,foldTargetMaterial,5);
 const halo=creaseSelection(map,group,{...options,width:.105,lift:.012,flatLift:.022});
 const core=creaseSelection(map,group,{...options,width:.038,lift:.016,flatLift:.026});
 add(halo.positions,halo.cells,creaseHaloMaterial,9);
 add(core.positions,core.cells,creaseSelectionMaterial,10);
 foldSelectionLayer.visible=foldLayer.visible;
}
function updateFoldAxes(){}

function renderRegionControls(){
 const switchList=$('requiredSwitchList'),chosenSwitches=new Set([...switchList.querySelectorAll('input:checked')].map(i=>i.value));
 const switches=documentModel.world.serialize().filter(node=>node.components.foldSwitch),switchLabels=Object.fromEntries(switches.map(node=>{const p=documentModel.world.cells(node.id)[0];return [node.id,'折线开关 '+coord(p.r,p.c)+' · '+node.id.slice(-8)];}));
 renderNameChecklist(switchList,[...new Set([...switches.map(node=>node.id),...chosenSwitches])],chosenSwitches,'绑定 ',null,'地图上没有折线开关',switchLabels);
 const keyList=$('requiredKeyList'),chosenKeys=new Set([...keyList.querySelectorAll('input:checked')].map(i=>i.value));renderNameChecklist(keyList,legalKeyNames(map,documentModel.world),chosenKeys,'所需钥匙 ',null,'地图上没有可收集的钥匙');
 const names=regionNames(map,documentModel.cellTags);
 const regionChoice=$('regionChoice'),previousRegion=regionChoice.value;regionChoice.replaceChildren(new Option('新建区域',''));for(const name of names)regionChoice.add(new Option(name,name));if(names.includes(previousRegion))regionChoice.value=previousRegion;$('newRegionPanel').hidden=!!regionChoice.value;
 const container=$('regionVisibility'),current=$('exitRegion').value;$('exitRegion').replaceChildren();
 for(const name of names)$('exitRegion').add(new Option(name,name));
 renderRegionChecklist(container,names,new Set(names.filter(name=>!hiddenRegions.has(name))),(name,checked)=>{if(checked)hiddenRegions.delete(name);else hiddenRegions.add(name);setSelectedCells(directSelectedCells);buildPaper();});
 if(names.includes(current))$('exitRegion').value=current;
}
$('assignRegion').onclick=()=>{try{if(!selectedCells.length)throw new Error('先选择区域方格');if(selectedCells.some(p=>cellHidden(p.r,p.c)))throw new Error('不能修改隐藏区域');for(const p of selectedCells)if(map.tiles[p.r]?.[p.c])assertTagAttachment(tagCatalog,'tag-region',map,p.r,p.c);const next=assignRegion(map,selectedCells,$('regionChoice').value||$('regionName').value,!!$('regionChoice').value,documentModel.cellTags);for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if(cellHidden(r,c)&&JSON.stringify(map.tiles[r][c])!==JSON.stringify(next.tiles[r][c]))throw new Error('区域更名会改变隐藏方块的出口标签，请先显示该区域');applyPropertyMap(next);buildPaper();persist();}catch(e){toast(e.message,true);}};
function prefabPreview(prefab){
 const key=JSON.stringify(prefab);if(previewCache.has(key))return previewCache.get(key);
 previewRenderer??=new THREE.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});previewRenderer.setSize(100,80);previewRenderer.setClearColor('#e1e8e0',1);
 const world=new THREE.Scene();world.add(new THREE.HemisphereLight('#ffffff','#526254',2));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(2,5,-3);world.add(light);
 const previewTile=prefab.tile??normalizeTile({...prefab.components?.surface,...(Object.hasOwn(prefab.components??{},'surface')?{}:{height:.09})}),height=previewTile.height,span=Math.max(prefab.size.width,prefab.size.height,height+(previewTile.kind==='player-token'?.8:0))*.7+.3;
 const cam=new THREE.OrthographicCamera(-span,span,span*.8,-span*.8,.1,100);cam.position.set(span*1.5,span*1.6+height/2,span*2);cam.lookAt(0,height/2,0);
 for(const p of footprint(prefab,0,0)){
   const tile=new THREE.Mesh(new THREE.BoxGeometry(.98,tileThickness(previewTile),.98),new THREE.MeshStandardMaterial({color:COLORS[previewTile.color]??COLORS.white}));tile.position.set(p.c-(prefab.size.width-1)/2,height-tileThickness(previewTile)/2,p.r-(prefab.size.height-1)/2);if(previewTile.kind!=='player-token'&&(prefab.tile||Object.hasOwn(prefab.components??{},'surface')))world.add(tile);
   if(previewTile.edgeColor&&previewTile.kind!=='player-token'){const edge=new THREE.LineSegments(new THREE.EdgesGeometry(tile.geometry),new THREE.LineBasicMaterial({color:previewTile.edgeColor}));edge.position.copy(tile.position);world.add(edge);}
   if(previewTile.kind==='player-token'){const token=makeToken(previewTile.color);token.rotation.y=-Math.PI*.75;token.position.copy(tile.position);token.position.y=height;world.add(token);}
   const mechanism=mechanismMarker(THREE,prefab.components??{});mechanism.position.copy(tile.position);mechanism.position.y=height+.04;world.add(mechanism);
   for(const type of (prefab.tile?.terrain?[prefab.tile.terrain]:['campfire','ice','fire','eruption','key'].filter(type=>Object.hasOwn(prefab.components??{},type)))){const marker=new THREE.Mesh(new THREE.PlaneGeometry(.72,.72),new THREE.MeshBasicMaterial({map:terrainTextures[type],transparent:true,depthWrite:false}));marker.rotation.x=-Math.PI/2;marker.position.copy(tile.position);marker.position.y=height+.012;world.add(marker);}
 }
 previewRenderer.render(world,cam);const url=previewRenderer.domElement.toDataURL('image/png');world.traverse(o=>{o.geometry?.dispose();if(o.material)o.material.dispose();});previewCache.set(key,url);return url;
}

function refreshPrefabPreviews(type){for(const prefab of prefabs.filter(p=>p.tile?.terrain===type||Object.hasOwn(p.components??{},type))){previewCache.delete(JSON.stringify(prefab));const img=document.querySelector('[data-prefab="'+prefab.id+'"] img');if(img)img.src=prefabPreview(prefab);}}

function placementCandidate(r,c,{preview=false}={}){
 const prefab=withEmitterDirection(prefabs.find(p=>p.id===selectedPrefabId),$('emitterInitialDirection').value),tile=brushTile();
 if(!prefab)throw new Error('没有可用实体');
 if(entityHidden(tile,hiddenEntities))throw new Error('请先显示该实体类型');
 if(blocked(tile)&&r===map.spawn.r&&c===map.spawn.c)throw new Error('玩家起点不能设为阻挡方块');
 if(blocked(tile)&&map.exit?.r===r&&map.exit?.c===c)throw new Error('出口不能设为阻挡方块，请先移动出口');
 const options={isHidden:cellHidden,nodeHidden,resolve:id=>prefabs.find(p=>p.id===id)},result=preview?previewPlacement(documentModel,prefab,tile,r,c,{...options,tagCells:placementTagCells}):null;
 const candidate=preview?result.candidate:placeCategorizedPrefab(documentModel,prefab,tile,r,c,options);
 if(!preview&&(!visibility.folds||!visibility.player))assertHiddenContentUnchanged(documentModel.view(),candidate.view(),visibility);
 assertTreeVisibility(candidate,preview?result.source:documentModel);
 return candidate;
}

let placementCheckCache=null;
function drawPlacementPreview(hit){
 if(P.mode!=='edit'||tool!=='place'||!hit){cancelPlacementPreview();return;}
 const prefab=prefabs.find(p=>p.id===selectedPrefabId);if(!prefab){cancelPlacementPreview();return;}
 const key=JSON.stringify([hit.r,hit.c,selectedPrefabId,$('blockHeight').value,$('blockThickness').value,$('blockGradualRate').value,$('keyName').value,$('emitterInitialDirection').value,color,visibility,[...hiddenEntities],[...hiddenRegions]]);
 if(placementRenderCache?.document===documentModel&&placementRenderCache.prefab===prefab&&placementRenderCache.key===key&&placementLayer.children.length){$('hoverCoord').textContent=placementRenderCache.text;return;}
 disposableClear(placementLayer);placementLayer.userData.preview=null;placementRenderCache=null;
 let cells,reason='';try{cells=previewFootprint(prefab,hit.r,hit.c,id=>prefabs.find(p=>p.id===id));}catch(error){$('hoverCoord').textContent='无法放置 · '+error.message;return;}
 if(placementCheckCache?.document===documentModel&&placementCheckCache.prefab===prefab&&placementCheckCache.key===key)reason=placementCheckCache.reason;
 else{let candidate;try{candidate=placementCandidate(hit.r,hit.c,{preview:true});}catch(error){reason=error.message;}placementCheckCache={document:documentModel,prefab,key,reason,candidate};}
 const invalid=!!reason;
 const previewMap=invalid?null:placementPreviewMap(placementCheckCache.candidate,cells);
 if(!invalid){
  const candidate=placementCheckCache.candidate,view=previewMap,affected=new Set(cells.map(p=>p.r+','+p.c));
  const projection=renderTreeCells(candidate,{nodeHidden,cellHidden,cells}),surfaceCells=projection.surfaceCells;
  const marker=(texture,r,c,height,scale,index=0,total=1)=>{
   const mesh=new THREE.Mesh(markerGeo,new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:.85,depthWrite:false,depthTest:false,toneMapped:false}));
   mesh.rotation.x=-Math.PI/2;mesh.position.set(wx(c)+(total>1?(index-(total-1)/2)*.22:0),height+.04+index*.005,wz(r));mesh.scale.setScalar(scale);mesh.renderOrder=12;placementLayer.add(mesh);
  };
  for(const p of surfaceCells){
   const material=new THREE.MeshStandardMaterial({color:COLORS[p.tile.color??'white'],transparent:true,opacity:.65,depthWrite:false,depthTest:false,roughness:.86,flatShading:true});
   const body=createSurfacePreview(THREE,view,p,material,cellHidden);body.position.x=wx(p.c);body.position.z=wz(p.r);body.position.y+=.012;body.renderOrder=10;placementLayer.add(body);
   if(p.tile.lift)marker(liftTexture,p.r,p.c,tileHeight(p.tile),.58);
   const mechanism=mechanismMarker(THREE,candidate.world.get(p.nodeId).components);mechanism.position.set(wx(p.c),tileHeight(p.tile)+.05,wz(p.r));placementLayer.add(mechanism);

  }
  for(const p of projection.tokenCells.filter(p=>affected.has(p.r+','+p.c))){const token=makeToken(p.tile.color);token.rotation.y=-Math.PI/2;token.position.set(wx(p.c),Math.max(p.surfaceTop,p.tile.height??0),wz(p.r));placementLayer.add(token);}
  for(const node of candidate.world.serialize().filter(node=>node.static.entityType==='creature'&&(node.components.firebird||node.components.rayEmitter))){
   const occupied=candidate.world.cells(node.id),p=occupied[Math.floor(occupied.length/2)];if(!p||!affected.has(p.r+','+p.c))continue;
   const mechanism=mechanismMarker(THREE,node.components);mechanism.position.set(wx(p.c),tileHeight(view.tiles[p.r]?.[p.c])+.05,wz(p.r));placementLayer.add(mechanism);
  }
  for(const p of projection.terrainCells)if(affected.has(p.r+','+p.c))marker(terrainTextures[p.type],p.r,p.c,p.surfaceTop,p.total>1?.4:.72,p.index,p.total);
  placementLayer.userData.preview={emitterDirections:candidate.world.serialize().filter(node=>node.components.rayEmitter).map(node=>({nodeId:node.id,direction:node.components.rayEmitter.initialDirection})),surfaces:surfaceCells.map(p=>({r:p.r,c:p.c,height:tileHeight(p.tile),thickness:tileThickness(p.tile),lift:!!p.tile.lift})),markers:projection.terrainCells.filter(p=>affected.has(p.r+','+p.c)).map(p=>p.type)};
 }
 for(const p of cells){const geometry=new THREE.PlaneGeometry(.94,.94),line=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:invalid?'#ce554c':'#59966d',depthTest:false}));geometry.dispose();line.rotation.x=-Math.PI/2;const top=invalid?tileTop(p.r,p.c):tileHeight(previewMap.tiles[p.r]?.[p.c]);line.position.set(wx(p.c),inside(p.r,p.c)&&!cellHidden(p.r,p.c)?top+.04:.04,wz(p.r));line.renderOrder=12;placementLayer.add(line);}
 $('hoverCoord').textContent=(invalid?'无法放置 · '+reason+' · ':'放置预览 · ')+prefab.name+' · '+prefab.size.width+' × '+prefab.size.height+' / '+cells.length+' 格';
 placementRenderCache={document:documentModel,prefab,key,text:$('hoverCoord').textContent};
}

function placementPreviewMap(candidate,cells){
 const preview={...map,tiles:map.tiles.slice()},rows=new Set();
 const changes=candidate.viewCells(cells);
 for(const {r,c} of cells){if(!rows.has(r)){preview.tiles[r]=preview.tiles[r].slice();rows.add(r);}preview.tiles[r][c]=changes.get(r+','+c)??null;}
 return preview;
}

$('applyKeyName').onclick=()=>{try{if(P.mode!=='edit')throw new Error('仅编辑模式可修改钥匙');commitTree(renameTreeKeys(documentModel,selectedCells,$('keyName').value,{isHidden:cellHidden,nodeHidden,schemaFor:nodeSchema}));}catch(error){toast(error.message,true);}};

$('regionChoice').onchange=()=>{$('newRegionPanel').hidden=!!$('regionChoice').value;};

function treeEntityChoices(){const choices=entityChoices(prefabs,map),ids=new Set(choices.map(p=>p.id));for(const node of documentModel.world.serialize())if(!ids.has(node.prefabId)){ids.add(node.prefabId);choices.push(normalizePrefab({version:1,id:node.prefabId,name:node.prefabId,tile:node.configuration??{color:"white"}}));}return choices;}
function renderEntityVisibility(){renderEntityChecklist($('entityVisibility'),treeEntityChoices().map(p=>({...p,preview:prefabPreview(p)})),hiddenEntities,(id,checked)=>{if(checked)hiddenEntities.delete(id);else hiddenEntities.add(id);refreshEntityVisibility();});}
function refreshEntityVisibility(){setSelectedCells(directSelectedCells);buildPaper();syncState();}
$('showAllEntities').onclick=()=>{hiddenEntities.clear();refreshEntityVisibility();};
$('hideAllEntities').onclick=()=>{for(const prefab of treeEntityChoices())hiddenEntities.add(prefab.id);refreshEntityVisibility();};

function assertTreeVisibility(next,before=documentModel){const signature=(doc,kind)=>doc.world.serialize().filter(node=>kind==='fold'?node.components.fold:Object.keys(node.tags).length).map(node=>({id:node.id,values:kind==='fold'?node.components.fold:node.tags,cells:doc.world.transforms.worldCells(node.transformId)}));if(!visibility.folds&&JSON.stringify(signature(before,'fold'))!==JSON.stringify(signature(next,'fold')))throw new Error('隐藏折线禁止编辑');if(!visibility.player&&JSON.stringify(signature(before,'tags'))!==JSON.stringify(signature(next,'tags')))throw new Error('隐藏标签禁止编辑');}
function commitTree(next,{placement=false,cell}={}){assertTreeVisibility(next);const before=placement&&gestureBefore?null:documentModel.serialize();if(!placement&&JSON.stringify(next.serialize())===JSON.stringify(before)){refreshTreePanel();return;}record({snapshot:before,refresh:false});const previousDocument=documentModel,previousMap=map;documentModel=next;map=next.view();if(selectedNodeId&&!next.world.has(selectedNodeId))selectedNodeId=null;controller.resetPosition();
 if(placement&&cell&&refreshFlatPaperPlacement(THREE,{before:previousDocument.world,after:next.world,beforeMap:previousMap,afterMap:map,...cell,layer:tileLayer,materialFor:color=>materials[color],wx,wz,hidden:cellHidden})){cancelPlacementPreview();clearSelection();foldMotionView.invalidatePrepared();renderer.shadowMap.needsUpdate=true;refreshTreePanel();applyVisibility();updateUI();scheduleFoldPreparation();}
 else buildPaper();persist();}
function refreshTreePanel(){
 const panel=$('treeNodes');if(!panel||!panel.closest('details')?.open)return;const nodes=documentModel.world.serialize();const point=lastClickTile??selectedCells[0];
 renderTreeNodes(panel,entityTreeContext(documentModel.world,selectedNodeId,point).map(node=>{const world=documentModel.world.transforms.world(node.transformId);return {id:node.id,depth:node.depth,label:node.prefabId+' · '+coord(world.r,world.c)+(node.colocated?' · 同格':''),disabled:nodeHidden(node)||documentModel.world.transforms.worldCells(node.transformId).some(p=>cellHidden(p.r,p.c)),selected:selectedNodeId===node.id};}),id=>{selectedNodeId=id;refreshTreePanel();});
 const node=nodes.find(item=>item.id===selectedNodeId);$('treeFields').hidden=!node;if(!node){clearPropertyInspector($('nodeConfiguration'));return;}const transform=documentModel.world.transforms.get(node.transformId),world=documentModel.world.transforms.world(node.transformId);$('nodeLocalR').value=transform.local.r;$('nodeLocalC').value=transform.local.c;$('nodeLocalDir').value=transform.local.dir;renderTreeParents($('nodeParent'),entityParentChoices(documentModel.world,node.id).map(other=>({...other,disabled:nodeHidden(other)||documentModel.world.transforms.worldCells(other.transformId).some(p=>cellHidden(p.r,p.c))})));$('nodeParent').value=nodes.find(item=>item.transformId===transform.parentId)?.id??'';const schema=nodeSchema(node),readable=inspectNodeValues(node,schema);$('nodeComponents').value=JSON.stringify(readable.components??{},null,2);$('nodeTags').value=JSON.stringify(readable.tags??{},null,2);$('nodeIdentity').textContent=node.id;$('nodeWorldPosition').textContent='地图位置 '+coord(world.r,world.c)+' · 朝'+FACE_NAMES[world.dir];
 renderPropertyInspector($('nodeConfiguration'),{components:readable.components??{},tags:readable.tags??{}},schema,(path,value)=>{if(P.mode!=='edit')throw new Error('仅编辑模式可修改实体');const current=documentModel.world.get(selectedNodeId),currentSchema=nodeSchema(current),before=inspectNodeValues(current,currentSchema),after=updateProperty(before,currentSchema,path,value);applyTreeConfiguration(current,before,after,currentSchema);},error=>{$('nodeEditStatus').textContent=error.message;toast(error.message,true);},new Set(),{identity:node.id,structured:true,expanded:true,hideReadOnly:true,choices:{'components.surface.color':Object.entries(COLOR_NAMES).map(([value,label])=>({value,label})),...triggerEditorChoiceMap()}});
 const locked=nodeHidden(node)||documentModel.world.transforms.worldCells(node.transformId).some(p=>cellHidden(p.r,p.c));$('treeFields').disabled=locked;for(const id of ['moveNode','reparentNode','applyNodeConfig'])$(id).disabled=locked;const protectedNode=documentModel.world.transforms.childrenOf(node.transformId).length||documentModel.world.transforms.referenceOwners(node.transformId).some(owner=>owner!=='entity:'+node.id);$('deleteNode').disabled=locked||!!protectedNode;$('deleteNode').title=protectedNode?'实体有子节点或外部引用，暂不能删除':'删除当前实体';
}
$('treeNodes').closest('details').addEventListener('toggle',event=>{if(event.currentTarget.open)refreshTreePanel();});
function treeAction(action){try{if(P.mode!=='edit'||!selectedNodeId)throw new Error('先选择实体节点');commitTree(action());$('nodeEditStatus').textContent='已应用';}catch(error){$('nodeEditStatus').textContent=error.message;toast(error.message,true);}}
$('moveNode').onclick=()=>treeAction(()=>moveNode(documentModel,selectedNodeId,{r:Number($('nodeLocalR').value),c:Number($('nodeLocalC').value),dir:Number($('nodeLocalDir').value)},cellHidden,nodeHidden));
$('reparentNode').onclick=()=>treeAction(()=>reparentNode(documentModel,selectedNodeId,$('nodeParent').value||null,$('preserveWorld').checked,cellHidden,nodeHidden));
$('deleteNode').onclick=()=>treeAction(()=>deleteNode(documentModel,selectedNodeId,cellHidden,nodeHidden));
function inspectNodeValues(node,schema){const value=nodeDebug.values(node.id,node,schema),components=clone(value.components??{});for(const id of ['lift','foldSwitch','rayEmitter','firebird'])if(components[id])components[id]={...components[id],triggers:components[id].triggers??['walk','teleport']};const physics={followFold:nodeFollowsFold(node),...(['item','creature'].includes(entityCategory(node))?{canDropOnFold:nodeCanDropOnFold(node)}:{}) ,...components.physics};return projectProperties({...value,components:{...components,physics}},schema,'readable');}
function nodeSchema(node){const prefab=prefabs.find(item=>item.id===node.prefabId),source={...(prefab?.tile??{}),...(node.configuration??{}),prefabId:node.prefabId,...(prefab?.propertySchema?{propertySchema:prefab.propertySchema}:{})};return nodePermissions(node,entityPropertySchema(source,tagCatalog));}
function applyTreeConfiguration(node,shown,after,schema){if(!visibility.folds&&JSON.stringify(shown.components?.fold)!==JSON.stringify(after.components?.fold))throw new Error('隐藏折线禁止编辑');if(!visibility.player&&JSON.stringify(shown.tags)!==JSON.stringify(after.tags))throw new Error('隐藏标签禁止编辑');updateProperty(shown,schema,['components'],after.components);updateProperty(shown,schema,['tags'],after.tags);const next=configureNode(documentModel,node.id,after.components,after.tags,cellHidden,nodeHidden,schema);commitTree(next);for(const change of debugChanges(shown,after,schema))nodeDebug.set(node.id,change.path,change.value);refreshTreePanel();$('nodeEditStatus').textContent='已应用';}
$('applyNodeConfig').onclick=()=>{try{if(P.mode!=='edit'||!selectedNodeId)throw new Error('先选择实体节点');const node=documentModel.world.get(selectedNodeId),schema=nodeSchema(node),shown=projectProperties(nodeDebug.values(node.id,node,schema),schema,'readable');applyTreeConfiguration(node,shown,{...shown,components:JSON.parse($('nodeComponents').value),tags:JSON.parse($('nodeTags').value)},schema);}catch(error){$('nodeEditStatus').textContent=error.message;toast(error.message,true);}};
