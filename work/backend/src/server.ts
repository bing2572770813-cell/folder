import type {FastifyInstance} from 'fastify';
import {createApp, type AppDependencies} from './app.js';
import {loadBackendConfig, type BackendConfig} from './config.js';

interface ShutdownSignals {
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
  off(event: 'SIGINT' | 'SIGTERM', listener: () => void): unknown;
}

function reportFailure(error: unknown): void {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

/** Only executable entry points install process handlers; createApp/startServer stay reusable. */
export function installShutdownHandlers(
  app: FastifyInstance,
  signals: ShutdownSignals = process,
  onError: (error: unknown) => void = reportFailure,
): () => void {
  let closing = false;
  const remove = () => {
    signals.off('SIGINT', shutdown);
    signals.off('SIGTERM', shutdown);
    app.server.off('close', remove);
  };
  const shutdown = () => {
    if (closing) return;
    closing = true;
    void app.close().catch(error => {remove(); onError(error);});
  };
  signals.on('SIGINT', shutdown);
  signals.on('SIGTERM', shutdown);
  app.server.once('close', remove);
  return remove;
}

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

export async function runServer(
  config: BackendConfig = loadBackendConfig(),
  dependencies: AppDependencies = {},
): Promise<FastifyInstance> {
  const app = await startServer(config, dependencies);
  installShutdownHandlers(app);
  const address = app.server.address();
  console.log(`FOLD FIELD ready at http://127.0.0.1:${typeof address === 'object' && address ? address.port : ''}`);
  return app;
}

if (require.main === module) void runServer().catch(reportFailure);
