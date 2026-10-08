const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL}=require('node:url');
const assert = require('node:assert/strict');
const {performance} = require('node:perf_hooks');
const {randomUUID} = require('node:crypto');
const {chromium} = require('playwright-core');
const {openPreview} = require('./preview-session.cjs');
const {assertBrowserEvidence} = require('./browser-evidence.cjs');

function parseScenario(args = process.argv.slice(2)) {
  if (args.length === 0) return 'all';
  if (args.length === 2 && args[0] === '--scenario' && ['all', 'desktop', 'mobile'].includes(args[1])) return args[1];
  throw new Error('Usage: node tools/browser-smoke.cjs [--scenario all|desktop|mobile]');
}

async function main() {
  const scenario = parseScenario();
  const cwd = path.resolve(__dirname, '..');
  const directory = path.join(cwd, '.dev-checks', 'browser-' + randomUUID().slice(0, 8));
  fs.mkdirSync(directory, {recursive: true});
  const started = performance.now(), results = [], errors = [];
  let preview, browser, context, page, failure;
  async function capture(name) {
    const canvas = page.locator('#viewport canvas').first();
    await canvas.waitFor({state: 'visible'});
    await page.waitForFunction(() => {
      const element = document.querySelector('#viewport canvas');
      return element?.width > 0 && element?.height > 0;
    });
    const png = await canvas.screenshot({path: path.join(directory, name + '-canvas.png')});
    // Decode the actual screenshot, avoiding cleared WebGL drawing buffers.
    const canvasColors = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/png'}));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const {data} = ctx.getImageData(0, 0, canvas.width, canvas.height), colors = new Set();
      for (let y = 0; y < canvas.height; y += Math.max(1, Math.floor(canvas.height / 80))) {
        for (let x = 0; x < canvas.width; x += Math.max(1, Math.floor(canvas.width / 80))) {
          const i = (y * canvas.width + x) * 4;
          colors.add(data[i] + ',' + data[i + 1] + ',' + data[i + 2]);
        }
      }
      return colors.size;
    }, png.toString('base64'));
    assertBrowserEvidence({errors, canvasColors});
    await page.screenshot({path: path.join(directory, name + '.png'), fullPage: true});
    results.push({name, status: 'pass', canvasColors});
  }
  async function open(viewport, route, {offlineAssets=false}={}) {
    context = await browser.newContext({viewport});
    await context.tracing.start({screenshots: true, snapshots: true});
    page = await context.newPage();
    page.setDefaultTimeout(10000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
    page.on('requestfailed', request => errors.push(request.url() + ': ' + request.failure()?.errorText));
    page.on('response', response => {if (response.status() >= 400) errors.push(response.url() + ': HTTP ' + response.status());});
    // Browsers request a favicon independently; it is not part of the app's readiness contract.
    await page.route('**/favicon.ico', route => route.fulfill({status: 204, body: ''}));
    if(offlineAssets)await page.route('**/assets/**',route=>route.fulfill({status:404,body:'external assets unavailable'}));
    await page.goto(new URL(route, preview.url).href, {waitUntil: 'networkidle'});
  }
  async function closeContext(name) {
    await context.tracing.stop({path: path.join(directory, name + '-trace.zip')});
    await context.close(); context = null; page = null;
  }
  try {
    const {startServer} = require('../backend/dist/server.js');
    const {loadBackendConfig} = require('../backend/dist/config.js');
    preview = await openPreview({startServer, config: loadBackendConfig({}, {workRoot: cwd})});
    const launch = process.env.FOLD_BROWSER_EXECUTABLE ? {executablePath: process.env.FOLD_BROWSER_EXECUTABLE} :
      {channel: process.env.FOLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chrome')};
    browser = await chromium.launch({...launch, headless: true});
    if (scenario === 'all' || scenario === 'desktop') {
      await open({width: 1280, height: 800}, '/');
      await page.waitForFunction(() => document.getElementById('editMode')?.getAttribute('aria-pressed') === 'true');
      await capture('desktop-editor');
      const originalName = await page.locator('#mapName').inputValue();
      await page.locator('#mapName').fill('Development smoke fixture');
      await page.locator('#mapName').press('Tab');
      assert.equal(await page.locator('#mapName').inputValue(), 'Development smoke fixture');
      await page.locator('#undoBtn').click();
      assert.equal(await page.locator('#mapName').inputValue(), originalName);
      results.push({name: 'rename-and-undo', status: 'pass'});
      await page.locator('#playMode').click();
      await page.waitForFunction(() => document.getElementById('playMode').getAttribute('aria-pressed') === 'true');
      assert.equal(await page.locator('#playPanel').isVisible(), true);
      await page.locator('#restartBtn').click();
      assert.equal(await page.locator('#canvasSteps').textContent(), '00');
      await page.evaluate(()=>window.foldField.enableDiagnostics());
      const playerModel=await page.evaluate(()=>window.__FOLD_FIELD_PREFABS__.find(prefab=>prefab.id==='player_ai')?.visual?.model);
      if(playerModel){
        await page.waitForFunction(model=>{const visual=JSON.parse(document.getElementById('viewport').dataset.render).playerVisual;return visual.model===model&&visual.ready&&!visual.fallback;},playerModel);
        results.push({name:'runtime-player-prefab-model',status:'pass',model:playerModel});
      }
      await capture('desktop-play');
      await page.locator('#editMode').click();
      await page.waitForFunction(() => document.getElementById('editMode').getAttribute('aria-pressed') === 'true');
      assert.equal(await page.locator('#editPanel').isVisible(), true);
      await page.reload({waitUntil: 'networkidle'});
      assert.equal(await page.locator('#mapName').inputValue(), originalName);
      await capture('desktop-reload');
      const dimensions=await page.evaluate(()=>{const {width,height}=window.foldField.getState().map;return {width,height};});
      await page.locator('#newMap').click();
      await page.waitForFunction(()=>window.foldField.getState().map.tiles.flat().every(tile=>tile===null));
      const draft=await page.evaluate(()=>window.foldField.getState());
      assert.equal(draft.mode,'edit');
      assert.deepEqual({width:draft.map.width,height:draft.map.height},dimensions);
      assert.deepEqual(draft.map.spawn,{r:Math.floor(dimensions.height/2),c:Math.floor(dimensions.width/2),dir:0});
      assert.equal(await page.evaluate(()=>{const toast=document.getElementById('toast');return toast.classList.contains('show')&&toast.classList.contains('error');}),false,'draft creation and placement must not show spawn errors');
      await page.locator('[data-tool="place"]').click();
      const first={r:1,c:1};
      const firstPoint=await page.evaluate(({r,c})=>window.foldField.screenPoint(r,c),first);
      await page.mouse.move(firstPoint.x,firstPoint.y);
      await page.waitForFunction(({r,c})=>window.foldField.getState().placementPreview?.surfaces.some(cell=>cell.r===r&&cell.c===c),first);
      await page.mouse.click(firstPoint.x,firstPoint.y);
      await page.waitForFunction(({r,c})=>window.foldField.getState().map.tiles[r][c]!==null,first);
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles.flat().filter(Boolean).length),1);
      assert.equal(await page.evaluate(()=>{const toast=document.getElementById('toast');return toast.classList.contains('show')&&toast.classList.contains('error');}),false,'draft creation and placement must not show spawn errors');
      await capture('desktop-draft-first-placement');
      await page.locator('#playMode').click();
      assert.equal(await page.evaluate(()=>window.foldField.getState().mode),'edit','empty drafts must still fail play validation');

      await page.locator('#undoBtn').click();
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles.flat().filter(Boolean).length),0);
      await page.locator('#redoBtn').click();
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles.flat().filter(Boolean).length),1);
      await page.locator('#tagSummary').click();
      await page.locator('[data-tool="player"]').click();
      const startPoint=await page.evaluate(({r,c})=>window.foldField.screenPoint(r,c),first);
      await page.mouse.click(startPoint.x,startPoint.y);
      await page.waitForFunction(({r,c})=>window.foldField.getState().map.tiles[r][c]?.tags?.spawn===true,first);
      await page.locator('#playMode').click();
      await page.waitForFunction(()=>window.foldField.getState().mode==='play');
      await page.locator('#editMode').click();
      await page.waitForFunction(()=>document.getElementById('saveState').textContent==='本地已保存');
      await page.reload({waitUntil:'networkidle'});
      const restored=await page.evaluate(()=>window.foldField.getState().map);
      assert.equal(restored.tiles[first.r][first.c].tags.spawn,true);
      assert.equal(restored.tiles.flat().filter(Boolean).length,1);
      await capture('desktop-draft-start-reload');
      results.push({name:'new-draft-preview-placement-undo-redo-start-and-reload',status:'pass'});
      const enemyMap={version:2,width:7,height:7,entities:[],transforms:[],cellTags:{},metadata:{spawn:{r:0,c:0,dir:0},exit:null,name:'敌人机关验收',description:'',maxSteps:0,bestSteps:null}};
      for(let r=0;r<7;r++)for(let c=0;c<7;c++){
        const id=r+'-'+c;enemyMap.cellTags[r+','+c]={regionTag:'A'};
        enemyMap.transforms.push({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
        enemyMap.entities.push({id,prefabId:'paper_ai',transformId:'t-'+id,components:{surface:{height:.09,color:'white'},collision:{blocked:false}},tags:r===0&&c===0?{spawn:true}:{},static:{entityType:'terrain'}});
      }
      await page.locator('#mapFile').setInputFiles({name:'enemy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(enemyMap))});
      await page.waitForFunction(()=>window.foldField.getState().map.name==='敌人机关验收');
      await page.evaluate(()=>window.foldField.enableDiagnostics());
      await page.locator('#prefabSummary').click();
      assert.equal(await page.locator('#prefabGrid [data-prefab="firebird_ai"]').isEnabled(),true);
      assert.equal(await page.locator('#prefabGrid [data-prefab="ray_emitter_ai"]').isEnabled(),true);
      assert.equal(await page.locator('#prefabGrid [data-prefab="player_ai"]').isEnabled(),false);
      await page.locator('#prefabGrid [data-prefab="firebird_ai"]').click();
      await page.locator('[data-tool="place"]').click();
      // Keep the configured bird model away from the clicked spawn/step while retaining the 12-cell eastward beam.
      const birdPoint=await page.evaluate(()=>window.foldField.screenPoint(3,1));
      await page.mouse.move(birdPoint.x,birdPoint.y);await page.mouse.click(birdPoint.x,birdPoint.y);
      await capture('desktop-enemy-placement');
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles.flat().filter(Boolean).length),49,'enemy retains its paper support');
      await page.locator('#playMode').click();await page.waitForFunction(()=>window.foldField.getState().mode==='play');
      const currentBirdModel=await page.evaluate(()=>window.__FOLD_FIELD_PREFABS__.find(prefab=>prefab.id==='firebird_ai')?.visual?.model);
      if(currentBirdModel){
        await page.waitForFunction(model=>JSON.parse(document.getElementById('viewport').dataset.render).models.some(entry=>entry.model===model),currentBirdModel);
        await capture('desktop-firebird-model');
      }
      const start=await page.evaluate(()=>window.foldField.screenPoint(0,0));await page.mouse.click(start.x,start.y);
      const next=await page.evaluate(()=>window.foldField.screenPoint(0,1));await page.mouse.click(next.x,next.y);
      await page.waitForFunction(()=>window.foldField.getState().steps===1&&!window.foldField.getState().moving);
      assert.equal(await page.evaluate(()=>window.foldField.getState().terrainState.flames.length),12);
      await page.waitForFunction(()=>{const render=JSON.parse(document.getElementById('viewport').dataset.render);return render.flameMarkers===12&&render.replacedFirebirds===1;});
      if(currentBirdModel)await page.waitForFunction(model=>!JSON.parse(document.getElementById('viewport').dataset.render).models.some(entry=>entry.model===model),currentBirdModel);
      await capture('desktop-firebird-flames');
      await page.locator('#undoBtn').click();
      assert.equal(await page.evaluate(()=>window.foldField.getState().terrainState.flames.length),0);
      results.push({name:'creature-picker-firebird-placement-trigger-flames-and-undo',status:'pass'});
      await page.locator('#editMode').click();
      const emitterMap=structuredClone(enemyMap);emitterMap.metadata.name='喷射模型验收';
      for(const [id,r,c,visual] of [['emitter',5,5,undefined],['legacy-emitter',2,5,{model:'model/emitter_ai.fbx',scale:[.005,.005,.005],offset:[4.6652925885,.0319734826,-4.5407583767]}]]){
        emitterMap.transforms.push({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
        emitterMap.entities.push({id,prefabId:'ray_emitter_ai',transformId:'t-'+id,components:{rayEmitter:{initialDirection:'east'},collision:{blocked:true}},tags:{},static:{entityType:'creature'},configuration:visual?{visual}:{}});
      }
      await page.locator('#mapFile').setInputFiles({name:'emitter-model.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(emitterMap))});
      await page.waitForFunction(()=>window.foldField.getState().map.name==='喷射模型验收');
      await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).models.length===0);
      await capture('desktop-emitter-editor-marker');
      const currentEmitterModel=await page.evaluate(()=>window.__FOLD_FIELD_PREFABS__.find(prefab=>prefab.id==='ray_emitter_ai').visual.model);
      await page.locator('#playMode').click();
      await page.waitForFunction(expected=>{const models=JSON.parse(document.getElementById('viewport').dataset.render).models;return ['emitter','legacy-emitter'].every(id=>models.some(model=>model.nodeId===id&&model.model===expected&&Math.abs(model.rotation+Math.PI/2)<1e-6));},currentEmitterModel);
      await capture('desktop-emitter-model');
      const emitterStart=await page.evaluate(()=>window.foldField.screenPoint(0,0));await page.mouse.click(emitterStart.x,emitterStart.y);
      const emitterNext=await page.evaluate(()=>window.foldField.screenPoint(0,1));await page.mouse.click(emitterNext.x,emitterNext.y);
      await page.waitForFunction(()=>window.foldField.getState().steps===1&&!window.foldField.getState().moving);
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[2][6].prefabId),'ice_ai');
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[2][6].blocked),true);
      assert.equal(await page.evaluate(()=>window.foldField.getState().terrainState.frozen),false);
      await capture('desktop-emitter-first-ice');
      const iceExport=page.waitForEvent('download');await page.locator('#exportMap').click();
      const originalMap=JSON.parse(fs.readFileSync(await (await iceExport).path(),'utf8'));
      assert.equal(originalMap.entities.find(node=>node.id==='2-6').prefabId,'paper_ai','map export retains original terrain');
      const emitterSecond=await page.evaluate(()=>window.foldField.screenPoint(0,2));await page.mouse.click(emitterSecond.x,emitterSecond.y);
      await page.waitForFunction(()=>window.foldField.getState().steps===2&&!window.foldField.getState().moving);
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[2][6].prefabId),'paper_ai');
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[2][4].prefabId),'ice_ai');
      await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).models.filter(model=>['emitter','legacy-emitter'].includes(model.nodeId)).every(model=>Math.abs(model.rotation+3*Math.PI/2)<1e-6));
      await page.waitForFunction(()=>{
        const cells=JSON.parse(document.getElementById('viewport').dataset.render).emitterHighlights;
        return cells.filter(cell=>['emitter','legacy-emitter'].includes(cell.emitterId)).length===6;
      });
      const forwardHighlights=await page.evaluate(()=>JSON.parse(document.getElementById('viewport').dataset.render).emitterHighlights.filter(cell=>['emitter','legacy-emitter'].includes(cell.emitterId)));
      assert.ok(forwardHighlights.every(cell=>cell.c<5),'emitter rear/last-shot cells must not be highlighted after reversing');
      results.push({name:'emitter-highlights-only-current-forward-range',status:'pass'});
      await capture('desktop-emitter-model-reversed');
      await page.locator('#undoBtn').click();
      await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).models.filter(model=>['emitter','legacy-emitter'].includes(model.nodeId)).every(model=>Math.abs(model.rotation+Math.PI/2)<1e-6));
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[2][6].prefabId),'ice_ai');
      await page.locator('#undoBtn').click();await page.waitForFunction(()=>window.foldField.getState().steps===0);
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[2][6].prefabId),'paper_ai');
      results.push({name:'emitter-ice-replacement-reversal-undo-and-canonical-export',status:'pass'});
      results.push({name:'emitter-fbx-legacy-models-runtime-facing-and-undo',status:'pass'});
      await page.locator('#editMode').click();
      const deathMap=structuredClone(enemyMap);deathMap.metadata.name='射线冻死验收';delete deathMap.entities[0].components.fragile;
      deathMap.transforms.push({id:'t-killer',parentId:null,local:{r:0,c:3,dir:0},footprint:{width:1,height:1,occupied:[true]}});
      deathMap.entities.push({id:'killer',prefabId:'ray_emitter_ai',transformId:'t-killer',components:{rayEmitter:{initialDirection:'west'},collision:{blocked:true}},tags:{},static:{entityType:'creature'}});
      await page.locator('#mapFile').setInputFiles({name:'ray-death.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(deathMap))});
      await page.waitForFunction(()=>window.foldField.getState().map.name==='射线冻死验收');await page.locator('#playMode').click();
      const deathStart=await page.evaluate(()=>window.foldField.screenPoint(0,0));await page.mouse.click(deathStart.x,deathStart.y);
      const deathTarget=await page.evaluate(()=>window.foldField.screenPoint(0,1));await page.mouse.click(deathTarget.x,deathTarget.y);
      await page.waitForFunction(()=>window.foldField.getState().terrainState.gameOver&&!window.foldField.getState().moving);
      assert.equal(await page.locator('#resultDetail').textContent(),'被射线冻死');assert.equal(await page.locator('#resultOverlay').isVisible(),true);
      await capture('desktop-ray-freeze-death');await page.keyboard.press('Control+z');
      await page.waitForFunction(()=>!window.foldField.getState().terrainState.gameOver&&window.foldField.getState().steps===0);
      assert.equal(await page.locator('#resultOverlay').isVisible(),false);assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[0][1].prefabId),'paper_ai');
      results.push({name:'ray-hit-shows-freeze-death-and-undo-restores-game',status:'pass'});
      await page.locator('#editMode').click();
      const offlineActors=structuredClone(emitterMap);offlineActors.metadata.name='模型预扫描离线验收';
      offlineActors.transforms.push({id:'t-bird',parentId:null,local:{r:1,c:1,dir:0},footprint:{width:3,height:3,occupied:Array(9).fill(true)}});
      offlineActors.entities.push({id:'offline-bird',prefabId:'firebird_ai',transformId:'t-bird',components:{firebird:{direction:'east'},collision:{blocked:true}},tags:{},static:{entityType:'creature'},configuration:{}});
      await page.locator('#mapFile').setInputFiles({name:'offline-actors.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(offlineActors))});
      await page.waitForFunction(()=>window.foldField.getState().map.name==='模型预扫描离线验收');
      await page.locator('#playMode').click();
      await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).firebirdTrackingHighlight===true);
      assert.match(await page.locator('#toast').textContent(),/火焰子弹正在追踪你.*火焰鸟发怒了/);
      await capture('desktop-firebird-tracking');
      results.push({name:'firebird-spawn-warning-player-halo-and-nine-cell-rage',status:'pass'});
      const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportGame').click()]);
      const exportedEmitter=path.join(directory,'emitter-offline-game.html');await download.saveAs(exportedEmitter);
      await page.locator('#editMode').click();
      await page.waitForFunction(()=>{const data=JSON.parse(document.getElementById('viewport').dataset.render);return data.models.length===0&&!data.playerVisual.enabled;});
      results.push({name:'edit-mode-icons-only-after-playing',status:'pass'});


      await page.locator('#editMode').click();
      for(const node of enemyMap.entities)node.components.surface.height=.7;
      enemyMap.entities[0].components.fragile={};enemyMap.metadata.name='易碎镜头验收';
      await page.locator('#mapFile').setInputFiles({name:'fragile-camera.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(enemyMap))});
      await page.waitForFunction(()=>window.foldField.getState().map.name==='易碎镜头验收');
      await page.locator('#playMode').click();await page.waitForFunction(()=>window.foldField.getState().mode==='play');
      await page.evaluate(()=>new Promise(resolve=>{let frames=0;const settle=()=>{if(++frames===10)resolve();else requestAnimationFrame(settle);};requestAnimationFrame(settle);}));
      const fragileStart=await page.evaluate(()=>window.foldField.screenPoint(0,0));await page.mouse.click(fragileStart.x,fragileStart.y);
      await page.evaluate(()=>{
        window.__fragileCameraTrace=[];
        const sample=()=>{window.__fragileCameraTrace.push(window.foldField.screenPoint(6,6).y);if(window.__fragileCameraTrace.length<50)requestAnimationFrame(sample);};requestAnimationFrame(sample);
      });
      const fragileNext=await page.evaluate(()=>window.foldField.screenPoint(0,1));await page.mouse.click(fragileNext.x,fragileNext.y);
      await page.waitForFunction(()=>window.__fragileCameraTrace.length===50&&!window.foldField.getState().moving);
      const trace=await page.evaluate(()=>window.__fragileCameraTrace);
      fs.writeFileSync(path.join(directory,'fragile-camera-trace.json'),JSON.stringify(trace));
      assert.ok(Math.max(...trace)-Math.min(...trace)<1,'equal-height fragile departure must not shake the camera: '+(Math.max(...trace)-Math.min(...trace)));
      assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[0][0]),null);
      await capture('desktop-fragile-camera-stable');
      await page.locator('#undoBtn').click();assert.notEqual(await page.evaluate(()=>window.foldField.getState().map.tiles[0][0]),null);
      await page.locator('#restartBtn').click();assert.equal(await page.locator('#canvasSteps').textContent(),'00');
      results.push({name:'fragile-departure-no-camera-shake-undo-restart',status:'pass',screenDrift:Math.max(...trace)-Math.min(...trace)});
      for(const source of ['paper','lift']){
        await page.locator('#editMode').click();
        const entryMap=structuredClone(enemyMap);delete entryMap.entities[0].components.fragile;
        entryMap.entities[1].components.fragile={};entryMap.metadata.name='易碎入格 '+source;
        if(source==='lift')entryMap.entities[0].components.lift={minHeight:.7,maxHeight:1.7,initialHeight:.7,turnsPerLeg:1};
        await page.locator('#mapFile').setInputFiles({name:'fragile-entry.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(entryMap))});
        await page.waitForFunction(name=>window.foldField.getState().map.name===name,entryMap.metadata.name);
        await page.locator('#playMode').click();await page.waitForFunction(()=>window.foldField.getState().mode==='play');
        await page.evaluate(()=>new Promise(resolve=>{let frames=0;const settle=()=>{if(++frames===10)resolve();else requestAnimationFrame(settle);};requestAnimationFrame(settle);}));
        const start=await page.evaluate(()=>window.foldField.screenPoint(0,0));await page.mouse.click(start.x,start.y);
        await page.evaluate(()=>{window.__fragileCameraTrace=[];const sample=()=>{window.__fragileCameraTrace.push(window.foldField.screenPoint(6,6).y);if(window.__fragileCameraTrace.length<50)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
        const target=await page.evaluate(()=>window.foldField.screenPoint(0,1));await page.mouse.click(target.x,target.y);
        await page.waitForFunction(()=>window.__fragileCameraTrace.length===50&&!window.foldField.getState().moving);
        const samples=await page.evaluate(()=>window.__fragileCameraTrace),drift=Math.max(...samples)-Math.min(...samples);
        fs.writeFileSync(path.join(directory,'fragile-entry-'+source+'-trace.json'),JSON.stringify(samples));
        assert.ok(drift<1,'entering fragile paper from '+source+' must not shake camera: '+drift);
        assert.equal(await page.evaluate(()=>window.foldField.getState().player.c),1);
        assert.notEqual(await page.evaluate(()=>window.foldField.getState().map.tiles[0][1]),null,'entry must not break fragile paper');
        await capture('desktop-fragile-entry-'+source);
        await page.locator('#undoBtn').click();assert.equal(await page.evaluate(()=>window.foldField.getState().player.c),0);
        await page.locator('#restartBtn').click();assert.equal(await page.locator('#canvasSteps').textContent(),'00');
        results.push({name:'fragile-entry-'+source+'-no-camera-shake',status:'pass',screenDrift:drift});
      }
      await page.locator('#editMode').click();
      {
      const placementEmitterMap=structuredClone(enemyMap);placementEmitterMap.metadata.name='喷射初始方向验收';
      await page.locator('#mapFile').setInputFiles({name:'emitter-direction.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(placementEmitterMap))});
      await page.waitForFunction(()=>window.foldField.getState().map.name==='喷射初始方向验收');
      if(!await page.locator('#prefabGrid').isVisible())await page.locator('#prefabSummary').click();
      await page.locator('#prefabGrid [data-prefab="ray_emitter_ai"]').click();
      assert.equal(await page.locator('#emitterDirectionPanel').isVisible(),true);
      assert.equal(await page.locator('#emitterInitialDirection').inputValue(),'north');
      const emitterPoint=await page.evaluate(()=>window.foldField.screenPoint(1,1));
      for(const direction of ['east','south','west','north','east']){
        await page.locator('#emitterInitialDirection').selectOption(direction);
        await page.mouse.move(emitterPoint.x,emitterPoint.y);
        await page.waitForFunction(direction=>window.foldField.getState().placementPreview?.emitterDirections.some(node=>node.direction===direction),direction);
      }
      await capture('desktop-emitter-direction-preview');
      await page.mouse.click(emitterPoint.x,emitterPoint.y);
      await page.waitForFunction(()=>document.getElementById('saveState').textContent==='本地已保存');
      const downloadPromise=page.waitForEvent('download');await page.locator('#exportMap').click();const exported=await downloadPromise;
      const saved=JSON.parse(fs.readFileSync(await exported.path(),'utf8'));
      assert.equal(saved.entities.find(node=>node.prefabId==='ray_emitter_ai').components.rayEmitter.initialDirection,'east');
      await page.locator('#prefabGrid [data-prefab="paper_ai"]').click();assert.equal(await page.locator('#emitterDirectionPanel').isVisible(),false);
      await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#mapName').inputValue(),'喷射初始方向验收');
      await page.locator('#playMode').click();await page.waitForFunction(()=>window.foldField.getState().mode==='play');
      await capture('desktop-emitter-direction-play');
      results.push({name:'emitter-initial-direction-picker-preview-export-reload-play',status:'pass'});
      }
      {
        await page.locator('#editMode').click();
        const switchMap=structuredClone(enemyMap);switchMap.metadata.name='独立出口开关验收';delete switchMap.entities[0].components.fragile;
        switchMap.cellTags['6,6']={regionTag:'B'};switchMap.cellTags['6,5']={regionTag:'C'};
        for(const [key,id,state] of [['2-4','open-switch',1],['2-5','closed-switch',0]]){
          const node=switchMap.entities.find(node=>node.id===key);node.id=id;node.prefabId='fold_switch_ai';node.components.foldSwitch={initialState:state};node.components.fold={directions:['v']};node.components.collision={blocked:true};node.static.walkable=false;
        }
        await page.locator('#mapFile').setInputFiles({name:'exit-switches.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(switchMap))});
        await page.waitForFunction(()=>window.foldField.getState().map.name==='独立出口开关验收');
        if(!await page.locator('[data-tool="region-exit"]').isVisible())await page.locator('#tagSummary').click();
        await page.locator('[data-tool="region-exit"]').click();
        await page.locator('#requiredSwitchList').locator('..').locator('summary').click();
        await page.locator('#exitRegion').selectOption('B');await page.locator('#requiredSwitchList input[value="open-switch"]').check();
        const firstExit=await page.evaluate(()=>window.foldField.screenPoint(0,1));await page.mouse.click(firstExit.x,firstExit.y);
        await page.locator('#requiredSwitchList input[value="open-switch"]').uncheck();await page.locator('#requiredSwitchList input[value="closed-switch"]').check();await page.locator('#exitRegion').selectOption('C');
        const secondExit=await page.evaluate(()=>window.foldField.screenPoint(0,2));await page.mouse.click(secondExit.x,secondExit.y);
        assert.deepEqual(await page.evaluate(()=>window.foldField.getState().map.tiles[0].slice(1,3).map(tile=>tile.tags.requiredSwitches)),[['open-switch'],['closed-switch']]);
        const downloadPromise=page.waitForEvent('download');await page.locator('#exportMap').click();const saved=JSON.parse(fs.readFileSync(await (await downloadPromise).path(),'utf8'));
        assert.deepEqual(saved.entities.find(node=>node.id==='0-1').tags.requiredSwitches,['open-switch']);
        await capture('desktop-exit-switch-bindings');
        await page.locator('#playMode').click();await page.waitForFunction(()=>window.foldField.getState().mode==='play');
        await page.evaluate(()=>window.foldField.enableDiagnostics());
        assert.equal(await page.evaluate(()=>JSON.parse(document.getElementById('viewport').dataset.render).spawnedEntityIds.includes('6-6')),false);
        assert.equal(await page.evaluate(()=>window.foldField.getState().map.tiles[6][6]),null);
        await capture('desktop-hidden-region-unspawned');
        const start=await page.evaluate(()=>window.foldField.screenPoint(0,0));await page.mouse.click(start.x,start.y);
        const toFirst=await page.evaluate(()=>window.foldField.screenPoint(0,1));await page.mouse.click(toFirst.x,toFirst.y);await page.waitForFunction(()=>window.foldField.getState().steps===1&&!window.foldField.getState().moving);
        assert.equal(await page.evaluate(()=>JSON.parse(document.getElementById('viewport').dataset.state).revealedRegions.includes('B')),true);
        const toSecond=await page.evaluate(()=>window.foldField.screenPoint(0,2));await page.mouse.click(toSecond.x,toSecond.y);await page.waitForFunction(()=>window.foldField.getState().steps===2&&!window.foldField.getState().moving);
        assert.equal(await page.evaluate(()=>JSON.parse(document.getElementById('viewport').dataset.state).revealedRegions.includes('C')),false);
        assert.equal(await page.evaluate(()=>JSON.parse(document.getElementById('viewport').dataset.render).spawnedEntityIds.includes('6-6')),true);
        assert.equal(await page.evaluate(()=>JSON.parse(document.getElementById('viewport').dataset.render).spawnedEntityIds.includes('6-5')),false);
        await capture('desktop-exit-independent-switch-gates');
        await page.locator('#undoBtn').click();await page.locator('#undoBtn').click();
        await page.waitForFunction(()=>window.foldField.getState().steps===0);
        await page.waitForFunction(()=>!JSON.parse(document.getElementById('viewport').dataset.render).spawnedEntityIds.includes('6-6'));
        await page.locator('#editMode').click();await page.waitForFunction(()=>window.foldField.getState().mode==='edit');
        await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).spawnedEntityIds.includes('6-6'));
        results.push({name:'region-instances-spawn-on-reveal-and-despawn-on-undo',status:'pass'});
        results.push({name:'exit-switch-checklist-save-and-independent-runtime-gates',status:'pass'});
      }
      await closeContext('desktop');
      await open({width:1280,height:800},pathToFileURL(exportedEmitter).href,{offlineAssets:true});
      await page.evaluate(()=>window.foldField.enableDiagnostics());
      await page.waitForFunction(expected=>{const models=JSON.parse(document.getElementById('viewport').dataset.render).models;return ['emitter','legacy-emitter'].every(id=>models.some(model=>model.nodeId===id&&model.model===expected));},currentEmitterModel);
      if(currentBirdModel)await page.waitForFunction(model=>JSON.parse(document.getElementById('viewport').dataset.render).models.some(entry=>entry.model===model),currentBirdModel);
      await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).firebirdTrackingHighlight===true);
      await capture('offline-current-emitter-model');
      results.push({name:'exported-game-resolves-current-prefab-model-without-server',status:'pass'});
      await closeContext('offline-emitter');
      await open({width:1280,height:800},pathToFileURL(path.resolve(cwd,'../outputs/game.html')).href,{offlineAssets:true});
      await page.evaluate(()=>window.foldField.enableDiagnostics());
      await page.waitForFunction(model=>{const data=JSON.parse(document.getElementById('viewport').dataset.render);return data.playerVisual?.model===model&&data.playerVisual.ready&&!data.playerVisual.fallback&&data.layers.player;},JSON.parse(fs.readFileSync(path.resolve(cwd,'../assets/prefab/entity/player_ai.json'),'utf8')).visual.model);
      await capture('standalone-builtin-player');
      results.push({name:'player-fbx-renders-from-file-without-asset-server',status:'pass'});
      await closeContext('standalone-player');
    }
    if (scenario === 'all' || scenario === 'mobile') {
      await open({width: 390, height: 844}, '/');
      await capture('mobile-editor');
      await closeContext('mobile-editor');
      await open({width: 390, height: 844}, '/game.html');
      await page.waitForFunction(() => document.body.classList.contains('game-only'));
      await capture('mobile-game');
      await closeContext('mobile-game');
    }
  } catch (error) {
    failure = error;
    if (page) await page.screenshot({path: path.join(directory, 'failure.png'), fullPage: true, timeout: 2000}).catch(() => {});
  } finally {
    if (context) {
      await context.tracing.stop({path: path.join(directory, 'failure-trace.zip')}).catch(() => {});
      await context.close().catch(() => {});
    }
    if (browser) await browser.close().catch(error => {failure ??= error;});
    if (preview) await preview.app.close().catch(error => {failure ??= error;});
    if (errors.length) failure ??= new Error('Browser errors: ' + errors.join('\n'));
    const report = {scenario, status: failure ? 'fail' : 'pass', durationMs: Math.round(performance.now() - started), results, errors,
      failure: failure?.stack ?? null, limitations: 'Smoke scenarios only; screenshots and color checks do not prove visual correctness or performance.'};
    fs.writeFileSync(path.join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(report.status.toUpperCase() + ' browser smoke: ' + results.length + ' scenarios; ' + report.durationMs + 'ms');
    console.log('Evidence: ' + directory);
  }
  if (failure) throw failure;
}
if (require.main === module) main().catch(error => {console.error(error); process.exitCode = 1;});

module.exports = {parseScenario};
