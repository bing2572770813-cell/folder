const copy=value=>structuredClone(value);
function intersect(a={},b={}){const result={...copy(a),...copy(b)};for(const flag of ['readable','tempEditable','serializable'])if(a[flag]===false||b[flag]===false)result[flag]=false;const keys=new Set([...Object.keys(a.children??{}),...Object.keys(b.children??{})]);if(keys.size){result.children={};for(const key of keys)result.children[key]=intersect(a.children?.[key],b.children?.[key]);}return result;}
export function nodePermissions(node,legacy={}){
 const schema=copy(legacy);schema.id={readable:true,tempEditable:false};schema.transformId={readable:true,tempEditable:false};schema.static={readable:true,tempEditable:false};
 const components=schema.components??={},children=components.children??={};schema.components=components;
 const field=(component,key,definition)=>{const branch=children[component]??={},fields=branch.children??={};children[component]=branch;fields[key]=intersect(fields[key],definition);};
 for(const key of ['height','thickness','gradualRate','color','edgeColor'])if(schema[key])field('surface',key,schema[key]);
 if(schema.blocked)field('collision','blocked',schema.blocked);if(schema.folds)field('fold','directions',schema.folds);
 const terrain=node.configuration?.terrain;if(terrain&&schema.terrainConfig)children[terrain]=intersect(children[terrain],schema.terrainConfig);if(terrain==='key'&&schema.keyName)field('key','name',schema.keyName);
 const effective=(component,key)=>{const branch=children[component]??{};return intersect(intersect(components,branch),key?branch.children?.[key]:{});};
 for(const key of ['height','thickness','gradualRate','color','edgeColor'])schema[key]=intersect(schema[key],effective('surface',key));
 schema.blocked=intersect(schema.blocked,effective('collision','blocked'));schema.folds=intersect(schema.folds,effective('fold','directions'));
 if(terrain)schema.terrainConfig=intersect(schema.terrainConfig,effective(terrain));if(terrain==='key')schema.keyName=intersect(schema.keyName,effective('key','name'));
 return schema;
}
