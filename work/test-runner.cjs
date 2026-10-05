const {spawnSync}=require('node:child_process');
const path=require('node:path');
for(const file of ['test-special-terrain.mjs','test-fold-geometry.mjs','test-editor-model.mjs','test-tile-model.mjs','test-map-integration.mjs','test-prefab-catalog.cjs','verify-static.cjs','verify-level.cjs']){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
  if(result.status!==0){process.exit(result.status||1);}
}
