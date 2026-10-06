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
export function createFoldMotionView({ paper, layers, playerGroup, wx, wz }) {
  let session = null;
  function reset() {
    if (!session) return;
    paper.attach(playerGroup);
    playerGroup.quaternion.copy(session.playerQuaternion);
    for (const [object, visible] of session.originals) object.visible = visible;
    for (const geometry of session.geometries) geometry.dispose();
    for (const mesh of session.instances) mesh.dispose();
    session.fixed.removeFromParent();
    session.pivot.removeFromParent();
    session = null;
  }
  function begin(cells, hinge, hingeCells = []) {
    reset();
    const selected = new Set(cells.map((p) => p.r + "," + p.c)),
      fixed = new THREE.Group(),
      pivot = new THREE.Group();
    paper.add(fixed, pivot);
    pivot.position.fromArray(hinge.origin);
    session = {
      fixed,
      pivot,
      originals: [],
      geometries: [],
      instances: [],
      playerQuaternion: playerGroup.quaternion.clone(),
      axis: new THREE.Vector3().fromArray(hinge.direction),
    };
    const creaseCells = new Set(hingeCells.map((p) => p.r + "," + p.c));
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
      if (!layer.visible) continue;
      for (const object of [...layer.children]) {
        if (!object.visible) continue;
        session.originals.push([object, object.visible]);
        object.visible = false;
        if (object.isInstancedMesh) {
          const matrix = new THREE.Matrix4();
          const batches=[[],[]];
          for (let i = 0; i < object.count; i++) {
            object.getMatrixAt(i, matrix);
            const cell = object.userData.cells?.[i];
            if (cell && creaseCells.has(cell.r + "," + cell.c)) {
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
              const moving=cell?selected.has(cell.r+','+cell.c):selectedPosition(matrix.elements[12],matrix.elements[14]);
              batches[Number(moving)].push(matrix.clone());
            }
          }
          batches.forEach((matrices,moving)=>{
            if(!matrices.length)return;
            const mesh=new THREE.InstancedMesh(object.geometry,object.material,matrices.length);
            matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));mesh.instanceMatrix.needsUpdate=true;
            mesh.castShadow=object.castShadow;mesh.receiveShadow=object.receiveShadow;mesh.renderOrder=object.renderOrder;
            session.instances.push(mesh);add(mesh,!!moving);
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
        add(clone, selectedPosition(clone.position.x, clone.position.z));
      }
    }
    function splitObject(object) {
      const geometry = object.geometry,
        index = geometry.index,
        position = geometry.attributes.position,
        primitive = object.isLineSegments ? 2 : 3,
        split = [{}, {}];
      for (let i = 0; i < (index?.count ?? position.count); i += primitive) {
        const indices = Array.from({ length: primitive }, (_, j) =>
          index ? index.getX(i + j) : i + j,
        );
        const cell = object.userData.triangleCells?.[i / 3];
        const x = indices.reduce((n, k) => n + position.getX(k), 0) / primitive,
          z = indices.reduce((n, k) => n + position.getZ(k), 0) / primitive;
        const key = cell
          ? cell.r + "," + cell.c
          : Math.round(wzInverse(z)) + "," + Math.round(wxInverse(x));
        const vertices = indices.map((k) =>
          Object.fromEntries(
            Object.entries(geometry.attributes).map(([name, a]) => [
              name,
              Array.from(a.array.slice(k * a.itemSize, (k + 1) * a.itemSize)),
            ]),
          ),
        );
        if (creaseCells.has(key) && primitive === 3) {
          for (let moving = 0; moving < 2; moving++) {
            const polygon = clipFoldPolygon(
              vertices,
              (v) => side(v.position[0], v.position[2]),
              !!moving,
            );
            for (let j = 1; j < polygon.length - 1; j++)
              append(split[moving], [polygon[0], polygon[j], polygon[j + 1]]);
          }
        } else
          append(
            split[Number(cell ? selected.has(key) : selectedPosition(x, z))],
            vertices,
          );
      }
      split.forEach((bucket, moving) => {
        if (!bucket.position?.length) return;
        const g = new THREE.BufferGeometry();
        for (const [name, values] of Object.entries(bucket))
          g.setAttribute(
            name,
            new THREE.Float32BufferAttribute(
              values,
              geometry.attributes[name].itemSize,
            ),
          );
        session.geometries.push(g);
        const clone = object.isLineSegments
          ? new THREE.LineSegments(g, object.material)
          : new THREE.Mesh(g, object.material);
        clone.castShadow = object.castShadow;
        clone.receiveShadow = object.receiveShadow;
        clone.renderOrder = object.renderOrder;
        add(clone, !!moving);
      });
    }
    function append(bucket, vertices) {
      for (const vertex of vertices)
        for (const [name, values] of Object.entries(vertex)) {
          bucket[name] ??= [];
          bucket[name].push(...values);
        }
    }
    pivot.attach(playerGroup);
    return true;
  }
  function setAngle(angle) {
    if (session) session.pivot.quaternion.setFromAxisAngle(session.axis, angle);
  }
  function playerPosition() {
    return playerGroup.getWorldPosition(new THREE.Vector3()).toArray();
  }
  // The model's anchor is 0.018 above its supporting surface.
  function footPosition(){return playerGroup.localToWorld(new THREE.Vector3(0,-.018,0)).toArray();}
  return { begin, setAngle, playerPosition, footPosition, reset, active: () => !!session };
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
