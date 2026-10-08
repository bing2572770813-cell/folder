const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
const root = __dirname,
  outputs = path.join(root, "../outputs");
async function build() {
  const catalog = await require("./prefab-catalog.cjs").readCatalog();
  if (catalog.errors.length) console.warn("Prefab warnings:", catalog.errors);
  const {visualAssetPaths}=await import('./resources/visual-assets.mjs');
  const builtinVisuals=catalog.prefabs.map(prefab=>prefab.visual);
  const builtinAssets=Object.fromEntries(visualAssetPaths(builtinVisuals).map(asset=>[
    asset,'data:'+(asset.endsWith('.png')?'image/png':'application/octet-stream')+';base64,'+
      fs.readFileSync(path.join(root,'../assets',asset)).toString('base64'),
  ]));
  console.log('Prescanned visual assets: '+Object.keys(builtinAssets).length+' files across '+catalog.prefabs.length+' entity prefabs');
  const audioDir=path.join(root,'../assets/audio/音乐素材');
  const audioNames={
    'opening-bgm':'openinglevel1_bgm.mp3','level23-bgm':'level23_bgm.mp3','level45-bgm':'level45_bgm.mp3','level67-bgm':'level67_bgm.mp3','ending-bgm':'Ending_BGM.mp3',
    'level-complete':'level_complete.mp3','game-over':'GameOver.mp3','footstep':'footstep.mp3','flip':'flip_sound.wav','paper-fracture':'paper_fracture.mp3',
    'fire-spit':'fire_spit(1).mp3','phoenix-roar':'phoenix_roar.mp3','switch-open':'switch_open.mp3','switch-close':'switch_close.mp3','fire-environment':'fire_environment.wav',
  };
  const audioAssets=Object.fromEntries(Object.entries(audioNames).map(([name,file])=>{
    const ext=path.extname(file).toLowerCase();
    const mime=ext==='.wav'?'audio/wav':'audio/mpeg';
    return [name,`data:${mime};base64,${fs.readFileSync(path.join(audioDir,file)).toString('base64')}`];
  }));
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
    entryPoints: [path.join(root, "react-entry.tsx")],
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
    'window.__FOLD_FIELD_BUILTIN_ASSETS__??='+JSON.stringify(builtinAssets)+';window.__FOLD_FIELD_AUDIO_ASSETS__??='+JSON.stringify(audioAssets)+';'+
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
