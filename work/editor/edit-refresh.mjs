import {createFrameTask} from '../core/frame-task.mjs';

/** Batch only effects; the caller commits every edit synchronously. */
export function createEditRefresh({rebuild,notify,requestFrame,cancelFrame}){
 let scene=false,save=false;
 const task=createFrameTask(()=>{
  const rebuildNeeded=scene,saveNeeded=save;scene=false;save=false;
  if(rebuildNeeded)rebuild();
  if(saveNeeded)notify();
 },{requestFrame,cancelFrame});
 function request(effects,defer=false){
  scene||=!!effects.scene;save||=!!effects.save;
  task.request();
  if(!defer)task.flush();
 }
 return {request,flush:task.flush};
}
