import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyMapToTree,loadTree} from '../dist/entities/legacy-map.js';
test('legacy entities retain sparse instance footprint, tags, mechanisms and void folds',()=>{
  const tile={prefabId:'large_ai',height:.2,blocked:false,regionTag:'A',instance:{id:'old',anchorR:1,anchorC:1,width:2,height:2},tags:{spawn:true},folds:['h'],properties:{nested:{value:3}},propertySchema:{properties:{serializable:true,tempEditable:false}}};
  const map={width:4,height:4,tiles:Array.from({length:4},()=>Array(4).fill(null)),foldCells:[{r:0,c:0,type:'v'}]};
  map.tiles[1][1]=tile;map.tiles[2][2]={...tile,tags:{},terrain:'fire'};
  const before=structuredClone(map);const tree=legacyMapToTree(map);const world=loadTree(tree);
  assert.equal(tree.entities.length,3);
  assert.equal(world.at(1,2).length,0);
  assert.equal(world.at(2,2)[0].components.fire.damage,1);
  assert.equal(world.at(1,1)[0].tags.region,'A');
  assert.deepEqual(world.at(1,1)[0].configuration,tile);
  assert.deepEqual(world.at(0,0)[0].components.fold.directions,['v']);
  assert.deepEqual(map,before);
  assert.deepEqual(loadTree(JSON.parse(JSON.stringify(tree))).serialize(),world.serialize());
});
