import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';

import { findGitBlocksRoot } from './repository-root.ts';

const MAX_SCHEMA_BYTES = 256 * 1024;
const SCHEMA_NAMES = [
  'case',
  'evidence',
  'gold',
  'manifest',
  'prediction',
  'score',
] as const;

export type SchemaName = (typeof SCHEMA_NAMES)[number];

export interface ValidationDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface SchemaRegistry {
  readonly validate: (
    name: string,
    value: unknown,
  ) => readonly ValidationDiagnostic[];
}

export function createSchemaRegistry(
  startDirectory = process.cwd(),
): SchemaRegistry {
  const repositoryRoot = findGitBlocksRoot(startDirectory);
  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    messages: true,
    removeAdditional: false,
    strict: true,
    useDefaults: false,
    validateFormats: false,
  });
  const validators = new Map<SchemaName, ValidateFunction>();

  for (const schemaName of SCHEMA_NAMES) {
    const schemaPath = join(
      repositoryRoot,
      'schemas',
      'evaluation',
      `${schemaName}.schema.json`,
    );
    const schemaText = readFileSync(schemaPath, 'utf8');
    if (Buffer.byteLength(schemaText, 'utf8') > MAX_SCHEMA_BYTES) {
      throw new Error(
        `Evaluation schema ${schemaName} exceeds its byte limit.`,
      );
    }
    const schema = JSON.parse(schemaText) as AnySchema;
    ajv.addSchema(schema);
    const validator = ajv.getSchema(
      `https://gitblocks.dev/schemas/evaluation/${schemaName}/1.0.0`,
    );
    if (validator === undefined) {
      throw new Error(`Evaluation schema ${schemaName} was not registered.`);
    }
    validators.set(schemaName, validator);
  }

  return {
    validate(name, value) {
      if (!isSchemaName(name)) {
        return [
          {
            code: 'schema.unknown',
            message: 'Unknown evaluation schema name.',
            path: '',
          },
        ];
      }
      const validator = validators.get(name);
      if (validator === undefined) {
        throw new Error(`Evaluation schema ${name} is unavailable.`);
      }
      if (validator(value)) {
        return [];
      }
      return formatErrors(validator.errors);
    },
  };
}

function formatErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ValidationDiagnostic[] {
  return (errors ?? [])
    .map((error) => ({
      code: `schema.${error.keyword}`,
      message: error.message ?? 'Schema validation failed.',
      path: error.instancePath,
    }))
    .sort((left, right) =>
      compareText(
        `${left.path}\0${left.code}\0${left.message}`,
        `${right.path}\0${right.code}\0${right.message}`,
      ),
    );
}

function isSchemaName(value: string): value is SchemaName {
  return (SCHEMA_NAMES as readonly string[]).includes(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
