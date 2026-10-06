const fs=require('node:fs');
const path=require('node:path');

function workspaceFiles(root=__dirname){
  return {name:'workspace-files',setup(build){
    build.onResolve({filter:/.*/},args=>{
      if(args.path.startsWith('node:'))throw new Error('Browser bundle cannot import Node module: '+args.path);
      const packages={three:'three/build/three.module.js',lucide:'lucide/dist/esm/lucide.js'};
      let file=packages[args.path]?path.join(root,'node_modules',packages[args.path]):args.path.startsWith('three/')?path.join(root,'node_modules',args.path):path.resolve(args.importer?path.dirname(args.importer):root,args.path);
      if(!fs.existsSync(file)&&file.endsWith('.js')&&fs.existsSync(file.slice(0,-3)+'.ts'))file=file.slice(0,-3)+'.ts';
      return {path:file,namespace:'workspace'};
    });
    build.onLoad({filter:/.*/,namespace:'workspace'},args=>({contents:fs.readFileSync(args.path,'utf8'),loader:args.path.endsWith('.json')?'json':args.path.endsWith('.ts')?'ts':'js'}));
  }};
}
module.exports={workspaceFiles};
