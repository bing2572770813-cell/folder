declare module "*.jsx" {
  export function mountReactEditor(container: HTMLElement): () => void;
  export function renderTreeNodes(container: HTMLElement, nodes: unknown[], onSelect: (id: string) => void): void;
  export function renderTreeParents(container: HTMLElement, nodes: unknown[]): void;
  export function renderTestModifiers(container: HTMLElement, state: unknown, onChange: (...args: unknown[]) => void): void;
  export function renderEntityGrid(container: HTMLElement, items: unknown[], selected: string | null, onSelect: (id: string) => void): void;
  export function renderEntityChecklist(container: HTMLElement, items: unknown[], hidden: Set<string>, onChange: (id: string, hidden: boolean) => void): void;
  export function renderNameChecklist(container: HTMLElement, names: string[], selected: string[], onChange: (name: string, checked: boolean) => void, empty?: string): void;
  export function renderRegionChecklist(container: HTMLElement, names: string[], selected: string | null, onChange: (name: string) => void): void;
  export function renderMechanismText(container: HTMLElement, texts: string[]): void;
}

declare module "*.css" {
  const value: string;
  export default value;
}
