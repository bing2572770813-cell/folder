import test from 'node:test';
import assert from 'node:assert/strict';
import {describeViewportCell,describeViewportGuidance} from '../../render/viewport-cell.mjs';

test('cell summary includes independent terrain, keys, collision and hidden occupancy',()=>{
 const nodes=[{prefabId:'paper',components:{surface:{height:.4}},tags:{},static:{}},
  {prefabId:'fire',components:{fire:{},collision:{blocked:true}},tags:{},static:{}},
  {prefabId:'key',components:{key:{name:'铜'}},tags:{exitTo:'B'},static:{}},
  {prefabId:'hidden',components:{surface:{}},tags:{},static:{}}];
 const document={world:{at:()=>nodes},cellTags:{'1,2':{regionTag:'A'}}};
 const text=describeViewportCell(document,1,2,{nameFor:id=>id,nodeHidden:node=>node.prefabId==='hidden'});
 assert.match(text,/火焰/);assert.match(text,/钥匙：铜/);
 assert.match(text,/阻挡/);assert.match(text,/隐藏 1/);assert.match(text,/A/);assert.match(text,/B/);
 assert.match(describeViewportCell({world:{at:()=>[]},cellTags:{}},0,0),/空格/);
});

test('lift summaries distinguish initial and current height and show turn length',()=>{
 const node={id:'lift',prefabId:'lift',components:{surface:{height:.09},lift:{minHeight:.09,maxHeight:1,initialHeight:.7,turnsPerLeg:3}},tags:{},static:{}};
 const doc={world:{at:()=>[node],runtime:()=>({height:.4})},cellTags:{}};
 const edit=describeViewportCell(doc,1,1);assert.match(edit,/初始高度 0.7/);assert.doesNotMatch(edit,/纸面高度 0.09/);assert.match(edit,/单程 3 回合/);
 const play=describeViewportCell(doc,1,1,{runtime:true});assert.match(play,/当前高度 0.4/);
});

test('guidance explains configured fragile counts and current remaining actions without mutating state',()=>{
 const node={id:'paper',prefabId:'fragile_paper_ai',components:{surface:{},fragile:{count:4}},tags:{},static:{}};
 let current={remaining:3};const doc={world:{at:()=>[node],runtime:()=>structuredClone(current)},cellTags:{}};
 const before=structuredClone(node);
 assert.match(describeViewportGuidance(doc,4,2,{runtime:false}),/C5:.*4 次成功行动.*坠亡/);
 assert.match(describeViewportGuidance(doc,4,2),/3 次成功行动/);
 current={remaining:0,broken:true};assert.match(describeViewportGuidance(doc,4,2),/已碎裂.*虚空/);
 assert.deepEqual(node,before);
});

test('guidance follows key collection and preserves all co-located entity functions',()=>{
 const nodes=[{id:'key',prefabId:'key',components:{key:{name:'铜'}},tags:{}},{id:'paper',prefabId:'paper',components:{surface:{}},tags:{exitTo:'区域B',requiredKeys:['铜','银']}}];
 const doc={world:{at:()=>nodes,runtime:()=>({})},cellTags:{}};
 const text=describeViewportGuidance(doc,0,0,{collectedKeys:['铜']});
 assert.match(text,/铜」已收集/);assert.match(text,/还需钥匙：银/);assert.match(text,/区域B/);
 assert.match(describeViewportGuidance({world:{at:()=>[]},cellTags:{}},1,0),/虚空.*无法行走/);
});
