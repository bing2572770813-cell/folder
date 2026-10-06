import fs from 'node:fs/promises';
import path from 'node:path';

export type CatalogError = {file: string; message: string};
export type CatalogResult = {prefabs: unknown[]; tags: unknown[]; errors: CatalogError[]};

type NormalizeModule = {
  normalizePrefab(value: unknown): unknown & {id: string};
};
type TagModule = {
  normalizeTagPrefab(value: unknown): unknown & {id: string};
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function normalizers(): Promise<{tile: NormalizeModule; tag: TagModule}> {
  // The shared model modules remain ESM during the backend migration.
  // @ts-expect-error no declaration file exists for the existing .mjs module yet.
  const tile = await import('../../../entities/tile-model.mjs') as NormalizeModule;
  // @ts-expect-error no declaration file exists for the existing .mjs module yet.
  const tag = await import('../../../tags/tag-model.mjs') as TagModule;
  return {tile, tag};
}

async function jsonFiles(folder: string, subdir: string): Promise<Array<{file: string; name: string}>> {
  const source = path.join(folder, subdir);
  let entries;
  try {
    entries = await fs.readdir(source, {withFileTypes: true});
  } catch (error) {
    if (subdir && (error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(entry => ({file: path.join(source, entry.name), name: subdir ? `${subdir}/${entry.name}` : entry.name}));
}

async function readDefinition(file: string): Promise<unknown> {
  const stat = await fs.stat(file);
  if (stat.size > 128000) throw new Error('文件超过 128 KB');
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function readCatalog(folder: string): Promise<CatalogResult> {
  const {tile, tag} = await normalizers();
  const prefabs: unknown[] = [];
  const tags: unknown[] = [];
  const errors: CatalogError[] = [];
  const ids = new Set<string>();
  const files = [
    ...(await jsonFiles(folder, 'entity')),
    ...(await jsonFiles(folder, '')),
  ];
  for (const entry of files) {
    try {
      const prefab = tile.normalizePrefab(await readDefinition(entry.file));
      if (ids.has(prefab.id)) throw new Error(`实体 ID 重复：${prefab.id}`);
      ids.add(prefab.id);
      prefabs.push(prefab);
    } catch (error) {
      errors.push({file: entry.name, message: errorMessage(error)});
    }
  }

  const tagIds = new Set<string>();
  for (const entry of await jsonFiles(folder, 'tag')) {
    try {
      const value = tag.normalizeTagPrefab(await readDefinition(entry.file));
      if (tagIds.has(value.id)) throw new Error(`标签 ID 或行为重复：${value.id}`);
      tagIds.add(value.id);
      tags.push(value);
    } catch (error) {
      errors.push({file: entry.name, message: errorMessage(error)});
    }
  }
  return {prefabs, tags, errors};
}

export async function savePrefab(folder: string, data: unknown): Promise<unknown> {
  const {tile} = await normalizers();
  const prefab = tile.normalizePrefab(data);
  if (!prefab.id.endsWith('_ai')) throw new Error('后端生成的实体 ID 须以 _ai 结尾');
  const current = await readCatalog(folder);
  if (current.prefabs.some(value => (value as {id: string}).id === prefab.id)) throw new Error('实体 ID 已存在，请使用新 ID');
  const target = path.join(folder, 'entity');
  await fs.mkdir(target, {recursive: true});
  await fs.writeFile(path.join(target, `${prefab.id}.json`), `${JSON.stringify(prefab, null, 2)}\n`, {flag: 'wx'});
  return prefab;
}

export async function saveTagPrefab(folder: string, data: unknown): Promise<unknown> {
  const {tag} = await normalizers();
  const value = tag.normalizeTagPrefab(data);
  if (!value.id.endsWith('_ai')) throw new Error('后端生成的标签 ID 须以 _ai 结尾');
  const current = await readCatalog(folder);
  if (current.tags.some(entry => (entry as {id: string}).id === value.id)) throw new Error('标签 ID 或行为已存在');
  const target = path.join(folder, 'tag');
  await fs.mkdir(target, {recursive: true});
  await fs.writeFile(path.join(target, `${value.id}.json`), `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx'});
  return value;
}
