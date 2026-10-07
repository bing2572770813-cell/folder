const {spawnSync}=require('node:child_process');
const path=require('node:path');
const {frontendFiles}=require('./tools/frontend-test-files.cjs');
function runEntityRegressions(cwd=__dirname){
  const files=['visual-prefab','visual-assets','local-placement-preview','categorized-placement','transform','tree-commands','tree-document','trigger-list'].map(name=>path.join(cwd,'backend/test/'+name+'.test.mjs'));
  const result=spawnSync(process.execPath,['--test',...files],{cwd,stdio:'inherit',windowsHide:true});
  if(result.error)console.error(result.error.message);
  return result.status===0?0:result.status||1;
}
function runFrontend(cwd=__dirname){
  for(const file of frontendFiles(cwd)){
    const result=spawnSync(process.execPath,[path.join(cwd,file)],{cwd,stdio:'inherit',windowsHide:true});
    if(result.error)console.error(result.error.message);
    if(result.status!==0)return result.status||1;
  }
  return 0;
}
if(require.main===module)process.exitCode=runEntityRegressions()||runFrontend();
module.exports={runFrontend,runEntityRegressions};
