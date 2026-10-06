import type {FastifyInstance} from 'fastify';
import {createApp, type AppDependencies} from './app.js';
import {loadBackendConfig, type BackendConfig} from './config.js';

export async function startServer(
  config: BackendConfig = loadBackendConfig(),
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const app = await createApp(config, dependencies);
  try {
    await app.listen({host: '127.0.0.1', port: config.port});
  } catch (error) {
    await app.close();
    throw error;
  }
  return app;
}

if (require.main === module) {
  startServer().then(app => {
    const address = app.server.address();
    console.log(`FOLD FIELD ready at http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`);
  }).catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
