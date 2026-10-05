export function copyJson(value,depth=0){
  if(depth>16)throw new Error('JSON 属性嵌套过深');
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value;
  if(Array.isArray(value))return value.map(item=>copyJson(item,depth+1));
  if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null)){
    return Object.fromEntries(Object.entries(value).map(([key,item])=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error('属性名称无效');return [key,copyJson(item,depth+1)];}));
  }
  throw new Error('属性必须是有效 JSON 数据');
}
