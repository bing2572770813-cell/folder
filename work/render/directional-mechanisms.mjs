import directionConfig from '../entities/ray-emitter-config.cjs';

// Visuals read configuration/runtime only; gameplay settlement stays in player.cjs.
export function mechanismMarker(THREE,components,runtime={}){
 const group=new THREE.Group();
 const line=(points,color,opacity=1)=>{const geometry=new THREE.BufferGeometry().setFromPoints(points.map(([x,z])=>new THREE.Vector3(x,0,z)));group.add(new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,toneMapped:false})));};
 const badge=(color,opacity=.16)=>{const mesh=new THREE.Mesh(new THREE.CircleGeometry(.39,32),new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));mesh.rotation.x=Math.PI/2;group.add(mesh);};
 if(components.rayEmitter){
  const direction=runtime.rayEmitter?.direction??components.rayEmitter.initialDirection;
  const arrow=new THREE.Shape();arrow.moveTo(-.09,.28);arrow.lineTo(.09,.28);arrow.lineTo(.09,-.02);arrow.lineTo(.24,-.02);arrow.lineTo(0,-.32);arrow.lineTo(-.24,-.02);arrow.lineTo(-.09,-.02);arrow.closePath();
  badge('#c83f2d',.2);const mesh=new THREE.Mesh(new THREE.ShapeGeometry(arrow),new THREE.MeshBasicMaterial({color:'#b72f24',side:THREE.DoubleSide,toneMapped:false}));mesh.rotation.x=Math.PI/2;
  const delta=directionConfig.directions[direction];group.rotation.y=Math.atan2(-delta.c,-delta.r);group.add(mesh);group.userData.direction=direction;
 }
 if(components.foldSwitch){
  const state=runtime.foldSwitch?.state??components.foldSwitch.initialState;
  badge(state===0?'#c43c37':'#2d8758',.22);
  const points=state===0?[[-.18,-.26],[.18,-.26],[.18,-.26],[.18,.26],[.18,.26],[-.18,.26],[-.18,.26],[-.18,-.26]]:[[0,-.26],[0,.26],[-.1,-.14],[0,-.26],[-.14,.26],[.14,.26]];
  line(points,state===0?'#9f292d':'#176a41');line(state===0?[[-.1,-.04],[.1,.04]]:[[0,-.1],[0,.1]],'#ffffff',.8);group.userData.switchState=state;
 }
 if(components.fragile){const breaking=runtime.fragile?.breaking===true,progress=Number(runtime.fragile?.progress??0),pulse=breaking?1+Math.sin(progress*Math.PI*6)*.08:1;badge(breaking?'#d56b3d':'#c99a48',breaking?.22:.12);line([[-.4,-.2],[-.08,-.1],[-.08,-.1],[.02,.07],[.02,.07],[.32,.32],[.02,.07],[-.13,.33],[.02,.07],[.32,-.12]],breaking?'#9c3f2d':'#554437');line([[-.28,.3],[-.08,.12],[-.08,.12],[.1,.24]],'#8b5c35',.8);group.scale.setScalar(pulse);}
 if(components.firebird){const replaced=runtime.firebird?.replaced===true;badge(replaced?'#3e4548':'#e05a2a',.26);line([[-.28,-.28],[.28,.28],[-.28,.28],[.28,-.28]],replaced?'#252b2d':'#d13a24');group.userData.firebird=!replaced;group.userData.replaced=replaced;}
 if(components.flame){group.userData.flame=true;badge('#ed7d24',.32);line([[-.08,-.3],[.12,-.08],[-.08,.02],[.14,.3]],'#f3b52b');}
 group.traverse(object=>{object.raycast=()=>{};});return group;
}

export function shotMarker(THREE,{last=false}={}){
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.84,.84),new THREE.MeshBasicMaterial({color:last?'#e04b3d':'#3e91a8',opacity:last?.34:.075,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
 mesh.rotation.x=-Math.PI/2;mesh.raycast=()=>{};mesh.userData.lastShot=last;return mesh;
}
