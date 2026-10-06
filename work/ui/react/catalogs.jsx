import React from "react";
import { UiButton, UiCheckbox } from "./controls.jsx";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { MantineProvider } from "@mantine/core";
import { editorTheme } from "../react-editor.jsx";
const roots = new WeakMap();
export function renderIsland(container, node) {
  let root = roots.get(container);
  if (!root) {
    root = createRoot(container);
    roots.set(container, root);
  }
  flushSync(() =>
    root.render(
      <MantineProvider theme={editorTheme} forceColorScheme="light">
        {node}
      </MantineProvider>,
    ),
  );
}
export function EntityGrid({ items, selected, onSelect }) {
  return (
    <>
      {items.map((item) => (
        <UiButton
          key={item.id}
          className={"prefab-preview" + (item.id === selected ? " active" : "")}
          data-prefab={item.id}
          data-name={item.name}
          title={item.name}
          aria-label={item.name}
          aria-pressed={item.id === selected}
          onClick={() => onSelect(item.id)}
        >
          <img src={item.preview} alt={item.name} />
        </UiButton>
      ))}
    </>
  );
}
export function renderEntityGrid(container, items, selected, onSelect) {
  renderIsland(
    container,
    <EntityGrid items={items} selected={selected} onSelect={onSelect} />,
  );
}
export function EntityChecklist({ items, hidden, onChange }) {
  return (
    <>
      {items.map((item) => (
        <label
          key={item.id}
          className="prefab-preview"
          title={item.name}
          data-name={item.name}
        >
          <UiCheckbox
            aria-label={"显示实体 " + item.name}
            checked={!hidden.has(item.id)}
            onChange={(e) => onChange(item.id, e.currentTarget.checked)}
          />
          <img src={item.preview} alt={item.name} />
        </label>
      ))}
    </>
  );
}
export function renderEntityChecklist(container, items, hidden, onChange) {
  renderIsland(
    container,
    <EntityChecklist items={items} hidden={hidden} onChange={onChange} />,
  );
}
export function NameChecklist({ names, selected, prefix, onChange, empty }) {
  const [checked, setChecked] = React.useState(selected);
  React.useEffect(() => setChecked(selected), [selected]);
  return names.length ? (
    <>
      {names.map((name) => (
        <UiCheckbox
          key={name}
          value={name}
          label={name}
          aria-label={prefix + name}
          checked={checked.has(name)}
          onChange={(e) => {
            const next = new Set(checked);
            if (e.currentTarget.checked) next.add(name);
            else next.delete(name);
            setChecked(next);
            onChange?.(name, e.currentTarget.checked);
          }}
        />
      ))}
    </>
  ) : (
    <span>{empty}</span>
  );
}
export function renderNameChecklist(
  container,
  names,
  selected,
  prefix,
  onChange,
  empty = "",
) {
  renderIsland(
    container,
    <NameChecklist
      names={names}
      selected={selected}
      prefix={prefix}
      onChange={onChange}
      empty={empty}
    />,
  );
}
export function renderMechanismText(container, texts) {
  renderIsland(
    container,
    <>
      {texts.map((text) => (
        <p key={text}>{text}</p>
      ))}
    </>,
  );
}
