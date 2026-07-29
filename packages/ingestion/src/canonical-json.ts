import { createHash } from 'node:crypto';

import { ingestionError } from './errors.ts';

export interface CanonicalJson {
  readonly text: string;
  readonly digest: string;
}

export function canonicalizeJson(value: unknown): CanonicalJson {
  const text = serialize(value, new Set<object>());
  return {
    text,
    digest: createHash('sha256').update(text).digest('hex'),
  };
}

export function stableId(prefix: string, value: unknown): string {
  return new StableIdRegistry().create(prefix, value);
}

export class StableIdRegistry {
  readonly #digests = new Map<string, string>();

  public create(prefix: string, value: unknown): string {
    if (!/^[a-z][a-z0-9-]{0,15}$/.test(prefix)) {
      throw ingestionError('ingestion.invalid-input');
    }
    const digest = canonicalizeJson(value).digest;
    const identifier = `${prefix}-${digest.slice(0, 40)}`;
    const prior = this.#digests.get(identifier);
    if (prior !== undefined && prior !== digest) {
      throw ingestionError('ingestion.identifier-collision');
    }
    this.#digests.set(identifier, digest);
    return identifier;
  }
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw ingestionError('ingestion.invalid-input');
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) {
    return withAncestor(value, ancestors, () => {
      return `[${value.map((entry) => serialize(entry, ancestors)).join(',')}]`;
    });
  }
  if (typeof value !== 'object' || !isPlainObject(value)) {
    throw ingestionError('ingestion.invalid-input');
  }
  return withAncestor(value, ancestors, () => {
    const entries = Object.entries(value)
      .filter((entry) => entry[1] !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => {
        return `${JSON.stringify(key)}:${serialize(entry, ancestors)}`;
      });
    return `{${entries.join(',')}}`;
  });
}

function withAncestor(
  value: object,
  ancestors: Set<object>,
  callback: () => string,
): string {
  if (ancestors.has(value)) {
    throw ingestionError('ingestion.invalid-input');
  }
  ancestors.add(value);
  try {
    return callback();
  } finally {
    ancestors.delete(value);
  }
}

function isPlainObject(value: object): value is Record<string, unknown> {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
}
