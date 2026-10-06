// Shared pure TypeScript models, bundled for browsers without backend filesystem modules.
export {TransformManager} from '../backend/src/entities/transform-manager.ts';
export {EntityWorld} from '../backend/src/entities/entity-world.ts';
export {validateEntityTags} from '../backend/src/entities/entity-model.ts';
export {PrefabRegistry} from '../backend/src/entities/prefab-definition.ts';
export {ComponentRegistry,defaultComponents} from '../backend/src/entities/components.ts';
export {importTreeMap,serializeTreeMap} from '../backend/src/entities/tree-serialization.ts';
export {validateTerrainStacking} from '../backend/src/entities/terrain-stacking.ts';
