import React from "react";
import { Tabs } from "@mantine/core";

// Mantine activates arrow-key targets, but Home/End only focus them.
// Capture these keys so focus, selected panel and the sole tab stop agree.
export function activateBoundaryTab(event) {
  if (event.key !== "Home" && event.key !== "End") return;
  const tabs = [...event.currentTarget.querySelectorAll('[role="tab"]')]
    .filter(tab => !tab.disabled);
  const target = event.key === "Home" ? tabs[0] : tabs.at(-1);
  if (!target) return;
  event.preventDefault();
  event.stopPropagation();
  target.focus();
  target.click();
}

// Mounted generic panels preserve their inputs and external adapter bindings.
export function TabbedSections({ label, defaultValue, sections }) {
  return (
    <Tabs
      defaultValue={defaultValue ?? sections[0].value}
      keepMounted
      keepMountedMode="display-none"
    >
      <Tabs.List className="editor-tabs" aria-label={label} onKeyDownCapture={activateBoundaryTab}>
        {sections.map((section) => (
          <Tabs.Tab
            key={section.value}
            value={section.value}
            id={section.tabId}
            aria-controls={section.panelId}
          >
            {section.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {sections.map((section) => (
        <Tabs.Panel
          key={section.value}
          value={section.value}
          id={section.panelId}
          aria-labelledby={section.tabId}
          tabIndex={0}
        >
          {section.content}
        </Tabs.Panel>
      ))}
    </Tabs>
  );
}
