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

import { SingleSelect_icons } from "./react/SingleSelect_icons.jsx";
import { MultiSelect_icons } from "./react/MultiSelect_icons.jsx";
export const renderSelectionMarkup = (multiple, props) =>
  renderToStaticMarkup(
    <MantineProvider theme={editorTheme} forceColorScheme="light">
      {multiple ? (
        <MultiSelect_icons {...props} />
      ) : (
        <SingleSelect_icons {...props} />
      )}
    </MantineProvider>,
  );

import {EntityGrid,EntityChecklist} from './react/catalogs.jsx';
export const renderEntityOptionsMarkup=(multiple,props)=>renderToStaticMarkup(
 <MantineProvider theme={editorTheme} forceColorScheme="light">
  {multiple?<EntityChecklist {...props}/>:<EntityGrid {...props}/>}
 </MantineProvider>);
