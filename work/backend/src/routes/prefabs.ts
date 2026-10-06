import type {FastifyInstance} from 'fastify';
import type {BackendConfig} from '../config.js';
import type {CatalogResult} from '../resources/catalog.js';

export type CatalogReader = (folder: string) => Promise<CatalogResult>;

export async function registerPrefabRoutes(
  app: FastifyInstance,
  config: BackendConfig,
  readCatalog: CatalogReader,
): Promise<void> {
  app.route({
    method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    url: '/api/prefabs',
    handler: async (request, reply) => {
      reply.header('Cache-Control', 'no-store');
      if (request.method !== 'GET') return reply.code(405).send({error: '方法无效'});
      try {
        return await readCatalog(config.prefabRoot);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.code(400).send({error: message});
      }
    },
  });
}
