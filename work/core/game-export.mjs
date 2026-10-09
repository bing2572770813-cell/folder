// Authoring metadata is unnecessary in a playable snapshot; controlled behavior IDs stay intact.
export function runtimePrefabs(prefabs) {
  const copy=structuredClone(prefabs);
  const strip=value=>{
    if(!value||typeof value!=='object')return;
    // Only this reserved authoring schema is removable; arbitrary serialized fields remain gameplay data.
    delete value.propertySchema;
    for(const child of Object.values(value))strip(child);
  };
  strip(copy);return copy;
}
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
export function gameBoot({map,prefabs,tags=[],assets={}}) {
  return '<script>window.__FOLD_FIELD_GAME_ONLY__=true;window.__FOLD_FIELD_EXPORT_MAP__='+json(map)+';window.__FOLD_FIELD_PREFABS__='+json(runtimePrefabs(prefabs))+';window.__FOLD_FIELD_TAGS__='+json(runtimePrefabs(tags))+';window.__FOLD_FIELD_EXPORT_ASSETS__='+json(assets)+';</script>';
}
export function gameHtml(template,runtime,configuration) {
  if(!template.includes('<!--APP_SCRIPT-->'))throw new Error('缺少独立游戏模板');
  // The editor bootstrap carries a catalog and authoring shell; never duplicate those in the game.
  const marker='\n/*FOLD_FIELD_PLAY_RUNTIME*/\n',start=runtime.indexOf(marker);
  const playable=start<0?runtime:runtime.slice(start+marker.length);
  return template.replace('<body>','<body class="game-only">').replace('<!--APP_SCRIPT-->',()=>gameBoot(configuration)+'<script id="fold-field-runtime">'+playable.replace(/<\/script/gi,'<\\/script')+'</script>');
}
