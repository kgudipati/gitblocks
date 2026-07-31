const MAXIMUM_DEPTH = 64;
const MAXIMUM_NODES = 100_000;
const MAXIMUM_ARRAY_LENGTH = 50_000;
const MAXIMUM_OBJECT_KEYS = 1_024;
const MAXIMUM_STRING_BYTES = 8 * 1024 * 1024;
const ARRAY_INDEX = /^(?:0|[1-9][0-9]*)$/u;

export class RepositoryInterviewEvaluationOwnershipError extends Error {
  constructor() {
    super('Repository interview evaluation input is invalid.');
    this.name = 'RepositoryInterviewEvaluationOwnershipError';
  }
}

export function ownAndFreezeRepositoryInterviewEvaluationDataV1<T>(
  value: T,
): T {
  const state = {
    nodes: 0,
    stringBytes: 0,
    active: new WeakSet<object>(),
  };
  try {
    return copy(value, 0, state) as T;
  } catch (error) {
    if (error instanceof RepositoryInterviewEvaluationOwnershipError)
      throw error;
    throw new RepositoryInterviewEvaluationOwnershipError();
  }
}

interface CopyState {
  nodes: number;
  stringBytes: number;
  readonly active: WeakSet<object>;
}

function copy(value: unknown, depth: number, state: CopyState): unknown {
  if (depth > MAXIMUM_DEPTH) fail();
  state.nodes += 1;
  if (state.nodes > MAXIMUM_NODES) fail();
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail();
    return value;
  }
  if (typeof value === 'string') {
    state.stringBytes += Buffer.byteLength(value, 'utf8');
    if (state.stringBytes > MAXIMUM_STRING_BYTES) fail();
    return value;
  }
  if (typeof value !== 'object') fail();
  if (state.active.has(value)) fail();
  state.active.add(value);
  try {
    return Array.isArray(value)
      ? copyArray(value, depth, state)
      : copyObject(value, depth, state);
  } finally {
    state.active.delete(value);
  }
}

function copyArray(
  value: readonly unknown[],
  depth: number,
  state: CopyState,
): readonly unknown[] {
  if (Object.getPrototypeOf(value) !== Array.prototype) fail();
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === 'symbol')) fail();
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    lengthDescriptor === undefined ||
    !('value' in lengthDescriptor) ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > MAXIMUM_ARRAY_LENGTH
  )
    fail();
  const length = lengthDescriptor.value;
  if (keys.length !== length + 1) fail();
  const output: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const key = String(index);
    if (!keys.includes(key)) fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !('value' in descriptor) ||
      !descriptor.enumerable
    )
      fail();
    output.push(copy(descriptor.value, depth + 1, state));
  }
  for (const key of keys) {
    if (key === 'length') continue;
    if (typeof key !== 'string' || !ARRAY_INDEX.test(key)) fail();
    const numeric = Number(key);
    if (!Number.isSafeInteger(numeric) || numeric >= length) fail();
  }
  return Object.freeze(output);
}

function copyObject(
  value: object,
  depth: number,
  state: CopyState,
): Readonly<Record<string, unknown>> {
  if (Object.getPrototypeOf(value) !== Object.prototype) fail();
  const keys = Reflect.ownKeys(value);
  if (
    keys.length > MAXIMUM_OBJECT_KEYS ||
    keys.some((key) => typeof key === 'symbol')
  )
    fail();
  const output: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== 'string') fail();
    state.stringBytes += Buffer.byteLength(key, 'utf8');
    if (state.stringBytes > MAXIMUM_STRING_BYTES) fail();
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !('value' in descriptor) ||
      !descriptor.enumerable
    )
      fail();
    Object.defineProperty(output, key, {
      value: copy(descriptor.value, depth + 1, state),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return Object.freeze(output);
}

function fail(): never {
  throw new RepositoryInterviewEvaluationOwnershipError();
}
