import React from "react";
import { UiButton, UiCheckbox, UiDisclosure } from "./controls.jsx";

export const DisplayLayers = React.memo(function DisplayLayers() {
  return (
    <>
      <UiDisclosure className="studio-section" open={true}>
        <summary>{"显示图层"}</summary>
        <div className="studio-fields">
          <label>
            <UiCheckbox id="coordsVisible" type="checkbox" defaultChecked />
            {"坐标"}
          </label>
          <UiDisclosure className="entity-layer-picker">
            <summary>{"实体"}</summary>
            <div>
              <UiButton id="showAllEntities">{"全选"}</UiButton>
              <UiButton id="hideAllEntities">{"全部取消"}</UiButton>
            </div>
            <div
              id="entityVisibility"
              className="prefab-grid"
              role="group"
              aria-label="显示实体"
            />
          </UiDisclosure>
          <label>
            <UiCheckbox id="foldsVisible" type="checkbox" defaultChecked />
            {"折纸线"}
          </label>
          <label>
            <UiCheckbox id="playerVisible" type="checkbox" defaultChecked />
            {"方块标签"}
          </label>
        </div>
        <h3>{"显示区域"}</h3>
        <div id="regionVisibility" />
      </UiDisclosure>
    </>
  );
});
