import React from "react";

export const Viewport = React.memo(function Viewport() {
  return (
    <div className="canvas-wrap" id="viewport">
      <div
        id="foldRadiusHint"
        className="fold-radius-hint"
        hidden={true}
        aria-live="polite"
      />
    </div>
  );
});
