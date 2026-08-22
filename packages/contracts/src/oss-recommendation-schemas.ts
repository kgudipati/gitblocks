import { Type, type Static } from 'typebox';

import { CAPABILITY_QUERY_LIMITS } from '@gitblocks/domain';

import {
  capabilityQueryCandidateReferenceIntentSchema,
  capabilityQueryConstraintModalitySchema,
  capabilityQueryInputV1ValueSchema,
  capabilityQueryNpmPackageReferenceValueSchema,
  capabilityQueryRepositoryFingerprintReferenceV1Schema,
  capabilityQueryRepositoryReferenceValueSchema,
  capabilityQueryStatementTextSchema,
  capabilityQuerySummarySchema,
  capabilityQueryTermTextSchema,
} from './capability-query-schemas.ts';
import {
  closedObject,
  contractVersionSchema,
  stableIdSchema,
} from './schema-builders.ts';
import {
  assessmentUnknownV1Schema,
  candidateIdentityV1Schema,
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

const responsibleOptionConstraintGroundingV1Schema = closedObject({
  evaluationId: stableIdSchema,
  basis: Type.Union([Type.Literal('deterministic'), Type.Literal('model')]),
  inferenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

const responsibleOptionConstraintStatusV1Schema = closedObject({
  constraintId: stableIdSchema,
  statement:
    fitAssessmentRequestV1Schema.properties.capabilityRequest.properties
      .hardConstraints.items.properties.statement,
  modality: Type.Union([Type.Literal('required'), Type.Literal('prohibited')]),
  status: Type.Union([
    Type.Literal('verified'),
    Type.Literal('unverified'),
    Type.Literal('conflicting'),
  ]),
  grounding: Type.Array(responsibleOptionConstraintGroundingV1Schema, {
    maxItems: 64,
  }),
});

const responsibleOptionV1ValueSchema = closedObject({
  candidateId: stableIdSchema,
  identity: candidateIdentityV1Schema,
  verificationStatus: Type.Union([
    Type.Literal('fully-verified'),
    Type.Literal('partially-verified'),
    Type.Literal('unverified-prohibited-constraint'),
  ]),
  constraintStatuses: Type.Array(responsibleOptionConstraintStatusV1Schema, {
    maxItems: 20,
  }),
});

export const responsibleOptionV1Schema = Type.Object(
  responsibleOptionV1ValueSchema.properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/responsible-option/1.0.0',
    additionalProperties: false,
  },
);

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
    state: Type.Union(
      [
        Type.Literal('satisfied'),
        Type.Literal('conflict'),
        Type.Literal('unresolved'),
      ],
      {
        description:
          'Judge only this disclosed evaluation; do not reconstruct or prove a candidate-wide complete feature or infrastructure inventory. ruleId identifies the deterministic check that was unresolved and does not define the model proof scope. Interpret conceptId as the exact taxonomy concept resolved in normalizedQuery; do not broaden it. For a required feature, candidate-owned evidence explicitly documenting the named concept is sufficient for satisfied; candidate-owned evidence explicitly establishing that the named concept is unsupported is conflict. For prohibited infrastructure, candidate-owned evidence establishing a complete alternative operating configuration that does not require the named component is sufficient for satisfied; candidate-owned evidence that the prohibited component is required is conflict. Use unresolved when supplied evidence genuinely does not speak to the concept or otherwise cannot ground satisfied or conflict. Never use unresolved solely to avoid inference, citation, or grounding requirements.',
      },
    ),
    inferenceIds: Type.Array(modelInferenceTokenSchema, {
      maxItems: 20,
      uniqueItems: true,
      description:
        "For state satisfied or conflict, include at least one inference token declared in inferences, owned by this candidate, cited by this candidate's assessment, and grounded only in supplied evidence owned by this candidate. For unresolved, use an empty array. Choose unresolved only when supplied candidate-owned evidence is inadequate to support satisfied or conflict, not solely to avoid their inference, citation, or grounding requirements.",
    }),
  });

