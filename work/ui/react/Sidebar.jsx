import React from "react";
import { UiButton } from "./controls.jsx";
import { EditorPanel } from "./EditorPanel.jsx";
import { PlayPanel } from "./PlayPanel.jsx";
export const Sidebar = React.memo(function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="mode-tabs">
        <UiButton id="editMode" className="active">
          <i data-lucide="pencil" />
          {"编辑模式"}
        </UiButton>
        <UiButton id="playMode">
          <i data-lucide="play" />
          {"游玩模式"}
        </UiButton>
      </div>
      <EditorPanel />
      <PlayPanel />
      <div className="side-meta">
        <span>{"FOLD FIELD / V1.0"}</span>
        <span id="saveState">{"本地已保存"}</span>
      </div>
    </aside>
  );
});
