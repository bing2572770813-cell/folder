import React from "react";
import {
  UiButton,
  UiDisclosure,
  UiInput,
  UiSelect,
  UiCheckbox,
  UiTextarea,
} from "./controls.jsx";
import { TabbedSections } from "./TabbedSections.jsx";

export const PlayPanel = React.memo(function PlayPanel() {
  return (
    <div className="play-panel" id="playPanel" hidden={true}>
      <TabbedSections
        label="游玩面板"
        defaultValue="player"
        sections={[
          {
            value: "developer",
            label: "开发者选项",
            tabId: "tabDeveloper",
            panelId: "panelDeveloper",
            content: (
              <>
                <UiDisclosure className="studio-section test-options" open>
                  <summary>测试用选项</summary>
                  <div className="test-modifiers">
                    <UiButton id="freeTeleportToggle" aria-pressed="false">
                      任意位置传送<span>关闭</span>
                    </UiButton>
                    <UiButton id="foldHintsToggle" aria-pressed="true">
                      折纸位移提示<span>开启</span>
                    </UiButton>
                  </div>
                  <div className="orientation-row">
                    <span id="playFacingLabel">朝向：北</span>
                    <div className="mini-controls">
                      <UiButton
                        className="icon-btn rotate-left"
                        aria-label="逆时针转向"
                      >
                        <i data-lucide="rotate-ccw" />
                      </UiButton>
                      <UiButton
                        className="icon-btn rotate-right"
                        aria-label="顺时针转向"
                      >
                        <i data-lucide="rotate-cw" />
                      </UiButton>
                    </div>
                  </div>
                </UiDisclosure>
              </>
            ),
          },
          {
            value: "player",
            label: "玩家状态",
            tabId: "tabPlayerState",
            panelId: "panelPlayerState",
            content: (
              <>
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
                <UiDisclosure className="studio-section player-properties" open>
                  <summary>玩家属性</summary>
                  <div className="studio-fields">
                    <label>
                      朝向
                      <UiSelect id="playerDirection" aria-label="玩家朝向">
                        {[
                          "北",
                          "东北",
                          "东",
                          "东南",
                          "南",
                          "西南",
                          "西",
                          "西北",
                        ].map((name, i) => (
                          <option key={i} value={i}>
                            {name}
                          </option>
                        ))}
                      </UiSelect>
                    </label>
                    <label>
                      行坐标（从 1 开始）
                      <UiInput
                        id="playerRow"
                        aria-label="玩家行坐标"
                        type="number"
                        min={1}
                        step={1}
                      />
                    </label>
                    <label>
                      列坐标（从 1 开始）
                      <UiInput
                        id="playerColumn"
                        aria-label="玩家列坐标"
                        type="number"
                        min={1}
                        step={1}
                      />
                    </label>
                    <fieldset className="player-height-limits">
                      <legend>可移动高度差</legend>
                      <label>
                        最大上移
                        <UiInput
                          id="playerMaxUp"
                          aria-label="最大上移"
                          type="number"
                          min={0}
                          max={16}
                          step={0.01}
                          defaultValue={1}
                        />
                      </label>
                      <label>
                        最大下降
                        <UiInput
                          id="playerMaxDown"
                          aria-label="最大下降"
                          type="number"
                          min={0}
                          max={16}
                          step={0.01}
                          defaultValue={1}
                        />
                      </label>
                    </fieldset>
                    <fieldset className="player-height-limits">
                      <legend>机制状态</legend>
                      <label>
                        过热层数
                        <UiInput
                          id="playerOverheat"
                          aria-label="过热层数"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={0}
                        />
                      </label>
                      <label>
                        冰冻
                        <UiCheckbox id="playerFrozen" aria-label="玩家冰冻" />
                      </label>
                      <label>
                        机制行动次数
                        <UiInput
                          id="playerActions"
                          aria-label="机制行动次数"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={0}
                        />
                      </label>
                      <label>
                        已收集钥匙（JSON 名称数组）
                        <UiTextarea
                          id="playerCollectedKeys"
                          aria-label="已收集钥匙"
                          defaultValue="[]"
                        />
                      </label>
                      <p className="studio-readout">
                        持有钥匙状态由名称列表决定；修改机制行动次数会同步喷发周期。
                      </p>
                    </fieldset>
                    <UiButton id="applyPlayerProperties">应用玩家属性</UiButton>
                    <p
                      id="playerPropertyStatus"
                      className="studio-readout"
                      role="status"
                    >
                      仅修改当前游玩状态，重启后重置。
                    </p>
                  </div>
                </UiDisclosure>
                <div className="fold-state">
                  <strong id="foldTitle">{"未选择折纸线"}</strong>
                  <span id="foldDetail">{"—"}</span>
                  <UiButton
                    className="teleport-btn"
                    id="teleportBtn"
                    disabled={true}
                  >
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
              </>
            ),
          },
        ]}
      />
    </div>
  );
});
