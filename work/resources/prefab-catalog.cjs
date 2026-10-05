const fs=require('node:fs/promises');
const path=require('node:path');
const directory=path.resolve(__dirname,'../../assets/prefab');
async function readCatalog(folder=directory){
  const {normalizePrefab}=await import('../entities/tile-model.mjs');
  const prefabs=[],errors=[],ids=new Set();
  const files=[];
  for(const subdir of ['entity','']){
    const source=path.join(folder,subdir);
    let entries;try{entries=await fs.readdir(source,{withFileTypes:true});}catch(error){if(subdir&&error.code==='ENOENT')continue;throw error;}
    for(const entry of entries.filter(e=>e.isFile()&&e.name.endsWith('.json')).sort((a,b)=>a.name.localeCompare(b.name)))files.push({file:path.join(source,entry.name),name:subdir?subdir+'/'+entry.name:entry.name});
  }
  for(const entry of files){
    try{
      const file=entry.file;
      if((await fs.stat(file)).size>128000)throw new Error('文件超过 128 KB');
      const prefab=normalizePrefab(JSON.parse(await fs.readFile(file,'utf8')));
      if(ids.has(prefab.id))throw new Error('实体 ID 重复：'+prefab.id);
      ids.add(prefab.id);prefabs.push(prefab);
    }catch(error){errors.push({file:entry.name,message:error.message});}
  }
  const {normalizeTagPrefab}=await import('../tags/tag-model.mjs');
  const tags=[],tagIds=new Set();
  let tagFiles=[];try{tagFiles=await fs.readdir(path.join(folder,'tag'),{withFileTypes:true});}catch(error){if(error.code!=='ENOENT')throw error;}
  for(const entry of tagFiles.filter(e=>e.isFile()&&e.name.endsWith('.json')).sort((a,b)=>a.name.localeCompare(b.name))){
    try{const file=path.join(folder,'tag',entry.name);if((await fs.stat(file)).size>128000)throw new Error('文件超过 128 KB');const tag=normalizeTagPrefab(JSON.parse(await fs.readFile(file,'utf8')));if(tagIds.has(tag.id))throw new Error('标签 ID 或行为重复');tagIds.add(tag.id);tags.push(tag);}catch(error){errors.push({file:'tag/'+entry.name,message:error.message});}
  }
  return {prefabs,tags,errors};
}
async function savePrefab(data,folder=directory){
  const {normalizePrefab}=await import('../entities/tile-model.mjs');
  const prefab=normalizePrefab(data);
  if(!prefab.id.endsWith('_ai'))throw new Error('后端生成的实体 ID 须以 _ai 结尾');
  const current=await readCatalog(folder);
  if(current.prefabs.some(p=>p.id===prefab.id))throw new Error('实体 ID 已存在，请使用新 ID');
  const entityFolder=path.join(folder,'entity');
  await fs.mkdir(entityFolder,{recursive:true});
  await fs.writeFile(path.join(entityFolder,prefab.id+'.json'),JSON.stringify(prefab,null,2)+'\n',{flag:'wx'});
  return prefab;
}
async function saveTagPrefab(data,folder=directory){
  const {normalizeTagPrefab}=await import('../tags/tag-model.mjs');const tag=normalizeTagPrefab(data);
  if(!tag.id.endsWith('_ai'))throw new Error('后端生成的标签 ID 须以 _ai 结尾');
  const current=await readCatalog(folder);if(current.tags.some(value=>value.id===tag.id))throw new Error('标签 ID 或行为已存在');
  const target=path.join(folder,'tag');await fs.mkdir(target,{recursive:true});await fs.writeFile(path.join(target,tag.id+'.json'),JSON.stringify(tag,null,2)+'\n',{flag:'wx'});return tag;
}
module.exports={readCatalog,savePrefab,saveTagPrefab};
