import directionConfig from '../entities/ray-emitter-config.cjs';

// Visuals read configuration/runtime only; gameplay settlement stays in player.cjs.
export function mechanismMarker(THREE,components,runtime={}){
 const group=new THREE.Group();
 const line=(points,color)=>{const geometry=new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,0,z)));group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,toneMapped:false})));};
 if(components.rayEmitter){
  const direction=runtime.rayEmitter?.direction??components.rayEmitter.initialDirection;
  const arrow=new THREE.Shape();arrow.moveTo(-.09,.28);arrow.lineTo(.09,.28);arrow.lineTo(.09,-.02);arrow.lineTo(.24,-.02);arrow.lineTo(0,-.32);arrow.lineTo(-.24,-.02);arrow.lineTo(-.09,-.02);arrow.closePath();
  const mesh=new THREE.Mesh(new THREE.ShapeGeometry(arrow),new THREE.MeshBasicMaterial({color:'#d95232',side:THREE.DoubleSide,toneMapped:false}));mesh.rotation.x=Math.PI/2;
  const delta=directionConfig.directions[direction];group.rotation.y=Math.atan2(-delta.c,-delta.r);group.add(mesh);group.userData.direction=direction;
 }
 if(components.foldSwitch){
  const state=runtime.foldSwitch?.state??components.foldSwitch.initialState;
  const points=state===0?[[-.18,-.26],[.18,-.26],[.18,-.26],[.18,.26],[.18,.26],[-.18,.26],[-.18,.26],[-.18,-.26]]:[[0,-.26],[0,.26],[-.1,-.14],[0,-.26],[-.14,.26],[.14,.26]];
  line(points,state===0?'#bd403b':'#247747');group.userData.switchState=state;
 }
 if(components.fragile)line([[-.4,-.2],[-.08,-.1],[-.08,-.1],[.02,.07],[.02,.07],[.32,.32],[.02,.07],[-.13,.33],[.02,.07],[.32,-.12]],'#6b5848');
 group.traverse(object=>{object.raycast=()=>{};});return group;
}

export function shotMarker(THREE,{last=false}={}){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.84,.84),new THREE.MeshBasicMaterial({color:last?'#ed493b':'#e5a331',opacity:last?.3:.09,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
 mesh.rotation.x=-Math.PI/2;mesh.raycast=()=>{};mesh.userData.lastShot=last;return mesh;
}
