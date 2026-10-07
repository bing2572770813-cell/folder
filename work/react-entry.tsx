import "@mantine/core/styles.css";
import "./ui/react-editor.css";
import { mountReactEditor } from "./ui/react-editor.jsx";

const container = document.getElementById("react-root");
if (!container) {
  throw new Error("缺少 React 编辑器挂载点");
}

mountReactEditor(container);

// The scene starts only after React has synchronously mounted every UI target.
import("./app.js").catch((error: unknown) => {
  console.error(error);
  const message = error instanceof Error ? error.message : String(error);
  container.textContent = "编辑器启动失败：" + message;
});
