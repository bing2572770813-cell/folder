import {fieldPermissions,identityFields} from '../core/property-model.mjs';
export function renderPropertyInspector(container,values,schema,onChange,onError=()=>{},mixed=new Set()){
  const focused=container.contains(document.activeElement)?document.activeElement.getAttribute('aria-label'):null;
  const expanded=new Set([...container.querySelectorAll('details[open]')].map(node=>node.dataset.path));
  container.replaceChildren();
  function render(parent,value,definition,path,permissions){
    const access=fieldPermissions(definition,permissions,path.length===1&&identityFields.has(path[0]));if(!access.readable)return;
    const names={color:'颜色',edgeColor:'边缘颜色',height:'高度',thickness:'厚度',gradualRate:'过渡比例',blocked:'阻挡',prefabId:'实体 ID',instance:'实例身份',kind:'外观类型',terrain:'机制类型',terrainConfig:'机制参数',regionTag:'区域',tags:'标签',folds:'折线方向',fold:'兼容折线标记',keyName:'钥匙名',requiredKeys:'所需钥匙',exitTo:'跳转区域',spawn:'玩家起点',entry:'区域入口',properties:'扩展属性',propertySchema:'属性定义'};
    const name=definition.label||names[path.at(-1)]||path.at(-1);
    if(value&&typeof value==='object'&&!Array.isArray(value)){
      const group=document.createElement('details'),summary=document.createElement('summary');group.dataset.path=JSON.stringify(path);group.open=expanded.has(group.dataset.path);summary.textContent=name;group.append(summary);parent.append(group);
      for(const [key,item] of Object.entries(value))render(group,item,definition.children?.[key]??{},[...path,key],access);return;
    }
    const label=document.createElement('label'),title=document.createElement('span');label.className='inspector-field';title.textContent=name;label.append(title);
    const input=document.createElement(Array.isArray(value)?'textarea':'input');
    input.setAttribute('aria-label',name+' ('+path.join('.')+')');input.disabled=!access.tempEditable;
    if(typeof value==='boolean'){input.type='checkbox';input.checked=value;}
    else if(typeof value==='number'){input.type='number';input.step='any';input.value=String(value);}
    else input.value=Array.isArray(value)||value===null?JSON.stringify(value):String(value);
    const isMixed=mixed.has(JSON.stringify(path));if(isMixed){if(typeof value==='boolean')input.indeterminate=true;else{input.value='';input.placeholder='多个不同值';}}
    input.onchange=()=>{try{if(isMixed&&input.type==='number'&&input.value==='')throw new Error('请输入批量修改值');const next=typeof value==='boolean'?input.checked:typeof value==='number'?Number(input.value):Array.isArray(value)||value===null?JSON.parse(input.value):input.value;onChange(path,next);input.removeAttribute('aria-invalid');}catch(error){input.setAttribute('aria-invalid','true');status.textContent=error.message;onError(error);}};
    const status=document.createElement('small');status.textContent=!access.tempEditable?'只读':access.serializable?'地图配置 · 随地图保存':'临时调试 · 不保存';if(isMixed)status.textContent='多个不同值 · '+status.textContent;label.append(input,status);parent.append(label);
  }
  for(const [name,value] of Object.entries(values))render(container,value,schema[name]??{},[name],{readable:true,serializable:true,tempEditable:true});
  if(focused)[...container.querySelectorAll('input,textarea')].find(input=>input.getAttribute('aria-label')===focused)?.focus({preventScroll:true});
}
