import {paperSurface} from './paper-surface.mjs';
import {createLiftBlock} from './lift-block.mjs';

/** Render the validated candidate with the same shell geometry as the map. */
export function createSurfacePreview(THREE,map,{r,c,tile},material,hidden=()=>false){
 const surface=paperSurface(map,r,c,hidden);
 if(!surface)return createLiftBlock(THREE,tile,material);
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(surface.positions,3));
 geometry.computeVertexNormals();
 return new THREE.Mesh(geometry,material);
}
