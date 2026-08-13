import { Type, type Static } from 'typebox';

import { capabilityQueryInputV1ValueSchema } from './capability-query-schemas.ts';
import {
  closedObject,
  contractVersionSchema,
  stableIdSchema,
} from './schema-builders.ts';
import {
  fitAssessmentResponseV1ValueSchema,
  repositoryFingerprintV1ValueSchema,
  transmissionApprovalV1Schema,
} from './schemas.ts';

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;

const inferenceRepositoryFactBindingV1Schema = closedObject({
  inferenceId: stableIdSchema,
  repositoryFactIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: 200,
    uniqueItems: true,
  }),
});

const evidenceNeededHardConstraintResolutionV1Schema = closedObject({
  candidateId: stableIdSchema,
  evaluationId: stableIdSchema,
  state: Type.Union([
    Type.Literal('satisfied'),
    Type.Literal('conflict'),
    Type.Literal('unresolved'),
  ]),
  inferenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

export const ossRecommendationRequestV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    recommendationRequestId: stableIdSchema,
    capabilityQuery: capabilityQueryInputV1ValueSchema,
    repositoryFingerprint: repositoryFingerprintV1ValueSchema,
    transmissionApproval: transmissionApprovalV1Schema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/oss-recommendation-request/1.0.0',
    additionalProperties: false,
  },
);

const targetFitAssessmentResponseV1ValueSchema = closedObject({
  contractVersion: contractVersionSchema,
  fitAssessment: fitAssessmentResponseV1ValueSchema,
  inferenceRepositoryFactBindings: Type.Array(
    inferenceRepositoryFactBindingV1Schema,
    { maxItems: 400 },
  ),
});

export const targetFitAssessmentResponseV1Schema = Type.Object(
  targetFitAssessmentResponseV1ValueSchema.properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/target-fit-assessment-response/1.0.0',
    additionalProperties: false,
  },
);

export const recommendationAssessmentResponseV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    targetFitAssessment: targetFitAssessmentResponseV1ValueSchema,
    evidenceNeededHardConstraintResolutions: Type.Array(
      evidenceNeededHardConstraintResolutionV1Schema,
      { maxItems: 320 },
    ),
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/recommendation-assessment-response/1.0.0',
    additionalProperties: false,
  },
);

export type OssRecommendationRequestV1 = Static<
  typeof ossRecommendationRequestV1Schema
>;
export type InferenceRepositoryFactBindingV1 = Static<
  typeof inferenceRepositoryFactBindingV1Schema
>;
export type EvidenceNeededHardConstraintResolutionV1 = Static<
  typeof evidenceNeededHardConstraintResolutionV1Schema
>;
export type TargetFitAssessmentResponseV1 = Static<
  typeof targetFitAssessmentResponseV1Schema
>;
export type RecommendationAssessmentResponseV1 = Static<
  typeof recommendationAssessmentResponseV1Schema
>;
