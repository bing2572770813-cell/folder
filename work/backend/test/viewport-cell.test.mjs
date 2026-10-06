import test from 'node:test';
import assert from 'node:assert/strict';
import {describeViewportCell} from '../../render/viewport-cell.mjs';

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
