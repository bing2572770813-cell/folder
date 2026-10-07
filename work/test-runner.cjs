const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {frontendFiles}=require('./tools/frontend-test-files.cjs');
function runFrontend(cwd=__dirname){
  for(const file of frontendFiles(cwd)){
    const result=spawnSync(process.execPath,[path.join(cwd,file)],{cwd,stdio:'inherit',windowsHide:true});
    if(result.error)console.error(result.error.message);
    if(result.status!==0)return result.status||1;
  }
  return 0;
}
if(require.main===module)process.exitCode=runFrontend();
module.exports={runFrontend};
