import React from "react";
import { Tabs } from "@mantine/core";

// Mounted generic panels preserve their inputs and external adapter bindings.
export function TabbedSections({ label, defaultValue, sections }) {
  return (
    <Tabs
      defaultValue={defaultValue ?? sections[0].value}
      keepMounted
      keepMountedMode="display-none"
    >
      <Tabs.List className="editor-tabs" aria-label={label}>
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
