export const lightingDefaults: Readonly<Record<string, number>>;
export const lightingFields: readonly (readonly [string, string, number, number, number])[];
export function validateLighting(values: Record<string, unknown>): Record<string, number>;
export function applyLighting(input: Record<string, unknown>, values: Record<string, unknown>, width: number, height: number): Record<string, number>;
