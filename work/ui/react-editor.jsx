import React from "react";
import { MantineProvider, createTheme } from "@mantine/core";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { EditorLayout } from "./react/EditorLayout.jsx";
export const editorTheme = createTheme({
  fontFamily: "Segoe UI, Microsoft YaHei, Arial, sans-serif",
  primaryColor: "paper",
  colors: {
    paper: [
      "#f5f7f1",
      "#eef1e9",
      "#e2e9dc",
      "#cfdbc5",
      "#b1c699",
      "#94ad77",
      "#729854",
      "#537340",
      "#354c3b",
      "#24342c",
    ],
  },
  defaultRadius: "sm",
  fontSizes: { xs: "11px", sm: "12px", md: "14px", lg: "16px", xl: "18px" },
});
export function EditorShell() {
  return (
    <MantineProvider theme={editorTheme} forceColorScheme="light">
      <EditorLayout />
    </MantineProvider>
  );
}
export function mountReactEditor(container) {
  const root = createRoot(container);
  flushSync(() => root.render(<EditorShell />));
  return () => root.unmount();
}
