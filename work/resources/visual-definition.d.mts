export interface VisualDefinition {model:string;scale:number[];offset:number[];rotation:number[];textures:Record<string,string>}
export function assetPath(value:unknown,kind:'model'|'texture'):string;
export function normalizeVisual(value:unknown):VisualDefinition|null|undefined;
