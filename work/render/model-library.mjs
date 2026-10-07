import {Group} from 'three';
import {clone as cloneSkeleton} from 'three/examples/jsm/utils/SkeletonUtils.js';
import {normalizeVisual} from '../resources/visual-definition.mjs';

export function disposeModel(template){
 const geometries=new Set(),materials=new Set(),textures=new Set();
 template.traverse(object=>{
  if(object.geometry)geometries.add(object.geometry);
  for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){
   materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value);
  }
 });
 for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();for(const texture of textures)texture.dispose();
}

/** Templates own GPU resources until session disposal; entity clones only own transforms. */
export function createModelLibrary({load}={}){
 const entries=new Map();let disposed=false;
 return {
  async instantiate(value){
   if(disposed)throw new Error('model library is disposed');
   const visual=normalizeVisual(value);if(!visual)throw new Error('model reference is required');
   const key=JSON.stringify([visual.model,Object.entries(visual.textures).sort(([a],[b])=>a.localeCompare(b))]);
   let entry=entries.get(key);
   if(!entry){
    entry={};entries.set(key,entry);
    entry.promise=Promise.resolve().then(()=>load(visual)).then(template=>{
     if(disposed){disposeModel(template);throw new Error('model library is disposed');}
     entry.template=template;return template;
    });
   }
   const template=await entry.promise;if(disposed)throw new Error('model library is disposed');
   const instance=new Group();instance.add(cloneSkeleton(template));
   instance.scale.fromArray(visual.scale);instance.position.fromArray(visual.offset);
   instance.rotation.set(...visual.rotation.map(degrees=>degrees*Math.PI/180));
   return instance;
  },
  dispose(){if(disposed)return;disposed=true;for(const entry of entries.values())if(entry.template)disposeModel(entry.template);entries.clear();},
 };
}
