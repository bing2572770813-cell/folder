import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MantineProvider } from "@mantine/core";
import { UiButton, UiInput, UiTextarea, UiCheckbox, UiSection, UiSelect, UiDisclosure, UiIcon } from "./controls.jsx";
import { Move, GitBranch, Trash2, Check } from "lucide";

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
      <span>{node.label}</span><small>{node.id}</small>
    </UiButton>
  ))}</MantineProvider>);
}
export function renderTreeParents(container, nodes) {
  renderInto(container, <><option value="">地图根节点</option>{nodes.map(node => (
    <option key={node.id} value={node.id} disabled={node.disabled}>{node.prefabId} · {node.id}</option>
  ))}</>);
}

// Fields stay mounted and uncontrolled so the scene adapter retains event targets.
export const TreeInspector = React.memo(function TreeInspector() {
  return <UiSection className="section">
    <h2 className="section-label">当前实体与关联节点</h2>
    <div id="treeNodes" className="studio-fields" role="group" aria-label="实体节点" />
    <fieldset id="treeFields" className="studio-fields" aria-label="当前实体" hidden>
      <p id="nodeIdentity" className="studio-readout" />
      <p id="nodeWorldPosition" className="studio-readout" />
      <UiDisclosure className="node-section" open>
        <summary>位置与父子关系</summary>
        <div className="studio-fields">
          <div className="node-coordinate-grid">
            <label>相对行<UiInput id="nodeLocalR" type="number" step="1" aria-label="节点局部行" /></label>
            <label>相对列<UiInput id="nodeLocalC" type="number" step="1" aria-label="节点局部列" /></label>
          </div>
          <label>相对朝向<UiSelect id="nodeLocalDir" aria-label="节点局部方向">
            {['北','东北','东','东南','南','西南','西','西北'].map((name, i) => <option key={i} value={i}>{name}</option>)}
          </UiSelect></label>
          <UiButton id="moveNode" className="node-command"><UiIcon icon={Move} />移动子树</UiButton>
          <label>父实体<UiSelect id="nodeParent" aria-label="父节点" /></label>
          <UiCheckbox id="preserveWorld" defaultChecked label="保持地图位置" aria-label="保持世界位置" />
          <UiButton id="reparentNode" className="node-command"><UiIcon icon={GitBranch} />应用父子关系</UiButton>
        </div>
      </UiDisclosure>
      <div id="nodeConfiguration" className="property-inspector" />
      <UiDisclosure className="node-section">
        <summary>高级配置</summary>
        <label>组件 JSON<UiTextarea id="nodeComponents" rows={8} aria-label="节点组件 JSON" /></label>
        <label>实体标签 JSON<UiTextarea id="nodeTags" rows={4} aria-label="节点标签 JSON" /></label>
        <UiButton id="applyNodeConfig" className="node-command"><UiIcon icon={Check} />应用配置</UiButton>
      </UiDisclosure>
      <p id="nodeEditStatus" className="studio-readout" role="status" />
      <UiButton id="deleteNode" className="node-command node-danger"><UiIcon icon={Trash2} />删除实体</UiButton>
    </fieldset>
  </UiSection>;
});
