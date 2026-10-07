import fs from 'node:fs/promises';

export type StaticFileReader = (file: string) => Promise<Buffer>;

export const readStaticFile: StaticFileReader = async file => {
  const stat = await fs.stat(file);
  if (!stat.isFile()) throw Object.assign(new Error('Not a file'), {code: 'ENOENT'});
  return fs.readFile(file);
};

export function isMissingFile(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}
