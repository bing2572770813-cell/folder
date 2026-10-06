import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorShell } from "./react-editor.jsx";
export const renderEditorMarkup = () => renderToStaticMarkup(<EditorShell />);

import { MantineProvider } from "@mantine/core";
import { editorTheme } from "./react-editor.jsx";
import { PropertyInspector } from "./react/PropertyInspector.jsx";
export const renderInspectorMarkup = (props) =>
  renderToStaticMarkup(
    <MantineProvider theme={editorTheme} forceColorScheme="light">
      <PropertyInspector {...props} />
    </MantineProvider>,
  );
