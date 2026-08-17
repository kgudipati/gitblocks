import {
  candidateDossierV1Schema,
  capabilityRequestV1Schema,
  errorEnvelopeV1Schema,
  fitAssessmentRequestV1Schema,
  fitAssessmentResponseV1Schema,
  repositoryArtifactChunkV1Schema,
  repositoryArtifactSetV1Schema,
  repositoryArtifactV1Schema,
  repositoryFingerprintV1Schema,
} from './schemas.ts';
import {
  modelExecutionV1Schema,
  repositoryInterviewRequestV1Schema,
  repositoryInterviewV1Schema,
} from './repository-interview-schemas.ts';
import {
  capabilityTaxonomySourceV1Schema,
  capabilityTaxonomyV1Schema,
} from './capability-taxonomy-schemas.ts';
import {
  capabilityQueryInputV1Schema,
  capabilityQueryNormalizationResultV1Schema,
} from './capability-query-schemas.ts';
import {
  deterministicCandidateProfileAuthorityV1Schema,
  deterministicCandidateProfileV1Schema,
} from './deterministic-candidate-profile-schemas.ts';
import {
  candidateRetrievalRequestV1Schema,
  candidateRetrievalResultV1Schema,
} from './candidate-retrieval-schemas.ts';
import {
  capabilityRetrievalExpansionSourceV1Schema,
  capabilityRetrievalExpansionV1Schema,
} from './capability-retrieval-expansion-schemas.ts';
import { candidateRetrievalMetadataAuthorityV1Schema } from './candidate-retrieval-metadata-schemas.ts';
import {
  ossRecommendationRequestV1Schema,
  recommendationAssessmentModelResponseV1Schema,
  recommendationAssessmentResponseV1Schema,
  targetFitAssessmentResponseV1Schema,
} from './oss-recommendation-schemas.ts';

export const CONTRACT_SCHEMA_NAMES = Object.freeze([
  'candidate-dossier',
  'capability-request',
  'error-envelope',
  'fit-assessment-request',
  'fit-assessment-response',
  'repository-artifact',
  'repository-artifact-chunk',
  'repository-artifact-set',
  'repository-fingerprint',
  'repository-interview-request',
  'model-execution',
  'repository-interview',
  'capability-taxonomy',
  'capability-taxonomy-source',
  'capability-query-input',
  'capability-query-normalization-result',
  'deterministic-candidate-profile',
  'deterministic-candidate-profile-authority',
  'candidate-retrieval-request',
  'candidate-retrieval-result',
  'capability-retrieval-expansion',
  'capability-retrieval-expansion-source',
  'candidate-retrieval-metadata-authority',
  'oss-recommendation-request',
  'target-fit-assessment-response',
  'recommendation-assessment-response',
  'recommendation-assessment-model-response',
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
  'capability-taxonomy': capabilityTaxonomyV1Schema,
  'capability-taxonomy-source': capabilityTaxonomySourceV1Schema,
  'capability-query-input': capabilityQueryInputV1Schema,
  'capability-query-normalization-result':
    capabilityQueryNormalizationResultV1Schema,
  'deterministic-candidate-profile': deterministicCandidateProfileV1Schema,
  'deterministic-candidate-profile-authority':
    deterministicCandidateProfileAuthorityV1Schema,
  'error-envelope': errorEnvelopeV1Schema,
  'fit-assessment-request': fitAssessmentRequestV1Schema,
  'fit-assessment-response': fitAssessmentResponseV1Schema,
  'repository-artifact': repositoryArtifactV1Schema,
  'repository-artifact-chunk': repositoryArtifactChunkV1Schema,
  'repository-artifact-set': repositoryArtifactSetV1Schema,
  'repository-fingerprint': repositoryFingerprintV1Schema,
  'repository-interview-request': repositoryInterviewRequestV1Schema,
  'model-execution': modelExecutionV1Schema,
  'repository-interview': repositoryInterviewV1Schema,
  'candidate-retrieval-request': candidateRetrievalRequestV1Schema,
  'candidate-retrieval-result': candidateRetrievalResultV1Schema,
  'capability-retrieval-expansion': capabilityRetrievalExpansionV1Schema,
  'capability-retrieval-expansion-source':
    capabilityRetrievalExpansionSourceV1Schema,
  'candidate-retrieval-metadata-authority':
    candidateRetrievalMetadataAuthorityV1Schema,
  'oss-recommendation-request': ossRecommendationRequestV1Schema,
  'target-fit-assessment-response': targetFitAssessmentResponseV1Schema,
  'recommendation-assessment-response':
    recommendationAssessmentResponseV1Schema,
  'recommendation-assessment-model-response':
    recommendationAssessmentModelResponseV1Schema,
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
