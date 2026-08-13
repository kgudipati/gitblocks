import { Type, type Static } from 'typebox';

import { CAPABILITY_QUERY_LIMITS } from '@gitblocks/domain';

import {
  capabilityFamilySchema,
  closedObject,
  contractVersionSchema,
  reasonCodeSchema,
  semanticVersionSchema,
  stableIdSchema,
} from './schema-builders.ts';

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;
const SAFE_LOCAL_TEXT_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u061c\\u180e\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff\\ufff9-\\ufffb]*$';
const DIGEST_PATTERN = '^[0-9a-f]{64}$';
const CATALOG_VERSION_PATTERN = '^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$';
const REPOSITORY_KEY_PATTERN =
  '^[a-z0-9](?:[a-z0-9_.-]{0,99})/[a-z0-9](?:[a-z0-9_.-]{0,99})$';
const PACKAGE_KEY_PATTERN =
  '^(?:@[a-z0-9][a-z0-9._-]{0,99}/)?[a-z0-9][a-z0-9._-]{0,99}$';

const digestSchema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: DIGEST_PATTERN,
});
const summarySchema = Type.String({
  minLength: 1,
  maxLength: CAPABILITY_QUERY_LIMITS.summaryCodeUnits,
  pattern: SAFE_LOCAL_TEXT_PATTERN,
});
const queryTermSchema = Type.String({
  minLength: 1,
  maxLength: CAPABILITY_QUERY_LIMITS.termCodeUnits,
  pattern: SAFE_LOCAL_TEXT_PATTERN,
});
const queryStatementSchema = Type.String({
  minLength: 1,
  maxLength: CAPABILITY_QUERY_LIMITS.statementCodeUnits,
  pattern: SAFE_LOCAL_TEXT_PATTERN,
});
const boundedContextSchema = Type.String({
  minLength: 1,
  maxLength: 500,
  pattern: SAFE_LOCAL_TEXT_PATTERN,
});
const modalitySchema = Type.Union([
  Type.Literal('required'),
  Type.Literal('preferred'),
  Type.Literal('prohibited'),
]);
const facetSchema = Type.Union([
  Type.Literal('capability'),
  Type.Literal('architecture'),
  Type.Literal('feature'),
  Type.Literal('infrastructure'),
  Type.Literal('deployment'),
  Type.Literal('ecosystem'),
  Type.Literal('runtime'),
  Type.Literal('framework'),
  Type.Literal('datastore'),
  Type.Literal('license'),
  Type.Literal('repository-state'),
  Type.Literal('maintenance'),
  Type.Literal('release'),
  Type.Literal('security'),
  Type.Literal('other'),
]);
const nullableReasonCodeSchema = Type.Union([reasonCodeSchema, Type.Null()]);
const nullableStableIdSchema = Type.Union([stableIdSchema, Type.Null()]);
const sourceIdsSchema = Type.Array(stableIdSchema, {
  minItems: 1,
  maxItems:
    CAPABILITY_QUERY_LIMITS.capabilityTerms +
    CAPABILITY_QUERY_LIMITS.draftConstraints +
    CAPABILITY_QUERY_LIMITS.candidateReferences,
  uniqueItems: true,
});

export const capabilityQueryTermV1Schema = closedObject({
  termId: stableIdSchema,
  originalTerm: queryTermSchema,
});

export const capabilityQuerySuccessConditionV1Schema = closedObject({
  conditionId: stableIdSchema,
  statement: queryStatementSchema,
});

export const capabilityQueryDraftConstraintV1Schema = closedObject({
  constraintId: stableIdSchema,
  modality: modalitySchema,
  statement: queryStatementSchema,
  originalTerm: queryTermSchema,
  facetHint: facetSchema,
  reasonCode: nullableReasonCodeSchema,
});

const candidateReferenceIntentSchema = Type.Union([
  Type.Literal('compare'),
  Type.Literal('named-candidate'),
]);

export const capabilityQueryCandidateReferenceV1Schema = Type.Union([
  closedObject({
    referenceId: stableIdSchema,
    kind: Type.Literal('candidate-id'),
    value: stableIdSchema,
    intent: candidateReferenceIntentSchema,
  }),
  closedObject({
    referenceId: stableIdSchema,
    kind: Type.Literal('repository'),
    value: Type.String({
      minLength: 3,
      maxLength: 201,
      pattern: REPOSITORY_KEY_PATTERN,
    }),
    intent: candidateReferenceIntentSchema,
  }),
  closedObject({
    referenceId: stableIdSchema,
    kind: Type.Literal('npm-package'),
    value: Type.String({
      minLength: 1,
      maxLength: 201,
      pattern: PACKAGE_KEY_PATTERN,
    }),
    intent: candidateReferenceIntentSchema,
  }),
]);

