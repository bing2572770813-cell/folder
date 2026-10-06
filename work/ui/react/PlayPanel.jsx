import React from "react";
import { UiButton, UiDisclosure } from "./controls.jsx";

export const PlayPanel = React.memo(function PlayPanel() {
  return (
    <div className="play-panel" id="playPanel" hidden={true}>
      <div className="player-status">
        <i data-lucide="navigation" />
        <div>
          <strong>{"玩家 01"}</strong>
          <small id="playerCoord">{"H8 · 朝北"}</small>
        </div>
      </div>
      <div className="run-stats">
        <div>
          <strong id="steps">{"00"}</strong>
          <span id="stepsLabel">{"总步数"}</span>
        </div>
        <div>
          <strong id="teleports">{"00"}</strong>
          <span>{"传送次数"}</span>
        </div>
      </div>
      <UiDisclosure className="studio-section test-options" open={true}>
        <summary>{"测试用选项"}</summary>
        <div className="test-modifiers">
          <UiButton id="freeTeleportToggle" aria-pressed="false">
            {"任意位置传送"}
            <span>{"关闭"}</span>
          </UiButton>
          <UiButton id="foldHintsToggle" aria-pressed="true">
            {"折纸位移提示"}
            <span>{"开启"}</span>
          </UiButton>
        </div>
        <div className="orientation-row">
          <span id="playFacingLabel">{"朝向：北"}</span>
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
      </UiDisclosure>
      <div className="fold-state">
        <strong id="foldTitle">{"未选择折纸线"}</strong>
        <span id="foldDetail">{"—"}</span>
        <UiButton className="teleport-btn" id="teleportBtn" disabled={true}>
          <i data-lucide="waypoints" />
          {"折纸传送"}
          <kbd>{"F"}</kbd>
        </UiButton>
      </div>
      <div className="play-hints" id="playHints">
        {
          "点击玩家显示八方向可移动方块；点击折纸线高亮目标，再次点击目标方块传送；也可按 F 或按钮。"
        }
      </div>
    </div>
  );
});
