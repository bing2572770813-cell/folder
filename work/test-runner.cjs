const {spawnSync}=require('node:child_process');
const path=require('node:path');
const entityModelTest=spawnSync(process.execPath,['--test',...['local-placement-preview','categorized-placement','transform','tree-commands','tree-document'].map(name=>path.join(__dirname,'backend/test/'+name+'.test.mjs'))],{stdio:'inherit'});
if(entityModelTest.status!==0)process.exit(entityModelTest.status||1);
const spatialTest=spawnSync(process.execPath,[path.join(__dirname,'test-spatial-batches.mjs')],{stdio:'inherit'});
if(spatialTest.status!==0)process.exit(spatialTest.status||1);
const tagMarkerTest=spawnSync(process.execPath,[path.join(__dirname,'test-tag-markers.mjs')],{stdio:'inherit'});
if(tagMarkerTest.status!==0)process.exit(tagMarkerTest.status||1);
const frameTest=spawnSync(process.execPath,[path.join(__dirname,'test-frame-task.mjs')],{stdio:'inherit'});
if(frameTest.status!==0)process.exit(frameTest.status||1);
const contextTest=spawnSync(process.execPath,[path.join(__dirname,'test-entity-tree-context.mjs')],{stdio:'inherit'});
if(contextTest.status!==0)process.exit(contextTest.status||1);
const foldMotionResult=spawnSync(process.execPath,[path.join(__dirname,'test-fold-motion.mjs')],{stdio:'inherit'});
if(foldMotionResult.status!==0)process.exit(foldMotionResult.status||1);
for(const file of ['test-table-scene.mjs','test-crease-guides.mjs','test-follow-camera.mjs','test-paper-surface.mjs','test-entity-visibility.mjs','test-map-name.mjs','test-player.mjs','test-regions-entities.mjs','test-special-terrain.mjs','test-fold-geometry.mjs','test-editor-model.mjs','test-editor-history.mjs','test-batch-inspection.mjs','test-cell-entity.mjs','test-event-bus.mjs','test-entity-behavior.mjs','test-tag-prefab.mjs','test-editor-visibility.mjs','test-property-model.mjs','test-tile-model.mjs','test-map-integration.mjs','test-prefab-catalog.cjs','test-react-ui.cjs','verify-static.cjs','verify-level.cjs']){
  const result=spawnSync(process.execPath,[path.join(__dirname,file)],{stdio:'inherit'});
  if(result.status!==0){process.exit(result.status||1);}
}
