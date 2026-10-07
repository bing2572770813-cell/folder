import * as THREE from "three";
import {tileHeight,tileThickness} from '../entities/tile-model.mjs';
import {isPaper} from './paper-surface.mjs';

export function tabletopHeight(map,hidden=()=>false){
  const heights=[];
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++){
    const tile=map.tiles[r]?.[c];
    if(isPaper(tile)&&!hidden(r,c))heights.push(tileHeight(tile)-tileThickness(tile));
  }
  return heights.length?Math.min(...heights):0;
}

// Temporary render transforms only. Static map cells are never mutated.
export function createFoldMotionView({ paper, layers, fixedLayers=[], playerGroup, wx, wz, canFold=()=>true }) {
  let session = null,prepared=null;
  const diagnostics={prepareMs:0,beginMs:0,reused:false};
  function dispose(target){
    if(!target)return;
    for(const geometry of target.geometries)geometry.dispose();
    for(const mesh of target.instances)mesh.dispose();
    target.fixed.removeFromParent();target.pivot.removeFromParent();
  }
  function reset() {
    if (!session) return;
    paper.attach(playerGroup);
    playerGroup.quaternion.copy(session.playerQuaternion);
    for (const [object, visible] of session.originals) object.visible = visible;
    session.fixed.removeFromParent();session.pivot.removeFromParent();
    session.pivot.quaternion.identity();
    if(prepared&&prepared!==session)dispose(prepared);
    prepared=session;session=null;
  }
  function invalidatePrepared(){if(!session){dispose(prepared);prepared=null;}}
  function signature(cells,hinge,hingeCells){
    const sources=layers.filter(layer=>!fixedLayers.includes(layer)&&layer.visible).map(layer=>[layer.uuid,layer.position.toArray(),layer.quaternion.toArray(),layer.scale.toArray(),layer.children.filter(o=>o.visible).map(o=>[o.uuid,o.geometry?.uuid,o.geometry?.index?.version,Object.values(o.geometry?.attributes??{}).map(a=>a.version),o.instanceMatrix?.version,o.count,o.position.toArray(),o.quaternion.toArray(),o.scale.toArray()])]);
    return JSON.stringify([cells,hinge,hingeCells,sources]);
  }
  function prepare(cells,hinge,hingeCells=[]){
    if(session)return false;
    const key=signature(cells,hinge,hingeCells);
    diagnostics.reused=prepared?.key===key;
    if(diagnostics.reused)return true;
    const start=performance.now();
    dispose(prepared);prepared=build(cells,hinge,hingeCells);prepared.key=key;
    diagnostics.prepareMs=performance.now()-start;
    return true;
  }
  function begin(cells,hinge,hingeCells=[]){
    const start=performance.now();
    reset();
    prepare(cells,hinge,hingeCells);session=prepared;prepared=null;
    session.playerQuaternion.copy(playerGroup.quaternion);
    for(const [object] of session.originals)object.visible=false;
    paper.add(session.fixed,session.pivot);session.pivot.attach(playerGroup);
    diagnostics.beginMs=performance.now()-start;
    return true;
  }
  function build(cells, hinge, hingeCells) {
    const selected = new Set(cells.map((p) => p.r + "," + p.c)),
      fixed = new THREE.Group(),
      pivot = new THREE.Group();
    pivot.position.fromArray(hinge.origin);
    const next = {
      fixed,
      pivot,
      originals: [],
      geometries: [],
      instances: [],
      playerQuaternion: playerGroup.quaternion.clone(),
      axis: new THREE.Vector3().fromArray(hinge.direction),
    };
    const creaseCells = new Set(hingeCells.map((p) => p.r + "," + p.c));
    // A fold uses a fixed snapshot: node lookup/structuredClone is per entity,
    // never per triangle of the same creased surface.
    const eligibility=new Map();
    const foldable=cell=>{const key=cell?.nodeId??(cell?cell.r+','+cell.c:null);if(!eligibility.has(key))eligibility.set(key,canFold(cell));return eligibility.get(key);};

    const side = (x, z) =>
      ((x - hinge.origin[0]) * hinge.direction[2] -
        (z - hinge.origin[2]) * hinge.direction[0]) *
      hinge.side;
    const selectedPosition = (x, z) => {
      const key = Math.round(wzInverse(z)) + "," + Math.round(wxInverse(x));
      return selected.has(key) || (creaseCells.has(key) && side(x, z) > 1e-8);
    };
    // Inverse of the editor's centered cell coordinates.
    const wxInverse = (x) => x - wx(0),
      wzInverse = (z) => z - wz(0);
    function add(object, moving) {
      (moving ? pivot : fixed).add(object);
      if (moving) object.position.sub(pivot.position);
    }
    for (const layer of layers) {
      if(fixedLayers.includes(layer))continue;
      if (!layer.visible) continue;
      for (const object of [...layer.children]) {
        if (!object.visible) continue;
        next.originals.push([object, object.visible]);
        if (object.isInstancedMesh) {
          const matrix = new THREE.Matrix4();
          const batches=[[],[]];
          for (let i = 0; i < object.count; i++) {
            object.getMatrixAt(i, matrix);
            const cell = object.userData.cells?.[i];
            if (cell && foldable(cell) && creaseCells.has(cell.r + "," + cell.c)) {
              const mesh = new THREE.Mesh(
                object.geometry.clone().applyMatrix4(matrix),
                object.material,
              );
              mesh.userData.triangleCells = Array.from(
                {
                  length:
                    (mesh.geometry.index?.count ??
                      mesh.geometry.attributes.position.count) / 3,
                },
                () => cell,
              );
              mesh.castShadow = object.castShadow;
              mesh.receiveShadow = object.receiveShadow;
              splitObject(mesh);
              mesh.geometry.dispose();
            } else {
              const moving=foldable(cell)&&(cell?selected.has(cell.r+','+cell.c):selectedPosition(matrix.elements[12],matrix.elements[14]));
              batches[Number(moving)].push(matrix.clone());
            }
          }
          batches.forEach((matrices,moving)=>{
            if(!matrices.length)return;
            const mesh=new THREE.InstancedMesh(object.geometry,object.material,matrices.length);
            matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;
            mesh.castShadow=object.castShadow;mesh.receiveShadow=object.receiveShadow;mesh.renderOrder=object.renderOrder;
            next.instances.push(mesh);add(mesh,!!moving);
          });
          continue;
        }
        if (object.userData.triangleCells || object.isLineSegments) {
          splitObject(object);
          continue;
        }
        const clone = object.clone(true);
        if(layer.position.lengthSq()>0){clone.position.add(layer.position);clone.quaternion.premultiply(layer.quaternion);}
        clone.visible = true;
        add(clone, foldable(object.userData.cell)&&selectedPosition(clone.position.x, clone.position.z));
      }
    }
    function splitObject(object) {
      const geometry = object.geometry,
        index = geometry.index,
        position = geometry.attributes.position,
        primitive = object.isLineSegments ? 2 : 3,
        split = [{count:0}, {count:0}];
      const attributes=Object.entries(geometry.attributes),capacity=(index?.count??position.count)*2;
      const storage=(bucket,name,size)=>bucket[name]??=(new Float32Array(capacity*size));
      const appendIndices=(bucket,indices)=>{
        for(const [name,attribute] of attributes){
          const size=attribute.itemSize,values=storage(bucket,name,size),array=attribute.array;let offset=bucket.count*size;
          for(const vertex of indices)for(let j=0;j<size;j++)values[offset++]=array[vertex*size+j];
        }
        bucket.count+=indices.length;
      };
      const append=(bucket,vertices)=>{
        for(const [name,attribute] of attributes){
          const size=attribute.itemSize,values=storage(bucket,name,size);let offset=bucket.count*size;
          for(const vertex of vertices)for(let j=0;j<size;j++)values[offset++]=vertex[name][j];
        }
        bucket.count+=vertices.length;
      };
      for (let i = 0; i < (index?.count ?? position.count); i += primitive) {
        const indices=primitive===2?[i,i+1]:[i,i+1,i+2];
        if(index)for(let j=0;j<primitive;j++)indices[j]=index.getX(indices[j]);
        const cell=primitive===2?object.userData.segmentCells?.[i/2]:object.userData.triangleCells?.[i/3];
        if(!foldable(cell)){appendIndices(split[0],indices);continue;}
        let key;
        if(cell)key=cell.r+','+cell.c;
        else{let x=0,z=0;for(const k of indices){x+=position.getX(k);z+=position.getZ(k);}key=Math.round(wzInverse(z/primitive))+','+Math.round(wxInverse(x/primitive));}
        if(!creaseCells.has(key)){
          appendIndices(split[Number(selected.has(key))],indices);
          continue;
        }
        const distances=indices.map(k=>side(position.getX(k),position.getZ(k))),min=Math.min(...distances),max=Math.max(...distances);
        // Most triangles in an axis cell are wholly on one side. Copy their
        // typed attributes directly; only intersected faces need vertex objects.
        if(min>=0){appendIndices(split[1],indices);if(max===0)appendIndices(split[0],indices);continue;}
        if(max<=0){appendIndices(split[0],indices);continue;}
        const vertices=indices.map(k=>Object.fromEntries(attributes.map(([name,a])=>[name,Array.from(a.array.subarray(k*a.itemSize,(k+1)*a.itemSize))])));
        for(let moving=0;moving<2;moving++){
          const polygon=clipFoldPolygon(vertices,v=>side(v.position[0],v.position[2]),!!moving);
          if(primitive===2){if(polygon.length>=2)append(split[moving],polygon.slice(0,2));}
          else for(let j=1;j<polygon.length-1;j++)append(split[moving],[polygon[0],polygon[j],polygon[j+1]]);
        }
      }
      split.forEach((bucket, moving) => {
        if (!bucket.count) return;
        const g = new THREE.BufferGeometry();
        for(const [name,attribute] of attributes)g.setAttribute(name,new THREE.BufferAttribute(bucket[name].slice(0,bucket.count*attribute.itemSize),attribute.itemSize));
        next.geometries.push(g);
        const clone = object.isLineSegments
          ? new THREE.LineSegments(g, object.material)
          : new THREE.Mesh(g, object.material);
        clone.castShadow = object.castShadow;
        clone.receiveShadow = object.receiveShadow;
        clone.renderOrder = object.renderOrder;
        add(clone, !!moving);
      });
    }
    return next;
  }
  function setAngle(angle) {
    if (session) session.pivot.quaternion.setFromAxisAngle(session.axis, angle);
  }
  function playerPosition() {
    return playerGroup.getWorldPosition(new THREE.Vector3()).toArray();
  }
  // The model's anchor is 0.018 above its supporting surface.
  function footPosition(){return playerGroup.localToWorld(new THREE.Vector3(0,-.018,0)).toArray();}
  return { begin, prepare, invalidatePrepared, setAngle, playerPosition, footPosition, reset, active: () => !!session, stats:()=>({...diagnostics}) };
}

export function clipFoldPolygon(vertices, distance, positive) {
  const result = [],
    sign = positive ? 1 : -1;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i],
      b = vertices[(i + 1) % vertices.length],
      da = distance(a) * sign,
      db = distance(b) * sign;
    if (da >= 0) result.push(a);
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db);
      result.push(
        Object.fromEntries(
          Object.keys(a).map((key) => [
            key,
            a[key].map((v, j) => v + (b[key][j] - v) * t),
          ]),
        ),
      );
    }
  }
  return result;
}

export function hingeFor(map, group, wx, wz, tableHeight=tabletopHeight(map)) {
  const direction = new THREE.Vector3(
    group.to.c - group.from.c,
    0,
    group.to.r - group.from.r,
  ).normalize();
  return {
    origin: [wx(group.center.c), tableHeight, wz(group.center.r)],
    direction: direction.toArray(),
  };
}
