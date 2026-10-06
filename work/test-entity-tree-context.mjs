import assert from 'node:assert/strict';
import { entityTreeContext, entityParentChoices } from './ui/entity-tree-context.mjs';
import { TransformManager } from './backend/dist/entities/transform-manager.js';
import { EntityWorld } from './backend/dist/entities/entity-world.js';

const transforms = new TransformManager(8, 8, [
  ['grandchild', 'child', 0, 1], ['child', 'parent', 0, 1],
  ['sibling', 'parent', 1, 0], ['parent', null, 2, 2],
  ['overlay', null, 2, 3], ['unrelated', null, 6, 6],
].map(([id, parentId, r, c]) => ({ id, parentId, local: { r, c, dir: 0 }, footprint: { width: 1, height: 1, occupied: [true] } })));
const nodes = ['grandchild', 'child', 'sibling', 'parent', 'overlay', 'unrelated'].map(id => ({
  id, transformId: id, prefabId: 'paper_ai', components: {}, tags: {}, static: {},
}));
nodes.push({ ...nodes[1], id: 'shared-child' });
const world = new EntityWorld(transforms, nodes);
const rows = entityTreeContext(world, 'child', { r: 2, c: 3 });
assert.deepEqual(rows.map(row => row.id), ['parent', 'child', 'shared-child', 'grandchild', 'overlay']);
assert.deepEqual(rows.map(row => row.depth), [0, 1, 1, 2, 0]);
assert.deepEqual(rows.filter(row => row.colocated).map(row => row.id), ['child', 'shared-child', 'overlay']);
assert.deepEqual(entityTreeContext(world, null, { r: 2, c: 3 }), []);
assert.deepEqual(entityTreeContext(world, 'deleted', null), []);
assert.deepEqual(entityTreeContext(world, 'overlay', null).map(row => row.id), ['overlay']);
assert.deepEqual(entityParentChoices(world, 'child').map(node => node.id), ['sibling', 'parent', 'overlay', 'unrelated']);
assert.deepEqual(entityParentChoices(world, 'parent').map(node => node.id), ['overlay', 'unrelated']);
console.log('PASS entity inspector hierarchy and clicked context');
