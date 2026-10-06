import React from "react";

export const StatusBar = React.memo(function StatusBar() {
  return (
    <footer className="statusbar">
      <div className="status-left">
        <span id="statusMode">{"EDIT MODE"}</span>
        <span id="hoverCoord">{"—"}</span>
      </div>
      <div className="status-right">
        <span id="mapStats">{"112 可通行 / 8 阻挡 / 4 折纸线"}</span>
        <span className="renderer-label">
          <i className="dot" />
          {"THREE.JS"}
        </span>
      </div>
    </footer>
  );
});
