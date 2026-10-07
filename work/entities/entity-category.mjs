export const entityCategories=Object.freeze([
  {id:'terrain',name:'地形'}, {id:'item',name:'道具'}, {id:'creature',name:'生物'},
]);
export function entityCategory(record){
  if(record?.static?.entityType)return record.static.entityType;
  const id=record?.prefabId??record?.id??record?.tile?.prefabId;
  if(id==='player_ai')return 'creature';
  if(id==='key_ai'||id==='player_token_ai'||record?.components?.key||record?.tile?.terrain==='key'||record?.configuration?.terrain==='key'||record?.tile?.kind==='player-token'||record?.configuration?.kind==='player-token')return 'item';
  return 'terrain';
}
export const isPlaceableEntity=record=>record?.static?.placeable!==false&&entityCategory(record)!=='creature'&&record?.id!=='void_ai';
