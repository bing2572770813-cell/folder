const path=require('node:path');
const {runChecks}=require('./check-runner.cjs');
const {createCheckPlan}=require('./check-plan.cjs');
const cwd=path.resolve(__dirname,'..');
const scope=process.argv[2]??'all';
if(process.argv.length>3||!['all','backend','frontend','tools'].includes(scope)){console.error('Usage: npm run check -- [all|backend|frontend|tools]');process.exitCode=2;}
else {
 const steps=createCheckPlan(cwd,scope);
 if(scope!=='all')console.log('Partial verification: '+scope+'; run npm run check before committing.');
 runChecks(steps,{cwd,outputRoot:path.join(cwd,'.dev-checks')}).then(report=>{process.exitCode=report.status==='pass'?0:1;}).catch(error=>{console.error(error);process.exitCode=1;});
}
