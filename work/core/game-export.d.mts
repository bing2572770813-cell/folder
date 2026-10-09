export function runtimePrefabs<T>(prefabs: T): T;
export function gameBoot(configuration: {map: unknown; prefabs: unknown; tags?: unknown; assets?: unknown}): string;
export function gameHtml(template: string, runtime: string, configuration: {map: unknown; prefabs: unknown; tags?: unknown; assets?: unknown}): string;
