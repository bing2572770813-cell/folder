import React from "react";
import { UiButton, UiDisclosure } from "./controls.jsx";
export function SingleSelectIconOptions({
  items = [],
  value,
  onChange,
  renderIcon = (item) => item.icon,
  optionProps = () => ({}),
}) {
  return (
    <>
      {items.map((item) => (
        <UiButton
          key={item.id}
          className={
            "icon-select-option prefab-preview" +
            (item.id === value ? " active" : "")
          }
          disabled={item.disabled}
          title={item.name}
          aria-label={item.name}
          aria-pressed={item.id === value}
          onClick={() => onChange?.(item.id)}
          {...optionProps(item)}
        >
          {renderIcon(item)}
        </UiButton>
      ))}
    </>
  );
}
/** Domain-free single icon selection shell; children provide optional parameter slots. */
export function SingleSelect_icons({
  label,
  summaryId,
  gridId,
  placeholder = "请选择",
  value,
  items,
  renderIcon = (item) => item.icon,
  onChange,
  optionProps,
  children,
  footer,
  gridChildren,
}) {
  const selected = items?.find((item) => item.id === value);
  return (
    <div className="icon-select-row">
      <span className="icon-select-label">{label}</span>
      <div className="icon-select-content">
        <UiDisclosure className="icon-select-dropdown prefab-picker">
          <summary id={summaryId} className="icon-select-summary">
            {selected ? (
              <>
                {renderIcon(selected)}
                <span>{selected.name}</span>
              </>
            ) : (
              placeholder
            )}
          </summary>
          <div
            id={gridId}
            className="prefab-grid icon-select-grid"
            role="group"
            aria-label={label}
          >
            {items ? (
              <SingleSelectIconOptions
                items={items}
                value={value}
                renderIcon={renderIcon}
                onChange={onChange}
                optionProps={optionProps}
              />
            ) : (
              gridChildren
            )}
          </div>
          {children}
        </UiDisclosure>
        {footer}
      </div>
    </div>
  );
}
