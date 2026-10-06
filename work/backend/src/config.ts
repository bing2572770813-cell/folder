import path from 'node:path';

export type BackendConfig = {
  port: number;
  outputRoot: string;
  prefabRoot: string;
};

type BackendRoots = {
  workRoot: string;
  outputRoot?: string;
  prefabRoot?: string;
};

const DEFAULT_PORT = 4173;

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === '') return DEFAULT_PORT;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('FOLD_PORT must be an integer from 1 to 65535');
  }
  return port;
}

export function loadBackendConfig(
  env: NodeJS.ProcessEnv = process.env,
  roots: BackendRoots = {workRoot: path.resolve(__dirname, '../..')},
): BackendConfig {
  const workRoot = path.resolve(roots.workRoot);
  return {
    port: parsePort(env.FOLD_PORT),
    outputRoot: path.resolve(roots.outputRoot ?? path.join(workRoot, '../outputs')),
    prefabRoot: path.resolve(roots.prefabRoot ?? path.join(workRoot, '../assets/prefab')),
  };
}
