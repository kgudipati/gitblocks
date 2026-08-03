import { describe, expect, it } from 'vitest';

import {
  canonicalizeJson,
  createOpenAiStrictSchemaProjection,
  getProviderOutputSchemaSnapshot,
  sha256Digest,
} from '../src/index.ts';

function closedRoot(propertySchema: Record<string, unknown>) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: 'https://gitblocks.dev/synthetic',
    title: 'Synthetic schema',
    description: 'Synthetic annotation.',
    type: 'object',
    properties: {
      value: propertySchema,
    },
    required: ['value'],
    additionalProperties: false,
  };
}

describe('canonical schema artifacts', () => {
  it('canonicalizes keys deterministically and hashes exact bytes', () => {
    const left = canonicalizeJson({ z: 1, a: { y: 2, b: 3 } });
    const right = canonicalizeJson({ a: { b: 3, y: 2 }, z: 1 });
    expect(left).toBe(right);
    expect(left).toBe('{"a":{"b":3,"y":2},"z":1}');
    expect(sha256Digest(left)).toBe(sha256Digest(right));
  });

  it('generates the provider-neutral schema deterministically', () => {
    const first = getProviderOutputSchemaSnapshot();
    const second = getProviderOutputSchemaSnapshot();
    expect(first).toBe(second);
    expect(first.endsWith('\n')).toBe(true);
    expect(sha256Digest(first)).toMatch(/^[0-9a-f]{64}$/u);
  });
});

describe('OpenAI strict-schema projection', () => {
  it('preserves reviewed supported execution keywords', () => {
    const schema = closedRoot({
      anyOf: [
        {
          type: 'string',
          enum: ['synthetic-a', 'synthetic-b'],
          pattern: '^synthetic-',
          format: 'hostname',
        },
        {
          type: 'integer',
          minimum: 1,
          maximum: 10,
          exclusiveMinimum: 0,
          exclusiveMaximum: 11,
          multipleOf: 1,
        },
        {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: { type: 'boolean', const: true },
        },
      ],
    });

    const projected = createOpenAiStrictSchemaProjection(schema);
    expect(projected).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: ['value'],
      properties: {
        value: {
          anyOf: [
            {
              type: 'string',
              enum: ['synthetic-a', 'synthetic-b'],
              pattern: '^synthetic-',
              format: 'hostname',
            },
            {
              type: 'integer',
              minimum: 1,
              maximum: 10,
              exclusiveMinimum: 0,
              exclusiveMaximum: 11,
              multipleOf: 1,
            },
            {
              type: 'array',
              minItems: 1,
              maxItems: 2,
              items: { type: 'boolean', const: true },
            },
          ],
        },
      },
    });
  });

  it('preserves supported definitions and local references', () => {
    const schema = {
      ...closedRoot({ $ref: '#/$defs/synthetic' }),
      $defs: {
        synthetic: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
          additionalProperties: false,
        },
      },
    };
    const projected = createOpenAiStrictSchemaProjection(schema);
    expect(projected).toMatchObject({
      properties: { value: { $ref: '#/$defs/synthetic' } },
      $defs: {
        synthetic: {
          type: 'object',
          required: ['code'],
          additionalProperties: false,
        },
      },
    });
  });

  it('removes only reviewed annotations and locally enforced unsupported keywords', () => {
    const schema = closedRoot({
      type: 'array',
      title: 'Synthetic array',
      description: 'Synthetic description.',
      examples: [['value']],
      default: ['value'],
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
      items: {
        type: 'string',
        minLength: 1,
        maxLength: 10,
      },
    });
    const projected = createOpenAiStrictSchemaProjection(schema);
    expect(JSON.stringify(projected)).not.toMatch(
      /(?:\\$schema|\\$id|title|description|examples|default|minLength|maxLength|uniqueItems)/u,
    );
    expect(projected).toMatchObject({
      type: 'object',
      properties: {
        value: {
          type: 'array',
          minItems: 1,
          maxItems: 2,
          items: { type: 'string' },
        },
      },
    });
  });

  it.each(['unknownKeyword', 'oneOf', 'allOf', 'not', 'if'])(
    'rejects unsupported or unknown keyword %s',
    (keyword) => {
      const schema = closedRoot({ type: 'string', [keyword]: [] });
      expect(() => createOpenAiStrictSchemaProjection(schema)).toThrow(
        /schema projection failed/u,
      );
    },
  );

  it('rejects a root union, optional property, and open object', () => {
    expect(() =>
      createOpenAiStrictSchemaProjection({
        anyOf: [closedRoot({ type: 'string' })],
      }),
    ).toThrow(/schema projection failed/u);

    expect(() =>
      createOpenAiStrictSchemaProjection({
        type: 'object',
        properties: { value: { type: 'string' } },
        required: [],
        additionalProperties: false,
      }),
    ).toThrow(/schema projection failed/u);

    expect(() =>
      createOpenAiStrictSchemaProjection({
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: true,
      }),
    ).toThrow(/schema projection failed/u);
  });

  it('rejects unresolved references, unsupported formats, excessive depth, and property count', () => {
    expect(() =>
      createOpenAiStrictSchemaProjection(
        closedRoot({ $ref: '#/$defs/missing' }),
      ),
    ).toThrow(/schema projection failed/u);

    expect(() =>
      createOpenAiStrictSchemaProjection(
        closedRoot({ type: 'string', format: 'synthetic-format' }),
      ),
    ).toThrow(/schema projection failed/u);

    let nested: Record<string, unknown> = { type: 'string' };
    for (let index = 0; index < 11; index += 1) {
      nested = {
        type: 'object',
        properties: { nested },
        required: ['nested'],
        additionalProperties: false,
      };
    }
    expect(() => createOpenAiStrictSchemaProjection(nested)).toThrow(
      /schema projection failed/u,
    );

    const properties = Object.fromEntries(
      Array.from({ length: 5_001 }, (_, index) => [
        `property${String(index)}`,
        { type: 'string' },
      ]),
    );
    expect(() =>
      createOpenAiStrictSchemaProjection({
        type: 'object',
        properties,
        required: Object.keys(properties),
        additionalProperties: false,
      }),
    ).toThrow(/schema projection failed/u);
  });
});
