// Folding capability is independent of walking collision and fold-line tags.
export function followsFold(tile){
 if(!tile)return false;
 return tile.followFold??(!tile.lift&&!tile.terrain&&tile.kind!=='player-token'&&(tile.surfaceConnected??(!tile.blocked&&(tile.prefabId==null||tile.prefabId==='paper_ai'))));
}
export function nodeFollowsFold(node){
 if(!node)return false;
 if(node.components.physics?.followFold!==undefined)return node.components.physics.followFold;
 if(!node.components.surface)return false;
 const tile={...node.configuration,...node.components.surface,prefabId:node.prefabId,
  surfaceConnected:node.components.surface.connected??node.configuration?.surfaceConnected,
  blocked:node.components.collision?.blocked??false,lift:node.components.lift,
  terrain:['campfire','ice','fire','eruption','key'].find(key=>Object.hasOwn(node.components,key))};
 return followsFold(tile);
}
