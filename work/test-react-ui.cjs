const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const esbuild = require("esbuild");
(async () => {
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, "ui/server-render.jsx")],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
  });
  const module = new Module(path.join(__dirname, "react-ui-test.cjs"));
  module.filename = module.id;
  module.paths = Module._nodeModulePaths(__dirname);
  module._compile(result.outputFiles[0].text, module.filename);
  const { parseHTML } = await import("linkedom");
  const { document } = parseHTML(module.exports.renderEditorMarkup());
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const panel of document.querySelectorAll('[role="tabpanel"]')) {
    assert.ok(document.getElementById(panel.getAttribute("aria-labelledby")));
    assert.ok(
      panel.querySelector('input,button,[role="status"]'),
      "Inactive panels must stay mounted",
    );
  }
  for (const tab of document.querySelectorAll('[role="tab"]'))
    assert.ok(document.getElementById(tab.getAttribute("aria-controls")));
  assert.equal(
    document.querySelector("#blockHeight").closest("details"),
    document.querySelector("#prefabSummary").parentElement,
  );
  assert.equal(
    document.querySelector("#foldDirectionPanel").previousElementSibling.dataset
      .tool,
    "fold",
  );
  assert.ok(
    document.querySelector("#foldDirectionPanel").hasAttribute("hidden"),
  );
  assert.ok(
    document
      .querySelector("#newMap")
      .className.includes("mantine-UnstyledButton"),
  );
  assert.ok(
    document.querySelector("#mapName").className.includes("mantine-Input"),
  );
  const props = {
    values: { height: 0.1, prefabId: "paper_ai", properties: { secret: 1 } },
    schema: { properties: { children: { secret: { readable: false } } } },
    mixed: new Set(['["height"]']),
    onChange: () => {},
    onError: () => {},
  };
  const inspector = parseHTML(
    module.exports.renderInspectorMarkup(props),
  ).document;
  assert.equal(
    inspector
      .querySelector('[aria-label="高度 (height)"]')
      .getAttribute("placeholder"),
    "多个不同值",
  );
  assert.ok(
    inspector
      .querySelector('[aria-label="实体 ID (prefabId)"]')
      .hasAttribute("disabled"),
  );
  assert.equal(
    inspector.querySelector('[aria-label="secret (properties.secret)"]'),
    null,
  );
  console.log(
    "PASS: React/Mantine shell, unique IDs, mounted panels, ARIA linkage, tool placement, mixed fields and property permissions.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
