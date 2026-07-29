import { createHash } from 'node:crypto';

import { persistenceError } from './errors.ts';

const MAX_CANONICAL_DEPTH = 32;
const MAX_CANONICAL_NODES = 200_000;

export interface CanonicalValue {
  readonly digest: string;
  readonly json: string;
  readonly value: unknown;
}

export function canonicalizeJson(value: unknown): CanonicalValue {
  const state = { nodes: 0 };
  const owned = ownJsonValue(value, 0, state);
  const json: string = JSON.stringify(owned);
  return {
    digest: createHash('sha256').update(json, 'utf8').digest('hex'),
    json,
    value: owned,
  };
}

function ownJsonValue(
  value: unknown,
  depth: number,
  state: { nodes: number },
): unknown {
  state.nodes += 1;
  if (depth > MAX_CANONICAL_DEPTH || state.nodes > MAX_CANONICAL_NODES) {
    throw persistenceError('persistence.invalid-input');
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw persistenceError('persistence.invalid-input');
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => ownJsonValue(entry, depth + 1, state));
  }
  if (!isPlainDataRecord(value)) {
    throw persistenceError('persistence.invalid-input');
  }
  const owned: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort(compareText)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      !Object.hasOwn(descriptor, 'value') ||
      descriptor.enumerable !== true
    ) {
      throw persistenceError('persistence.invalid-input');
    }
    const entry: unknown = (
      descriptor as PropertyDescriptor & { readonly value: unknown }
    ).value;
    if (entry === undefined) {
      throw persistenceError('persistence.invalid-input');
    }
    owned[key] = ownJsonValue(entry, depth + 1, state);
  }
  return owned;
}

function isPlainDataRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  try {
    const prototype = Object.getPrototypeOf(value) as unknown;
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
