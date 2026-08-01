const LIMITS = Object.freeze({
  maximumNodes: 20_000,
  maximumDepth: 32,
  maximumArrayLength: 500,
  maximumObjectKeys: 100,
  maximumStringBytes: 8 * 1024 * 1024,
});

interface OwnershipState {
  nodes: number;
  stringBytes: number;
  readonly ancestors: Set<object>;
}

export function ownAndFreezeOperatorData<T>(value: T): Readonly<T> {
  const state: OwnershipState = {
    nodes: 0,
    stringBytes: 0,
    ancestors: new Set(),
  };
  return own(value, 0, state) as Readonly<T>;
}

function own(value: unknown, depth: number, state: OwnershipState): unknown {
  if (depth > LIMITS.maximumDepth || ++state.nodes > LIMITS.maximumNodes) {
    throw new Error('Operator data is outside its bounds.');
  }
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    state.stringBytes += Buffer.byteLength(value, 'utf8');
    if (state.stringBytes > LIMITS.maximumStringBytes) {
      throw new Error('Operator data is outside its bounds.');
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Operator data is invalid.');
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== 'object') {
    throw new Error('Operator data is invalid.');
  }
  if (state.ancestors.has(value)) throw new Error('Operator data is cyclic.');
  state.ancestors.add(value);
  try {
    return Array.isArray(value)
      ? ownArray(value, depth, state)
      : ownObject(value, depth, state);
  } finally {
    state.ancestors.delete(value);
  }
}

function ownArray(
  value: unknown[],
  depth: number,
  state: OwnershipState,
): readonly unknown[] {
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  let lengthDescriptor: PropertyDescriptor | undefined;
  try {
    prototype = Reflect.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
    lengthDescriptor = Reflect.getOwnPropertyDescriptor(value, 'length');
  } catch {
    throw new Error('Operator data reflection failed.');
  }
  if (
    prototype !== Array.prototype ||
    lengthDescriptor === undefined ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0 ||
    lengthDescriptor.value > LIMITS.maximumArrayLength ||
    keys.length !== lengthDescriptor.value + 1 ||
    !keys.includes('length')
  ) {
    throw new Error('Operator array is invalid.');
  }
  const output: unknown[] = [];
  for (let index = 0; index < lengthDescriptor.value; index += 1) {
    const key = String(index);
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !('value' in descriptor) ||
      keys[index] !== key
    ) {
      throw new Error('Operator array is invalid.');
    }
    output.push(own(descriptor.value, depth + 1, state));
  }
  return Object.freeze(output);
}

function ownObject(
  value: object,
  depth: number,
  state: OwnershipState,
): Readonly<Record<string, unknown>> {
  let prototype: object | null;
  let keys: readonly PropertyKey[];
  try {
    prototype = Reflect.getPrototypeOf(value);
    keys = Reflect.ownKeys(value);
  } catch {
    throw new Error('Operator data reflection failed.');
  }
  if (
    (prototype !== Object.prototype && prototype !== null) ||
    keys.length > LIMITS.maximumObjectKeys ||
    keys.some((key) => typeof key !== 'string')
  ) {
    throw new Error('Operator object is invalid.');
  }
  const output: Record<string, unknown> = {};
  for (const key of keys as readonly string[]) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !descriptor.enumerable ||
      !('value' in descriptor)
    ) {
      throw new Error('Operator object is invalid.');
    }
    output[key] = own(descriptor.value, depth + 1, state);
  }
  return Object.freeze(output);
}

export function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort(compareText);
  const sorted = [...expected].sort(compareText);
  return (
    actual.length === sorted.length &&
    actual.every((key, index) => key === sorted[index])
  );
}

export function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
