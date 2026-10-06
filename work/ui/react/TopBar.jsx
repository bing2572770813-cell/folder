import React from "react";
import { UiButton, UiInput } from "./controls.jsx";

export const TopBar = React.memo(function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brandmark">
          <i data-lucide="origami" />
        </div>
        <div>
          <div className="brand-name">{"FOLD FIELD"}</div>
          <div className="brand-sub">{"纸上地图 · 2.5D MAP EDITOR"}</div>
        </div>
      </div>
      <div className="top-middle">
        <UiInput
          id="mapName"
          className="project-name"
          type="text"
          maxLength="48"
          aria-label="地图名称"
          defaultValue="未命名关卡"
          spellCheck="false"
        />
        <span className="project-tag">{"LOCAL"}</span>
      </div>
      <div className="top-actions">
        <UiButton
          className="subtle-btn"
          id="newMap"
          data-tip="新建空白地图"
          aria-label="新建空白地图"
        >
          <i data-lucide="file-plus-2" />
          <span>{"新建"}</span>
        </UiButton>
        <div className="separator" />
        <UiButton
          className="subtle-btn"
          id="importMap"
          data-tip="导入地图 JSON"
          aria-label="导入地图"
        >
          <i data-lucide="folder-open" />
          <span>{"导入"}</span>
        </UiButton>
        <UiButton
          className="subtle-btn"
          id="exportMap"
          data-tip="导出地图 JSON"
          aria-label="导出地图"
        >
          <i data-lucide="download" />
          <span>{"导出地图"}</span>
        </UiButton>
        <UiButton
          className="subtle-btn"
          id="exportGame"
          data-tip="导出独立游戏预览"
          aria-label="导出游戏"
        >
          <i data-lucide="play" />
          <span>{"导出游戏"}</span>
        </UiButton>
      </div>
    </header>
  );
});
