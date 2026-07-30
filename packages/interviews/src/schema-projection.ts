import type { JsonSchemaValue } from '@gitblocks/contracts';

import {
  canonicalizeJsonValue,
  serializeCanonicalJson,
} from './canonical-json.ts';
import { repositoryInterviewProviderOutputV1Schema } from './provider-output-schema.ts';

export const OPENAI_RESPONSES_STRICT_PROJECTION_VERSION = '1.0.0' as const;

export const OPENAI_STRICT_REMOVED_KEYWORDS = Object.freeze([
  '$schema',
  '$id',
  'title',
  'description',
  'examples',
  'default',
  'minLength',
  'maxLength',
  'uniqueItems',
] as const);

export const OPENAI_STRICT_REJECTED_COMPOSITION_KEYWORDS = Object.freeze([
  'oneOf',
  'allOf',
  'not',
  'dependentRequired',
  'dependentSchemas',
  'if',
  'then',
  'else',
] as const);

const SUPPORTED_KEYWORDS = new Set([
  '$defs',
  '$ref',
  'additionalProperties',
  'anyOf',
  'const',
  'enum',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'items',
  'maximum',
  'maxItems',
  'minimum',
  'minItems',
  'multipleOf',
  'pattern',
  'properties',
  'required',
  'type',
]);
const REMOVED_KEYWORDS = new Set<string>(OPENAI_STRICT_REMOVED_KEYWORDS);
const REJECTED_COMPOSITION_KEYWORDS = new Set<string>(
  OPENAI_STRICT_REJECTED_COMPOSITION_KEYWORDS,
);
const SUPPORTED_FORMATS = new Set([
  'date-time',
  'time',
  'date',
  'duration',
  'email',
  'hostname',
  'ipv4',
  'ipv6',
  'uuid',
]);
const MAXIMUM_OBJECT_DEPTH = 10;
const MAXIMUM_PROPERTIES = 5_000;
const MAXIMUM_TOTAL_SCHEMA_STRING_LENGTH = 120_000;
const MAXIMUM_ENUM_VALUES = 1_000;
const MAXIMUM_LARGE_ENUM_STRING_LENGTH = 15_000;

export class SchemaProjectionError extends Error {
  public constructor() {
    super('OpenAI strict schema projection failed.');
    this.name = 'SchemaProjectionError';
  }
}

export function getProviderOutputSchemaSnapshot(): string {
  return serializeCanonicalJson(repositoryInterviewProviderOutputV1Schema);
}

export function getOpenAiStrictSchemaSnapshot(): string {
  return serializeCanonicalJson(
    createOpenAiStrictSchemaProjection(
      repositoryInterviewProviderOutputV1Schema,
    ),
  );
}

export function createOpenAiStrictSchemaProjection(
  input: unknown,
): JsonSchemaValue {
  try {
    const root = requireRecord(input);
    if (root['anyOf'] !== undefined || root['type'] !== 'object') {
      throw new SchemaProjectionError();
    }
    const projected = projectSchema(root, true);
    const canonical = canonicalizeJsonValue(projected);
    assertStrictObjects(canonical);
    assertProviderLimits(canonical);
    assertReferencesResolve(canonical);
    return canonical;
  } catch (error) {
    if (error instanceof SchemaProjectionError) {
      throw error;
    }
    throw new SchemaProjectionError();
  }
}

function projectSchema(
  schema: Readonly<Record<string, unknown>>,
  isRoot: boolean,
): Readonly<Record<string, JsonSchemaValue>> {
  const projected: Record<string, JsonSchemaValue> = {};
  for (const [keyword, value] of Object.entries(schema)) {
    if (REMOVED_KEYWORDS.has(keyword)) {
      continue;
    }
    if (
      REJECTED_COMPOSITION_KEYWORDS.has(keyword) ||
      !SUPPORTED_KEYWORDS.has(keyword)
    ) {
      throw new SchemaProjectionError();
    }
    switch (keyword) {
      case '$defs':
      case 'properties': {
        const records = requireRecord(value);
        projected[keyword] = Object.fromEntries(
          Object.entries(records).map(([name, child]) => [
            name,
            projectSchema(requireRecord(child), false),
          ]),
        );
        break;
      }
      case 'anyOf': {
        if (isRoot || !Array.isArray(value) || value.length === 0) {
          throw new SchemaProjectionError();
        }
        projected[keyword] = value.map((child) =>
          projectSchema(requireRecord(child), false),
        );
        break;
      }
      case 'items':
        projected[keyword] = projectSchema(requireRecord(value), false);
        break;
      case '$ref':
      case 'format':
      case 'pattern':
      case 'type':
        if (typeof value !== 'string') {
          throw new SchemaProjectionError();
        }
        if (keyword === 'format' && !SUPPORTED_FORMATS.has(value)) {
          throw new SchemaProjectionError();
        }
        if (keyword === 'pattern') {
          new RegExp(value, 'u');
        }
        projected[keyword] = value;
        break;
      case 'required':
        if (!isStringArray(value)) {
          throw new SchemaProjectionError();
        }
        projected[keyword] = value.map((entry) => entry);
        break;
      case 'additionalProperties':
        if (value !== false) {
          throw new SchemaProjectionError();
        }
        projected[keyword] = false;
        break;
      case 'enum':
        if (!isJsonPrimitiveArray(value) || value.length === 0) {
          throw new SchemaProjectionError();
        }
        projected[keyword] = value.map((entry) => entry);
        break;
      case 'const':
        if (!isJsonPrimitive(value)) {
          throw new SchemaProjectionError();
        }
        projected[keyword] = value;
        break;
      case 'exclusiveMaximum':
      case 'exclusiveMinimum':
      case 'maximum':
      case 'minimum':
      case 'multipleOf':
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          throw new SchemaProjectionError();
        }
        projected[keyword] = value;
        break;
      case 'maxItems':
      case 'minItems':
        if (
          typeof value !== 'number' ||
          !Number.isSafeInteger(value) ||
          value < 0
        ) {
          throw new SchemaProjectionError();
        }
        projected[keyword] = value;
        break;
    }
  }
  return projected;
}

