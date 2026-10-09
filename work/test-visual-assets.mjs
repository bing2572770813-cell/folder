import assert from 'node:assert/strict';
import {createVisualAssetSource,visualAssetPaths} from './resources/visual-assets.mjs';
const visual={model:'model/key_ai.fbx',textures:{'diffuse.png':'texture/key_ai.png'}};
assert.deepEqual(visualAssetPaths([visual,visual,null]),['model/key_ai.fbx','texture/key_ai.png']);
const buffers={'/assets/model/key_ai.fbx':new TextEncoder().encode('model bytes').buffer,'/assets/texture/key_ai.png':new Uint8Array([137,80,78,71]).buffer};
const source=createVisualAssetSource({fetch:async url=>({ok:true,arrayBuffer:async()=>buffers[url]})});
const bytes=await source.read(visual.model);assert.equal(bytes,await source.read(visual.model),'byte cache reuses the fetched result');
const embedded=await source.bundle([visual]);assert.equal(embedded['model/key_ai.fbx'],'data:application/octet-stream;base64,bW9kZWwgYnl0ZXM=');
const offline=createVisualAssetSource({offline:true,embedded,fetch:()=>{throw new Error('offline export attempted network access');}});
assert.deepEqual(await offline.read(visual.model),bytes);assert.equal(offline.url('texture/key_ai.png'),embedded['texture/key_ai.png']);
await assert.rejects(()=>offline.read('model/missing_ai.fbx'),/缺少资源/);assert.throws(()=>offline.url('texture/missing_ai.png'),/缺少贴图/);
console.log('PASS: selected visual asset collection, byte reuse, standalone bundling and offline resource reads.');

const mixed=createVisualAssetSource({embedded,fetch:async url=>({ok:true,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer})});
assert.deepEqual(await mixed.read(visual.model),bytes,'built-in player bytes take precedence over external requests');
assert.deepEqual(await mixed.read('model/new_ai.fbx'),new Uint8Array([1,2,3]).buffer,'other live models retain external loading');
assert.equal(mixed.url('texture/key_ai.png'),embedded['texture/key_ai.png']);
console.log('PASS: built-in model/texture data coexist with live external assets.');

const {readFile}=await import('node:fs/promises');
const {default:catalogModule}=await import('./prefab-catalog.cjs');
const catalog=await catalogModule.readCatalog(),paths=visualAssetPaths(catalog.prefabs.map(prefab=>prefab.visual));
for(const name of ['index.html','game.html']){
 const html=await readFile(new URL('../outputs/'+name,import.meta.url),'utf8');
 const match=name==='index.html'?html.match(/window\.__FOLD_FIELD_BUILTIN_ASSETS__\?\?=(\{.*?\});/):html.match(/window\.__FOLD_FIELD_EXPORT_ASSETS__=(\{.*?\});/);
 assert.ok(match,'built '+name+' must contain prescanned visual assets');
 const assets=JSON.parse(match[1]);
 assert.deepEqual(Object.keys(assets).sort(),[...paths].sort(),'all prefab visuals must be bundled, without an entity ID whitelist');
 for(const path of paths){
  const actual=await readFile(new URL('../assets/'+path,import.meta.url));
  assert.deepEqual(Buffer.from(assets[path].split(',')[1],'base64'),actual,'embedded bytes must match '+path);
 }
}
console.log('PASS: both HTML builds prescan every entity prefab model and declared texture, including new references.');
