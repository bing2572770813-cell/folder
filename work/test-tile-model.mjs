import assert from 'node:assert/strict';
import {normalizeTile,normalizePrefab,columnLabel,applyFoldLine,foldsOf,blocked,foldsAt,TERRAIN_TYPES} from './tile-model.mjs';
assert.equal(normalizeTile({color:'white',fold:null}).height,.09);
assert.equal(blocked(normalizeTile({color:'black',fold:null})),true);
assert.equal(columnLabel(25),'Z');assert.equal(columnLabel(26),'AA');assert.equal(columnLabel(127),'DX');
for(const height of [0,17,NaN,'2'])assert.throws(()=>normalizeTile({color:'white',height}));
assert.throws(()=>normalizePrefab({version:1,id:'../../bad',name:'bad',tile:{color:'white'}}));
assert.equal(normalizePrefab({version:1,id:'paper_ai',name:'纸块',tile:{color:'white',height:2,blocked:false}}).tile.prefabId,'paper_ai');
for(const terrain of TERRAIN_TYPES){
  const input={version:1,id:terrain+'_ai',name:terrain,tile:{color:'blue',terrain,terrainConfig:{value:2,nested:{flags:[true,null]}}}};
  const prefab=normalizePrefab(input);
  assert.equal(prefab.tile.terrain,terrain);
  assert.deepEqual(normalizePrefab(JSON.parse(JSON.stringify(prefab))),prefab);
  input.tile.terrainConfig.nested.flags[0]=false;
  assert.equal(prefab.tile.terrainConfig.nested.flags[0],true);
}
assert.throws(()=>normalizeTile({color:'white',terrain:'unknown'}));
assert.throws(()=>normalizeTile({color:'white',terrainConfig:{}}));
for(const terrainConfig of [[],42,{value:NaN},{value:()=>{}}])assert.throws(()=>normalizeTile({color:'blue',terrain:'ice',terrainConfig}));
assert.deepEqual(normalizeTile({color:'blue',terrain:'ice'}).terrainConfig,{});
const map={width:5,height:5,tiles:Array.from({length:5},()=>Array.from({length:5},()=>normalizeTile({color:'white'})))};
map.tiles[2][1]=null;map.tiles[2][4]=normalizeTile({color:'black'});
assert.equal(applyFoldLine(map,2,2,'h'),true);assert.equal(applyFoldLine(map,2,2,'h'),false);
assert.deepEqual(foldsOf(map.tiles[2][4]),[]);assert.equal(map.tiles[2][1],null);
applyFoldLine(map,2,2,'v');applyFoldLine(map,2,2,'d1');applyFoldLine(map,2,2,'d2');
assert.deepEqual(foldsOf(map.tiles[2][2]),['h','v','d1','d2']);
assert.deepEqual(foldsOf(map.tiles[0][0]),[]);assert.deepEqual(foldsOf(map.tiles[0][4]),[]);applyFoldLine(map,2,1,'h');assert.deepEqual(foldsAt(map,2,1),['h']);
applyFoldLine(map,2,2,null);assert.deepEqual(foldsOf(map.tiles[2][2]),[]);assert.deepEqual(foldsOf(map.tiles[0][0]),[]);
console.log('PASS: legacy tiles, height validation, prefab identity, DX coordinates, per-cell placement including void, crossing markers and local removal.');

const uncolored=normalizePrefab({version:1,id:'plain_ai',name:'无颜色',tile:{height:.25,blocked:false}});
assert.equal(Object.hasOwn(uncolored.tile,'color'),false);
assert.equal(Object.hasOwn(normalizeTile(JSON.parse(JSON.stringify(uncolored.tile))),'color'),false);
assert.equal(normalizeTile({color:'white',edgeColor:'#414140'}).edgeColor,'#414140');
for(const edgeColor of ['414140','#fff','red',null])assert.throws(()=>normalizeTile({edgeColor}));
console.log('PASS: optional prefab color survives roundtrip and intrinsic edge colors are validated.');

for(const terrain of TERRAIN_TYPES){
  const tile=normalizeTile({height:.2,edgeColor:'#414140',terrain,terrainConfig:{nested:{value:2}}});
  assert.equal(Object.hasOwn(tile,'color'),false);
  assert.equal(tile.edgeColor,'#414140');
  assert.equal(tile.terrain,terrain);
  assert.deepEqual(normalizeTile(JSON.parse(JSON.stringify(tile))),tile);
}
console.log('PASS: bridged mechanism properties coexist with optional color and intrinsic edges.');

assert.throws(()=>normalizeTile({color:'white',instance:{id:'broken'}}),/占格/);
const instance={id:'valid',anchorR:0,anchorC:0,width:2,height:3};
assert.deepEqual(normalizeTile({color:'white',instance}).instance,instance);
console.log('PASS: entity instance metadata rejects malformed footprints and preserves valid identities.');
