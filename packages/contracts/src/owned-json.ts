export function cloneOwnedJson<T>(value: T): T {
  return cloneValue(value, new Set<object>()) as T;
}

function cloneValue(value: unknown, ancestors: Set<object>): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return withAncestor(value, ancestors, () =>
      value.map((item) => cloneValue(item, ancestors)),
    );
  }
  if (!isPlainRecord(value)) {
    throw new Error('Contract input is not plain JSON data.');
  }
  return withAncestor(value, ancestors, () =>
    Object.fromEntries(
      Object.keys(value).map((key) => [key, cloneValue(value[key], ancestors)]),
    ),
  );
}

function withAncestor<T>(
  value: object,
  ancestors: Set<object>,
  callback: () => T,
): T {
  if (ancestors.has(value)) {
    throw new Error('Contract input is not plain JSON data.');
  }
  ancestors.add(value);
  try {
    return callback();
  } finally {
    ancestors.delete(value);
  }
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
