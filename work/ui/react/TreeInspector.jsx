import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MantineProvider } from "@mantine/core";
import { UiButton, UiInput, UiTextarea, UiCheckbox, UiSection, UiSelect } from "./controls.jsx";

const roots = new WeakMap();
function renderInto(container, content) {
  let root = roots.get(container);
  if (!root) { root = createRoot(container); roots.set(container, root); }
  flushSync(() => root.render(content));
}
export function renderTreeNodes(container, nodes, onSelect) {
  renderInto(container, <MantineProvider>{nodes.map(node => (
    <UiButton key={node.id} type="button" title={node.id} data-node-id={node.id}
      className="entity-context-row" style={{ marginLeft: `${Math.min(node.depth ?? 0, 8) * 12}px` }}
      disabled={node.disabled} aria-pressed={node.selected} onClick={() => onSelect(node.id)}>
      {node.label}
    </UiButton>
  ))}</MantineProvider>);
}
export function renderTreeParents(container, nodes) {
  renderInto(container, <><option value="">地图根节点</option>{nodes.map(node => (
    <option key={node.id} value={node.id}>{node.prefabId} · {node.id}</option>
  ))}</>);
}

// Fields stay mounted and uncontrolled so the scene adapter retains event targets.
export const TreeInspector = React.memo(function TreeInspector() {
  return <UiSection className="section">
    <h2 className="section-label">当前实体与关联节点</h2>
    <div id="treeNodes" className="studio-fields" role="group" aria-label="实体节点" />
    <div id="treeFields" className="studio-fields" hidden>
      <p id="nodeIdentity" className="studio-readout" />
      <label>局部行<UiInput id="nodeLocalR" type="number" aria-label="节点局部行" /></label>
      <label>局部列<UiInput id="nodeLocalC" type="number" aria-label="节点局部列" /></label>
      <label>局部方向<UiInput id="nodeLocalDir" type="number" min="0" max="7" aria-label="节点局部方向" /></label>
      <UiButton id="moveNode">移动节点与子树</UiButton>
      <label>父节点<UiSelect id="nodeParent" aria-label="父节点" /></label>
      <label><UiCheckbox id="preserveWorld" defaultChecked aria-label="保持世界位置" />保持世界位置</label>
      <UiButton id="reparentNode">重挂载</UiButton>
      <label>组件 JSON<UiTextarea id="nodeComponents" rows={8} aria-label="节点组件 JSON" /></label>
      <label>实体标签 JSON<UiTextarea id="nodeTags" rows={4} aria-label="节点标签 JSON" /></label>
      <UiButton id="applyNodeConfig">应用节点配置</UiButton>
      <UiButton id="deleteNode">删除节点（保护引用与子节点）</UiButton>
      <p>区域属于地图格。方向相加，不旋转子节点偏移。</p>
    </div>
  </UiSection>;
});
