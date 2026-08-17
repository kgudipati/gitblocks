import { Type, type Static } from 'typebox';

import { capabilityQueryInputV1ValueSchema } from './capability-query-schemas.ts';
import {
  closedObject,
  contractVersionSchema,
  stableIdSchema,
} from './schema-builders.ts';
import {
  assessmentUnknownV1Schema,
  fitAssessmentRequestV1Schema,
  fitAssessmentResponseV1ValueSchema,
  hardConstraintConflictV1Schema,
  inferenceV1Schema,
  materialClaimV1Schema,
  repositoryFingerprintV1ValueSchema,
  transmissionApprovalV1Schema,
} from './schemas.ts';

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;

const suppliedEvidenceTokenSchema = Type.String({
  minLength: 2,
  maxLength: 5,
  pattern: '^e[1-9][0-9]{0,3}$',
});
const suppliedLimitationTokenSchema = Type.String({
  minLength: 2,
  maxLength: 4,
  pattern: '^l[1-9][0-9]{0,2}$',
});
const suppliedUnknownTokenSchema = Type.String({
  minLength: 2,
  maxLength: 4,
  pattern: '^u[1-9][0-9]{0,2}$',
});
const modelInferenceTokenSchema = Type.String({
  minLength: 2,
  maxLength: 4,
  pattern: '^i[1-9][0-9]{0,2}$',
});
const modelClaimTokenSchema = Type.String({
  minLength: 2,
  maxLength: 4,
  pattern: '^c[1-9][0-9]{0,2}$',
});
const modelAssessmentUnknownTokenSchema = Type.String({
  minLength: 2,
  maxLength: 4,
  pattern: '^a[1-9][0-9]{0,2}$',
});
const modelConflictTokenSchema = Type.String({
  minLength: 2,
  maxLength: 4,
  pattern: '^x[1-9][0-9]{0,2}$',
});
const modelUnknownReferenceTokenSchema = Type.Union([
  suppliedUnknownTokenSchema,
  modelAssessmentUnknownTokenSchema,
]);

const fitRequestCandidateSchema =
  fitAssessmentRequestV1Schema.properties.candidates.items;
const fitRequestEvidenceSchema =
  fitRequestCandidateSchema.properties.observations.items;
const fitRequestLimitationSchema =
  fitRequestCandidateSchema.properties.limitations.items;
const fitRequestUnknownSchema =
  fitRequestCandidateSchema.properties.unknowns.items;

const recommendationAssessmentModelEvidenceV1Schema = closedObject({
  ...fitRequestEvidenceSchema.properties,
  evidenceId: suppliedEvidenceTokenSchema,
});
const recommendationAssessmentModelLimitationV1Schema = closedObject({
  ...fitRequestLimitationSchema.properties,
  limitationId: suppliedLimitationTokenSchema,
  evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});
const recommendationAssessmentModelCandidateUnknownV1Schema = closedObject({
  ...fitRequestUnknownSchema.properties,
  unknownId: suppliedUnknownTokenSchema,
  evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});
const recommendationAssessmentModelCandidateDossierV1Schema = closedObject({
  ...fitRequestCandidateSchema.properties,
  observations: Type.Array(recommendationAssessmentModelEvidenceV1Schema, {
    maxItems: 100,
  }),
  limitations: Type.Array(recommendationAssessmentModelLimitationV1Schema, {
    maxItems: 40,
  }),
  unknowns: Type.Array(recommendationAssessmentModelCandidateUnknownV1Schema, {
    maxItems: 40,
  }),
});

export const recommendationAssessmentModelFitRequestV1Schema = Type.Object(
  {
    ...fitAssessmentRequestV1Schema.properties,
    candidates: Type.Array(
      recommendationAssessmentModelCandidateDossierV1Schema,
      { minItems: 1, maxItems: 20 },
    ),
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/recommendation-assessment-model-fit-request/1.0.0',
    additionalProperties: false,
  },
);

const inferenceRepositoryFactBindingV1Schema = closedObject({
  inferenceId: stableIdSchema,
  repositoryFactIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: 200,
    uniqueItems: true,
  }),
});

