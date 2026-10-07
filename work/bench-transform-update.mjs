import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const output=await build({entryPoints:[fileURLToPath(new URL('./backend/src/entities/transform-manager.ts',import.meta.url))],bundle:true,platform:'node',format:'esm',write:false});
const {TransformManager}=await import('data:text/javascript;base64,'+Buffer.from(output.outputFiles[0].text).toString('base64'));
for(const size of [12,48,96,128]){
 const nodes=Array.from({length:size*size},(_,i)=>({id:'tile-'+i,parentId:null,local:{r:Math.floor(i/size),c:i%size,dir:0},footprint:{width:1,height:1,occupied:[true]}}));
 const manager=new TransformManager(size,size,nodes),samples=[];
 for(let i=0;i<9;i++){const start=performance.now();manager.setLocal('tile-0',{r:i%2,c:i%2,dir:0});if(i>=2)samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);
 console.log(JSON.stringify({size,operation:'setLocal single root',warmup:2,samples:7,medianMs:+samples[3].toFixed(3)}));
}
