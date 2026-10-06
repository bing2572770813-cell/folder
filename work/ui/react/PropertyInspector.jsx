import React, { useEffect, useState } from "react";
import { UiInput, UiCheckbox, UiTextarea, UiDisclosure } from "./controls.jsx";
import {
  fieldPermissions,
  identityFields,
} from "../../core/property-model.mjs";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MantineProvider } from "@mantine/core";
import { editorTheme } from "../react-editor.jsx";
const roots = new WeakMap();
const names = {
  color: "颜色",
  edgeColor: "边缘颜色",
  height: "高度",
  thickness: "厚度",
  gradualRate: "过渡比例",
  blocked: "阻挡",
  prefabId: "实体 ID",
  instance: "实例身份",
  kind: "外观类型",
  terrain: "机制类型",
  terrainConfig: "机制参数",
  regionTag: "区域",
  tags: "标签",
  folds: "折线方向",
  fold: "兼容折线标记",
  keyName: "钥匙名",
  requiredKeys: "所需钥匙",
  exitTo: "跳转区域",
  spawn: "玩家起点",
  entry: "区域入口",
  properties: "扩展属性",
  propertySchema: "属性定义",
};
const inputValue = (value) =>
  typeof value === "boolean"
    ? value
    : Array.isArray(value) || value === null
      ? JSON.stringify(value)
      : String(value);
function PropertyField({
  value,
  definition,
  path,
  access,
  mixed,
  onChange,
  onError,
}) {
  const [draft, setDraft] = useState(
    mixed && typeof value !== "boolean" ? "" : inputValue(value),
  );
  const [error, setError] = useState("");
  const signature = JSON.stringify(value);
  useEffect(() => {
    setDraft(mixed && typeof value !== "boolean" ? "" : inputValue(value));
    setError("");
  }, [signature, mixed]);
  const name = definition.label || names[path.at(-1)] || path.at(-1),
    label = name + " (" + path.join(".") + ")";
  function commit(raw = draft) {
    try {
      if (typeof value !== "boolean" && raw === inputValue(value) && !mixed)
        return;
      if (typeof value === "number" && raw === "")
        throw new Error("请输入修改值");
      const next =
        typeof value === "boolean"
          ? raw
          : typeof value === "number"
            ? Number(raw)
            : Array.isArray(value) || value === null
              ? JSON.parse(raw)
              : raw;
      onChange(path, next);
      setError("");
    } catch (e) {
      setError(e.message);
      onError(e);
    }
  }
  const props = {
    "aria-label": label,
    "aria-invalid": error ? "true" : undefined,
    disabled: !access.tempEditable,
  };
  return (
    <label className="inspector-field">
      <span>{name}</span>
      {typeof value === "boolean" ? (
        <UiCheckbox
          {...props}
          checked={!!draft}
          indeterminate={mixed}
          onChange={(e) => {
            setDraft(e.currentTarget.checked);
            commit(e.currentTarget.checked);
          }}
        />
      ) : Array.isArray(value) ? (
        <UiTextarea
          {...props}
          value={draft}
          placeholder={mixed ? "多个不同值" : undefined}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => commit()}
        />
      ) : (
        <UiInput
          {...props}
          type={typeof value === "number" ? "number" : "text"}
          step={typeof value === "number" ? "any" : undefined}
          value={draft}
          placeholder={mixed ? "多个不同值" : undefined}
          onChange={(e) => setDraft(e.currentTarget.value)}
          onBlur={() => commit()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
      )}
      <small>
        {error ||
          (mixed ? "多个不同值 · " : "") +
            (!access.tempEditable
              ? "只读"
              : access.serializable
                ? "地图配置 · 随地图保存"
                : "临时调试 · 不保存")}
      </small>
    </label>
  );
}
function PropertyNode({
  value,
  definition,
  path,
  parent,
  mixed,
  onChange,
  onError,
}) {
  const access = fieldPermissions(
    definition,
    parent,
    path.length === 1 && identityFields.has(path[0]),
  );
  if (!access.readable) return null;
  if (value && typeof value === "object" && !Array.isArray(value))
    return (
      <UiDisclosure data-path={JSON.stringify(path)}>
        <summary>
          {definition.label || names[path.at(-1)] || path.at(-1)}
        </summary>
        {Object.entries(value).map(([key, item]) => (
          <PropertyNode
            key={key}
            value={item}
            definition={definition.children?.[key] ?? {}}
            path={[...path, key]}
            parent={access}
            mixed={mixed}
            onChange={onChange}
            onError={onError}
          />
        ))}
      </UiDisclosure>
    );
  return (
    <PropertyField
      value={value}
      definition={definition}
      path={path}
      access={access}
      mixed={mixed.has(JSON.stringify(path))}
      onChange={onChange}
      onError={onError}
    />
  );
}
export function PropertyInspector({
  values,
  schema,
  onChange,
  onError,
  mixed,
}) {
  return (
    <>
      {Object.entries(values).map(([key, value]) => (
        <PropertyNode
          key={key}
          value={value}
          definition={schema[key] ?? {}}
          path={[key]}
          parent={{ readable: true, serializable: true, tempEditable: true }}
          mixed={mixed}
          onChange={onChange}
          onError={onError}
        />
      ))}
    </>
  );
}
export function renderPropertyInspector(
  container,
  values,
  schema,
  onChange,
  onError = () => {},
  mixed = new Set(),
) {
  const focused = container.contains(document.activeElement)
    ? document.activeElement.getAttribute("aria-label")
    : null;
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  flushSync(() =>
    root.render(
      <MantineProvider theme={editorTheme} forceColorScheme="light">
        <PropertyInspector
          values={values}
          schema={schema}
          onChange={onChange}
          onError={onError}
          mixed={mixed}
        />
      </MantineProvider>,
    ),
  );
  if (focused)
    [...container.querySelectorAll("input,textarea")]
      .find((input) => input.getAttribute("aria-label") === focused)
      ?.focus({ preventScroll: true });
}
export function clearPropertyInspector(container) {
  const root = roots.get(container);
  if (root) flushSync(() => root.render(null));
  else container.replaceChildren();
}
