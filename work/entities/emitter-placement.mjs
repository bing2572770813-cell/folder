import emitter from './ray-emitter-config.cjs';

// Placement overrides belong to the new instance, never to the catalog prefab.
export function withEmitterDirection(prefab,initialDirection){
 if(!prefab?.components?.rayEmitter)return prefab;
 const config={...prefab.components.rayEmitter,initialDirection};emitter.validate(config);
 return {...prefab,components:{...prefab.components,rayEmitter:config}};
}
