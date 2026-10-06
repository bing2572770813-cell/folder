// A transient inspector projection; TransformManager remains the hierarchy owner.
export function entityTreeContext(world, selectedId, point) {
  const nodes = world.serialize();
  const selected = nodes.find(node => node.id === selectedId);
  if (!selected) return [];
  const transforms = world.transforms.serialize();
  const included = new Set();
  const ancestors = id => {
    while (id !== null) {
      included.add(id);
      id = world.transforms.get(id).parentId;
    }
  };
  const descendants = id => {
    included.add(id);
    for (const child of world.transforms.childrenOf(id)) descendants(child);
  };
  ancestors(selected.transformId);
  descendants(selected.transformId);
  const colocated = new Set(point ? world.at(point.r, point.c).map(node => node.id) : []);
  for (const node of nodes) if (colocated.has(node.id)) ancestors(node.transformId);
  const rows = [];
  const visit = (id, depth) => {
    if (!included.has(id)) return;
    for (const node of nodes.filter(node => node.transformId === id)) {
      rows.push({ ...node, depth, colocated: colocated.has(node.id) });
    }
    for (const child of world.transforms.childrenOf(id)) visit(child, depth + 1);
  };
  for (const transform of transforms) if (transform.parentId === null) visit(transform.id, 0);
  return rows;
}
