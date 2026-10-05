export function mountEditorTabs(root, {onActivate = () => {}} = {}) {
  const list = root.querySelector('[role="tablist"]');
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const panels = new Map([...root.querySelectorAll('[role="tabpanel"]')].map(panel => [panel.dataset.panel, panel]));
  const find = id => root.querySelector('#' + id);
  const selection = find('copyRegion').closest('details');
  const layers = find('entityVisibility').closest('.studio-section');
  const block = find('prefabGrid').closest('section');
  const tools = root.querySelector('[data-tool="paint"]').closest('section');
  const fold = root.querySelector('[data-fold="h"]').closest('section');
  const facing = find('facingLabel').closest('section');
  const dimensions = find('mapWidth').closest('section');
  const entitySelector = block.querySelector('.studio-fields');
  const selectorSection = document.createElement('section');
  selectorSection.className = 'section';
  const title = document.createElement('h2');title.className='section-label';title.textContent='实体类型';
  selectorSection.append(title, entitySelector);
  const selectionTools = document.createElement('section');selectionTools.className='section';
  const selectionTitle = document.createElement('h2');selectionTitle.className='section-label';selectionTitle.textContent='选区与剪贴板';
  selectionTools.append(selectionTitle, selection.querySelector('.studio-tools'));
  selection.querySelector('summary').textContent='区域标签';
  block.querySelector('h2').textContent='实例属性与标签';
  panels.get('map').append(tools, selectorSection, selectionTools, fold);
  panels.get('inspect').append(block, selection, facing);
  panels.get('properties').append(dimensions);
  panels.get('layers').append(layers);
  layers.open=true;
  let active='map';
  function activate(name, focus=false, notify=true) {
    if(!panels.has(name))throw new Error('Unknown editor tab: '+name);
    active=name;
    for(const tab of tabs){const selected=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;}
    for(const [key,panel] of panels)panel.hidden=key!==name;
    root.dataset.activeTab=name;
    if(focus)tabs.find(tab=>tab.dataset.tab===name).focus();
    if(notify)onActivate(name);
  }
  const listeners=[];
  const listen=(element,type,handler)=>{element.addEventListener(type,handler);listeners.push(()=>element.removeEventListener(type,handler));};
  for(const [index,tab] of tabs.entries()){
    listen(tab,'click',()=>activate(tab.dataset.tab));
    listen(tab,'keydown',event=>{
      let next;
      if(event.key==='ArrowRight'||event.key==='ArrowDown')next=(index+1)%tabs.length;
      else if(event.key==='ArrowLeft'||event.key==='ArrowUp')next=(index+tabs.length-1)%tabs.length;
      else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
      event.preventDefault();activate(tabs[next].dataset.tab,true);
    });
  }
  activate(active,false,false);
  return {activate,get active(){return active;},dispose(){for(const remove of listeners)remove();}};
}
