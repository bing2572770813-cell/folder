import path from 'node:path';
import type {FastifyInstance} from 'fastify';
import type {BackendConfig} from '../config.js';
import {readStaticFile, isMissingFile, type StaticFileReader} from '../resources/static-files.js';

function contentType(file: string): string {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.jpg') || file.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function insideRoot(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function registerStaticRoutes(app: FastifyInstance, config: BackendConfig, readFile: StaticFileReader = readStaticFile): Promise<void> {
  app.get('/*', async (request, reply) => {
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.raw.url ?? '/', 'http://localhost').pathname);
    } catch {
      return reply.code(400).send({error: '路径无效'});
    }
    const root = path.resolve(config.outputRoot);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^[/\\]+/, '');
    const target = path.resolve(root, relative);
    if (!insideRoot(root, target)) return reply.code(403).send();
    try {
      const contents = await readFile(target);
      reply.type(contentType(target));
      reply.header('Cache-Control', 'no-store');
      return reply.send(contents);
    } catch (error) {
      if (isMissingFile(error)) return reply.code(404).send('Not found');
      request.log.error({err: error}, 'Static file read failed');
      return reply.code(500).send({error: '文件读取失败'});
    }
  });
}
