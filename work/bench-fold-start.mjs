import * as THREE from 'three';
import {paperSurface} from './render/paper-surface.mjs';
import {createFoldMotionView} from './render/fold-motion.mjs';

// Bounded CPU benchmark of the real start adapter, including entity lookup cost.
for(const size of [7,31]){
 const middle=(size-1)/2,map={width:size,height:size,tiles:Array.from({length:size},(_,r)=>Array.from({length:size},()=>({prefabId:'paper_ai',height:.09,thickness:.09,folds:r===middle?['h']:[]})))};
 const paper=new THREE.Group(),layer=new THREE.Group(),player=new THREE.Group();paper.add(layer,player);
 const positions=[],triangleCells=[],cells=[];
 for(let c=0;c<size;c++){
  const surface=paperSurface(map,middle,c),cell={r:middle,c,nodeId:'paper-'+c};
  for(let i=0;i<surface.positions.length;i+=3)positions.push(surface.positions[i]+c-middle,surface.positions[i+1],surface.positions[i+2]);
  for(let i=0;i<surface.positions.length/9;i++)triangleCells.push(cell);
  cells.push(cell);
 }
 const geometry=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
 const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial());mesh.userData.triangleCells=triangleCells;layer.add(mesh);
 const node={id:'paper',components:{surface:{height:.09,thickness:.09},physics:{followFold:true}},configuration:{color:'white',folds:['h'],tags:{}}};
 let lookups=0;const view=createFoldMotionView({paper,layers:[layer],playerGroup:player,wx:c=>c-middle,wz:r=>r-middle,canFold:()=>{lookups++;return structuredClone(node).components.physics.followFold;}});
 const hinge={origin:[0,0,0],direction:[1,0,0],side:1},samples=[];
 for(let i=0;i<3;i++){
  view.invalidatePrepared();lookups=0;
  let start=performance.now();view.prepare([],hinge,cells);const prepareMs=performance.now()-start,lookupCalls=lookups;
  start=performance.now();view.begin([],hinge,cells);const beginMs=performance.now()-start;
  samples.push({prepareMs:+prepareMs.toFixed(2),beginMs:+beginMs.toFixed(2),lookupCalls,beginLookupCalls:lookups-lookupCalls});view.reset();
 }
 console.log(JSON.stringify({size,triangles:triangleCells.length,samples}));
 view.invalidatePrepared();
 geometry.dispose();mesh.material.dispose();
}
