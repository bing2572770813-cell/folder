import {Vector3} from 'three';

export const lightingDefaults = Object.freeze({directional:2.6,ambient:2.1,fill:1.1,shadow:1,azimuth:-48.37,elevation:56.22,exposure:1.05});
export const lightingFields = [
  ['directional','定向光强度',0,10,.1], ['ambient','环境光强度',0,10,.1],
  ['fill','补光强度',0,10,.1], ['shadow','阴影强度',0,1,.05],
  ['azimuth','光照方位角',-180,180,1], ['elevation','光照仰角',1,89,1],
  ['exposure','曝光',.1,4,.05],
];
export function validateLighting(values){
 const next={};for(const [key,label,min,max] of lightingFields){const value=Number(values[key]);if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${label}须为 ${min}–${max}`);next[key]=value;}return next;
}
export function applyLighting({sunlight,ambient,fill,renderer},values,width,height){
 const next=validateLighting(values),radius=Math.max(24,Math.hypot(width,height)*1.5),az=next.azimuth*Math.PI/180,el=next.elevation*Math.PI/180;
 sunlight.position.copy(new Vector3(Math.sin(az)*Math.cos(el),Math.sin(el),Math.cos(az)*Math.cos(el)).multiplyScalar(radius));
 sunlight.intensity=next.directional;ambient.intensity=next.ambient;fill.intensity=next.fill;
 sunlight.shadow.intensity=next.shadow;sunlight.castShadow=next.shadow>0;
 const span=Math.max(width,height)*.8+4,camera=sunlight.shadow.camera;
 Object.assign(camera,{left:-span,right:span,top:span,bottom:-span,near:.1,far:radius+span*3});camera.updateProjectionMatrix();
 renderer.toneMappingExposure=next.exposure;return next;
}
