import {normalizeVisual} from '../resources/visual-definition.mjs';

/** Project persisted visual references into render-only model placements. */
export function collectModelDescriptors(document, {nodeHidden=()=>false, cellHidden=()=>false, wx=c=>c, wz=r=>r, tileTop=()=>0, getPrefab=()=>null, runtime=false}={}) {
 const descriptors=[];
 for(const node of document.world.serialize()) {
  const prefab=getPrefab(node.prefabId);
  const visual=normalizeVisual(prefab?.visual!==undefined?prefab.visual:node.configuration?.visual);
  if(!visual||node.static?.render===false||nodeHidden(node))continue;
  if(runtime&&node.components?.firebird&&document.world.runtime(node.id,'firebird').replaced)continue;
  const cells=document.world.transforms.worldCells(node.transformId).filter(({r,c})=>!cellHidden(r,c)).map(cell=>({...cell,nodeId:node.id}));
  if(!cells.length)continue;
  const center=cells.reduce((sum,{r,c})=>{sum.x+=wx(c);sum.z+=wz(r);sum.y=Math.max(sum.y,tileTop(r,c));return sum;},{x:0,y:0,z:0});
  center.x/=cells.length;center.z/=cells.length;
  const transformWorld=document.world.transforms.world(node.transformId);
  const emitter=node.components?.rayEmitter;
  const direction=emitter&&(runtime?(document.world.runtime(node.id,'rayEmitter').direction??emitter.initialDirection):emitter.initialDirection);
  const dir=emitter?({north:0,east:2,south:4,west:6}[direction]??transformWorld.dir):transformWorld.dir;
  descriptors.push({id:node.id,visual,cells,cell:cells[0],position:[center.x,center.y,center.z],dir,nodeId:node.id});
 }
 return descriptors;
}
