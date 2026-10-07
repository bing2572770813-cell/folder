const kindOf=cell=>cell.tags.exitTo?'exit':cell.tags.entry?'entry':null;

/** Static cell tags share two materials; instance cells retain picking identity. */
export function createTagMarkerBatches(THREE,cells,{geometry,textures,wx,wz,top}){
 const groups=new Map();
 for(const cell of cells){const kind=kindOf(cell);if(!kind)continue;const group=groups.get(kind)??[];group.push(cell);groups.set(kind,group);}
 return [...groups].map(([kind,cells])=>{
  const material=new THREE.MeshBasicMaterial({map:textures[kind],transparent:true,depthWrite:false,depthTest:false});
  const mesh=new THREE.InstancedMesh(geometry,material,cells.length);
  mesh.renderOrder=6;mesh.userData.cells=cells;mesh.userData.tagKind=kind;
  updateTagMarkerBatch(THREE,mesh,{wx,wz,top});return mesh;
 });
}

export function updateTagMarkerBatch(THREE,mesh,{wx,wz,top}){
 const matrix=new THREE.Matrix4(),position=new THREE.Vector3();
 const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2),scale=new THREE.Vector3(.4,.4,.4);
 mesh.userData.cells.forEach((cell,index)=>{
  position.set(wx(cell.c)-.27,top(cell)+.045,wz(cell.r));
  matrix.compose(position,rotation,scale);mesh.setMatrixAt(index,matrix);
 });
 mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
}
