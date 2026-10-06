const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const root = __dirname,
  outputs = path.join(root, "../outputs");
async function build() {
  const catalog = await require("./prefab-catalog.cjs").readCatalog();
  if (catalog.errors.length) console.warn("Prefab warnings:", catalog.errors);
  const shared = {
    bundle: true,
    write: false,
    legalComments: "inline",
    target: ["es2020"],
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
  };
  const server = await esbuild.build({
    ...shared,
    entryPoints: [path.join(root, "ui/server-render.jsx")],
    platform: "node",
    format: "cjs",
    packages: "external",
  });
  const ssr = new Module(path.join(root, "ui/react-shell.cjs"));
  ssr.filename = path.join(root, "ui/react-shell.cjs");
  ssr.paths = Module._nodeModulePaths(root);
  ssr._compile(server.outputFiles[0].text, ssr.filename);
  const markup = ssr.exports.renderEditorMarkup();
  const result = await esbuild.build({
    ...shared,
    plugins: [require("./build-support.cjs").workspaceFiles(root)],
    entryPoints: [path.join(root, "react-entry.jsx")],
    platform: "browser",
    format: "iife",
    minify: true,
    outfile: "editor.js",
  });
  const js = result.outputFiles.find((f) => f.path.endsWith(".js")).text,
    css = result.outputFiles.find((f) => f.path.endsWith(".css"))?.text ?? "";
  const template = fs
    .readFileSync(path.join(root, "editor.html"), "utf8")
    .replace(
      "</style>",
      fs.readFileSync(path.join(root, "ui/editor-tabs.css"), "utf8") +
        "\n</style>",
    )
    .replace("<style>", "<style>" + css + "</style><style>")
    .replace("<!--REACT_MARKUP-->", markup);
  const code =
    "window.__FOLD_FIELD_TAGS__??=" +
    JSON.stringify(catalog.tags).replace(/</g, "\\u003c") +
    ";window.__FOLD_FIELD_PREFABS__??=" +
    JSON.stringify(catalog.prefabs).replace(/</g, "\\u003c") +
    ";" +
    js.replace(/<\/script/gi, "<\\/script");
  fs.mkdirSync(outputs, { recursive: true });
  const html = template.replace(
    "<!--APP_SCRIPT-->",
    () => "<script>" + code + "</script>",
  );
  fs.writeFileSync(path.join(outputs, "index.html"), html);
  const demoMap = JSON.parse(
    fs.readFileSync(path.join(outputs, "fold-field-demo.json"), "utf8"),
  );
  const boot =
    "<script>window.__FOLD_FIELD_EXPORT_MAP__=" +
    JSON.stringify(demoMap).replace(/</g, "\\u003c") +
    ";window.__FOLD_FIELD_GAME_ONLY__=true;</script>";
  const gameHtml = template.replace(
    "<!--APP_SCRIPT-->",
    () => boot + "<script>" + code + "</script>",
  );
  fs.writeFileSync(path.join(outputs, "game.html"), gameHtml);
  console.log(
    "Built React editor HTML: " +
      Buffer.byteLength(html).toLocaleString() +
      " bytes",
  );
  console.log(
    "Built standalone game HTML: " +
      Buffer.byteLength(gameHtml).toLocaleString() +
      " bytes",
  );
}
build().catch((error) => {
  console.error(error);
  process.exit(1);
});
