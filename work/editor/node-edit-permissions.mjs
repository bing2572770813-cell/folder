import {propertyAt,updateProperty} from '../core/property-model.mjs';

export function projectedCellSchema(primary,nodes,tile,schemaFor,fallback){
 const schema=structuredClone(primary?schemaFor(primary):fallback);
 const intersect=(definition,permissions)=>{const result={...definition};for(const flag of ['readable','tempEditable','serializable'])result[flag]=(definition?.[flag]??true)&&permissions.every(p=>p[flag]);return result;};
 for(const key of Object.keys(tile.tags??{})){
  const owners=nodes.filter(node=>Object.hasOwn(node.tags,key));
  const accesses=owners.map(node=>propertyAt(node,schemaFor(node),['tags',key]).permissions);
  schema.tags??={};schema.tags.children??={};schema.tags.children[key]=intersect(schema.tags.children[key],accesses);
 }
 const folds=nodes.filter(node=>node.components.fold);
 if(folds.length)schema.folds=intersect(schema.folds,folds.map(node=>propertyAt({...node,components:{...node.components,fold:{...node.components.fold,directions:node.components.fold.directions??[]}}},schemaFor(node),['components','fold','directions']).permissions));
 return schema;
}

// Property tools may update several owners or clear a unique tag on another cell.
export function assertNodePropertyChanges(before,after,schemaFor){
 for(const node of before.world.serialize()){
  const next=after.world.get(node.id);if(!next)throw new Error('属性编辑不能删除实体');
  const schema=schemaFor(node);
  for(const field of ['components','tags'])if(JSON.stringify(node[field])!==JSON.stringify(next[field]))updateProperty(node,schema,[field],next[field]);
  // The legacy adapter materializes these component/identity mirrors on first edit.
  // Components and tags above validate their actual owners, including removals.
  const mirrors=new Set(['followFold','height','thickness','gradualRate','surfaceConnected','color','edgeColor','blocked','folds','fold','tags','terrain','terrainConfig','lift','minHeight','maxHeight','initialHeight','turnsPerLeg','keyName','prefabId','instance','propertySchema','kind']);
  const configuration=Object.fromEntries(Object.entries(node.configuration??{}).filter(([key])=>!mirrors.has(key))),updated=Object.fromEntries(Object.entries(next.configuration??{}).filter(([key])=>!mirrors.has(key)));
  if(JSON.stringify(configuration)!==JSON.stringify(updated))updateProperty({configuration},{configuration:{children:schema}},['configuration'],updated);
 }
}
