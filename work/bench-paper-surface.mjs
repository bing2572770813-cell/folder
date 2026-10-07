import {paperSurface,createPaperSurfaceCache} from './render/paper-surface.mjs';

for(const size of [12,48,96]){
 const makeMap=()=>({tiles:Array.from({length:size},(_,r)=>Array.from({length:size},(_,c)=>({prefabId:'paper_ai',height:1+c%2,thickness:.1,gradualRate:1,folds:r%12===0&&c%12===0?['h']:[]}))),foldCells:[]});
 const results=[];
 for(const reuse of [false,true]){
  const map=makeMap(),cache=createPaperSurfaceCache(),samples=[];let components=0;
  for(let i=0;i<9;i++){
   map.tiles[Math.floor(size/2)][Math.floor(size/2)].height=3+i%2;
   const start=performance.now();cache.begin();components=0;
   for(let r=0;r<size;r++)for(let c=0;c<size;c++)components+=(reuse?cache.get(map,r,c):paperSurface(map,r,c))?.positions.length??0;
   cache.end();if(i>=2)samples.push(performance.now()-start);
  }
  samples.sort((a,b)=>a-b);
  results.push({reuse,medianMs:+samples[3].toFixed(3),components});
 }
 if(results[0].components!==results[1].components)throw new Error('Geometry component counts differ');
 console.log(JSON.stringify({size,operation:'CPU paper geometry after one height edit; excludes projection, buffers and browser paint',warmup:2,samples:7,results}));
}
