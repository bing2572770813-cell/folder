const ACTION_TRIGGERS=Object.freeze(['walk','teleport']);

function normalizeComponentTriggers(value){
 if(value&&typeof value==='object'&&!Array.isArray(value))value=value.triggers;
 if(value===undefined)return [...ACTION_TRIGGERS];
 if(!Array.isArray(value)||!value.length||value.some(trigger=>!ACTION_TRIGGERS.includes(trigger)))throw new Error('Invalid component triggers');
 const result=[...new Set(value)];
 if(result.length!==value.length)throw new Error('Duplicate component triggers');
 return result;
}

function componentTriggerMatches(value,trigger){return trigger===undefined||normalizeComponentTriggers(value).includes(trigger);}

function dispatchTriggerList(triggerList,event,context,handlers){
 const effects=[];
 for(const subscription of triggerList){
  if(subscription.event!==event)continue;
  if(subscription.triggers&&!subscription.triggers.includes(context.action?.trigger))continue;
  const handler=handlers[subscription.handler];
  if(typeof handler!=='function')throw new Error('Unknown trigger handler: '+subscription.handler);
  const result=handler(context);
  if(result)effects.push(...(Array.isArray(result)?result:[result]));
 }
 return effects;
}

module.exports={ACTION_TRIGGERS,normalizeComponentTriggers,componentTriggerMatches,dispatchTriggerList};
