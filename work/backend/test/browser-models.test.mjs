import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import path from 'node:path';
const require=createRequire(import.meta.url);
const esbuild=require('esbuild');
const {workspaceFiles}=require('../../build-support.cjs');
const workRoot=path.resolve(import.meta.dirname,'../..');

test('actual browser bundler loads shared TS models without Node runtime imports',async()=>{
  const result=await esbuild.build({entryPoints:[path.join(workRoot,'entities/tree-runtime.mjs')],plugins:[workspaceFiles(workRoot)],bundle:true,platform:'browser',format:'iife',globalName:'TreeModels',write:false});
  const context=vm.createContext({structuredClone});vm.runInContext(result.outputFiles[0].text,context);
  const Manager=context.TreeModels.TransformManager;
  const manager=new Manager(5,5);
  manager.create({id:'root',parentId:null,local:{r:1,c:1,dir:0},footprint:{width:1,height:1,occupied:[true]}});
  assert.equal(manager.at(1,1)[0],'root');
  assert.equal(typeof context.TreeModels.defaultComponents,'function');
  assert.equal(typeof context.TreeModels.importTreeMap,'function');
});
