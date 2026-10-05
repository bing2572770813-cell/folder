const fs=require('node:fs/promises');
const {savePrefab}=require('./prefab-catalog.cjs');
(async()=>{
  const source=process.argv[2];
  if(!source)throw new Error('用法：node work/write-prefab.cjs <实体定义.json>');
  const prefab=await savePrefab(JSON.parse(await fs.readFile(source,'utf8')));
  console.log('已写入 assets/prefab/'+prefab.id+'.json');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