export const capabilityQueryRepositoryFingerprintReferenceV1Schema =
  closedObject({
    fingerprintId: stableIdSchema,
    fingerprintDigest: digestSchema,
  });

const capabilityQueryInputV1Properties = {
  contractVersion: contractVersionSchema,
  queryInputId: stableIdSchema,
  scope: Type.Literal('local-pre-approval'),
  summary: summarySchema,
  capabilityTerms: Type.Array(capabilityQueryTermV1Schema, {
    minItems: 1,
    maxItems: CAPABILITY_QUERY_LIMITS.capabilityTerms,
  }),
  successConditions: Type.Array(capabilityQuerySuccessConditionV1Schema, {
    minItems: 1,
    maxItems: CAPABILITY_QUERY_LIMITS.successConditions,
  }),
  draftConstraints: Type.Array(capabilityQueryDraftConstraintV1Schema, {
    maxItems: CAPABILITY_QUERY_LIMITS.draftConstraints,
  }),
  candidateReferences: Type.Array(capabilityQueryCandidateReferenceV1Schema, {
    maxItems: CAPABILITY_QUERY_LIMITS.candidateReferences,
  }),
  repositoryFingerprintReference: Type.Union([
    capabilityQueryRepositoryFingerprintReferenceV1Schema,
    Type.Null(),
  ]),
};

export const capabilityQueryInputV1ValueSchema = closedObject(
  capabilityQueryInputV1Properties,
);

export const capabilityQueryInputV1Schema = Type.Object(
  capabilityQueryInputV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/capability-query-input/1.0.0',
    additionalProperties: false,
  },
);

const normalizedCapabilityConceptV1Schema = closedObject({
  conceptId: stableIdSchema,
  sourceTermIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: CAPABILITY_QUERY_LIMITS.capabilityTerms,
    uniqueItems: true,
  }),
  ruleId: stableIdSchema,
});

const normalizedConstraintV1Schema = closedObject({
  normalizedConstraintId: stableIdSchema,
  sourceConstraintIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: CAPABILITY_QUERY_LIMITS.draftConstraints,
    uniqueItems: true,
  }),
  modality: modalitySchema,
  facet: facetSchema,
  resolutionBasis: Type.Union([
    Type.Literal('controlled-taxonomy'),
    Type.Literal('preserved-declaration'),
    Type.Literal('unresolved'),
    Type.Literal('ambiguity'),
    Type.Literal('exclusion'),
    Type.Literal('contradiction'),
  ]),
  ruleId: stableIdSchema,
  conceptId: nullableStableIdSchema,
  canonicalTerm: nullableStableIdSchema,
});

const preservedDeclarationV1Schema = closedObject({
  constraintId: stableIdSchema,
  modality: modalitySchema,
  statement: queryStatementSchema,
  originalTerm: queryTermSchema,
  facet: facetSchema,
  reasonCode: nullableReasonCodeSchema,
});

const resolvedCandidateReferenceV1Schema = closedObject({
  referenceId: stableIdSchema,
  referenceKind: Type.Union([
    Type.Literal('candidate-id'),
    Type.Literal('repository'),
    Type.Literal('npm-package'),
  ]),
  intent: candidateReferenceIntentSchema,
  candidateId: stableIdSchema,
  capabilityFamily: capabilityFamilySchema,
  ruleId: stableIdSchema,
});

const unresolvedTermV1Schema = closedObject({
  unresolvedId: stableIdSchema,
  sourceKind: Type.Union([
    Type.Literal('capability-term'),
    Type.Literal('constraint'),
    Type.Literal('candidate-reference'),
  ]),
  sourceIds: sourceIdsSchema,
  canonicalTerm: nullableStableIdSchema,
  reasonCode: reasonCodeSchema,
  blocking: Type.Boolean(),
});

const clarificationV1Schema = closedObject({
  clarificationId: stableIdSchema,
  reasonCode: reasonCodeSchema,
  sourceIds: sourceIdsSchema,
  possibleConceptIds: Type.Array(stableIdSchema, {
    maxItems: 16,
    uniqueItems: true,
  }),
  context: boundedContextSchema,
});

