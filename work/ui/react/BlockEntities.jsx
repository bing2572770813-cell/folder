import React from "react";
import {
  UiButton,
  UiInput,
  UiSelect,
  UiDisclosure,
  UiSection,
} from "./controls.jsx";

export const BlockEntities = React.memo(function BlockEntities() {
  return (
    <UiSection className="section">
      <h2 className="section-label">{"方块实体"}</h2>
      <div className="studio-fields">
        <label>
          {"方块实体"}
          <UiDisclosure className="prefab-picker">
            <summary id="prefabSummary">{"选择实体"}</summary>
            <div
              id="prefabGrid"
              className="prefab-grid"
              role="group"
              aria-label="方块实体"
            />
            <UiSelect id="prefabType" aria-label="方块实体" hidden={true} />
            <div
              id="blockColorPanel"
              className="block-color-panel"
              hidden={true}
            >
              <h3 className="section-label">
                {"方块颜色"}
                <small>{"COLOR"}</small>
              </h3>
              <div className="palette">
                <UiButton
                  className="swatch active"
                  style={{ "--swatch": "#f4f5ed" }}
                  data-color="white"
                  data-tip="白色"
                  aria-label="白色"
                  aria-pressed="true"
                />
                <UiButton
                  className="swatch"
                  style={{ "--swatch": "#e97c73" }}
                  data-color="red"
                  data-tip="红色"
                  aria-label="红色"
                />
                <UiButton
                  className="swatch"
                  style={{ "--swatch": "#e9cf72" }}
                  data-color="yellow"
                  data-tip="黄色"
                  aria-label="黄色"
                />
                <UiButton
                  className="swatch"
                  style={{ "--swatch": "#7ebed3" }}
                  data-color="blue"
                  data-tip="蓝色"
                  aria-label="蓝色"
                />
                <UiButton
                  className="swatch"
                  style={{ "--swatch": "#91bd83" }}
                  data-color="green"
                  data-tip="绿色"
                  aria-label="绿色"
                />
                <UiButton
                  className="swatch"
                  style={{ "--swatch": "#b6a0d0" }}
                  data-color="purple"
                  data-tip="紫色"
                  aria-label="紫色"
                />
                <UiButton
                  className="swatch"
                  style={{ "--swatch": "#303a38" }}
                  data-color="black"
                  data-tip="黑色"
                  aria-label="黑色"
                />
              </div>
              <div className="palette-info">
                <b id="colorName">{"纸白"}</b>
                <span id="colorType">{"普通方块"}</span>
              </div>
            </div>
            <UiSection className="block-entity-parameters">
              <h3 className="section-label">{"轮廓参数"}</h3>
              <div className="studio-fields">
                <label>
                  {"方块高度"}
                  <UiInput
                    id="blockHeight"
                    type="number"
                    min="0.01"
                    max="16"
                    step="0.01"
                    defaultValue="0.09"
                    aria-label="方块高度"
                  />
                </label>
                <label>
                  {"方块厚度"}
                  <UiInput
                    id="blockThickness"
                    type="number"
                    min="0.001"
                    max="16"
                    step="0.001"
                    defaultValue="0.09"
                    aria-label="方块厚度"
                  />
                </label>
                <label>
                  {"gradual rate"}
                  <UiInput
                    id="blockGradualRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    defaultValue="0.6666666666666666"
                    aria-label="gradual rate"
                    title="过渡部分总宽度 ÷ 平坦部分宽度"
                  />
                </label>
                <span id="prefabStatus" role="status" />
              </div>
            </UiSection>
          </UiDisclosure>
          <span id="footprintInfo" />
        </label>
      </div>
      <UiSection className="section">
        <div id="keyNamePanel" hidden={true}>
          <label>
            {"钥匙名"}
            <UiInput
              id="keyName"
              maxLength="80"
              defaultValue="钥匙"
              aria-label="钥匙名"
            />
          </label>
          <UiButton id="applyKeyName">{"修改选中钥匙名"}</UiButton>
        </div>
        <div className="tag-picker-row">
          <span className="tag-picker-label">{"方块标签"}</span>
          <UiDisclosure className="prefab-picker">
            <summary id="tagSummary">{"选择方块标签"}</summary>
            <div className="prefab-grid" role="group" aria-label="方块标签">
              <UiButton
                className="prefab-preview tag-preview"
                data-tool="player"
                data-name="玩家起点"
                title="玩家起点"
                aria-label="玩家起点"
              >
                <i data-lucide="navigation" />
              </UiButton>
              <UiButton
                className="prefab-preview tag-preview"
                data-tool="entry"
                data-name="设置区域入口"
                title="设置区域入口"
                aria-label="设置区域入口"
              >
                <i data-lucide="waypoints" />
              </UiButton>
              <UiButton
                className="prefab-preview tag-preview"
                data-tool="region-exit"
                data-name="设置区域出口"
                title="设置区域出口"
                aria-label="设置区域出口"
              >
                <i data-lucide="flag" />
              </UiButton>
              <UiButton
                className="prefab-preview tag-preview"
                data-tool="clear-tags"
                data-name="清除方块标签"
                title="清除方块标签"
                aria-label="清除方块标签"
              >
                <i data-lucide="x" />
              </UiButton>
            </div>
          </UiDisclosure>
        </div>
        <div id="exitRegionPanel" hidden={true}>
          <label>
            {"跳转区域"}
            <UiSelect id="exitRegion" aria-label="跳转区域" />
          </label>
          <UiDisclosure>
            <summary>{"所需 key"}</summary>
            <div id="requiredKeyList" />
          </UiDisclosure>
        </div>
      </UiSection>
    </UiSection>
  );
});
