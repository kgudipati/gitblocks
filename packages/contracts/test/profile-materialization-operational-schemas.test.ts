import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const OPERATIONAL_SCHEMAS = {
  'coverage.schema.json':
    '79a3147a6e78cd5adc7a19ac06916820c9091e943ee8161695b31eeea67936eb',
  'provider-policy.schema.json':
    '39be981d31acc0e8437087edb13ebb3e441e654a9ce6b3692eb1d657aa345dc1',
  'receipt.schema.json':
    'c91fbea628bbf890e88b12a5c682f4ce64733e0750c788ebd9174899d5e4a8a2',
  'source-authority.schema.json':
    'af4fa351c882fbb34c6379f1ee06522dc5367a1ee5eadc6db2ee90b5992acff1',
} as const;

describe('profile-materialization operational schemas', () => {
  it('compiles closed strict schemas without adding product contract roots', async () => {
    const ajv = new Ajv2020({
      allErrors: false,
      coerceTypes: false,
      messages: false,
      removeAdditional: false,
      strict: true,
      useDefaults: false,
      validateFormats: false,
      verbose: false,
    });
    for (const [name, expectedDigest] of Object.entries(OPERATIONAL_SCHEMAS)) {
      const bytes = await readFile(
        new URL(
          `../../../schemas/operations/profile-materialization/${name}`,
          import.meta.url,
        ),
      );
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        expectedDigest,
      );
      const schema: unknown = JSON.parse(bytes.toString('utf8'));
      if (!isRecord(schema)) {
        throw new Error('Operational schema must be an object.');
      }
      const validate = ajv.compile(schema);
      if (name === 'provider-policy.schema.json') {
        const policy: unknown = JSON.parse(
          await readFile(
            new URL(
              '../../../catalog/public-v1/profile-materialization-provider-policy.json',
              import.meta.url,
            ),
            'utf8',
          ),
        );
        expect(validate(policy)).toBe(true);
      }
      walk(schema, (entry) => {
        expect(Object.hasOwn(entry, 'default')).toBe(false);
        if (entry['type'] === 'object') {
          const properties = entry['properties'];
          const required = entry['required'];
          if (isRecord(properties)) {
            expect(entry['additionalProperties']).toBe(false);
            expect(Array.isArray(required)).toBe(true);
            expect(new Set(required as readonly unknown[])).toEqual(
              new Set(Object.keys(properties)),
            );
          } else {
            expect(isRecord(entry['propertyNames'])).toBe(true);
            expect(isRecord(entry['additionalProperties'])).toBe(true);
          }
        }
      });
    }
  });
});

function walk(
  value: unknown,
  inspect: (entry: Record<string, unknown>) => void,
): void {
  if (Array.isArray(value)) {
    value.forEach((entry) => {
      walk(entry, inspect);
    });
    return;
  }
  if (!isRecord(value)) return;
  inspect(value);
  Object.values(value).forEach((entry) => {
    walk(entry, inspect);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
