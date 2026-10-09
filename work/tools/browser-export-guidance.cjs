const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
async function verifyExportGuidance(browser,url,directory){
 const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true}),page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 page.on('requestfailed',request=>errors.push(request.url()+': '+request.failure()?.errorText));
 try{
  await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));
  await page.goto(url,{waitUntil:'networkidle'});
  const map={version:2,width:3,height:3,entities:[],transforms:[],cellTags:{},metadata:{name:'导出引导测试',spawn:{r:1,c:1,dir:2},exit:null,maxSteps:0}};
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){
   const id=r+'-'+c,fragile=r===1&&c===2;
   map.transforms.push({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
   map.entities.push({id,transformId:'t-'+id,prefabId:fragile?'fragile_paper_ai':'paper_ai',components:{surface:{height:.09,color:'white'},...(fragile?{fragile:{count:4}}:{})},tags:r===1&&c===1?{spawn:true}:{},static:{entityType:'terrain',walkable:true}});
   map.cellTags[id.replace('-',',')]={regionTag:'测试区域'};
  }
  await page.locator('#mapFile').setInputFiles({name:'export-guide.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(map))});
  await page.waitForFunction(()=>document.getElementById('mapName').value==='导出引导测试');
  // Check the on-block counter through real movement, undo and break settlement.
  await page.evaluate(()=>window.foldField.enableDiagnostics());
  await page.locator('#playMode').click();
  await page.screenshot({path:path.join(directory,'fragile-counter-isometric.png')});
  await page.locator('#topView').click();
  const cellPoint=async(r,c)=>page.evaluate(({r,c})=>window.foldField.screenPoint(r,c),{r,c});
  const capture=async name=>{await page.mouse.move(10,10);await page.screenshot({path:path.join(directory,name+'.png')});};
  await capture('fragile-counter-4');
  let from=await cellPoint(1,1),to=await cellPoint(0,1);
  await page.mouse.click(from.x,from.y);await page.mouse.click(to.x,to.y);
  await page.waitForFunction(()=>window.foldField.getState().steps===1&&!window.foldField.getState().moving);
  let fragilePoint=await cellPoint(1,2);await page.mouse.move(fragilePoint.x,fragilePoint.y);
  await page.waitForFunction(()=>document.getElementById('gameHint').textContent.includes('3 次'));
  await capture('fragile-counter-3');
  await page.locator('#undoBtn').click();await page.waitForFunction(()=>window.foldField.getState().steps===0);
  fragilePoint=await cellPoint(1,2);await page.mouse.move(fragilePoint.x,fragilePoint.y);
  await page.waitForFunction(()=>document.getElementById('gameHint').textContent.includes('4 次'));
  await capture('fragile-counter-undo-4');
  for(let step=1;step<=4;step++){
   from=await cellPoint(step%2===1?1:0,1);to=await cellPoint(step%2===1?0:1,1);
   if(step===1)await page.mouse.click(from.x,from.y);
   await page.mouse.click(to.x,to.y);
   await page.waitForFunction(step=>window.foldField.getState().steps===step&&!window.foldField.getState().moving,step);
  }
  await page.waitForFunction(()=>window.foldField.getState().map.tiles[1][2]===null);
  await capture('fragile-counter-broken');
  await page.locator('#restartBtn').click();await page.waitForFunction(()=>window.foldField.getState().steps===0);
  await capture('fragile-counter-restart-4');
  await page.locator('#editMode').click();
  // Export from a dirty inspection UI, verifying that selected/editor state is never copied.
  await page.locator('#tabInspect').click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#exportGame').click()]);
  const file=path.join(directory,'export-guide.html');await download.saveAs(file);
  await page.addInitScript(()=>{
    const NativeAudio=window.Audio;window.__exportAudio=[];
    window.Audio=function(src){
      const item=new NativeAudio(src),play=item.play.bind(item);let first=true;
      item.play=()=>{if(item.loop&&first){first=false;return Promise.reject(new DOMException('Autoplay blocked','NotAllowedError'));}return play();};
      window.__exportAudio.push(item);return item;
    };
  });
  const requests=[];page.on('request',request=>{if(/^https?:/.test(request.url()))requests.push(request.url());});
  await page.goto(pathToFileURL(file).href,{waitUntil:'networkidle'});
  await page.locator('#gameHud').waitFor({state:'visible'});
  for(const selector of ['.sidebar','#editMode','#mapName','#resultEdit','#startBtn'])assert.equal(await page.locator(selector).count(),0,selector+' must not exist in the playable DOM');
  assert.equal(await page.evaluate(()=>typeof window.foldField),'undefined');
  assert.equal(await page.evaluate(()=>window.__FOLD_FIELD_PREFABS__),undefined);
  assert.equal(await page.evaluate(()=>window.__exportAudio.filter(item=>item.loop).length),1,'export includes a BGM track');
  assert.equal(await page.evaluate(()=>window.__exportAudio.find(item=>item.loop).paused),true,'blocked autoplay keeps music pending');
  await page.locator('#topView').click();
  await page.waitForFunction(()=>{const music=window.__exportAudio.find(item=>item.loop);return music&&!music.paused&&music.currentTime>0;});
  const bounds=await page.locator('#viewport canvas').boundingBox(),center={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2},target={x:center.x+bounds.height/9,y:center.y};
  await page.mouse.move(target.x,target.y);
  await page.waitForFunction(()=>document.getElementById('gameHint').textContent.includes('C2:')&&document.getElementById('gameHint').textContent.includes('4 次'));
  const hud=await page.locator('#gameHud').boundingBox();assert.ok(hud.y>400,'guide belongs in the lower-left corner');assert.ok(hud.x<50);
  await page.screenshot({path:path.join(directory,'export-guide-before.png')});
  await page.mouse.click(center.x,center.y);await page.mouse.click(target.x,target.y);
  await page.waitForFunction(()=>document.getElementById('gameHint').textContent.includes('3 次'));
  await page.locator('#restartBtn').click();await page.mouse.move(target.x+1,target.y);
  await page.waitForFunction(()=>document.getElementById('gameHint').textContent.includes('4 次'));
  await page.screenshot({path:path.join(directory,'export-guide-restart.png')});
  assert.deepEqual(requests,[],'all prefab logic, models, textures and audio must work without a server');
  assert.equal(await page.evaluate(()=>window.__exportAudio.filter(item=>item.loop).length),1,'later input never replaces the BGM instance');
  assert.deepEqual(errors,[],'export and gameplay must have no runtime errors');
  return [{name:'fragile-counter-move-undo-break-restart',status:'pass'},{name:'offline-game-no-editor-or-reflection-and-live-fragile-guidance',status:'pass'}];
 }catch(error){await page.screenshot({path:path.join(directory,'export-guide-failure.png')}).catch(()=>{});throw error;}finally{await context.close();}
}
module.exports={verifyExportGuidance};
if(require.main===module){
 const fs=require('node:fs'),{chromium}=require('playwright-core'),{openPreview}=require('./preview-session.cjs');
 (async()=>{
  const cwd=path.resolve(__dirname,'..'),directory=path.join(cwd,'.dev-checks','export-guide-'+Date.now());fs.mkdirSync(directory,{recursive:true});
  let preview,browser;
  try{
   preview=await openPreview({startServer:require('../backend/dist/server.js').startServer,config:require('../backend/dist/config.js').loadBackendConfig({}, {workRoot:cwd})});
   browser=await chromium.launch({channel:process.env.FOLD_BROWSER_CHANNEL??'msedge',headless:true});
   const results=await verifyExportGuidance(browser,preview.url,directory);
   fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify({status:'pass',results},null,2));console.log('PASS export guidance: '+directory);
  }catch(error){fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify({status:'fail',error:error.stack},null,2));console.error(error);console.error('Evidence: '+directory);process.exitCode=1;}
  finally{await browser?.close();await preview?.app.close();}
 })();
}
