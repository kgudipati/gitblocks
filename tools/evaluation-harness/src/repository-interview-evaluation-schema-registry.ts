import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  Ajv2020,
  type AnySchema,
  type ErrorObject,
  type ValidateFunction,
} from 'ajv/dist/2020.js';

import { findGitBlocksRoot } from './repository-root.ts';
import type { ValidationDiagnostic } from './schema-registry.ts';

const MAX_SCHEMA_BYTES = 256 * 1024;
const REGISTRIES = new Map<
  string,
  RepositoryInterviewEvaluationSchemaRegistry
>();
const NAMES = [
  'adjudication-record',
  'adversarial-fixture',
  'audit-record',
  'audit-scope',
  'candidate',
  'cohort-policy',
  'gate-policy',
  'gate-report',
  'manifest',
  'review-policy',
  'rubric',
  'run-summary',
] as const;

export type RepositoryInterviewEvaluationSchemaName = (typeof NAMES)[number];

export interface RepositoryInterviewEvaluationSchemaRegistry {
  readonly validate: (
    name: RepositoryInterviewEvaluationSchemaName,
    value: unknown,
  ) => readonly ValidationDiagnostic[];
}

export function createRepositoryInterviewEvaluationSchemaRegistry(
  startDirectory = process.cwd(),
): RepositoryInterviewEvaluationSchemaRegistry {
  const root = findGitBlocksRoot(startDirectory);
  const existing = REGISTRIES.get(root);
  if (existing !== undefined) return existing;
  const ajv = new Ajv2020({
    allErrors: true,
    coerceTypes: false,
    messages: true,
    removeAdditional: false,
    strict: true,
    useDefaults: false,
    validateFormats: false,
  });
  const validators = new Map<
    RepositoryInterviewEvaluationSchemaName,
    ValidateFunction
  >();
  for (const name of NAMES) {
    const path = join(
      root,
      'schemas/evaluation/repository-interviews',
      `${name}.schema.json`,
    );
    const text = readFileSync(path, 'utf8');
    if (Buffer.byteLength(text, 'utf8') > MAX_SCHEMA_BYTES) {
      throw new Error('Repository-interview evaluation schema is oversized.');
    }
    const schema = JSON.parse(text) as AnySchema;
    ajv.addSchema(schema);
    const validator = ajv.getSchema(
      `https://gitblocks.dev/schemas/evaluation/repository-interviews/${name}/1.0.0`,
    );
    if (validator === undefined) {
      throw new Error('Repository-interview evaluation schema is unavailable.');
    }
    validators.set(name, validator);
  }
  const registry: RepositoryInterviewEvaluationSchemaRegistry = {
    validate(name, value) {
      const validator = validators.get(name);
      if (validator === undefined)
        return [
          diagnostic(
            'schema.unknown',
            'Unknown repository-interview evaluation schema.',
            '',
          ),
        ];
      if (validator(value)) return [];
      return formatErrors(validator.errors);
    },
  };
  REGISTRIES.set(root, registry);
  return registry;
}

function formatErrors(
  errors: readonly ErrorObject[] | null | undefined,
): readonly ValidationDiagnostic[] {
  return (errors ?? [])
    .map((error) =>
      diagnostic(
        `schema.${error.keyword}`,
        error.message ?? 'Schema validation failed.',
        error.instancePath,
      ),
    )
    .sort((left, right) =>
      compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`),
    );
}

function diagnostic(
  code: string,
  message: string,
  path: string,
): ValidationDiagnostic {
  return { code, message, path: path.slice(0, 256) };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
