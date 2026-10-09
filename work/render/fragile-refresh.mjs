// Build once with the scene; breaking a cell touches only its existing buffers.
export function createFragileRefresh(THREE,layers,{gridRanges=[],voidHeight=0,targets=null}={}){
 const cells=new Map(),zero=new THREE.Matrix4().makeScale(0,0,0);
 const allowed=targets&&new Set(targets.map(cell=>cell.r+','+cell.c));
 const add=(cell,update)=>{if(!cell)return;const key=cell.r+','+cell.c;if(allowed&&!allowed.has(key))return;const list=cells.get(key)??[];list.push(update);cells.set(key,list);};
 for(const layer of layers)for(const object of layer.children){
  if(object.isInstancedMesh){object.userData.cells?.forEach((cell,index)=>add(cell,()=>{object.setMatrixAt(index,zero);object.instanceMatrix.addUpdateRange(index*16,16);object.instanceMatrix.needsUpdate=true;}));continue;}
  const attribute=object.geometry?.attributes.position;
  const owners=object.userData.triangleCells??object.userData.segmentCells;
  if(attribute&&owners){const stride=object.userData.triangleCells?9:6;owners.forEach((cell,index)=>add(cell,()=>{attribute.array.fill(0,index*stride,(index+1)*stride);attribute.addUpdateRange(index*stride,stride);attribute.needsUpdate=true;}));}
  else add(object.userData.cell??object.userData.exitCell,()=>{object.visible=false;});
 }
 for(const range of gridRanges)add(range.cell,()=>{for(let i=range.start+1;i<range.end;i+=3)range.attribute.array[i]=voidHeight;range.attribute.addUpdateRange(range.start,range.end-range.start);range.attribute.needsUpdate=true;});
 return {remove(cell){const key=cell.r+','+cell.c;for(const update of cells.get(key)??[])update();}};
}
