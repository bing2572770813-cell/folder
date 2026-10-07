import * as THREE from "three";
import tableAsset from "../../assets/model/boardgame_table_ai.json" with { type: "json" };

/** Blender-authored scenery, bundled as geometry so saved standalone games work. */
export function createTableScene() {
  const group = new THREE.Group();
  group.name = "boardgame-table";
  group.userData.source = tableAsset.source;
  for (const part of tableAsset.meshes) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(part.positions, 3),
    );
    geometry.setAttribute(
      "normal",
      new THREE.Float32BufferAttribute(part.normals, 3),
    );
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const material = new THREE.MeshStandardMaterial({
      color: part.color,
      roughness: 0.86,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = part.name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  /** Surface Y is selected by the caller from the map's lowest paper underside. */
  function layout(width, height, surfaceY = 0) {
    const w = Math.max(1, Number(width) || 1);
    const h = Math.max(1, Number(height) || 1);
    const margin = 2.4;
    const verticalScale = Math.max(0.7, Math.sqrt(Math.max(w, h) / 10));
    group.scale.set((w + margin) / 10, verticalScale, (h + margin) / 10);
    group.position.set(0, Number.isFinite(surfaceY) ? surfaceY : 0, 0);
    group.updateMatrixWorld(true);
  }

  function dispose() {
    group.removeFromParent();
    for (const mesh of group.children) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    group.clear();
  }

  layout(10, 10);
  return { group, layout, dispose };
}
