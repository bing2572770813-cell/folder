export type PropertyPath = readonly (string | number)[];

export class DebugState {
  values<T>(key: string, baseline: T, schema: unknown): T;
  set(key: string, path: PropertyPath, value: unknown): void;
  clear(): void;
}
