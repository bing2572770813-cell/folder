import {tileHeight,tileThickness} from '../entities/tile-model.mjs';
// The body owns the decal; changing the mesh transform moves both together.
export function createLiftBlock(THREE,tile,material){
 const thickness=tileThickness(tile),body=new THREE.Mesh(new THREE.BoxGeometry(1,thickness,1),material);
 body.userData.liftThickness=thickness;
 setLiftBlockHeight(body,tileHeight(tile));return body;
}
export function setLiftBlockHeight(body,height){body.position.y=height-body.userData.liftThickness/2;}
