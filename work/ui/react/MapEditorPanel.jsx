import React from "react";

import { MapTools } from "./MapTools.jsx";
import { BlockEntities } from "./BlockEntities.jsx";
import { SelectionClipboard } from "./SelectionClipboard.jsx";
export const MapEditorPanel = React.memo(function MapEditorPanel() {
  return (
    <>
      <MapTools />
      <BlockEntities />
      <SelectionClipboard />
    </>
  );
});
