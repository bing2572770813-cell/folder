import React from "react";
import { UiButton, UiSection, UiRadio, UiIcon } from "./controls.jsx";
import { Replace, Layers2 } from "lucide";

export const MapTools = React.memo(function MapTools() {
  return (
    <UiSection className="section">
      <h2 className="section-label">
        {"地图工具"}
        <small>{"TOOLS"}</small>
      </h2>
      <fieldset className="placement-options">
        <legend>放置方式</legend>
        <UiRadio id="replacePlacement" name="placementMode" value="replace" defaultChecked
          label={<span><UiIcon icon={Replace} />替换</span>} aria-label="替换放置" />
        <UiRadio id="stackPlacement" name="placementMode" value="stack"
          label={<span><UiIcon icon={Layers2} />叠加</span>} aria-label="叠加放置" />
      </fieldset>
      <div className="tool-grid">
        <UiButton id="clearMap" className="tool-btn" data-tip="清空地图" aria-label="清空地图">
          <i data-lucide="trash-2" />
        </UiButton>
        <UiButton
          className="tool-btn"
          data-tool="place"
          data-tip="放置方块"
          aria-label="放置方块"
        >
          <i data-lucide="square-plus" />
        </UiButton>
        <UiButton
          className="tool-btn"
          data-tool="erase"
          data-tip="删除方块"
          aria-label="删除方块"
        >
          <i data-lucide="eraser" />
        </UiButton>
        <UiButton
          className="tool-btn"
          data-tool="fold"
          data-tip="放置折纸线"
          aria-label="放置折纸线"
        >
          <i data-lucide="split" />
        </UiButton>
        <UiSection id="foldDirectionPanel" className="section" hidden={true}>
          <h2 className="section-label">
            {"折纸方向"}
            <small>{"FOLD AXIS"}</small>
          </h2>
          <div className="fold-grid">
            <UiButton
              className="fold-btn active"
              data-fold="h"
              data-tip="横向折线"
              aria-label="横向折线"
            >
              <i className="fold-symbol" />
            </UiButton>
            <UiButton
              className="fold-btn"
              data-fold="v"
              data-tip="纵向折线"
              aria-label="纵向折线"
            >
              <i className="fold-symbol vertical" />
            </UiButton>
            <UiButton
              className="fold-btn"
              data-fold="d1"
              data-tip="对角线 ↘"
              aria-label="对角线 ↘"
            >
              <i className="fold-symbol diagonal" />
            </UiButton>
            <UiButton
              className="fold-btn"
              data-fold="d2"
              data-tip="对角线 ↗"
              aria-label="对角线 ↗"
            >
              <i className="fold-symbol antidiagonal" />
            </UiButton>
            <UiButton
              className="fold-btn"
              data-fold="none"
              data-tip="移除折纸线"
              aria-label="移除折纸线"
            >
              <i data-lucide="x" />
            </UiButton>
          </div>
        </UiSection>
        <UiButton
          className="tool-btn wide"
          id="gridToggle"
          aria-pressed="true"
          data-tip="显示或隐藏方块接缝的浅灰勾线"
        >
          <i data-lucide="grid-2x2" />
          {"网格"}
        </UiButton>
        <UiButton
          className="tool-btn"
          data-tool="select"
          data-tip="选区"
          aria-label="选区"
        >
          <i data-lucide="scan" />
          <span className="selection-mode-label">{"选区 · 单选"}</span>
        </UiButton>
      </div>
    </UiSection>
  );
});
