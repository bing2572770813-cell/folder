import assert from 'node:assert/strict';
import { createLevel, normalizeProject, duplicateLevel, removeLevel, moveLevel, snapshotLevel } from './level-group.mjs';
const map={version:1,width:3,height:3,tiles:Array.from({length:3},()=>Array.from({length:3},()=>({color:'white',fold:null}))),spawn:{r:0,c:0,dir:0},exit:{r:2,c:2},maxSteps:0,bestSteps:null};
const project=normalizeProject({version:1,levels:[createLevel(map,'a'),createLevel(map,'b')]});
const copy=duplicateLevel(project,'a');assert.equal(project.levels.length,3);moveLevel(project,copy.id,1);assert.equal(project.levels[2].id,copy.id);removeLevel(project,'a');assert.equal(project.levels.length,2);assert.throws(()=>normalizeProject({version:1,levels:[{id:'x',map},{id:'x',map}]}));
snapshotLevel(project.levels[0],'测试快照');assert.equal(project.levels[0].snapshots[0].label,'测试快照');
console.log('PASS: level group creation, duplication, ordering, deletion and validation.');
