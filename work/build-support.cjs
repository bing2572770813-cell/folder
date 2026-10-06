const fs=require('node:fs');
const path=require('node:path');
function workspaceFiles(root=__dirname){
  return {name:'workspace-files',setup(build){
    build.onResolve({filter:/^node:/},args=>{throw new Error('Browser bundle cannot import Node module: '+args.path);});
    build.onResolve({filter:/\.js$/},args=>{
      if(!args.path.startsWith('.'))return;
      const file=path.resolve(args.resolveDir||root,args.path);
      if(!fs.existsSync(file)&&fs.existsSync(file.slice(0,-3)+'.ts'))return {path:file.slice(0,-3)+'.ts'};
    });
  }};
}
module.exports={workspaceFiles};
