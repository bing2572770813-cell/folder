export const entityCategories: readonly string[];
export function entityCategory(record: Record<string, unknown> | null | undefined): string;
export function isPlaceableEntity(record: Record<string, unknown> | null | undefined): boolean;
