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
    const entityPath=path.join(folder,'entity','test_ai.json');
    const original=await fs.readFile(entityPath,'utf8');
    await assert.rejects(savePrefab({...data,name:'覆写'},folder));
    assert.equal(await fs.readFile(entityPath,'utf8'),original);
    let catalog=await readCatalog(folder);assert.equal(catalog.prefabs[0].tile.height,2);
    await fs.writeFile(entityPath,JSON.stringify({...data,tile:{...data.tile,height:3}}));
    catalog=await readCatalog(folder);assert.equal(catalog.prefabs[0].tile.height,3);
    await fs.writeFile(path.join(folder,'invalid.json'),'broken');
    await fs.writeFile(path.join(folder,'duplicate.json'),JSON.stringify(data));
    catalog=await readCatalog(folder);assert.equal(catalog.prefabs.length,1);assert.equal(catalog.errors.length,2);
    assert.equal(catalog.prefabs[0].tile.height,3,'New entity directory takes precedence over a duplicate legacy file');
    await fs.mkdir(path.join(folder,'tag'));
    await fs.writeFile(path.join(folder,'tag','not-an-entity.json'),'not an entity');
    catalog=await readCatalog(folder);assert.equal(catalog.errors.length,2,'Tag definitions are never parsed as entities');
    await fs.writeFile(path.join(folder,'legacy.json'),JSON.stringify({...data,id:'legacy_ai'}));
    catalog=await readCatalog(folder);assert.ok(catalog.prefabs.some(p=>p.id==='legacy_ai'));
    await assert.rejects(savePrefab({...data,id:'legacy_ai'},folder),/已存在/);
    await assert.rejects(savePrefab({...data,id:'../escape_ai'},folder));
    await assert.rejects(savePrefab({...data,id:'author'},folder));
    console.log('PASS: entity subdirectory, legacy fallback, tag isolation, cross-directory duplicate rejection, refresh and no overwrite.');
  }finally{await fs.rm(folder,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