const noticeV1Schema = closedObject({
  noticeId: stableIdSchema,
  reasonCode: reasonCodeSchema,
  sourceIds: sourceIdsSchema,
  replacementAliasKey: stableIdSchema,
});

const normalizationStepV1Schema = closedObject({
  stepId: stableIdSchema,
  ruleId: stableIdSchema,
  inputSourceIds: sourceIdsSchema,
  outputIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: CAPABILITY_QUERY_LIMITS.normalizedConstraints + 8,
    uniqueItems: true,
  }),
});

const candidateCatalogBindingV1Schema = closedObject({
  catalogVersion: Type.String({
    minLength: 1,
    maxLength: 64,
    pattern: CATALOG_VERSION_PATTERN,
  }),
  catalogDigest: digestSchema,
});

export const capabilityQueryNormalizationResultV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    normalizationId: Type.String({
      minLength: 62,
      maxLength: 62,
      pattern: '^normalization-[0-9a-f]{48}$',
    }),
    scope: Type.Literal('local-pre-approval'),
    queryInputId: stableIdSchema,
    queryInputDigest: digestSchema,
    taxonomyVersion: semanticVersionSchema,
    taxonomySemanticDigest: digestSchema,
    normalizerVersion: Type.Literal('1.0.0'),
    candidateCatalogBinding: Type.Union([
      candidateCatalogBindingV1Schema,
      Type.Null(),
    ]),
    outcome: Type.Union([
      Type.Literal('normalized'),
      Type.Literal('clarification-required'),
      Type.Literal('unsupported'),
    ]),
    primaryFamilyId: Type.Union([capabilityFamilySchema, Type.Null()]),
    normalizedCapabilityConcepts: Type.Array(
      normalizedCapabilityConceptV1Schema,
      { maxItems: CAPABILITY_QUERY_LIMITS.normalizedCapabilityConcepts },
    ),
    normalizedConstraints: Type.Array(normalizedConstraintV1Schema, {
      maxItems: CAPABILITY_QUERY_LIMITS.normalizedConstraints,
    }),
    preservedDeclarations: Type.Array(preservedDeclarationV1Schema, {
      maxItems: CAPABILITY_QUERY_LIMITS.draftConstraints,
    }),
    resolvedCandidateReferences: Type.Array(
      resolvedCandidateReferenceV1Schema,
      { maxItems: CAPABILITY_QUERY_LIMITS.candidateReferences },
    ),
    unresolvedTerms: Type.Array(unresolvedTermV1Schema, {
      maxItems: CAPABILITY_QUERY_LIMITS.unresolvedTerms,
    }),
    clarifications: Type.Array(clarificationV1Schema, {
      maxItems: CAPABILITY_QUERY_LIMITS.clarifications,
    }),
    notices: Type.Array(noticeV1Schema, {
      maxItems: CAPABILITY_QUERY_LIMITS.notices,
    }),
    normalizationSteps: Type.Array(normalizationStepV1Schema, {
      minItems: 1,
      maxItems: CAPABILITY_QUERY_LIMITS.normalizationSteps,
    }),
    repositoryFingerprintReference: Type.Union([
      capabilityQueryRepositoryFingerprintReferenceV1Schema,
      Type.Null(),
    ]),
    semanticDigest: digestSchema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/capability-query-normalization-result/1.0.0',
    additionalProperties: false,
  },
);

export type CapabilityQueryTermV1 = Static<typeof capabilityQueryTermV1Schema>;
export type CapabilityQuerySuccessConditionV1 = Static<
  typeof capabilityQuerySuccessConditionV1Schema
>;
export type CapabilityQueryDraftConstraintV1 = Static<
  typeof capabilityQueryDraftConstraintV1Schema
>;
export type CapabilityQueryCandidateReferenceV1 = Static<
  typeof capabilityQueryCandidateReferenceV1Schema
>;
export type CapabilityQueryRepositoryFingerprintReferenceV1 = Static<
  typeof capabilityQueryRepositoryFingerprintReferenceV1Schema
>;
export type CapabilityQueryInputV1 = Static<
  typeof capabilityQueryInputV1Schema
>;
export type CapabilityQueryNormalizationResultV1 = Static<
  typeof capabilityQueryNormalizationResultV1Schema
>;
