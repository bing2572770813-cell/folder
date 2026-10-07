import {Group} from 'three';
import {normalizeVisual} from '../resources/visual-definition.mjs';

/** Async completions request a safe rebuild; only update() attaches instances to the scene. */
export function createModelView({layer,library,onChange=()=>{},onError=()=>{}}){
 const entries=new Map();let disposed=false;
 function remove(id){const entry=entries.get(id);entry?.host.removeFromParent();entries.delete(id);}
 return {
  update(descriptors){
   const used=new Set(),ready=new Set();if(disposed)return ready;
   for(const descriptor of descriptors){
    const visual=normalizeVisual(descriptor.visual);if(!visual)continue;
    const key=JSON.stringify(visual),id=descriptor.id;used.add(id);let entry=entries.get(id);
    if(entry?.key!==key){
     remove(id);entry={key,host:new Group(),descriptor};entries.set(id,entry);
     const pending=entry;
     library.instantiate(visual).then(instance=>{
      if(disposed||entries.get(id)!==pending)return;
      pending.instance=instance;onChange();
     }).catch(error=>{
      if(disposed||entries.get(id)!==pending)return;
      pending.error=error;onError(pending.descriptor,error);
     });
    }
    entry.descriptor=descriptor;entry.host.userData.cell=descriptor.cell;
    entry.host.position.fromArray(descriptor.position);entry.host.rotation.y=-(descriptor.dir??0)*Math.PI/4;
    if(entry.instance){if(!entry.instance.parent)entry.host.add(entry.instance);(descriptor.parent??layer).add(entry.host);ready.add(id);}
   }
   for(const id of entries.keys())if(!used.has(id))remove(id);
   return ready;
  },
  dispose(){if(disposed)return;disposed=true;for(const id of [...entries.keys()])remove(id);},
 };
}
