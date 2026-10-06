import React from "react";
import { UiButton, UiInput, UiSection } from "./controls.jsx";

export const MapProperties = React.memo(function MapProperties() {
  return (
    <>
      <p className="studio-readout">
        {"地图名称在顶部中央编辑；结构与可序列化配置随地图导出。"}
      </p>
      <UiSection className="section">
        <h2 className="section-label">
          {"地图尺寸"}
          <small>{"MAP SIZE"}</small>
        </h2>
        <div className="map-fields">
          <label>
            {"宽度"}
            <UiInput
              id="mapWidth"
              type="number"
              min="3"
              max="128"
              defaultValue="12"
              aria-label="地图宽度"
            />
          </label>
          <label>
            {"高度"}
            <UiInput
              id="mapHeight"
              type="number"
              min="3"
              max="128"
              defaultValue="10"
              aria-label="地图高度"
            />
          </label>
        </div>
        <UiButton className="apply-btn" id="resizeMap">
          <i data-lucide="scaling" />
          {"应用尺寸"}
        </UiButton>
      </UiSection>
    </>
  );
});
