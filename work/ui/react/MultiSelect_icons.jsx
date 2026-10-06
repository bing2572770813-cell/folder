import React from "react";
import { UiButton, UiCheckbox, UiDisclosure } from "./controls.jsx";
export function MultiSelectIconOptions({
  items = [],
  value = new Set(),
  onChange,
  renderIcon = (item) => item.icon,
  ariaPrefix = "",
  empty = "暂无选项",
}) {
  return items.length ? (
    <>
      {items.map((item) => (
        <label
          key={item.id}
          className="prefab-preview icon-select-option"
          title={item.name}
          data-name={item.name}
        >
          <UiCheckbox
            disabled={item.disabled}
            value={item.id}
            aria-label={ariaPrefix + item.name}
            checked={value.has(item.id)}
            onChange={(e) => onChange?.(item.id, e.currentTarget.checked)}
          />
          {renderIcon(item)}
          <span className="icon-option-name">{item.name}</span>
        </label>
      ))}
    </>
  ) : (
    <span>{empty}</span>
  );
}
/** Reusable multi-select disclosure, independent of layers, entities or regions. */
export function MultiSelect_icons({
  label,
  gridId,
  summaryId,
  items,
  value,
  onChange,
  renderIcon,
  ariaPrefix,
  empty,
  selectAllId,
  clearAllId,
  onSelectAll,
  onClearAll,
  showActions = true,
}) {
  return (
    <UiDisclosure className="icon-select-dropdown multi-icon-select">
      <summary id={summaryId} className="icon-select-summary">
        {label}
      </summary>
      {showActions && (
        <div className="icon-select-actions">
          <UiButton id={selectAllId} onClick={onSelectAll}>
            全选
          </UiButton>
          <UiButton id={clearAllId} onClick={onClearAll}>
            全部取消
          </UiButton>
        </div>
      )}
      <div
        id={gridId}
        className="prefab-grid icon-select-grid"
        role="group"
        aria-label={label}
      >
        {items && (
          <MultiSelectIconOptions
            items={items}
            value={value}
            onChange={onChange}
            renderIcon={renderIcon}
            ariaPrefix={ariaPrefix}
            empty={empty}
          />
        )}
      </div>
    </UiDisclosure>
  );
}
