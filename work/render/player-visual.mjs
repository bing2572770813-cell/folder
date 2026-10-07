import {Group} from 'three';
import {createModelView} from './model-view.mjs';

/** The visual is a child of the runtime player, so movement and folding need no special model logic. */
export function createPlayerVisualView({host,library,createFallback,clearFallback,onChange=()=>{},onError=()=>{}}){
 const fallback=new Group(),models=new Group();host.add(fallback,models);
 let current,color,disposed=false,ready=false,enabled=true;
 const view=createModelView({layer:models,library,onChange:()=>{refresh();onChange();},onError:(descriptor,error)=>onError(descriptor,error)});
 function refresh(){
  if(disposed)return;
  if(!enabled){view.update([]);ready=false;fallback.visible=false;return;}
  const visual=current?.visual;
  ready=view.update(visual?[{id:'runtime-player',visual,position:[0,0,0],dir:0}]:[]).has('runtime-player');
  fallback.visible=!ready;
  const next=current?.tile?.color??'white';
  if(!ready&&color!==next){clearFallback(fallback);fallback.add(createFallback(next));color=next;}
 }
 return {
  update(prefab,visible=true){current=prefab;enabled=visible;refresh();},
  status(){return {model:current?.visual?.model??null,ready,enabled,fallback:enabled&&!ready};},
  dispose(){if(disposed)return;disposed=true;view.dispose();clearFallback(fallback);fallback.removeFromParent();models.removeFromParent();},
 };
}
