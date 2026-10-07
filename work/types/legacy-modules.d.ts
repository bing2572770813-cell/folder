declare module '*.mjs' {
  const value: unknown;
  export default value;
}

declare module '*.cjs' {
  const value: unknown;
  export = value;
}

declare module '*.js' {
  const value: unknown;
  export default value;
}

declare module '*.jsx' {
  export function mountReactEditor(container: HTMLElement): () => void;
}

declare module '*.css' {
  const value: string;
  export default value;
}
