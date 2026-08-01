import { ingestionError } from './errors.ts';

export interface JsonBounds {
  readonly maximumBytes: number;
  readonly maximumDepth: number;
  readonly maximumNodes: number;
}

interface OwnershipState {
  nodes: number;
  stringBytes: number;
  readonly ancestors: Set<object>;
}

export function ownAndFreezeIngestionJson<T>(
  value: T,
  bounds: JsonBounds,
): Readonly<T> {
  const state: OwnershipState = {
    nodes: 0,
    stringBytes: 0,
    ancestors: new Set(),
  };
  return own(value, 0, bounds, state) as Readonly<T>;
}

function own(
  value: unknown,
  depth: number,
  bounds: JsonBounds,
  state: OwnershipState,
): unknown {
  if (depth > bounds.maximumDepth || ++state.nodes > bounds.maximumNodes) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    state.stringBytes += Buffer.byteLength(value, 'utf8');
    if (state.stringBytes > bounds.maximumBytes) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object' || state.ancestors.has(value)) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  state.ancestors.add(value);
  try {
    return Array.isArray(value)
      ? ownArray(value, depth, bounds, state)
      : ownObject(value, depth, bounds, state);
  } finally {
    state.ancestors.delete(value);
  }
}

function ownArray(
  value: unknown[],
  depth: number,
  bounds: JsonBounds,
  state: OwnershipState,
): readonly unknown[] {
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let length: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    length = Reflect.getOwnPropertyDescriptor(value, 'length');
  } catch {
    throw ingestionError('ingestion.invalid-receipt');
  }
  if (
    prototype !== Array.prototype ||
    length === undefined ||
    typeof length.value !== 'number' ||
    !Number.isSafeInteger(length.value) ||
    length.value < 0 ||
    length.value > bounds.maximumNodes ||
    keys.length !== length.value + 1 ||
    !keys.includes('length')
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const result: unknown[] = [];
  for (let index = 0; index < length.value; index += 1) {
    const key = String(index);
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    } catch {
      throw ingestionError('ingestion.invalid-receipt');
    }
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !('value' in descriptor) ||
      keys[index] !== key
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    result.push(own(descriptor.value, depth + 1, bounds, state));
  }
  return Object.freeze(result);
}

function ownObject(
  value: object,
  depth: number,
  bounds: JsonBounds,
  state: OwnershipState,
): Readonly<Record<string, unknown>> {
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = Reflect.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    throw ingestionError('ingestion.invalid-receipt');
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length > 100 ||
    keys.some((key) => typeof key !== 'string')
  ) {
    throw ingestionError('ingestion.invalid-receipt');
  }
  const result: Record<string, unknown> = {};
  for (const key of keys as readonly string[]) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    } catch {
      throw ingestionError('ingestion.invalid-receipt');
    }
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw ingestionError('ingestion.invalid-receipt');
    }
    result[key] = own(descriptor.value, depth + 1, bounds, state);
  }
  return Object.freeze(result);
}

export function parseBoundedJson(
  text: string,
  bounds: JsonBounds,
  code:
    | 'ingestion.invalid-manifest'
    | 'ingestion.invalid-receipt'
    | 'ingestion.provider-response',
): unknown {
  if (Buffer.byteLength(text, 'utf8') > bounds.maximumBytes) {
    throw ingestionError(
      code === 'ingestion.provider-response'
        ? 'ingestion.body-too-large'
        : code,
    );
  }
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    throw ingestionError(code);
  }
  validateTree(value, bounds, code);
  return value;
}

function validateTree(
  root: unknown,
  bounds: JsonBounds,
  code:
    | 'ingestion.invalid-manifest'
    | 'ingestion.invalid-receipt'
    | 'ingestion.provider-response',
): void {
  const stack: { readonly value: unknown; readonly depth: number }[] = [
    { value: root, depth: 0 },
  ];
  let nodes = 0;
  const ancestors = new Set<object>();
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined) {
      break;
    }
    nodes += 1;
    if (nodes > bounds.maximumNodes || current.depth > bounds.maximumDepth) {
      throw ingestionError(code);
    }
    if (current.value === null || typeof current.value !== 'object') {
      if (
        typeof current.value === 'number' &&
        !Number.isFinite(current.value)
      ) {
        throw ingestionError(code);
      }
      continue;
    }
    if (ancestors.has(current.value)) {
      throw ingestionError(code);
    }
    ancestors.add(current.value);
    const children = Array.isArray(current.value)
      ? current.value
      : Object.values(current.value as Record<string, unknown>);
    for (const child of children) {
      stack.push({ value: child, depth: current.depth + 1 });
    }
    ancestors.delete(current.value);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

export function requireRecord(
  value: unknown,
  code:
    | 'ingestion.invalid-manifest'
    | 'ingestion.invalid-receipt'
    | 'ingestion.provider-response' = 'ingestion.provider-response',
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw ingestionError(code);
  }
  return value;
}

export function requireString(value: unknown, maximumLength = 2_048): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumLength ||
    hasControlCharacter(value)
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return value;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

export function optionalString(
  value: unknown,
  maximumLength = 2_048,
): string | null {
  return value === null || value === undefined
    ? null
    : requireString(value, maximumLength);
}

export function requireTimestamp(value: unknown): string {
  const timestamp = requireString(value, 40);
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(timestamp) ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    throw ingestionError('ingestion.provider-response');
  }
  return new Date(timestamp).toISOString();
}
