import {Vector3} from 'three';

// Fits a square of map cells without stretching it on rectangular viewports.
export function squareViewSpan(camera,center,size=9,aspect=1){
  camera.updateMatrixWorld(true);
  let x=0,y=0;
  const origin=center.clone().applyMatrix4(camera.matrixWorldInverse);
  for(const dx of [-size/2,size/2])for(const dz of [-size/2,size/2]){
    const point=center.clone().add(new Vector3(dx,0,dz)).applyMatrix4(camera.matrixWorldInverse);
    x=Math.max(x,Math.abs(point.x-origin.x));y=Math.max(y,Math.abs(point.y-origin.y));
  }
  return Math.max(y,x/Math.max(.1,aspect));
}

export function followTarget(camera,controls,target,offset){
  controls.target.copy(target);camera.position.copy(target).add(offset);camera.lookAt(target);camera.updateMatrixWorld(true);
}

export function boundedFollowTarget(position,width,height,size=9){
  const xLimit=Math.max(0,(width-size)/2),zLimit=Math.max(0,(height-size)/2);
  return new Vector3(Math.max(-xLimit,Math.min(xLimit,position.x))||0,position.y,Math.max(-zLimit,Math.min(zLimit,position.z))||0);
}

export function regionFocusTarget(cells,positionForCell){
  if(!cells.length)return null;
  const target=new Vector3();
  for(const cell of cells)target.add(positionForCell(cell));
  return target.multiplyScalar(1/cells.length);
}

export function regionFocusPhase(start,now,{focusMs=240,holdMs=1000,returnMs=320}={}){
  const elapsed=Math.max(0,now-start);
  if(elapsed<focusMs)return {phase:'focus',progress:smooth(elapsed/focusMs)};
  if(elapsed<focusMs+holdMs)return {phase:'hold',progress:1};
  if(elapsed<focusMs+holdMs+returnMs)return {phase:'return',progress:smooth((elapsed-focusMs-holdMs)/returnMs)};
  return null;
}

function smooth(value){const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);}
