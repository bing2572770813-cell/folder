export function createMechanics() {
  const registry = new Map();
  return {
    register(mechanic) {
      if (!mechanic || typeof mechanic.id !== 'string' || typeof mechanic.actions !== 'function') throw new Error('机制必须提供 id 和 actions');
      registry.set(mechanic.id, mechanic);
      return this;
    },
    get(id) { return registry.get(id); },
    list() { return [...registry.values()]; },
    actions(context) { return [...registry.values()].flatMap(mechanic => mechanic.actions(context).map(action => ({ ...action, mechanic: mechanic.id }))); },
    validate(context) { return [...registry.values()].flatMap(mechanic => mechanic.validate ? mechanic.validate(context) : []); },
  };
}

export const movementMechanic = {
  id: 'movement',
  label: '八向移动',
  actions({ map, position }) {
    const actions = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = position.r + dr, c = position.c + dc;
      if (r >= 0 && c >= 0 && r < map.height && c < map.width && map.tiles[r][c] && map.tiles[r][c].color !== 'black') actions.push({ kind: 'move', from: { ...position }, to: { r, c } });
    }
    return actions;
  },
};

export function createMechanicContext(map, position, state = {}) { return { map, position, state }; }
