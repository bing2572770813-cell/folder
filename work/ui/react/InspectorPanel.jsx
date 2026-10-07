import React from "react";
import { UiDisclosure, UiSection } from "./controls.jsx";
import { TreeInspector } from "./TreeInspector.jsx";

export const InspectorPanel = React.memo(function InspectorPanel() {
  return (
    <>
      <UiSection className="section">
        <h2 className="section-label">实体机制</h2>
        <p id="inspectedEntity" className="studio-readout" role="status">
          使用地图工具的选区选择方格
        </p>
        <div id="propertyInspector" className="property-inspector" />
        <div id="cellSpecialInspector" className="property-inspector" />
        <h3 className="section-label">方块机制</h3>
        <div id="mechanismDescriptions" className="studio-readout" role="status">
          选择实体以查看机制说明
        </div>
        <p id="propertyEditStatus" className="studio-readout" role="status" />
      </UiSection>
      <UiSection className="section">
        <UiDisclosure className="node-section">
          <summary>通用外观与物理属性</summary>
          <div id="generalPropertyInspector" className="property-inspector" />
        </UiDisclosure>
        <UiDisclosure className="node-section">
          <summary>区域、标签与折线</summary>
          <p id="inspectedCellProperties" className="studio-readout" />
          <div id="cellPropertyInspector" className="property-inspector" />
        </UiDisclosure>
        <UiDisclosure className="node-section">
          <summary>原始配置与折线</summary>
          <pre id="inspectedProperties" className="inspection-json">尚未选择</pre>
        </UiDisclosure>
      </UiSection>
      <TreeInspector />
    </>
  );
});
