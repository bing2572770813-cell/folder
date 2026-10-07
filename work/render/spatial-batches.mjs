/** Render-only partitions. Cells and instance order remain available for picking. */
export const spatialCellKey=(cell,size=16)=>Math.floor(cell.r/size)+','+Math.floor(cell.c/size);
export function spatialCellBatches(cells,size=16){
 const batches=new Map();
 for(const cell of cells){
  const key=spatialCellKey(cell,size);
  const batch=batches.get(key)??[];batch.push(cell);batches.set(key,batch);
 }
 return [...batches.values()];
}

/** Preserve the generated shell exactly, partitioning only its render buffers. */
export function createSurfaceBatchCollector({wx,wz,size=16}){
 const colors=new Map();
 function add(cell,surface){
  const color=cell.tile.color??'white',key=spatialCellKey(cell,size);
  const chunks=colors.get(color)??new Map();colors.set(color,chunks);
  const bucket=chunks.get(key)??{positions:[],triangleCells:[],cells:[]};chunks.set(key,bucket);
  bucket.cells.push(cell);
  const x=wx(cell.c),z=wz(cell.r);
  for(let i=0;i<surface.positions.length;i+=3)bucket.positions.push(surface.positions[i]+x,surface.positions[i+1],surface.positions[i+2]+z);
  for(let i=0;i<surface.positions.length/9;i++)bucket.triangleCells.push(cell);
 }
 function meshes(THREE,materialFor){
  const result=[];
  for(const [color,chunks] of colors)for(const bucket of chunks.values()){
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(bucket.positions,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
   const mesh=new THREE.Mesh(geometry,materialFor(color));mesh.userData.triangleCells=bucket.triangleCells;mesh.userData.surfaceCells=bucket.cells;result.push(mesh);
  }
  return result;
 }
 return {add,meshes};
}

export function createSpatialInstances(THREE,{cells,geometry,material,matrixFor,size=16}){
 return spatialCellBatches(cells,size).map(batch=>{
  const mesh=new THREE.InstancedMesh(geometry,material,batch.length);
  mesh.userData.cells=batch;
  batch.forEach((cell,index)=>mesh.setMatrixAt(index,matrixFor(cell)));
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();return mesh;
 });
}
