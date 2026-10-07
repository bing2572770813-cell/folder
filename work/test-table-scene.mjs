import assert from "node:assert/strict";
import * as THREE from "three";
import { createTableScene } from "./render/table-scene.mjs";

const table = createTableScene();
assert.equal(table.group.children.length, 4);
assert.ok(table.group.userData.source.endsWith("boardgame_table_ai.blend"));
let triangles = 0;
for (const mesh of table.group.children) {
  triangles += mesh.geometry.attributes.position.count / 3;
  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, true);
  const normals = mesh.geometry.attributes.normal;
  for (let i = 0; i < normals.count; i++) {
    assert.ok(
      Math.abs(
        Math.hypot(normals.getX(i), normals.getY(i), normals.getZ(i)) - 1,
      ) < 1e-5,
    );
  }
}
assert.ok(triangles < 1200, "low-poly scenery stays below 1200 triangles");
for (const [width, height, surfaceY] of [
  [14, 10, -0.2],
  [1, 1, -1],
  [128, 64, 0.5],
]) {
  table.layout(width, height, surfaceY);
  const bounds = new THREE.Box3().setFromObject(table.group);
  assert.ok(
    Math.abs(bounds.max.y - surfaceY) < 1e-5,
    "tabletop aligns with supplied underside height",
  );
  assert.ok(bounds.min.x < -width / 2 && bounds.max.x > width / 2);
  assert.ok(bounds.min.z < -height / 2 && bounds.max.z > height / 2);
  assert.ok(bounds.min.y < surfaceY, "legs stay below table surface");
}
table.dispose();
assert.equal(table.group.children.length, 0);
console.log("table scene tests passed");
