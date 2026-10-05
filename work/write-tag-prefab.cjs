const fs=require('node:fs/promises');
const {saveTagPrefab}=require('./prefab-catalog.cjs');
(async()=>{if(!process.argv[2])throw new Error('用法：node work/write-tag-prefab.cjs <标签定义.json>');const tag=await saveTagPrefab(JSON.parse(await fs.readFile(process.argv[2],'utf8')));console.log('已写入 assets/prefab/tag/'+tag.id+'.json');})().catch(error=>{console.error(error.message);process.exitCode=1;});
