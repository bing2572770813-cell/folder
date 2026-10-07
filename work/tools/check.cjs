const path=require('node:path');
const fs=require('node:fs');
const {runChecks}=require('./check-runner.cjs');
const cwd=path.resolve(__dirname,'..');
if(process.argv.length>2){console.error('Usage: npm run check (runs all checks; no test filtering or cache)');process.exitCode=2;}
else {
 const node=(name,args)=>({name,command:process.execPath,args});
 const backendTests=fs.readdirSync(path.join(cwd,'backend/test')).filter(file=>file.endsWith('.test.mjs')).sort().map(file=>'backend/test/'+file);
 const toolTests=fs.readdirSync(path.join(__dirname,'test')).filter(file=>file.endsWith('.test.cjs')).sort().map(file=>'tools/test/'+file);
 if(!backendTests.length||!toolTests.length)throw new Error('Required test suite is empty');
 const steps=[
  node('tool-tests',['--test',...toolTests]),
  node('backend-build',[path.join(path.dirname(require.resolve('typescript/package.json')),'bin/tsc'),'-p','backend/tsconfig.json']),
  node('backend-tests',['--test',...backendTests]),
  node('html-build',['build.cjs']),
  node('frontend-tests',['test-runner.cjs']),
  {name:'working-diff',command:'git',args:['diff','--check']},
  {name:'staged-diff',command:'git',args:['diff','--cached','--check']}
 ];
 runChecks(steps,{cwd,outputRoot:path.join(cwd,'.dev-checks')}).then(report=>{process.exitCode=report.status==='pass'?0:1;}).catch(error=>{console.error(error);process.exitCode=1;});
}
