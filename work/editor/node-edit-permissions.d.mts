export function projectedCellSchema(primary: unknown, nodes: unknown[], tile: Record<string, unknown>, schemaFor: (node: unknown) => unknown, fallback: unknown): Record<string, unknown>;
export function assertNodePropertyChanges(before: { world: { serialize(): unknown[] } }, after: { world: { get(id: string): unknown } }, schemaFor: (node: unknown) => unknown): void;
