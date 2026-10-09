const keyOf=cell=>cell.r+','+cell.c;

/** Scene-owned lookup: rebuild it with the scene, append patches, discard on reset. */
export function createCellRefresh(THREE,{dispose}){
 const entries=new Map(),materialUses=new Map(),zero=new THREE.Matrix4().makeScale(0,0,0);
 const materials=object=>{const result=[];object.traverse(child=>{if(child.material)result.push(...(Array.isArray(child.material)?child.material:[child.material]));});return result;};
 function add(objects){
  for(const object of objects){
   for(const material of materials(object))materialUses.set(material,(materialUses.get(material)??0)+1);
   const groups=new Map();
   const own=(cell,index)=>{if(!cell)return;const key=keyOf(cell),indices=groups.get(key)??[];indices.push(index);groups.set(key,indices);};
   const attribute=object.geometry?.attributes.position;
   const owners=object.isInstancedMesh?object.userData.cells:object.userData.segmentCells??object.userData.triangleCells;
   if(owners)owners.forEach(own);else own(object.userData.cell??object.userData.exitCell,0);
   const remaining=new Set(groups.keys());
   for(const [key,indices] of groups){
    const list=entries.get(key)??[];
    list.push(()=>{
     remaining.delete(key);
     if(!remaining.size){
      for(const material of materials(object)){const uses=materialUses.get(material)-1;if(uses)materialUses.set(material,uses);else materialUses.delete(material);}
      object.removeFromParent();dispose(object,new Set(materialUses.keys()));return;
     }
     if(object.isInstancedMesh){
      object.userData.removedInstances??=new Set();
      for(const index of indices){object.setMatrixAt(index,zero);object.instanceMatrix.addUpdateRange(index*16,16);object.userData.removedInstances.add(index);}
      object.instanceMatrix.needsUpdate=true;
     }else if(attribute){
      const stride=object.isLineSegments?6:9;
      for(const index of indices){attribute.array.fill(0,index*stride,(index+1)*stride);attribute.addUpdateRange(index*stride,stride);}
      attribute.needsUpdate=true;
      if(object.userData.surfaceCells)object.userData.surfaceCells=object.userData.surfaceCells.filter(cell=>keyOf(cell)!==key);
     }
    });entries.set(key,list);
   }
  }
 }
 return {add,remove(cells){for(const cell of cells){const key=keyOf(cell);for(const remove of entries.get(key)??[])remove();entries.delete(key);}}};
}

/** Height/connectivity edits affect adjacent paper seams; color/overlay edits do not. */
export function placementRefreshCells(beforeMap,document,footprint,dependencies=[]){
 const cells=new Map([...footprint,...dependencies].map(cell=>[keyOf(cell),cell]));
 const projected=document.viewCells(footprint);
 const geometry=tile=>JSON.stringify(tile?[tile.height,tile.thickness,tile.gradualRate,tile.surfaceConnected,tile.blocked,tile.lift,tile.folds]:null);
 for(const cell of footprint){
  if(geometry(beforeMap.tiles[cell.r]?.[cell.c])===geometry(projected.get(keyOf(cell))))continue;
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
   const neighbor={r:cell.r+dr,c:cell.c+dc};
   if(neighbor.r>=0&&neighbor.c>=0&&neighbor.r<beforeMap.height&&neighbor.c<beforeMap.width)cells.set(keyOf(neighbor),neighbor);
  }
 }
 return [...cells.values()];
}
