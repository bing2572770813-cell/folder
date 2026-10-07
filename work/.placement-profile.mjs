import {build} from 'esbuild';
const built=await build({stdin:{contents:"export {TreeDocument} from './entities/tree-document.mjs';export {placeCategorizedPrefab} from './entities/tree-commands.mjs';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false});
const mod=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const p={id:'paper_ai',size:{width:1,height:1},occupied:[true],static:{entityType:'terrain'},tile:{color:'white',height:.09},BaseEntity:['void_ai']};
const d=new mod.TreeDocument({version:1,width:64,height:64,tiles:Array.from({length:64},()=>Array.from({length:64},()=>({color:'white',height:.09,prefabId:'paper_ai'}))),spawn:{r:0,c:0,dir:0},foldCells:[]});
const calls={}; function wrap(proto,name){const f=proto[name];proto[name]=function(...a){const start=performance.now();try{return f.apply(this,a)}finally{const n=calls[name]??={count:0,ms:0};n.count++;n.ms+=performance.now()-start;}};}
wrap(Object.getPrototypeOf(d.world),'serialize');wrap(Object.getPrototypeOf(d.world),'clone');wrap(Object.getPrototypeOf(d.world.transforms),'commit');wrap(Object.getPrototypeOf(d),'cellNodes');
for(let i=0;i<3;i++)mod.placeCategorizedPrefab(d,p,p.tile,30,30);
for(const key of Object.keys(calls))delete calls[key];const t=performance.now();mod.placeCategorizedPrefab(d,p,p.tile,30,30);console.log(JSON.stringify({total:performance.now()-t,calls},null,2));
