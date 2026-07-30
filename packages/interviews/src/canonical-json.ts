import { createHash } from 'node:crypto';

import type { JsonSchemaValue } from '@gitblocks/contracts';

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(canonicalizeJsonValue(value));
}

export function serializeCanonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalizeJsonValue(value), null, 2)}\n`;
}

export function canonicalizeJsonValue(value: unknown): JsonSchemaValue {
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
    return value.map((child) => canonicalizeJsonValue(child));
  }
  if (!isPlainRecord(value)) {
    throw new Error('Canonical JSON input is invalid.');
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, child]) => [key, canonicalizeJsonValue(child)]),
  );
}

export function sha256Digest(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
