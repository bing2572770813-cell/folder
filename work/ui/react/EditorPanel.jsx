import React from "react";
import { Tabs } from "@mantine/core";
import { MapEditorPanel } from "./MapEditorPanel.jsx";
import { InspectorPanel } from "./InspectorPanel.jsx";
import { MapProperties } from "./MapProperties.jsx";
import { LayerVisibility } from "./LayerVisibility.jsx";
const panels = [
  ["map", "地图编辑", "tabMap", "panelMap", MapEditorPanel],
  ["inspect", "检视", "tabInspect", "panelInspect", InspectorPanel],
  ["properties", "地图属性", "tabProperties", "panelProperties", MapProperties],
  ["layers", "图层", "tabLayers", "panelLayers", LayerVisibility],
];
export const EditorPanel = React.memo(function EditorPanel() {
  return (
    <div id="editPanel">
      <Tabs
        defaultValue="map"
        keepMounted
        keepMountedMode="display-none"
        onChange={(name) =>
          document.dispatchEvent(
            new CustomEvent("fold:editor-tab", { detail: name }),
          )
        }
      >
        <Tabs.List className="editor-tabs" aria-label="编辑器工具面板">
          {panels.map(([name, label, tabId]) => (
            <Tabs.Tab
              key={name}
              value={name}
              id={tabId}
              aria-controls={panels.find((p) => p[0] === name)[3]}
              data-tab={name}
            >
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {panels.map(([name, label, tabId, panelId, Panel]) => (
          <Tabs.Panel
            key={name}
            value={name}
            id={panelId}
            aria-labelledby={tabId}
            data-panel={name}
            tabIndex={0}
          >
            <Panel />
          </Tabs.Panel>
        ))}
      </Tabs>
    </div>
  );
});
