import {jsonObject, type JsonObject} from '../entities/entity-model.js';

/** Common catalog metadata; optional prefab fields remain extensible JSON. */
export type CatalogDefinition = JsonObject & {version: 1; id: string; name: string};

export function catalogDefinition(value: unknown): CatalogDefinition {
  const definition = jsonObject(value);
  if (definition.version !== 1 || typeof definition.id !== 'string'
    || !/^[a-zA-Z0-9_-]{1,80}$/.test(definition.id)
    || typeof definition.name !== 'string' || !definition.name.trim()) {
    throw new Error('Invalid normalized catalog definition');
  }
  return {...definition, version: 1, id: definition.id, name: definition.name};
}

/** All imports of the shared ESM normalizers are confined to this adapter. */
export async function sharedNormalizers() {
  const [tile, tag] = await Promise.all([
    import('../../../entities/tile-model.mjs'),
    import('../../../tags/tag-model.mjs'),
  ]);
  return {
    normalizePrefab: (value: unknown) => catalogDefinition(tile.normalizePrefab(value)),
    normalizeTagPrefab: (value: unknown) => catalogDefinition(tag.normalizeTagPrefab(value)),
  };
}
