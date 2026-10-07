import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogDefinition} from '../dist/resources/shared-normalizers.js';

test('shared normalizer boundary requires identified finite JSON definitions',()=>{
 const source={version:1,id:'paper_ai',name:'纸张',components:{surface:{height:.09}}};
 const definition=catalogDefinition(source);assert.deepEqual(definition,source);
 definition.components.surface.height=2;assert.equal(source.components.surface.height,.09);
 for(const invalid of [{version:1,id:12,name:'x'},{version:2,id:'x',name:'x'},{version:1,id:'../x',name:'x'},{version:1,id:'x',name:''},{...source,value:Infinity}])assert.throws(()=>catalogDefinition(invalid));
});
