import React from "react";
import { UiButton, UiDisclosure, UiSection } from "./controls.jsx";
import { TreeInspector } from "./TreeInspector.jsx";

export const InspectorPanel = React.memo(function InspectorPanel() {
  return (
    <>
      <UiSection className="section">
        <h2 className="section-label">{"当前选区"}</h2>
        <p id="inspectedEntity" className="studio-readout" role="status">
          {"使用地图工具的选区选择方格"}
        </p>
        <h3 className="section-label">实体整体属性</h3>
        <div id="propertyInspector" className="property-inspector" />
        <h3 className="section-label">直接选中方格的独立属性</h3>
        <p id="inspectedCellProperties" className="studio-readout" />
        <div id="cellPropertyInspector" className="property-inspector" />
        <p id="propertyEditStatus" className="studio-readout" role="status" />
        <UiDisclosure>
          <summary>{"实际配置与折线"}</summary>
          <pre id="inspectedProperties" className="inspection-json">
            {"尚未选择"}
          </pre>
        </UiDisclosure>
      </UiSection>
      <TreeInspector />
      <UiSection className="section">
        <h2 className="section-label">{"方块机制"}</h2>
        <div
          id="mechanismDescriptions"
          className="studio-readout"
          role="status"
        >
          {"选择实体以查看机制说明"}
        </div>
      </UiSection>
      <UiSection className="section">
        <h2 className="section-label">
          {"玩家方向"}
          <small>{"PLAYER"}</small>
        </h2>
        <div className="orientation-row">
          <span id="facingLabel">{"朝向：北"}</span>
          <div className="mini-controls">
            <UiButton
              className="icon-btn rotate-left"
              data-tip="逆时针转向"
              aria-label="逆时针转向"
            >
              <i data-lucide="rotate-ccw" />
            </UiButton>
            <UiButton
              className="icon-btn rotate-right"
              data-tip="顺时针转向"
              aria-label="顺时针转向"
            >
              <i data-lucide="rotate-cw" />
            </UiButton>
          </div>
        </div>
      </UiSection>
    </>
  );
});
