import {
  candidateDossierV1Schema,
  capabilityRequestV1Schema,
  errorEnvelopeV1Schema,
  fitAssessmentRequestV1Schema,
  fitAssessmentResponseV1Schema,
  repositoryFingerprintV1Schema,
} from './schemas.ts';

export const CONTRACT_SCHEMA_NAMES = Object.freeze([
  'candidate-dossier',
  'capability-request',
  'error-envelope',
  'fit-assessment-request',
  'fit-assessment-response',
  'repository-fingerprint',
] as const);

export type ContractSchemaName = (typeof CONTRACT_SCHEMA_NAMES)[number];

export type JsonSchemaValue =
  | boolean
  | number
  | string
  | null
  | readonly JsonSchemaValue[]
  | { readonly [key: string]: JsonSchemaValue };

const SCHEMAS = {
  'candidate-dossier': candidateDossierV1Schema,
  'capability-request': capabilityRequestV1Schema,
  'error-envelope': errorEnvelopeV1Schema,
  'fit-assessment-request': fitAssessmentRequestV1Schema,
  'fit-assessment-response': fitAssessmentResponseV1Schema,
  'repository-fingerprint': repositoryFingerprintV1Schema,
} as const;

export function getContractSchemaV1(name: ContractSchemaName): JsonSchemaValue {
  return canonicalizeJsonSchema(SCHEMAS[name]);
}

export function serializeContractSchemaV1(name: ContractSchemaName): string {
  return `${JSON.stringify(getContractSchemaV1(name), null, 2)}\n`;
}

function canonicalizeJsonSchema(value: unknown): JsonSchemaValue {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((child) => canonicalizeJsonSchema(child));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => compareText(left, right))
        .map(([key, child]) => [key, canonicalizeJsonSchema(child)]),
    );
  }
  throw new Error('Owned contract schema contains a non-JSON value.');
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
