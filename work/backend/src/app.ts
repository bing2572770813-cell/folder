import Fastify, {type FastifyInstance} from 'fastify';
import {loadBackendConfig, type BackendConfig} from './config.js';
import {readCatalog, type CatalogResult} from './resources/catalog.js';
import {registerPrefabRoutes, type CatalogReader} from './routes/prefabs.js';
import {registerStaticRoutes} from './routes/static-files.js';

export type AppDependencies = {
  readCatalog?: CatalogReader;
};

export async function createApp(
  config: BackendConfig = loadBackendConfig(),
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const app = Fastify({logger: false});
  const catalog = dependencies.readCatalog ?? readCatalog;
  await registerPrefabRoutes(app, config, catalog);
  await registerStaticRoutes(app, config);
  return app;
}

export type {CatalogResult};
