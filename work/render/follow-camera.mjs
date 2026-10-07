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
