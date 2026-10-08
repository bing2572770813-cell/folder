import assert from 'node:assert/strict';
import test from 'node:test';
import {triggerEditorChoices} from './ui/trigger-editor-options.mjs';

test('trigger-related mechanism fields expose fixed editor choices',()=>{
 assert.deepEqual(triggerEditorChoices('components.rayEmitter.initialDirection'),[
  {value:'north',label:'上（北）'},
  {value:'east',label:'右（东）'},
  {value:'south',label:'下（南）'},
  {value:'west',label:'左（西）'},
 ]);
 assert.deepEqual(triggerEditorChoices('components.firebird.direction'),[
  {value:'north',label:'上（北）'},
  {value:'east',label:'右（东）'},
  {value:'south',label:'下（南）'},
  {value:'west',label:'左（西）'},
 ]);
 assert.deepEqual(triggerEditorChoices('components.foldSwitch.initialState'),[
  {value:0,label:'0（关闭）'},
  {value:1,label:'1（开启）'},
 ]);
 assert.equal(triggerEditorChoices('components.fire.damage'),undefined);
});
