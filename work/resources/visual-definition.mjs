export function assetPath(value,kind){
 if(typeof value!=='string'||value.length>240||!value.startsWith(kind+'/')||value.split('/').some(part=>!part||part==='.'||part==='..')||/[\\%?#:\u0000-\u001f]/.test(value)||!value.toLowerCase().endsWith(kind==='model'?'.fbx':'.png'))throw new Error('无效 '+kind+' 资源路径');
 return value;
}
export function normalizeVisual(value){
 if(value===undefined||value===null)return value;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('visual 须为对象或 null');
 const vector=(name,fallback)=>{
  const input=value[name]??fallback;
  if(!Array.isArray(input)||input.length!==3||input.some(n=>typeof n!=='number'||!Number.isFinite(n))||(name==='scale'&&input.some(n=>n<=0)))throw new Error('visual.'+name+' 须为三个有效数值，缩放须大于零');
  return [...input];
 };
 const textures=value.textures??{};
 if(!textures||typeof textures!=='object'||Array.isArray(textures))throw new Error('visual.textures 须为贴图名称映射');
 return {model:assetPath(value.model,'model'),scale:vector('scale',[1,1,1]),offset:vector('offset',[0,0,0]),rotation:vector('rotation',[0,0,0]),textures:Object.fromEntries(Object.entries(textures).map(([name,path])=>{
  if(!name||/[\\/\u0000-\u001f]/.test(name))throw new Error('贴图名称须为 FBX 中的文件名');
  return [name,assetPath(path,'texture')];
 }))};
}
