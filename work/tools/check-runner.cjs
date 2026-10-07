const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const {finished}=require('node:stream/promises');
const {performance}=require('node:perf_hooks');
const {randomUUID}=require('node:crypto');

async function runStep(step,{cwd,logPath}){
 const started=performance.now(),log=fs.createWriteStream(logPath);
 const tail=[];let partial='',launchError=null,logError=null;
 log.on('error',error=>{logError=error;});
 function collect(chunk){
  log.write(chunk);
  const lines=(partial+chunk.toString()).split(/\r?\n/);partial=lines.pop();
  for(const line of lines){tail.push(line.slice(-4096));if(tail.length>16)tail.shift();}
  if(partial.length>4096)partial=partial.slice(-4096);
 }
 const result=await new Promise(resolve=>{
  const child=spawn(step.command,step.args??[],{cwd,shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.on('error',error=>{launchError=error.message;log.write(error.stack+'\n');});
  child.on('close',(exitCode,signal)=>resolve({exitCode,signal}));
 });
 if(partial)tail.push(partial);
 log.end();try{await finished(log);}catch(error){logError=error;}
 const error=launchError??logError?.message??null;
 return {name:step.name,command:step.command,args:step.args??[],status:result.exitCode===0&&!result.signal&&!error?'pass':'fail',...result,error,
  durationMs:Math.round(performance.now()-started),logPath,tail};
}

async function runChecks(steps,{cwd,outputRoot,write=console.log}){
 const runId=new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
 const directory=path.join(outputRoot,runId);fs.mkdirSync(directory,{recursive:true});
 const started=performance.now(),results=[];
 for(const [index,step] of steps.entries()){
  if(results.some(result=>result.status==='fail')){results.push({name:step.name,status:'skipped'});continue;}
  const result=await runStep(step,{cwd,logPath:path.join(directory,index+'-'+step.name+'.log')});
  results.push(result);write(`${result.status.toUpperCase()} ${result.name} ${(result.durationMs/1000).toFixed(2)}s`);
  if(result.status==='fail'){
   if(result.error)write(result.error);
   if(result.signal)write('Signal: '+result.signal);
   write(result.tail.join('\n'));write('Failure log: '+result.logPath);
  }
 }
 const report={runId,cwd,nodeVersion:process.version,status:results.every(result=>result.status==='pass')?'pass':'fail',
  durationMs:Math.round(performance.now()-started),steps:results.map(({tail,...result})=>result)};
 const reportPath=path.join(directory,'report.json');fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(path.join(outputRoot,'latest.json'),JSON.stringify({reportPath,status:report.status},null,2)+'\n');
 write(`${report.status.toUpperCase()} ${results.filter(result=>result.status==='pass').length}/${steps.length} stages; ${results.filter(result=>result.status==='skipped').length} skipped; ${(report.durationMs/1000).toFixed(2)}s`);
 write('Report: '+reportPath);
 return report;
}
module.exports={runStep,runChecks};
