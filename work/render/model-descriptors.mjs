import {normalizeVisual} from '../resources/visual-definition.mjs';

/** Project persisted visual references into render-only model placements. */
export function collectModelDescriptors(document, {nodeHidden=()=>false, cellHidden=()=>false, runtime=false, wx=c=>c, wz=r=>r, tileTop=()=>0}={}) {
 const descriptors=[];
 for(const node of document.world.serialize()) {
  const visual=normalizeVisual(node.configuration?.visual);
  if(!visual||node.static?.render===false||nodeHidden(node))continue;
  const cells=document.world.transforms.worldCells(node.transformId).filter(({r,c})=>!cellHidden(r,c)).map(cell=>({...cell,nodeId:node.id}));
  if(!cells.length)continue;
  const center=cells.reduce((sum,{r,c})=>{sum.x+=wx(c);sum.z+=wz(r);sum.y=Math.max(sum.y,tileTop(r,c));return sum;},{x:0,y:0,z:0});
  center.x/=cells.length;center.z/=cells.length;
  const runtimeState=runtime?document.world.runtime(node.id,'model'):null;
  const transformWorld=document.world.transforms.world(node.transformId);
  descriptors.push({id:node.id,visual,cells,cell:cells[0],position:[center.x,center.y,center.z],dir:runtimeState?.dir??transformWorld.dir??node.configuration?.dir??0,nodeId:node.id});
 }
 return descriptors;
}
