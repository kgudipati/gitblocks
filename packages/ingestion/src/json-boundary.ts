import { ingestionError } from './errors.ts';

export interface JsonBounds {
  readonly maximumBytes: number;
  readonly maximumDepth: number;
  readonly maximumNodes: number;
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
