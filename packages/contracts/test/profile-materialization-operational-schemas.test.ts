import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { Ajv2020 } from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';

const OPERATIONAL_SCHEMAS = {
  'coverage.schema.json':
    '79a3147a6e78cd5adc7a19ac06916820c9091e943ee8161695b31eeea67936eb',
  'provider-policy.schema.json':
    'deac5cee0d921aabeb013ceecfa0730f878d5bd6cc451cd6fb865cd4257f4458',
  'persistence-proof.schema.json':
    '96974cfd824cc9e14ca1f2e61ffdf4bb8f14edbae5f1c268fb1d92d041f51b96',
  'receipt.schema.json':
    '53b546ad92e36499a344874d146bd2ffd9c8b0ef340f7a9524d05cb54054e955',
  'source-authority.schema.json':
    '8483a9564a668de709180b97868b115a49fe209fc54abe4b1614c88912d6c7ab',
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