function assertStrictObjects(root: JsonSchemaValue): void {
  walkSchema(root, (schema) => {
    if (schema['type'] !== 'object') {
      return;
    }
    if (
      schema['additionalProperties'] !== false ||
      !isRecord(schema['properties']) ||
      !Array.isArray(schema['required'])
    ) {
      throw new SchemaProjectionError();
    }
    const propertySchemas = schema['properties'];
    if (!isRecord(propertySchemas)) {
      throw new SchemaProjectionError();
    }
    const properties = Object.keys(propertySchemas);
    const required = schema['required'];
    if (
      required.length !== properties.length ||
      required.some(
        (name) =>
          typeof name !== 'string' || !Object.hasOwn(propertySchemas, name),
      )
    ) {
      throw new SchemaProjectionError();
    }
  });
}

function assertProviderLimits(root: JsonSchemaValue): void {
  let propertyCount = 0;
  let totalStringLength = 0;
  let maximumObjectDepth = 0;

  const visit = (schema: JsonSchemaValue, objectDepth: number): void => {
    if (typeof schema === 'string') {
      totalStringLength += schema.length;
      return;
    }
    if (
      schema === null ||
      typeof schema === 'boolean' ||
      typeof schema === 'number'
    ) {
      return;
    }
    if (isJsonArray(schema)) {
      for (const child of schema) {
        visit(child, objectDepth);
      }
      return;
    }

    const schemaObject = schema as Readonly<Record<string, JsonSchemaValue>>;
    const nextObjectDepth =
      schemaObject['type'] === 'object' ? objectDepth + 1 : objectDepth;
    maximumObjectDepth = Math.max(maximumObjectDepth, nextObjectDepth);
    const properties = schemaObject['properties'];
    if (isRecord(properties)) {
      const names = Object.keys(properties);
      propertyCount += names.length;
      totalStringLength += names.reduce(
        (total, name) => total + name.length,
        0,
      );
    }
    const definitions = schemaObject['$defs'];
    if (isRecord(definitions)) {
      totalStringLength += Object.keys(definitions).reduce(
        (total, name) => total + name.length,
        0,
      );
    }
    const enumValues = schemaObject['enum'];
    if (isJsonArray(enumValues)) {
      if (enumValues.length > MAXIMUM_ENUM_VALUES) {
        throw new SchemaProjectionError();
      }
      let enumStringLength = 0;
      for (const entry of enumValues) {
        if (typeof entry === 'string') {
          enumStringLength += entry.length;
        }
      }
      if (
        enumValues.length > 250 &&
        enumStringLength > MAXIMUM_LARGE_ENUM_STRING_LENGTH
      ) {
        throw new SchemaProjectionError();
      }
    }
    for (const [key, child] of Object.entries(schemaObject)) {
      totalStringLength += key.length;
      visit(child, nextObjectDepth);
    }
  };

  visit(root, 0);
  if (
    maximumObjectDepth > MAXIMUM_OBJECT_DEPTH ||
    propertyCount > MAXIMUM_PROPERTIES ||
    totalStringLength > MAXIMUM_TOTAL_SCHEMA_STRING_LENGTH
  ) {
    throw new SchemaProjectionError();
  }
}

function assertReferencesResolve(root: JsonSchemaValue): void {
  if (!isRecord(root)) {
    throw new SchemaProjectionError();
  }
  const definitions = isRecord(root['$defs']) ? root['$defs'] : {};
  walkSchema(root, (schema) => {
    const reference = schema['$ref'];
    if (reference === undefined) {
      return;
    }
    if (
      typeof reference !== 'string' ||
      !/^#\/\$defs\/[A-Za-z0-9._-]+$/u.test(reference)
    ) {
      throw new SchemaProjectionError();
    }
    const name = reference.slice('#/$defs/'.length);
    if (!Object.hasOwn(definitions, name)) {
      throw new SchemaProjectionError();
    }
  });
}

function walkSchema(
  value: JsonSchemaValue,
  visitor: (schema: Readonly<Record<string, JsonSchemaValue>>) => void,
): void {
  if (isJsonArray(value)) {
    for (const child of value) {
      walkSchema(child, visitor);
    }
    return;
  }
  if (!isRecord(value)) {
    return;
  }
  visitor(value);
  for (const child of Object.values(value)) {
    walkSchema(child, visitor);
  }
}

function requireRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!isPlainRecord(value)) {
    throw new SchemaProjectionError();
  }
  return value;
}

function isRecord(
  value: unknown,
): value is Readonly<Record<string, JsonSchemaValue>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function isJsonPrimitive(
  value: unknown,
): value is boolean | number | string | null {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  );
}

function isJsonArray(value: unknown): value is readonly JsonSchemaValue[] {
  return Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((entry): entry is string => typeof entry === 'string')
  );
}

function isJsonPrimitiveArray(
  value: unknown,
): value is readonly (boolean | number | string | null)[] {
  return (
    Array.isArray(value) &&
    value.every((entry): entry is boolean | number | string | null =>
      isJsonPrimitive(entry),
    )
  );
}
