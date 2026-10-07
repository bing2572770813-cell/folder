const DIRECTIONS=Object.freeze([
 {value:'north',label:'上（北）'},
 {value:'east',label:'右（东）'},
 {value:'south',label:'下（南）'},
 {value:'west',label:'左（西）'},
]);
const SWITCH_STATES=Object.freeze([
 {value:0,label:'0（关闭）'},
 {value:1,label:'1（开启）'},
]);

const choices=Object.freeze({
 'components.rayEmitter.initialDirection':DIRECTIONS,
 'components.firebird.direction':DIRECTIONS,
 'components.foldSwitch.initialState':SWITCH_STATES,
});

export function triggerEditorChoices(path){return choices[path];}

export function triggerEditorChoiceMap(){return choices;}
