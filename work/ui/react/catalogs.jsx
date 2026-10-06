import React from "react";
import { SingleSelectIconOptions } from "./SingleSelect_icons.jsx";
import { MultiSelectIconOptions } from "./MultiSelect_icons.jsx";
import { UiCheckbox } from "./controls.jsx";
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
    <SingleSelectIconOptions
      items={items}
      value={selected}
      onChange={onSelect}
      renderIcon={(item) => <img src={item.preview} alt={item.name} />}
      optionProps={(item) => ({
        "data-prefab": item.id,
        "data-name": item.name,
      })}
    />
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
    <MultiSelectIconOptions
      items={items}
      value={
        new Set(
          items.filter((item) => !hidden.has(item.id)).map((item) => item.id),
        )
      }
      onChange={onChange}
      ariaPrefix="显示实体 "
      renderIcon={(item) => <img src={item.preview} alt={item.name} />}
    />
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

export function renderRegionChecklist(container, names, selected, onChange) {
  renderIsland(
    container,
    <MultiSelectIconOptions
      items={names.map((name) => ({ id: name, name }))}
      value={selected}
      ariaPrefix="显示区域 "
      onChange={onChange}
      renderIcon={(item) => (
        <span className="icon-select-letter" aria-hidden="true">
          {item.name.slice(0, 1)}
        </span>
      )}
      empty="暂无区域"
    />,
  );
}
