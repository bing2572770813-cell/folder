import "@mantine/core/styles.css";
import "./ui/react-editor.css";
import { mountReactEditor } from "./ui/react-editor.jsx";
mountReactEditor(document.getElementById("react-root"));
// The scene starts only after React has synchronously mounted every UI target.
import("./app.js").catch((error) => {
  console.error(error);
  document.getElementById("react-root").textContent =
    "编辑器启动失败：" + error.message;
});