const ossRecommendationRequestV1Properties = {
  contractVersion: contractVersionSchema,
  recommendationRequestId: stableIdSchema,
  capabilityQuery: capabilityQueryInputV1ValueSchema,
  repositoryFingerprint: repositoryFingerprintV1ValueSchema,
  transmissionApproval: transmissionApprovalV1Schema,
} as const;

const ossRecommendationRequestV1ValueSchema = closedObject(
  ossRecommendationRequestV1Properties,
);

export const ossRecommendationRequestV1Schema = Type.Object(
  ossRecommendationRequestV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/oss-recommendation-request/1.0.0',
    additionalProperties: false,
  },
);

const ossRecommendationCandidateReferenceV2Schema = Type.Union([
  closedObject({
    kind: Type.Literal('candidate-id'),
    value: stableIdSchema,
    intent: capabilityQueryCandidateReferenceIntentSchema,
  }),
  closedObject({
    kind: Type.Literal('repository'),
    value: capabilityQueryRepositoryReferenceValueSchema,
    intent: capabilityQueryCandidateReferenceIntentSchema,
  }),
  closedObject({
    kind: Type.Literal('npm-package'),
    value: capabilityQueryNpmPackageReferenceValueSchema,
    intent: capabilityQueryCandidateReferenceIntentSchema,
  }),
]);

const ossRecommendationConstraintV2Schema = closedObject({
  modality: capabilityQueryConstraintModalitySchema,
  statement: capabilityQueryStatementTextSchema,
  term: capabilityQueryTermTextSchema,
});

const ossRecommendationTransmissionApprovalV2Schema = closedObject({
  approvedBy: transmissionApprovalV1Schema.properties.approvedBy,
  approvedAt: transmissionApprovalV1Schema.properties.approvedAt,
  approvedCategories: Type.Array(
    transmissionApprovalV1Schema.properties.approvedCategories.items,
    {
      minItems: 4,
      maxItems: 4,
      uniqueItems: true,
      description:
        'Caller-assert all four categories after explicit transmission approval: bounded-evidence, candidate-dossiers, capability-request, and repository-fingerprint.',
    },
  ),
  fingerprintDigest:
    capabilityQueryRepositoryFingerprintReferenceV1Schema.properties
      .fingerprintDigest,
});

const ossRecommendationRequestV2Properties = {
  contractVersion: Type.Literal('2.0.0'),
  summary: capabilityQuerySummarySchema,
  capabilityTerms: Type.Array(capabilityQueryTermTextSchema, {
    minItems: 1,
    maxItems: CAPABILITY_QUERY_LIMITS.capabilityTerms,
    description:
      'Original caller capability terms as bare strings. Use one supported primary family meaning such as "rate limiting".',
  }),
  successConditions: Type.Array(capabilityQueryStatementTextSchema, {
    minItems: 1,
    maxItems: CAPABILITY_QUERY_LIMITS.successConditions,
    description: 'Original observable success conditions as bare strings.',
  }),
  constraints: Type.Array(ossRecommendationConstraintV2Schema, {
    maxItems: CAPABILITY_QUERY_LIMITS.draftConstraints,
    description:
      'Original caller declarations. Preserve required, preferred, or prohibited modality exactly; facet and generic request-origin reason codes are derived server-side.',
  }),
  candidateReferences: Type.Optional(
    Type.Array(ossRecommendationCandidateReferenceV2Schema, {
      maxItems: CAPABILITY_QUERY_LIMITS.candidateReferences,
      description:
        'Optional exact candidate, owner/repository, or npm-package references; reference IDs are derived server-side.',
    }),
  ),
  repositoryFingerprint: repositoryFingerprintV1ValueSchema,
  transmissionApproval: ossRecommendationTransmissionApprovalV2Schema,
} as const;

const ossRecommendationRequestV2ValueSchema = closedObject(
  ossRecommendationRequestV2Properties,
);

