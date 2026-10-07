const ACTION_TRIGGERS=Object.freeze(['walk','teleport']);

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

module.exports={ACTION_TRIGGERS,dispatchTriggerList};
