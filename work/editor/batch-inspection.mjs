import {propertyAt} from '../core/property-model.mjs';
export function selectionDetails(map,direct,isHidden=()=>false){
  const candidates=direct.filter(p=>p.r>=0&&p.c>=0&&p.r<map.height&&p.c<map.width);
  const expanded=inspectionCells(map,candidates),hiddenIds=new Set(expanded.filter(p=>isHidden(p.r,p.c)).map(p=>map.tiles[p.r]?.[p.c]?.instance?.id).filter(Boolean));
  const visible=candidates.filter(p=>!isHidden(p.r,p.c)&&!hiddenIds.has(map.tiles[p.r]?.[p.c]?.instance?.id));
  const cells=inspectionCells(map,visible),keys=new Set(visible.map(p=>p.r+','+p.c));
  return {direct:visible,cells,linked:cells.filter(p=>!keys.has(p.r+','+p.c))};
}
export function inspectionCells(map,selected){
  const ids=new Set(selected.map(p=>map.tiles[p.r]?.[p.c]?.instance?.id).filter(Boolean));
  const cells=new Map(selected.map(p=>[p.r+','+p.c,{...p}]));
  for(let r=0;r<map.height;r++)for(let c=0;c<map.width;c++)if(ids.has(map.tiles[r][c]?.instance?.id))cells.set(r+','+c,{r,c});
  return [...cells.values()];
}
export function batchProperties(entries){
  const schema={},mixed=new Set();
  function walk(values,path){
    const first=values[0];
    if(values.some(v=>v===undefined||typeof v!==typeof first||Array.isArray(v)!==Array.isArray(first)||(v===null)!==(first===null)))return undefined;
    const accesses=entries.map(e=>propertyAt(e.values,e.schema,path).permissions);
    let target=schema;for(const key of path.slice(0,-1))target=(target[key]??={}).children??={};
    target[path.at(-1)]=Object.fromEntries(['readable','serializable','tempEditable'].map(flag=>[flag,accesses.every(a=>a[flag])]));
    if(first&&typeof first==='object'&&!Array.isArray(first)){
      const result={};for(const key of Object.keys(first)){const value=walk(values.map(v=>v[key]),[...path,key]);if(value!==undefined)result[key]=value;}return result;
    }
    if(values.some(v=>JSON.stringify(v)!==JSON.stringify(first)))mixed.add(JSON.stringify(path));
    return structuredClone(first);
  }
  const values={};if(entries.length)for(const key of Object.keys(entries[0].values)){const value=walk(entries.map(e=>e.values[key]),[key]);if(value!==undefined)values[key]=value;}
  return {values,schema,mixed};
}
