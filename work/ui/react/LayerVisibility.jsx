import React from "react";
import { UiCheckbox, UiSection } from "./controls.jsx";
import { MultiSelect_icons } from "./MultiSelect_icons.jsx";
export const LayerVisibility = React.memo(function LayerVisibility() {
  return (
    <UiSection className="section layer-visibility">
      <h2 className="section-label">显示图层</h2>
      <div className="studio-fields">
        <label>
          <UiCheckbox id="coordsVisible" defaultChecked />
          坐标
        </label>
        <label>
          <UiCheckbox id="foldsVisible" defaultChecked />
          折纸线
        </label>
        <label>
          <UiCheckbox id="playerVisible" defaultChecked />
          方块标签
        </label>
      </div>
      <div className="layer-visibility-sections">
        <MultiSelect_icons
          label="实体"
          summaryId="entityLayerSummary"
          gridId="entityVisibility"
          selectAllId="showAllEntities"
          clearAllId="hideAllEntities"
        />
        <MultiSelect_icons
          label="显示区域"
          summaryId="regionLayerSummary"
          gridId="regionVisibility"
          showActions={false}
        />
      </div>
    </UiSection>
  );
});
