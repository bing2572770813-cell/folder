export const ACTION_TRIGGERS:readonly string[];
export function normalizeComponentTriggers(value:unknown):string[];
export function componentTriggerMatches(value:unknown,trigger?:string):boolean;
export function dispatchTriggerList(triggerList:unknown[],event:string,context:unknown,handlers:Record<string,Function>):unknown[];
