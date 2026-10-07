import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--test','backend/test/ray-emitter.test.mjs','backend/test/mechanism-document.test.mjs'],{cwd:import.meta.dirname,stdio:'inherit',windowsHide:true});
if(result.error)throw result.error;
if(result.status!==0)process.exit(result.status??1);
