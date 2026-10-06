import React from "react";

import { MapTools } from "./MapTools.jsx";
import { BlockEntityTools } from "./BlockEntityTools.jsx";
import { SelectionClipboard } from "./SelectionClipboard.jsx";
export const MapEditorPanel = React.memo(function MapEditorPanel() {
  return (
    <>
      <MapTools />
      <BlockEntityTools />
      <SelectionClipboard />
    </>
  );
});
