// A transient inspector projection; TransformManager remains the hierarchy owner.
export function entityTreeContext(world, selectedId, point) {
  if (!selectedId || !world.has(selectedId)) return [];
  const selected = world.get(selectedId);
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
  const sameCell=point?world.at(point.r,point.c):[];
  const colocated = new Set(sameCell.map(node=>node.id));
  for (const node of sameCell) ancestors(node.transformId);
  const rows = [];
  const visit = (id, depth) => {
    if (!included.has(id)) return;
    for (const node of world.forTransform(id)) {
      rows.push({ ...node, depth, colocated: colocated.has(node.id) });
    }
    for (const child of world.transforms.childrenOf(id)) visit(child, depth + 1);
  };
  for (const id of world.transforms.orderedIds(included)) if (world.transforms.get(id).parentId === null) visit(id, 0);
  return rows;
}

export function entityParentChoices(world, selectedId) {
  const node = world.get(selectedId);
  const excluded = new Set();
  const visit = id => {
    excluded.add(id);
    for (const child of world.transforms.childrenOf(id)) visit(child);
  };
  visit(node.transformId);
  return world.serialize().filter(other => !excluded.has(other.transformId));
}
