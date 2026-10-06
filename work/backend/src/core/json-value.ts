export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export interface JsonObject {[key: string]: JsonValue}
export interface JsonPolicy {maxDepth: number; depthError: string; keyError: string; valueError: string}
const defaultPolicy: JsonPolicy = {
  maxDepth: 32, depthError: 'JSON nesting exceeds 32',
  keyError: 'Unsafe JSON property', valueError: 'Configuration must contain finite JSON values',
};

/** Pure shared JSON boundary, independent of Node, UI and entity semantics. */
export function jsonCopy(value: unknown, depth = 0, policy: JsonPolicy = defaultPolicy): JsonValue {
  if (depth > policy.maxDepth) throw new Error(policy.depthError);
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) {
    const result: JsonValue[] = [];
    for (let index = 0; index < value.length; index++) {
      if (!Object.hasOwn(value, index)) throw new Error(policy.valueError);
      result.push(jsonCopy(value[index], depth + 1, policy));
    }
    return result;
  }
  if (value && typeof value === 'object'
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    const result: JsonObject = {};
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(policy.keyError);
      result[key] = jsonCopy(item, depth + 1, policy);
    }
    return result;
  }
  throw new Error(policy.valueError);
}

export function jsonObject(value: unknown): JsonObject {
  const copied = jsonCopy(value);
  if (!copied || typeof copied !== 'object' || Array.isArray(copied)) throw new Error('Expected JSON object');
  return copied;
}

export function freezeJson<T extends JsonValue>(value: T): T {
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) freezeJson(item);
    Object.freeze(value);
  }
  return value;
}