export const ossRecommendationRequestV2Schema = Type.Object(
  ossRecommendationRequestV2Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/oss-recommendation-request-v2/2.0.0',
    additionalProperties: false,
  },
);

export const ossRecommendationRequestSchema = Type.Union(
  [
    ossRecommendationRequestV1ValueSchema,
    ossRecommendationRequestV2ValueSchema,
  ],
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/oss-recommendation-request/2.0.0',
    description:
      'Root-version-discriminated recommend_oss input. contractVersion 1.0.0 preserves the existing canonical request; contractVersion 2.0.0 accepts the simpler caller-facing request.',
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
  outcome: {
    ...fitAssessmentResponseV1ValueSchema.properties.outcome,
    description:
      'outcome must agree with candidateAssessments dispositions: recommend requires at least one recommended or viable; no-viable-candidate requires every assessment rejected; insufficient-evidence requires no recommended or viable and at least one insufficient-evidence.',
  },
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
        {
          minItems: 1,
          maxItems: 20,
          description:
            'Within each candidateAssessment, every reason must use a unique reasonCode; do not repeat a reasonCode in that assessment. Every cited evidence, inference, claim, candidate unknown, hard-constraint conflict, and limitation must belong to the same candidateId as the candidateAssessment that cites it; each reason candidateId must equal its enclosing assessment candidateId.',
        },
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
        description:
          "Include every supplied candidate-unknown token (u...) belonging to this candidate so each hydrated decision-relevant unknown remains reachable from this assessment. A model-created assessment-unknown token (a...) must exactly match an unknownId declared in this response's assessmentUnknowns catalog.",
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
    {
      minItems: 1,
      maxItems: 20,
      description:
        'Every candidate-owned entry in the supplied or declared catalogs must be cited by the candidateAssessment with the same candidateId: supplied limitations in limitationIds, supplied candidate unknowns in unknownIds, and declared inferences, material claims, and hard-constraint conflicts in their matching ID arrays.',
    },
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
    {
      maxItems: 400,
      description:
        'Catalog identifiers must be unique response-wide: do not reuse any inferenceId, claimId, unknownId, or conflictId, including within one catalog or across catalogs.',
    },
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
        'Complete catalog of model-created material claims. Declare every claimId before citing that exact token from candidateAssessments.claimIds, and cite every declared claim from the candidateAssessment with the same candidateId.',
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
    {
      maxItems: 800,
      description:
        'Complete catalog of model-created assessment unknowns. Declare each unknownId before citing that exact token from candidateAssessments.unknownIds.',
    },
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
    {
      maxItems: 400,
      description:
        "For every hard conflict, constraintId must exactly identify a supplied source hard constraint and reasonCode must exactly equal that source constraint's reasonCode; cite only candidate-owned evidence and cite the conflict from its owner assessment.",
    },
  ),
  orderedViableCandidateIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
    description:
      'List only candidateIds whose candidateAssessment disposition is recommended or viable, strongest repository-conditioned fit first. Do not include rejected or insufficient-evidence candidates. Do not repeat IDs and do not exceed fitAssessmentRequest.requestedMaximumResults; deterministic construction filters and caps this list.',
  }),
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
    responsibleOptions: Type.Array(responsibleOptionV1ValueSchema, {
      maxItems: 3,
    }),
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
export type OssRecommendationRequestV2 = Static<
  typeof ossRecommendationRequestV2Schema
>;
export type OssRecommendationRequest = Static<
  typeof ossRecommendationRequestSchema
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
export type ResponsibleOptionV1 = Static<typeof responsibleOptionV1Schema>;
export type TargetFitAssessmentResponseV1 = Static<
  typeof targetFitAssessmentResponseV1Schema
>;
export type RecommendationAssessmentResponseV1 = Static<
  typeof recommendationAssessmentResponseV1Schema
>;
export type RecommendationAssessmentModelResponseV1 = Static<
  typeof recommendationAssessmentModelResponseV1Schema
>;
