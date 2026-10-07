import path from 'node:path';
import fs from 'node:fs/promises';
import type {FastifyInstance} from 'fastify';
import type {BackendConfig} from '../config.js';
import {assetPath} from '../resources/visual-definition.js';
import {readStaticFile,isMissingFile} from '../resources/static-files.js';

const inside=(root:string,target:string)=>{const relative=path.relative(root,target);return relative!==''&&!relative.startsWith('..')&&!path.isAbsolute(relative);};
export async function registerAssetRoutes(app:FastifyInstance,config:BackendConfig):Promise<void>{
 app.get('/assets/*',async(request,reply)=>{
  let relative:string;
  try{
   const pathname=decodeURIComponent((request.raw.url??'').split('?')[0]);relative=pathname.slice('/assets/'.length);
   assetPath(relative,relative.startsWith('model/')?'model':'texture');
  }catch{return reply.code(400).send({error:'资源路径无效'});}
  const root=path.resolve(config.assetRoot??path.dirname(config.prefabRoot)),target=path.resolve(root,relative);
  if(!inside(root,target))return reply.code(403).send();
  try{
   const [realRoot,realFile]=await Promise.all([fs.realpath(root),fs.realpath(target)]);
   if(!inside(realRoot,realFile))return reply.code(403).send();
   const bytes=await readStaticFile(realFile);
   reply.type(relative.toLowerCase().endsWith('.png')?'image/png':'application/octet-stream');reply.header('Cache-Control','no-cache');
   return reply.send(bytes);
  }catch(error){if(isMissingFile(error))return reply.code(404).send({error:'资源不存在'});request.log.error({err:error},'Asset read failed');return reply.code(500).send({error:'资源读取失败'});}
 });
}
