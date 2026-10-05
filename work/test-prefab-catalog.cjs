const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {readCatalog,savePrefab}=require('./prefab-catalog.cjs');
(async()=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),'fold-prefab-'));
  try{
    const data={version:1,id:'test_ai',name:'测试实体',tile:{color:'green',height:2,blocked:false,folds:['h','v']}};
    await savePrefab(data,folder);
    const original=await fs.readFile(path.join(folder,'test_ai.json'),'utf8');
    await assert.rejects(savePrefab({...data,name:'覆写'},folder));
    assert.equal(await fs.readFile(path.join(folder,'test_ai.json'),'utf8'),original);
    let catalog=await readCatalog(folder);assert.equal(catalog.prefabs[0].tile.height,2);
    await fs.writeFile(path.join(folder,'test_ai.json'),JSON.stringify({...data,tile:{...data.tile,height:3}}));
    catalog=await readCatalog(folder);assert.equal(catalog.prefabs[0].tile.height,3);
    await fs.writeFile(path.join(folder,'invalid.json'),'broken');
    await fs.writeFile(path.join(folder,'duplicate.json'),JSON.stringify(data));
    catalog=await readCatalog(folder);assert.equal(catalog.prefabs.length,1);assert.equal(catalog.errors.length,2);
    await assert.rejects(savePrefab({...data,id:'../escape_ai'},folder));
    await assert.rejects(savePrefab({...data,id:'author'},folder));
    console.log('PASS: disk catalog refresh, validation isolation, duplicates, safe names and no overwrite.');
  }finally{await fs.rm(folder,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
