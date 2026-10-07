/** Coalesce work without coupling scheduling to maps, input or rendering. */
export function createFrameTask(run,{requestFrame,cancelFrame}){
 let handle=null,latest,revision=0;
 function cancel(){
  revision++;
  if(handle!==null)cancelFrame(handle);
  handle=null;latest=undefined;
 }
 function request(value){
  latest=value;
  if(handle!==null)return;
  const scheduledRevision=revision;
  handle=requestFrame(()=>{
   if(scheduledRevision!==revision)return;
   handle=null;const value=latest;latest=undefined;run(value);
  });
 }
 function flush(){
  if(handle===null)return;
  const value=latest;cancel();run(value);
 }
 return {request,cancel,flush};
}
