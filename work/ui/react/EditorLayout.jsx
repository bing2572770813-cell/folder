import React from "react";
import { UiButton } from "./controls.jsx";
import { TopBar } from "./TopBar.jsx";
import { Viewport } from "./Viewport.jsx";
import { Sidebar } from "./Sidebar.jsx";
import { StatusBar } from "./StatusBar.jsx";
export const EditorLayout = React.memo(function EditorLayout() {
  return (
    <>
      <div className="app">
        <TopBar />
        <div className="workspace">
          <Sidebar />
          <main className="main">
            <Viewport />
            <div className="canvas-top">
              <div>
                <div className="scene-title">
                  <span id="sceneMapName">{"未命名关卡"}</span>
                  {" / "}
                  <span id="canvasMode">{"编辑"}</span>
                </div>
                <div className="scene-sub" id="toolStatus">
                  {"改颜色"}
                </div>
              </div>
              <div className="view-tabs">
                <UiButton id="fixedView" className="active" aria-pressed="true">
                  <i data-lucide="box" />
                  {"固定视角"}
                </UiButton>
                <UiButton id="topView" aria-pressed="false">
                  <i data-lucide="layers-2" />
                  {"俯视角"}
                </UiButton>
              </div>
            </div>
            <div className="game-hud" id="gameHud" hidden={true}>
              <strong id="gameTitle">{"关卡"}</strong>
              <span id="gameDescription">{"—"}</span>
              <small id="gameHint">
                {
                  "点击玩家查看移动范围；点击折纸线高亮目标，再次点击目标方块掉落。"
                }
              </small>
            </div>
            <div className="legend-inline">
              <i />
              <span id="selectionText">{"12 × 10 TILEMAP"}</span>
            </div>
            <div className="canvas-side">
              <UiButton
                className="icon-btn"
                id="zoomIn"
                data-tip="放大"
                aria-label="放大"
              >
                <i data-lucide="plus" />
              </UiButton>
              <UiButton
                className="icon-btn"
                id="zoomOut"
                data-tip="缩小"
                aria-label="缩小"
              >
                <i data-lucide="minus" />
              </UiButton>
              <UiButton
                className="icon-btn"
                id="fitView"
                data-tip="地图居中"
                aria-label="地图居中"
              >
                <i data-lucide="scan" />
              </UiButton>
              <span id="zoomLabel" className="zoom-label">
                {"100%"}
              </span>
            </div>
            <div className="toast" id="toast" role="status" />
            <div className="map-badge">
              <i data-lucide="origami" />
              <strong>{"纸张 01"}</strong>
              <span>{"/"}</span>
              <span id="tileCount">{"120 TILES"}</span>
            </div>
            <div className="action-bar">
              <UiButton className="primary" id="startBtn">
                <i data-lucide="play" />
                <span id="startLabel">{"开始游玩"}</span>
              </UiButton>
              <div className="bar-sep" />
              <UiButton id="restartBtn" data-tip="回到起点" aria-label="重启">
                <i data-lucide="rotate-ccw" />
                <span>{"重启"}</span>
              </UiButton>
              <UiButton
                id="undoBtn"
                data-tip="撤销上一步"
                aria-label="撤销"
                disabled={true}
              >
                <i data-lucide="undo-2" />
                <span>{"撤销"}</span>
              </UiButton>
            </div>
            <UiButton
              className="icon-btn"
              id="redoBtn"
              style={{ position: "absolute", bottom: "82px", left: "24px" }}
              data-tip="重做"
              aria-label="重做"
              disabled={true}
            >
              <i data-lucide="redo-2" />
            </UiButton>
            <div className="result-overlay" id="resultOverlay" hidden={true}>
              <div className="result-card">
                <h2 id="resultTitle">{"通关"}</h2>
                <p id="resultDetail">{"—"}</p>
                <div className="result-actions">
                  <UiButton className="primary" id="resultRetry">
                    {"再试一次"}
                  </UiButton>
                  <UiButton id="resultEdit">{"返回编辑"}</UiButton>
                </div>
              </div>
            </div>
            <div className="scene-count">
              <span>{"STEPS"}</span>
              <b id="canvasSteps">{"00"}</b>
            </div>
            <div className="viewport-corner">
              <i data-lucide="compass" />
              <span>{"ISOMETRIC"}</span>
            </div>
          </main>
        </div>
        <StatusBar />
      </div>
      <input
        id="mapFile"
        type="file"
        accept=".json,application/json"
        hidden={true}
      />
      <div className="tooltip" id="tooltip" role="tooltip" />
    </>
  );
});
