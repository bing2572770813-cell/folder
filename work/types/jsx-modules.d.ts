declare module '*.jsx' {
  export function mountReactEditor(container: HTMLElement): () => void;
}

declare module '*.css' {
  const value: string;
  export default value;
}
