export const cloneProject = value => JSON.parse(JSON.stringify(value));

export function createLevel(map, id = `level-${Date.now()}`) {
  return { id, name: map.name || '未命名关卡', category: 'practice', map: cloneProject(map), notes: '', snapshots: [] };
}

export function normalizeProject(input) {
  if (!input || input.version !== 1 || !Array.isArray(input.levels) || !input.levels.length) throw new Error('关卡组至少需要一个关卡');
  const ids = new Set();
  const levels = input.levels.map((level) => {
    if (!level || typeof level.id !== 'string' || !level.id.trim() || ids.has(level.id)) throw new Error('关卡 ID 无效或重复');
    if (!level.map) throw new Error('关卡数据缺失：' + level.id);
    ids.add(level.id);
    return {
      id: level.id,
      name: typeof level.name === 'string' && level.name.trim() ? level.name.trim().slice(0, 48) : '未命名关卡',
      category: ['teaching', 'practice', 'challenge'].includes(level.category) ? level.category : 'practice',
      map: cloneProject(level.map),
      notes: typeof level.notes === 'string' ? level.notes.slice(0, 2000) : '',
      snapshots: Array.isArray(level.snapshots) ? cloneProject(level.snapshots).slice(-20) : [],
    };
  });
  return { version: 1, name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : '折纸关卡组', activeId: ids.has(input.activeId) ? input.activeId : levels[0].id, levels };
}

export function duplicateLevel(project, id) {
  const source = project.levels.find(level => level.id === id);
  if (!source) throw new Error('找不到关卡');
  const copy = cloneProject(source);
  copy.id = `${id}-copy-${Date.now()}`;
  copy.name = `${copy.name} 副本`;
  const index = project.levels.indexOf(source);
  project.levels.splice(index + 1, 0, copy);
  project.activeId = copy.id;
  return copy;
}

export function removeLevel(project, id) {
  if (project.levels.length <= 1) throw new Error('至少保留一个关卡');
  const index = project.levels.findIndex(level => level.id === id);
  if (index < 0) throw new Error('找不到关卡');
  project.levels.splice(index, 1);
  if (project.activeId === id) project.activeId = project.levels[Math.min(index, project.levels.length - 1)].id;
}

export function moveLevel(project, id, direction) {
  const index = project.levels.findIndex(level => level.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= project.levels.length) return;
  [project.levels[index], project.levels[next]] = [project.levels[next], project.levels[index]];
}

export function snapshotLevel(level, label = '手动快照') {
  if (!level) throw new Error('找不到关卡');
  level.snapshots.push({ label: String(label).trim().slice(0, 48) || '手动快照', createdAt: new Date().toISOString(), map: cloneProject(level.map) });
  if (level.snapshots.length > 20) level.snapshots.shift();
  return level.snapshots[level.snapshots.length - 1];
}
