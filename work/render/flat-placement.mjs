import {paperSurface,hasConnectedLiftNearby} from './paper-surface.mjs';
import {tileHeight,tileThickness,tileGradualRate,foldsAt} from '../entities/tile-model.mjs';
import {nodeFollowsFold} from '../entities/fold-properties.mjs';
import {createSpatialInstances,spatialCellKey} from './spatial-batches.mjs';

/** Reuse flat paper batches only when every geometry and overlay dependency is unchanged. */
export function refreshFlatPaperPlacement(THREE,{before,after,beforeMap,afterMap,r,c,layer,materialFor,wx,wz,hidden=()=>false}){
 if(beforeMap.width!==afterMap.width||beforeMap.height!==afterMap.height||hidden(r,c))return false;
 const oldNodes=before.at(r,c),newNodes=after.at(r,c),old=oldNodes[0],next=newNodes[0];
 if(oldNodes.length!==1||newNodes.length!==1||!old||!next)return false;
 for(const [world,node] of [[before,old],[after,next]]){
  if(node.prefabId!=='paper_ai'||node.static.render===false||node.static.transparent||node.components.lift||!node.components.surface)return false;
  const transform=world.transforms.get(node.transformId);
  if(transform.parentId!==null||transform.footprint.width!==1||transform.footprint.height!==1||world.transforms.childrenOf(node.transformId).length)return false;
 }
 if(nodeFollowsFold(old)!==nodeFollowsFold(next)||JSON.stringify(old.tags)!==JSON.stringify(next.tags))return false;
 const a=beforeMap.tiles[r]?.[c],b=afterMap.tiles[r]?.[c];
 if(!a||!b||a.terrain||b.terrain||a.blocked||b.blocked||a.kind==='player-token'||b.kind==='player-token')return false;
 if(tileHeight(a)!==tileHeight(b)||tileThickness(a)!==tileThickness(b)||tileGradualRate(a)!==tileGradualRate(b)||a.edgeColor!==b.edgeColor||a.surfaceConnected!==b.surfaceConnected)return false;
 for(const map of [beforeMap,afterMap])if(foldsAt(map,r,c).length||hasConnectedLiftNearby(map,r,c,hidden)||paperSurface(map,r,c,hidden))return false;
 const source=layer.children.find(mesh=>mesh.isInstancedMesh&&mesh.userData.cells?.some(cell=>cell.nodeId===old.id&&cell.r===r&&cell.c===c));
 if(!source)return false;
 const cell=source.userData.cells.find(cell=>cell.nodeId===old.id&&cell.r===r&&cell.c===c),material=materialFor(b.color??'white');
 if(!material)return false;
 if(source.material!==material){
  const chunk=spatialCellKey(cell),target=layer.children.find(mesh=>mesh!==source&&mesh.isInstancedMesh&&mesh.geometry===source.geometry&&mesh.material===material&&spatialCellKey(mesh.userData.cells[0])===chunk);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  const build=(cells,material)=>createSpatialInstances(THREE,{cells,geometry:source.geometry,material,matrixFor:({r,c,tile})=>{const height=tileHeight(tile),thickness=tileThickness(tile);position.set(wx(c),height-thickness/2,wz(r));scale.set(1,thickness,1);return matrix.compose(position,rotation,scale);}});
  const replacement=[...build(source.userData.cells.filter(item=>item!==cell),source.material),...build([...(target?.userData.cells??[]),cell],material)];
  for(const mesh of replacement){mesh.castShadow=source.castShadow;mesh.receiveShadow=source.receiveShadow;}
  layer.remove(source);source.dispose();if(target){layer.remove(target);target.dispose();}
  layer.add(...replacement);
 }
 // Grid/style references and picking buffers share this render-only cell record.
 cell.nodeId=next.id;cell.tile=b;
 return true;
}
