// Surface-local vector digits keep counters sharp without loading fonts/textures.
const digits=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
const segments={a:[0,0,1,0],b:[1,0,1,1],c:[1,1,1,2],d:[0,2,1,2],e:[0,1,0,2],f:[0,0,0,1],g:[0,1,1,1]};

export function fragileCounter(THREE,config,state={}){
 if(state.broken)return null;
 const remaining=Math.max(0,Math.trunc(Number(state.remaining??config.count??1)));
 const text=String(remaining),scale=.12,gap=.045,width=text.length*scale+(text.length-1)*gap,positions=[];
 for(let i=0;i<text.length;i++)for(const segment of digits[Number(text[i])]??''){
  const [x1,z1,x2,z2]=segments[segment],x=i*(scale+gap)-width/2,z=-scale,half=.013;
  const a=[x+x1*scale,z+z1*scale],b=[x+x2*scale,z+z2*scale];
  const dx=x1===x2?half:0,dz=z1===z2?half:0;
  for(const [px,pz] of [[a[0]-dx,a[1]-dz],[b[0]-dx,b[1]-dz],[b[0]+dx,b[1]+dz],[a[0]-dx,a[1]-dz],[b[0]+dx,b[1]+dz],[a[0]+dx,a[1]+dz]])positions.push(px,.003,pz);
 }
 const group=new THREE.Group(),radius=Math.max(.19,width/2+.045);
 const badge=new THREE.Mesh(new THREE.CircleGeometry(radius,32),new THREE.MeshBasicMaterial({color:'#fff4d6',side:THREE.DoubleSide,toneMapped:false}));
 badge.rotation.x=-Math.PI/2;group.add(badge);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 group.add(new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:remaining===0?'#a33327':'#463826',side:THREE.DoubleSide,toneMapped:false})));
 group.position.set(0,.008,-.22);group.userData.fragileCounter=remaining;
 return group;
}
