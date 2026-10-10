const assert=require('node:assert/strict');
const path=require('node:path');
async function verifyRegionCamera(browser,url,directory){
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage();
 try{
  await page.goto(url,{waitUntil:'networkidle'});
  const map={version:2,width:20,height:10,entities:[],transforms:[],cellTags:{},metadata:{name:'区域摄像机验收',spawn:{r:1,c:2,dir:2},exit:null,maxSteps:0}};
  for(let r=0;r<10;r++)for(let c=0;c<20;c++){
   const id=r+'-'+c,tags=r===1&&c===2?{spawn:true}:r===1&&c===4?{exitTo:'B'}:r===1&&c===15?{entry:true}:{};
   map.transforms.push({id:'t-'+id,parentId:null,local:{r,c,dir:0},footprint:{width:1,height:1,occupied:[true]}});
   map.entities.push({id,prefabId:'paper_ai',transformId:'t-'+id,components:{surface:{height:.09,color:'white'}},tags,static:{entityType:'terrain'}});
   map.cellTags[r+','+c]={regionTag:c<7?'A':'B'};
  }
  await page.locator('#mapFile').setInputFiles({name:'region-camera.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(map))});
  await page.waitForFunction(()=>window.foldField.getState().map.name==='区域摄像机验收');
  await page.evaluate(()=>window.foldField.enableDiagnostics());await page.locator('#playMode').click();
  const pose=()=>page.evaluate(()=>{const data=JSON.parse(document.getElementById('viewport').dataset.render);return {camera:data.camera,target:data.target};});
  const point=(r,c)=>page.evaluate(({r,c})=>window.foldField.screenPoint(r,c),{r,c});
  await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).visibleTiles===70);
  const before=await pose(),start=await point(1,2);await page.mouse.click(start.x,start.y);
  let next=await point(1,3);await page.mouse.click(next.x,next.y);
  await page.waitForFunction(()=>window.foldField.getState().steps===1&&!window.foldField.getState().moving);
  assert.deepEqual(await pose(),before,'ordinary walking leaves camera unchanged');
  next=await point(1,4);await page.mouse.click(next.x,next.y);
  await page.waitForFunction(()=>window.foldField.getState().steps===2&&!window.foldField.getState().moving&&window.foldField.getState().player.c===15);
  await page.waitForFunction(()=>JSON.parse(document.getElementById('viewport').dataset.render).visibleTiles===200);
  const after=await pose();assert.notDeepEqual(after.target,before.target,'new region recenters on destination');
  await page.screenshot({path:path.join(directory,'new-region-camera.png')});
  next=await point(1,16);await page.mouse.click(next.x,next.y);
  await page.waitForFunction(()=>window.foldField.getState().steps===3&&!window.foldField.getState().moving);
  assert.deepEqual(await pose(),after,'walking in revealed region never follows');
  await page.setViewportSize({width:1300,height:800});
  await page.waitForFunction(()=>document.querySelector('#viewport canvas').width>0);
  assert.deepEqual(await pose(),after,'resizing never follows ordinary movement');
  await page.locator('#undoBtn').click();await page.waitForFunction(()=>window.foldField.getState().steps===2);
  assert.deepEqual(await pose(),after,'undo within region never follows');
  await page.locator('#undoBtn').click();await page.waitForFunction(()=>window.foldField.getState().steps===1);
  assert.deepEqual(await pose(),after,'hiding a region on undo never follows');
  return [{name:'new-region-camera-once-walking-and-undo-stay-fixed',status:'pass'}];
 }finally{await context.close();}
}
module.exports={verifyRegionCamera};
