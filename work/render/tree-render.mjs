// Detached render views; all coordinates come from the canonical Transform tree.
const terrainTypes=['campfire','ice','fire','eruption','key'];
const hasSurface=node=>Object.hasOwn(node.components,'surface');
const rendered=node=>node.static.render!==false;
const surfaceVisible=node=>rendered(node)&&!node.static.transparent&&hasSurface(node);

function surfaceTile(document,node,r,c,runtime=false){
 const tile={...structuredClone(node.configuration??{}),...structuredClone(node.components.surface??{}),prefabId:node.prefabId,
  tags:structuredClone(node.tags),regionTag:document.cellTags[r+','+c]?.regionTag??'默认区域',blocked:node.components.collision?.blocked??false};
 if(node.components.lift){tile.lift=structuredClone(node.components.lift);tile.height=runtime?(document.world.runtime(node.id,'lift').height??node.components.lift.initialHeight):node.components.lift.initialHeight;}
 delete tile.terrain;delete tile.terrainConfig;delete tile.keyName;
 const terrain=terrainTypes.find(type=>Object.hasOwn(node.components,type));
 if(terrain){tile.terrain=terrain;tile.terrainConfig=structuredClone(node.components[terrain]);if(terrain==='key')tile.keyName=node.components.key.name??'钥匙';}
 tile.folds=structuredClone(node.components.fold?.directions??[]);tile.fold=tile.folds[0]??null;
 return tile;
}

export function renderTreeCells(document,{nodeHidden=()=>false,cellHidden=()=>false,runtime=false}={}){
 const surfaceCells=[],terrainCells=[],tagCells=[];
 const nodes=document.world.serialize().sort((a,b)=>a.id.localeCompare(b.id));
 for(const node of nodes){
  if(!rendered(node)||nodeHidden(node))continue;
  for(const {r,c} of document.world.transforms.worldCells(node.transformId)){
   if(cellHidden(r,c))continue;
   if(surfaceVisible(node)){
    const primary=document.world.at(r,c).sort((a,b)=>a.id.localeCompare(b.id)).find(candidate=>hasSurface(candidate)&&!candidate.static.transparent);
    surfaceCells.push({nodeId:node.id,r,c,tile:surfaceTile(document,node,r,c,runtime),primary:primary?.id===node.id});
   }
   for(const type of terrainTypes)if(Object.hasOwn(node.components,type))terrainCells.push({nodeId:node.id,r,c,type,tile:{...surfaceTile(document,node,r,c,runtime),terrain:type,terrainConfig:structuredClone(node.components[type]),...(type==='key'?{keyName:node.components.key.name??'钥匙'}:{})}});
   if(Object.keys(node.tags).length)tagCells.push({nodeId:node.id,r,c,tags:structuredClone(node.tags)});
  }
 }
 const heights=new Map(),stacks=new Map();for(const cell of surfaceCells){const key=cell.r+','+cell.c;heights.set(key,Math.max(heights.get(key)??0,Number(cell.tile.height??.09)));}
 for(const marker of terrainCells){const key=marker.r+','+marker.c;if(!stacks.has(key))stacks.set(key,[]);stacks.get(key).push(marker);}
 for(const stack of stacks.values())stack.forEach((marker,index)=>{marker.index=index;marker.total=stack.length;marker.surfaceTop=heights.get(marker.r+','+marker.c)??0;});for(const cell of tagCells)cell.surfaceTop=heights.get(cell.r+','+cell.c)??0;
 return {surfaceCells,terrainCells,tagCells};
}

/** Keep neighboring primary geometry so paper seams and hidden-cell rules still work. */
export function mapForSurface(document,nodeId,runtime=false){
 const map=document.view(),node=document.world.get(nodeId);
 if(!hasSurface(node))return map;
 for(const {r,c} of document.world.transforms.worldCells(node.transformId))map.tiles[r][c]=surfaceTile(document,node,r,c,runtime);
 return map;
}
