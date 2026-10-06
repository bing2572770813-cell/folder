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
  assert.ok(document.querySelector('#nodeConfiguration'));
  assert.equal(document.querySelector('#nodeLocalDir').tagName, 'SELECT');
  assert.equal(document.querySelector('#nodeLocalDir').querySelectorAll('option').length, 8);
  assert.ok(document.querySelector('#nodeComponents').closest('details'));
  const nodeForm = parseHTML(module.exports.renderInspectorMarkup({
    values: { components: { fire: { damage: 1 }, collision: { blocked: false } }, tags: { requiredKeys: ['铜'] } },
    schema: { components: { children: { fire: { children: { damage: { tempEditable: false } } } } } },
    mixed: new Set(), onChange: () => {}, onError: () => {}, options: { structured: true, expanded: true },
  })).document;
  assert.ok(nodeForm.querySelector('[aria-label="过热增量 (components.fire.damage)"]').hasAttribute('disabled'));
  assert.equal(nodeForm.querySelector('[aria-label="阻挡 (components.collision.blocked)"]').getAttribute('type'), 'checkbox');
  assert.ok(nodeForm.querySelector('[aria-label="所需钥匙 1"]'));
  assert.equal(nodeForm.querySelector('textarea'), null);
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ['playerOverheat','playerFrozen','playerActions','playerCollectedKeys'])
    assert.equal(document.getElementById(id).closest('[role="tabpanel"]').id,'panelPlayerState');
  assert.ok(document.querySelector('#cellPropertyInspector'));
  assert.equal(document.querySelector('#clearMap').closest('.tool-grid').className,'tool-grid');
  assert.equal(document.querySelector('#freeTeleportToggle').closest('[role="tabpanel"]').id,'panelDeveloper');
  assert.equal(document.querySelector('#applyPlayerProperties').closest('[role="tabpanel"]').id,'panelPlayerState');
  assert.equal(document.querySelector('#tabPlayerState .mantine-Tabs-tabLabel').textContent,'玩家状态');
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

  const entityPicker = document
    .querySelector("#prefabSummary")
    .closest(".icon-select-row");
  const tagPicker = document
    .querySelector("#tagSummary")
    .closest(".icon-select-row");
  assert.ok(entityPicker && tagPicker);
  assert.equal(
    document.querySelector("#prefabSummary").className,
    document.querySelector("#tagSummary").className,
  );
  const entityLayer = document
    .querySelector("#entityVisibility")
    .closest("details");
  const regionLayer = document
    .querySelector("#regionVisibility")
    .closest("details");
  assert.equal(entityLayer.parentElement, regionLayer.parentElement);
  assert.equal(entityLayer.className, regionLayer.className);
  assert.equal(
    entityLayer.closest("section").querySelector("h2").textContent,
    "显示图层",
  );
  const items = [
    { id: "alpha", name: "图标 A", icon: "A" },
    { id: "beta", name: "图标 B", icon: "B", disabled: true },
  ];
  const single = parseHTML(
    module.exports.renderSelectionMarkup(false, {
      label: "任意单选",
      items,
      value: "alpha",
      summaryId: "genericSummary",
    }),
  ).document;
  assert.ok(
    single.querySelector("#genericSummary").textContent.includes("图标 A"),
  );
  assert.equal(
    single.querySelector('[aria-label="图标 A"]').getAttribute("aria-pressed"),
    "true",
  );
  assert.ok(
    single.querySelector('[aria-label="图标 B"]').hasAttribute("disabled"),
  );
  const multi = parseHTML(
    module.exports.renderSelectionMarkup(true, {
      label: "任意多选",
      items,
      value: new Set(["alpha"]),
    }),
  ).document;
  assert.ok(multi.querySelector('[value="alpha"]').hasAttribute("checked"));
  assert.ok(!multi.querySelector('[value="beta"]').hasAttribute("checked"));
  console.log(
    "PASS: React/Mantine shell, unique IDs, mounted panels, ARIA linkage, tool placement, mixed fields and property permissions.",
  );
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
