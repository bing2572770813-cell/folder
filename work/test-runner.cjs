const {spawnSync}=require('node:child_process');
const path=require('node:path');
const contextTest=spawnSync(process.execPath,[path.join(__dirname,'test-entity-tree-context.mjs')],{stdio:'inherit'});
if(contextTest.status!==0)process.exit(contextTest.status||1);
for(const file of ['test-paper-surface.mjs','test-entity-visibility.mjs','test-map-name.mjs','test-player.mjs','test-regions-entities.mjs','test-special-terrain.mjs','test-fold-geometry.mjs','test-editor-model.mjs','test-editor-history.mjs','test-batch-inspection.mjs','test-cell-entity.mjs','test-event-bus.mjs','test-entity-behavior.mjs','test-tag-prefab.mjs','test-editor-visibility.mjs','test-property-model.mjs','test-tile-model.mjs','test-map-integration.mjs','test-prefab-catalog.cjs','test-react-ui.cjs','verify-static.cjs','verify-level.cjs']){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
  if(result.status!==0){process.exit(result.status||1);}
}
