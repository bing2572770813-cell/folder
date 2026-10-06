import React from "react";
import {
  Box,
  Paper,
  UnstyledButton,
  Input,
  NativeSelect,
  Checkbox,
  Textarea,
} from "@mantine/core";
// Inputs remain uncontrolled: the game adapter validates and commits their values.
export const UiButton = React.forwardRef(function UiButton(props, ref) {
  return <UnstyledButton {...props} ref={ref} />;
});
export const UiInput = React.forwardRef(function UiInput(
  { className, style, ...props },
  ref,
) {
  return (
    <Input
      {...props}
      ref={ref}
      classNames={{ input: className }}
      styles={{ wrapper: { display: "contents" }, input: style }}
    />
  );
});
export const UiCheckbox = React.forwardRef(function UiCheckbox(props, ref) {
  return (
    <Checkbox
      {...props}
      ref={ref}
      styles={{
        root: { display: "inline-flex" },
        body: { alignItems: "center" },
      }}
    />
  );
});
export const UiSelect = React.forwardRef(function UiSelect(
  { children, ...props },
  ref,
) {
  return (
    <NativeSelect {...props} ref={ref}>
      {children}
    </NativeSelect>
  );
});
export const UiTextarea = React.forwardRef(function UiTextarea(props, ref) {
  return <Textarea {...props} ref={ref} />;
});
export function UiDisclosure(props) {
  return <Paper component="details" {...props} />;
}
export function UiSection(props) {
  return <Box component="section" {...props} />;
}
export function UiIcon({ icon, size = 16 }) {
  const render = ([tag, attrs, children = []], key) => React.createElement(tag,
    Object.fromEntries(Object.entries(attrs).map(([name, value]) => [name.replace(/-([a-z])/g, (_, c) => c.toUpperCase()), value])),
    ...children.map((child, index) => React.cloneElement(render(child), { key: index })));
  return React.cloneElement(render(icon), { width: size, height: size, 'aria-hidden': true });
}
