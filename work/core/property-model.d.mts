export const identityFields: ReadonlySet<string>;
export function normalizePropertySchema(schema?: unknown): Record<string, unknown>;
export function fieldPermissions(definition?: unknown, parent?: Record<string, boolean>, identity?: boolean): Record<string, boolean>;
export function projectProperties<T>(values: T, schema?: unknown, flag?: string): T;
export function propertyAt(values: unknown, schema: unknown, path: readonly (string | number)[]): { value: unknown; definition: unknown; permissions: Record<string, boolean> };
export function updateProperty<T>(values: T, schema: unknown, path: readonly (string | number)[], nextValue: unknown): T;
export function serializeMapConfiguration<T>(map: T, schemaFor?: (tile: unknown) => unknown): T;
export function mergeSerializableProperties<T>(before: T, after: T, schema?: unknown): T;
export function debugChanges(before: unknown, after: unknown, schema?: unknown): Array<{ path: Array<string | number>; value: unknown }>;
