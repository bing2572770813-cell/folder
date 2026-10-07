/** Render-only partitions. Cells and instance order remain available for picking. */
export function spatialCellBatches(cells,size=16){
 const batches=new Map();
 for(const cell of cells){
  const key=Math.floor(cell.r/size)+','+Math.floor(cell.c/size);
  const batch=batches.get(key)??[];batch.push(cell);batches.set(key,batch);
 }
 return [...batches.values()];
}

export function createSpatialInstances(THREE,{cells,geometry,material,matrixFor,size=16}){
 return spatialCellBatches(cells,size).map(batch=>{
  const mesh=new THREE.InstancedMesh(geometry,material,batch.length);
  mesh.userData.cells=batch;
  batch.forEach((cell,index)=>mesh.setMatrixAt(index,matrixFor(cell)));
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();return mesh;
 });
}
