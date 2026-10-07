import {LoadingManager} from 'three';
import {FBXLoader} from 'three/examples/jsm/loaders/FBXLoader.js';
import {disposeModel} from './model-library.mjs';

/** External textures are explicit PNG references; embedded FBX textures stay embedded. */
export function createFbxModelLoader(source){
 return async visual=>{
  const buffer=await source.read(visual.model),manager=new LoadingManager();
  let pending=false,resolveTextures;const failures=[];
  const complete=new Promise(resolve=>resolveTextures=resolve);
  manager.onStart=()=>pending=true;manager.onLoad=()=>resolveTextures();manager.onError=url=>failures.push(url);
  manager.setURLModifier(url=>{
   if(url.startsWith('blob:')||url.startsWith('data:'))return url;
   const filename=url.split(/[\\/]/).at(-1),path=visual.textures[filename];
   if(!path)throw new Error('FBX 外部贴图未声明：'+filename+' · '+visual.model);
   return source.url(path);
  });
  let model;
  try{
   model=new FBXLoader(manager).parse(buffer,'');if(pending)await complete;
   if(failures.length)throw new Error('模型贴图加载失败：'+failures.join('，'));
   let meshes=0;model.traverse(object=>{if(object.isMesh){meshes++;object.castShadow=true;object.receiveShadow=true;}});
   if(!meshes)throw new Error('FBX 不包含可显示网格：'+visual.model);
   return model;
  }catch(error){if(model)disposeModel(model);throw error;}
 };
}
