import { join } from 'node:path';

import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';

import type { RetrievalDiagnostic } from './contracts.ts';
import { loadRetrievalJsonFile } from './json-boundary.ts';

const SCHEMA_NAMES = [
  'clarification-gold',
  'equivalence',
  'hard-filter-projection',
  'manifest',
  'no-result-gold',
  'normalization-gold',
  'prediction-set',
  'query',
  'relevance-gold',
  'score-report',
] as const;

export type RetrievalSchemaName = (typeof SCHEMA_NAMES)[number];

export interface RetrievalSchemaRegistry {
  readonly validate: (
    name: RetrievalSchemaName,
    value: unknown,
  ) => readonly RetrievalDiagnostic[];
}

export function createRetrievalSchemaRegistry(
  repositoryRoot: string,
): RetrievalSchemaRegistry {
  const schemaRoot = join(repositoryRoot, 'schemas/evaluation/retrieval');
  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    messages: true,
    removeAdditional: false,
    strict: true,
    useDefaults: false,
    validateFormats: false,
  });
  const definitions = loadSchema(schemaRoot, 'definitions.schema.json');
  ajv.addSchema(definitions);
  const validators = new Map<RetrievalSchemaName, ValidateFunction>();
  for (const name of SCHEMA_NAMES) {
    const schema = loadSchema(schemaRoot, `${name}.schema.json`);
    ajv.addSchema(schema);
    const validator = ajv.getSchema(
      `https://gitblocks.dev/schemas/evaluation/retrieval/${name}/1.0.0`,
    );
    if (validator === undefined) {
      throw new Error('Retrieval evaluation schema could not be registered.');
    }
    validators.set(name, validator);
  }
  return {
    validate(name, value) {
      const validator = validators.get(name);
      if (validator === undefined) {
        return [diagnostic('retrieval.schema.unknown', '', 'Unknown schema.')];
      }
      return validator(value) ? [] : formatErrors(validator.errors);
    },
  };
}

function loadSchema(root: string, path: string): AnySchema {
  return loadRetrievalJsonFile(root, path) as AnySchema;
}

function formatErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly RetrievalDiagnostic[] {
  return (errors ?? [])
    .slice(0, 500)
    .map((error) =>
      diagnostic(
        `retrieval.schema.${error.keyword}`,
        error.instancePath,
        error.message ?? 'Schema validation failed.',
      ),
    )
    .sort((left, right) =>
      compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
    );
}

function diagnostic(
  code: string,
  path: string,
  message: string,
): RetrievalDiagnostic {
  return { code, path: path.slice(0, 256), message: message.slice(0, 500) };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
