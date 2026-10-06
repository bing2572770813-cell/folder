import React, { useEffect, useState } from "react";
import { UiInput, UiCheckbox, UiTextarea, UiDisclosure, UiButton, UiIcon, UiSelect } from "./controls.jsx";
import { Plus, X } from "lucide";
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
  connected: "连接相邻纸面",
  surfaceConnected: "连接相邻纸面",
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
  components: "组件",
  surface: "表面",
  collision: "碰撞",
  fire: "火焰",
  ice: "冰河",
  campfire: "篝火",
  eruption: "喷发",
  key: "钥匙",
  directions: "折线方向",
  damage: "过热增量",
  name: "名称",
  tag: "标签组件",
};
function PrimitiveList({ value, path, access, definition, onChange, onError }) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const signature = JSON.stringify(value);
  useEffect(() => { setDraft(value); setError(''); }, [signature]);
  const items = fieldPermissions(definition.items ?? {}, access);
  const editable = access.tempEditable && items.tempEditable && items.readable;
  const title = definition.label || names[path.at(-1)] || path.at(-1);
  function commit(next) {
    try { onChange(path, next); setError(''); }
    catch (e) { setError(e.message); onError(e); }
  }
  return <div className="inspector-list">
    <span>{title}</span>
    {items.readable && draft.map((item, index) => <div className="inspector-list-row" key={index}>
      <UiInput aria-label={`${title} ${index + 1}`} value={String(item)} disabled={!editable}
        type={typeof item === 'number' ? 'number' : 'text'}
        onChange={e => setDraft(draft.map((entry, i) => i === index ? e.currentTarget.value : entry))}
        onBlur={() => {
          const next = draft.map((entry, i) => typeof (value[i] ?? value[0]) === 'number' ? Number(entry) : entry);
          if (next.some((entry, i) => typeof (value[i] ?? value[0]) === 'number' && (draft[i] === '' || !Number.isFinite(entry)))) {
            setError('请输入有效数字'); return;
          }
          if (JSON.stringify(next) !== signature) commit(next);
        }} />
      <UiButton type="button" className="compact-icon" aria-label={`移除${title} ${index + 1}`} title="移除" disabled={!editable}
        onClick={() => { const next = value.filter((_, i) => i !== index); if(index >= value.length)setDraft(draft.filter((_, i) => i !== index));else commit(next); }}><UiIcon icon={X} /></UiButton>
    </div>)}
    <UiButton type="button" className="compact-icon" title={`添加${title}`} aria-label={`添加${title}`} disabled={!editable}
      onClick={() => setDraft([...draft, value.length && typeof value[0] === 'number' ? 0 : ''])}><UiIcon icon={Plus} /></UiButton>
    {error && <small role="alert">{error}</small>}
  </div>;
}
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
  options = {},
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
      ) : options.choices?.[path.join('.')] ? (
        <UiSelect {...props} value={draft} onChange={e => { setDraft(e.currentTarget.value); commit(e.currentTarget.value); }}>
          {options.choices[path.join('.')].map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
        </UiSelect>
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
  options = {},
}) {
  const access = fieldPermissions(
    definition,
    parent,
    path.length === 1 && identityFields.has(path[0]),
  );
  if (!access.readable) return null;
  if (value && typeof value === "object" && !Array.isArray(value))
    return (
      <UiDisclosure data-path={JSON.stringify(path)} open={options.expanded ? true : undefined}>
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
            options={options}
          />
        ))}
      </UiDisclosure>
    );
  if (options.structured && Array.isArray(value) && value.every(item => typeof item === 'string' || typeof item === 'number'))
    return <PrimitiveList value={value} path={path} access={access} definition={definition} onChange={onChange} onError={onError} />;
  return (
    <PropertyField
      value={value}
      definition={definition}
      path={path}
      access={access}
      mixed={mixed.has(JSON.stringify(path))}
      onChange={onChange}
      onError={onError}
      options={options}
    />
  );
}
export function PropertyInspector({
  values,
  schema,
  onChange,
  onError,
  mixed,
  options = {},
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
          options={options}
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
  options = {},
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
          key={options.identity}
          values={values}
          schema={schema}
          onChange={onChange}
          onError={onError}
          mixed={mixed}
          options={options}
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
