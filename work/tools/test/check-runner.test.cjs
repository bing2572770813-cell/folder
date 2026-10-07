const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {runChecks}=require('../check-runner.cjs');
const step=(name,code)=>({name,command:process.execPath,args:['-e',code]});
async function fixture(run){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'folder-check-test-'));
 try{await run(directory);}finally{fs.rmSync(directory,{recursive:true,force:true});}
}
test('successful noisy commands retain full logs and emit short summaries',()=>fixture(async directory=>{
 const output=[];const report=await runChecks([step('noisy',"for(let i=0;i<2000;i++)console.log('line '+i);console.error('stderr retained');")],{cwd:directory,outputRoot:directory,write:text=>output.push(text)});
 assert.equal(report.status,'pass');assert.equal(report.steps[0].exitCode,0);
 const log=fs.readFileSync(report.steps[0].logPath,'utf8');assert.match(log,/line 0/);assert.match(log,/line 1999/);assert.match(log,/stderr retained/);
 assert.ok(output.join('\n').length<1000);assert.doesNotMatch(output.join('\n'),/line 1999/);
 const latest=JSON.parse(fs.readFileSync(path.join(directory,'latest.json')));
 assert.deepEqual(JSON.parse(fs.readFileSync(latest.reportPath)),report);
}));
test('failure preserves exit code and detail, and skips dependent work',()=>fixture(async directory=>{
 const output=[];const report=await runChecks([step('failed',"console.error('failure detail');process.exit(7);"),step('never',"throw new Error('must not execute')")],{cwd:directory,outputRoot:directory,write:text=>output.push(text)});
 assert.equal(report.status,'fail');assert.equal(report.steps[0].exitCode,7);assert.equal(report.steps[1].status,'skipped');
 assert.match(output.join('\n'),/failure detail/);assert.match(output.join('\n'),/1 skipped/);
 assert.ok(fs.existsSync(report.steps[0].logPath));
}));
test('missing executable is a failed check, not a passing empty log',()=>fixture(async directory=>{
 const report=await runChecks([{name:'missing',command:path.join(directory,'missing-program'),args:[]}],{cwd:directory,outputRoot:directory,write:()=>{}});
 assert.equal(report.status,'fail');assert.match(report.steps[0].error,/ENOENT/);
}));
test('consecutive runs preserve earlier reports and logs',()=>fixture(async directory=>{
 const options={cwd:directory,outputRoot:directory,write:()=>{}};
 const first=await runChecks([step('same',"console.log('first run')")],options);
 const second=await runChecks([step('same',"console.log('second run')")],options);
 assert.notEqual(first.runId,second.runId);
 assert.match(fs.readFileSync(first.steps[0].logPath,'utf8'),/first run/);
 assert.match(fs.readFileSync(second.steps[0].logPath,'utf8'),/second run/);
 assert.equal(second.steps[0].command,process.execPath);
}));
