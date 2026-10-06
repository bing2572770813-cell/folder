import React from "react";
import {
  UiButton,
  UiInput,
  UiSelect,
  UiDisclosure,
  UiSection,
} from "./controls.jsx";

export const SelectionClipboard = React.memo(function SelectionClipboard() {
  return (
    <UiSection className="section">
      <h2 className="section-label">{"选区与剪贴板"}</h2>
      <div className="studio-tools">
        <UiButton id="copyRegion" data-tip="复制选区" aria-label="复制选区">
          <i data-lucide="copy" />
        </UiButton>
        <UiButton
          id="pasteRegion"
          data-tip="选择粘贴落点"
          aria-label="粘贴选区"
        >
          <i data-lucide="clipboard-paste" />
        </UiButton>
      </div>
      <UiDisclosure className="studio-section" open={true}>
        <summary>{"区域标签"}</summary>
        <label>
          {"区域标签"}
          <UiSelect id="regionChoice" aria-label="区域标签">
            <option value="">{"新建区域"}</option>
          </UiSelect>
        </label>
        <label id="newRegionPanel">
          {"区域名称"}
          <UiInput id="regionName" maxLength="80" aria-label="区域名称" />
        </label>
        <UiButton id="assignRegion">{"设置区域标签"}</UiButton>
        <div className="studio-readout" id="regionStatus">
          {"未选择区域"}
        </div>
      </UiDisclosure>
    </UiSection>
  );
});