const recommendationAssessmentModelInferenceRepositoryFactBindingV1Schema =
  closedObject({
    inferenceId: modelInferenceTokenSchema,
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

const recommendationAssessmentModelHardConstraintResolutionV1Schema =
  closedObject({
    ...evidenceNeededHardConstraintResolutionV1Schema.properties,
    inferenceIds: Type.Array(modelInferenceTokenSchema, {
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

const recommendationAssessmentModelFitResponseV1ValueSchema = closedObject({
  outcome: fitAssessmentResponseV1ValueSchema.properties.outcome,
  candidateAssessments: Type.Array(
    closedObject({
      ...fitAssessmentResponseV1ValueSchema.properties.candidateAssessments
        .items.properties,
      reasons: Type.Array(
        closedObject({
          ...fitAssessmentResponseV1ValueSchema.properties.candidateAssessments
            .items.properties.reasons.items.properties,
          evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
            maxItems: 20,
            uniqueItems: true,
          }),
          inferenceIds: Type.Array(modelInferenceTokenSchema, {
            maxItems: 20,
            uniqueItems: true,
          }),
          unknownIds: Type.Array(modelUnknownReferenceTokenSchema, {
            maxItems: 20,
            uniqueItems: true,
          }),
        }),
        { minItems: 1, maxItems: 20 },
      ),
      evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
        maxItems: 100,
        uniqueItems: true,
      }),
      inferenceIds: Type.Array(modelInferenceTokenSchema, {
        maxItems: 40,
        uniqueItems: true,
      }),
      claimIds: Type.Array(modelClaimTokenSchema, {
        maxItems: 40,
        uniqueItems: true,
        description:
          "Every token in claimIds must exactly match a claimId declared in this response's materialClaims catalog; use an empty array when no material claim is declared.",
      }),
      unknownIds: Type.Array(modelUnknownReferenceTokenSchema, {
        maxItems: 40,
        uniqueItems: true,
      }),
      hardConstraintConflictIds: Type.Array(modelConflictTokenSchema, {
        maxItems: 20,
        uniqueItems: true,
      }),
      limitationIds: Type.Array(suppliedLimitationTokenSchema, {
        maxItems: 40,
        uniqueItems: true,
      }),
    }),
    { minItems: 1, maxItems: 20 },
  ),
  inferences: Type.Array(
    closedObject({
      ...inferenceV1Schema.properties,
      inferenceId: modelInferenceTokenSchema,
      evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
        minItems: 1,
        maxItems: 20,
        uniqueItems: true,
      }),
    }),
    { maxItems: 400 },
  ),
  materialClaims: Type.Array(
    closedObject({
      ...materialClaimV1Schema.properties,
      claimId: modelClaimTokenSchema,
      evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
        maxItems: 20,
        uniqueItems: true,
      }),
      inferenceIds: Type.Array(modelInferenceTokenSchema, {
        maxItems: 20,
        uniqueItems: true,
      }),
    }),
    {
      maxItems: 800,
      description:
        'Complete catalog of model-created material claims. Declare every claimId before citing that exact token from candidateAssessments.claimIds.',
    },
  ),
  assessmentUnknowns: Type.Array(
    closedObject({
      ...assessmentUnknownV1Schema.properties,
      unknownId: modelAssessmentUnknownTokenSchema,
      evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
        maxItems: 20,
        uniqueItems: true,
      }),
    }),
    { maxItems: 800 },
  ),
  hardConstraintConflicts: Type.Array(
    closedObject({
      ...hardConstraintConflictV1Schema.properties,
      conflictId: modelConflictTokenSchema,
      evidenceIds: Type.Array(suppliedEvidenceTokenSchema, {
        minItems: 1,
        maxItems: 20,
        uniqueItems: true,
      }),
    }),
    { maxItems: 400 },
  ),
  rankGroups: fitAssessmentResponseV1ValueSchema.properties.rankGroups,
  rankRelations: fitAssessmentResponseV1ValueSchema.properties.rankRelations,
  incomparablePairs:
    fitAssessmentResponseV1ValueSchema.properties.incomparablePairs,
  assessmentProcessing:
    fitAssessmentResponseV1ValueSchema.properties.assessmentProcessing,
});

const recommendationAssessmentModelTargetFitResponseV1ValueSchema =
  closedObject({
    fitAssessment: recommendationAssessmentModelFitResponseV1ValueSchema,
    inferenceRepositoryFactBindings: Type.Array(
      recommendationAssessmentModelInferenceRepositoryFactBindingV1Schema,
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

export const recommendationAssessmentModelResponseV1Schema = Type.Object(
  {
    targetFitAssessment:
      recommendationAssessmentModelTargetFitResponseV1ValueSchema,
    evidenceNeededHardConstraintResolutions: Type.Array(
      recommendationAssessmentModelHardConstraintResolutionV1Schema,
      { maxItems: 320 },
    ),
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/recommendation-assessment-model-response/1.0.0',
    additionalProperties: false,
  },
);

export type OssRecommendationRequestV1 = Static<
  typeof ossRecommendationRequestV1Schema
>;
export type RecommendationAssessmentModelFitRequestV1 = Static<
  typeof recommendationAssessmentModelFitRequestV1Schema
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
export type RecommendationAssessmentModelResponseV1 = Static<
  typeof recommendationAssessmentModelResponseV1Schema
>;
