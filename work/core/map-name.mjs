export function normalizeMapName(value) {
  return typeof value==='string'&&value.trim()?value.trim().slice(0,48):'未命名关卡';
}

export function mapFilename(name) {
  let safe=normalizeMapName(name).replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/g,'');
  if(!safe)safe='未命名关卡';
  if(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(safe))safe='_'+safe;
  return safe+'.json';
}
