import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const bundled=await build({stdin:{contents:"export {TreeDocument} from './entities/tree-document.mjs';export {placeCategorizedPrefab} from './entities/tree-commands.mjs';export {previewPlacement} from './entities/placement-preview.mjs';",resolveDir:fileURLToPath(new URL('.',import.meta.url))},bundle:true,platform:'node',format:'esm',write:false});
const {TreeDocument,placeCategorizedPrefab,previewPlacement}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const prefab={id:'paper_ai',size:{width:1,height:1},occupied:[true],static:{entityType:'terrain'},tile:{color:'white',height:.09},BaseEntity:['void_ai']};
for(const size of [12,48,96,128]){
 const doc=new TreeDocument({version:1,width:size,height:size,tiles:Array.from({length:size},()=>Array.from({length:size},()=>({color:'white',height:.09,prefabId:'paper_ai'}))),spawn:{r:0,c:0,dir:0},foldCells:[]});
 const tagCells=doc.world.serialize().filter(node=>node.tags.spawn||node.tags.entry).flatMap(node=>doc.world.transforms.worldCells(node.transformId));
 const measure=fn=>{fn(0);fn(1);const values=[];for(let i=0;i<5;i++){const start=performance.now();fn(i);values.push(performance.now()-start);}return values.sort((a,b)=>a-b)[2];};
 const formal=measure(i=>placeCategorizedPrefab(doc,prefab,prefab.tile,Math.floor(size/2),i+2));
 const preview=measure(i=>previewPlacement(doc,prefab,prefab.tile,Math.floor(size/2),i+2,{tagCells}));
 console.log(JSON.stringify({size,formalMs:+formal.toFixed(2),previewMs:+preview.toFixed(2),reductionPercent:+(100*(1-preview/formal)).toFixed(1)}));
}
