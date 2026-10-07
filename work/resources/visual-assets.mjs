import {normalizeVisual,assetPath} from './visual-definition.mjs';

export function visualAssetPaths(visuals){
 const paths=new Set();for(const value of visuals){const visual=normalizeVisual(value);if(!visual)continue;paths.add(visual.model);for(const texture of Object.values(visual.textures))paths.add(texture);}return [...paths];
}
const decode=data=>Uint8Array.from(atob(data.slice(data.indexOf(',')+1)),char=>char.charCodeAt(0)).buffer;
function encode(path,buffer){
 const bytes=new Uint8Array(buffer),chunks=[];for(let i=0;i<bytes.length;i+=8192)chunks.push(String.fromCharCode(...bytes.subarray(i,i+8192)));
 return 'data:'+(path.toLowerCase().endsWith('.png')?'image/png':'application/octet-stream')+';base64,'+btoa(chunks.join(''));
}
/** Byte cache is separate from parsed model resources; exports reuse exact loaded bytes. */
export function createVisualAssetSource({embedded={},offline=false,fetch:fetchAsset=globalThis.fetch}={}){
 const bytes=new Map();
 function read(path){
  assetPath(path,path.startsWith('model/')?'model':'texture');
  if(!bytes.has(path))bytes.set(path,Promise.resolve().then(async()=>{
   const data=embedded[path];if(typeof data==='string'&&/^data:[^,]*;base64,/.test(data))return decode(data);
   if(offline)throw new Error('离线文件缺少资源：'+path);
   const response=await fetchAsset('/assets/'+path);if(!response.ok)throw new Error('资源读取失败：'+path+' (HTTP '+response.status+')');return response.arrayBuffer();
  }));
  return bytes.get(path);
 }
 return {
  read,
  url(path){assetPath(path,'texture');if(embedded[path])return embedded[path];if(offline)throw new Error('离线文件缺少贴图：'+path);return '/assets/'+path;},
  async bundle(visuals){const result={};await Promise.all(visualAssetPaths(visuals).map(async path=>{result[path]=encode(path,await read(path));}));return result;},
 };
}
