import { Type, type Static, type TLiteral, type TUnion } from 'typebox';

import {
  CAPABILITY_QUERY_CONSTRAINT_FACETS,
  CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
  DETERMINISTIC_PROFILE_FIELD_IDS,
  DETERMINISTIC_PROFILE_RULES_VERSION,
} from '@gitblocks/domain';

import { capabilityQueryNormalizationResultV1Schema } from './capability-query-schemas.ts';
import {
  closedObject,
  contractVersionSchema,
  semanticVersionSchema,
  stableIdSchema,
} from './schema-builders.ts';
import { CAPABILITY_RETRIEVAL_EXPANSION_VERSION } from './capability-retrieval-expansion-schemas.ts';

export const CANDIDATE_RETRIEVAL_REQUEST_VERSION =
  'candidate-retrieval-request/1.1.0' as const;
export const CANDIDATE_RETRIEVAL_RESULT_VERSION =
  'candidate-retrieval-result/1.1.0' as const;
export const CANDIDATE_RETRIEVAL_ALGORITHM_VERSION =
  'deterministic-candidate-retrieval/1.1.0' as const;
export const CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS = Object.freeze([
  {
    channelId: 'capability-family',
    channelVersion: 'capability-family/1.0.0',
  },
  {
    channelId: 'taxonomy-concept',
    channelVersion: 'taxonomy-concept/1.0.0',
  },
  {
    channelId: 'candidate-identity',
    channelVersion: 'candidate-identity/1.1.0',
  },
  {
    channelId: 'package-identity',
    channelVersion: 'package-identity/1.1.0',
  },
  {
    channelId: 'structured-profile',
    channelVersion: 'structured-profile/1.0.0',
  },
] as const);

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;
const DIGEST_PATTERN = '^[0-9a-f]{64}$';
const CATALOG_VERSION_PATTERN = '^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$';

const digestSchema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: DIGEST_PATTERN,
});
const catalogVersionSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: CATALOG_VERSION_PATTERN,
});
const retrievalRequestIdSchema = Type.String({
  minLength: 66,
  maxLength: 66,
  pattern: '^retrieval-request-[0-9a-f]{48}$',
});
const retrievalResultIdSchema = Type.String({
  minLength: 65,
  maxLength: 65,
  pattern: '^retrieval-result-[0-9a-f]{48}$',
});
const laneLimitSchema = Type.Integer({ minimum: 1, maximum: 10 });

export const candidateRetrievalAuthorityBindingsV1Schema = closedObject({
  taxonomy: closedObject({
    taxonomyVersion: semanticVersionSchema,
    taxonomySemanticDigest: digestSchema,
  }),
  candidateProfiles: closedObject({
    authorityVersion: Type.Literal(
      DETERMINISTIC_CANDIDATE_PROFILE_AUTHORITY_VERSION,
    ),
    semanticAuthorityDigest: digestSchema,
    profileRulesVersion: Type.Literal(DETERMINISTIC_PROFILE_RULES_VERSION),
  }),
  catalog: closedObject({
    catalogVersion: catalogVersionSchema,
    catalogDigest: digestSchema,
  }),
  candidateConstraintEvaluationVersion: Type.Literal(
    CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  ),
  retrievalExpansion: closedObject({
    authorityVersion: Type.Literal(CAPABILITY_RETRIEVAL_EXPANSION_VERSION),
    semanticDigest: digestSchema,
  }),
});

const embeddedCapabilityQueryNormalizationResultV1Schema = withoutRootMetadata(
  capabilityQueryNormalizationResultV1Schema,
);

export const candidateRetrievalRequestV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    retrievalRequestVersion: Type.Literal(CANDIDATE_RETRIEVAL_REQUEST_VERSION),
    retrievalRequestId: retrievalRequestIdSchema,
    normalization: embeddedCapabilityQueryNormalizationResultV1Schema,
    authorityBindings: candidateRetrievalAuthorityBindingsV1Schema,
    eligibleResultLimit: laneLimitSchema,
    evidenceNeededResultLimit: laneLimitSchema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/candidate-retrieval-request/1.1.0',
    additionalProperties: false,
  },
);

const channelIdSchema = Type.Union([
  Type.Literal('capability-family'),
  Type.Literal('taxonomy-concept'),
  Type.Literal('candidate-identity'),
  Type.Literal('package-identity'),
  Type.Literal('structured-profile'),
]);
const channelVersionSchema = Type.Union([
  Type.Literal('capability-family/1.0.0'),
  Type.Literal('taxonomy-concept/1.0.0'),
  Type.Literal('candidate-identity/1.1.0'),
  Type.Literal('package-identity/1.1.0'),
  Type.Literal('structured-profile/1.0.0'),
]);
const channelBindingSchema = closedObject({
  channelId: channelIdSchema,
  channelVersion: channelVersionSchema,
});
const boundedStableIdsSchema = Type.Array(stableIdSchema, {
  maxItems: 64,
  uniqueItems: true,
});
const profileFieldIdSchema = literals(DETERMINISTIC_PROFILE_FIELD_IDS);
const constraintFacetSchema = literals(CAPABILITY_QUERY_CONSTRAINT_FACETS);
const boundedProfileFieldIdsSchema = Type.Array(profileFieldIdSchema, {
  maxItems: 27,
  uniqueItems: true,
});
const retrievalChannelMatchV1Schema = closedObject({
  channelId: channelIdSchema,
  channelVersion: channelVersionSchema,
  componentScore: Type.Integer({ minimum: 1, maximum: 2_000 }),
  matchedCapabilityConceptIds: boundedStableIdsSchema,
  matchedProfileFieldIds: boundedProfileFieldIdsSchema,
  matchedExpansionEdgeIds: Type.Array(stableIdSchema, {
    maxItems: 32,
    uniqueItems: true,
  }),
});
const unresolvedHardEvaluationV1Schema = closedObject({
  evaluationId: stableIdSchema,
  sourceKind: Type.Union([
    Type.Literal('normalized-constraint'),
    Type.Literal('preserved-declaration'),
    Type.Literal('primary-family'),
  ]),
  modality: Type.Union([Type.Literal('required'), Type.Literal('prohibited')]),
  facet: constraintFacetSchema,
  conceptId: Type.Union([stableIdSchema, Type.Null()]),
  profileFieldId: Type.Union([profileFieldIdSchema, Type.Null()]),
  match: Type.Literal('unresolved'),
  state: Type.Literal('unresolved'),
  ruleId: stableIdSchema,
});
const candidateCommon = {
  candidateId: stableIdSchema,
  retrievalScore: Type.Integer({ minimum: 1, maximum: 10_000 }),
  matchedCapabilityConceptIds: boundedStableIdsSchema,
  matchedProfileFieldIds: boundedProfileFieldIdsSchema,
  channelMatches: Type.Array(retrievalChannelMatchV1Schema, {
    minItems: 1,
    maxItems: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.length,
  }),
} as const;

export const eligibleRetrievalCandidateV1Schema = closedObject({
  ...candidateCommon,
  lane: Type.Literal('eligible'),
  unresolvedHardEvaluations: Type.Array(unresolvedHardEvaluationV1Schema, {
    maxItems: 0,
  }),
});
export const evidenceNeededRetrievalCandidateV1Schema = closedObject({
  ...candidateCommon,
  lane: Type.Literal('evidence-needed'),
  unresolvedHardEvaluations: Type.Array(unresolvedHardEvaluationV1Schema, {
    minItems: 1,
    maxItems: 64,
  }),
});
export const candidateRetrievalCandidateV1Schema = Type.Union([
  eligibleRetrievalCandidateV1Schema,
  evidenceNeededRetrievalCandidateV1Schema,
]);

export const preRetrievalLaneCountsV1Schema = closedObject({
  eligible: Type.Integer({ minimum: 0, maximum: 10_000 }),
  'evidence-needed': Type.Integer({ minimum: 0, maximum: 10_000 }),
  excluded: Type.Integer({ minimum: 0, maximum: 10_000 }),
});

const retrievalDiagnosticsV1Schema = closedObject({
  candidatesExamined: Type.Integer({ minimum: 0, maximum: 10_000 }),
  candidatesConstraintEvaluated: Type.Integer({
    minimum: 0,
    maximum: 10_000,
  }),
  activeChannelCount: Type.Integer({
    minimum: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.length,
    maximum: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.length,
  }),
  candidateChannelMatches: Type.Integer({ minimum: 0, maximum: 50_000 }),
  negativeControlsExcluded: Type.Integer({ minimum: 0, maximum: 10_000 }),
  exactRepositoryIdentityGroups: Type.Integer({
    minimum: 0,
    maximum: 10_000,
  }),
  exactPackageIdentityGroups: Type.Integer({
    minimum: 0,
    maximum: 10_000,
  }),
  exactIdentityDuplicatesRemoved: Type.Integer({
    minimum: 0,
    maximum: 10_000,
  }),
  eligibleCandidatesTruncated: Type.Integer({ minimum: 0, maximum: 10_000 }),
  evidenceNeededCandidatesTruncated: Type.Integer({
    minimum: 0,
    maximum: 10_000,
  }),
  expansionSourceConcepts: Type.Integer({ minimum: 0, maximum: 64 }),
  expansionEdgesApplied: Type.Integer({ minimum: 0, maximum: 32 }),
  expansionEdgesTruncated: Type.Integer({ minimum: 0, maximum: 512 }),
  candidateExpansionMatches: Type.Integer({ minimum: 0, maximum: 50_000 }),
});

export const candidateRetrievalResultV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    retrievalResultVersion: Type.Literal(CANDIDATE_RETRIEVAL_RESULT_VERSION),
    retrievalResultId: retrievalResultIdSchema,
    retrievalRequestId: retrievalRequestIdSchema,
    normalizationId: Type.String({
      minLength: 62,
      maxLength: 62,
      pattern: '^normalization-[0-9a-f]{48}$',
    }),
    normalizationSemanticDigest: digestSchema,
    authorityBindings: candidateRetrievalAuthorityBindingsV1Schema,
    retrievalAlgorithmVersion: Type.Literal(
      CANDIDATE_RETRIEVAL_ALGORITHM_VERSION,
    ),
    channelBindings: Type.Array(channelBindingSchema, {
      minItems: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.length,
      maxItems: CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.length,
    }),
    eligibleResultLimit: laneLimitSchema,
    evidenceNeededResultLimit: laneLimitSchema,
    preRetrievalLaneCounts: preRetrievalLaneCountsV1Schema,
    eligibleCandidates: Type.Array(eligibleRetrievalCandidateV1Schema, {
      maxItems: 10,
    }),
    evidenceNeededCandidates: Type.Array(
      evidenceNeededRetrievalCandidateV1Schema,
      { maxItems: 10 },
    ),
    diagnostics: retrievalDiagnosticsV1Schema,
    semanticDigest: digestSchema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/candidate-retrieval-result/1.1.0',
    additionalProperties: false,
  },
);

export type CandidateRetrievalAuthorityBindingsV1 = Static<
  typeof candidateRetrievalAuthorityBindingsV1Schema
>;
export type CandidateRetrievalRequestV1 = Static<
  typeof candidateRetrievalRequestV1Schema
>;
export type CandidateRetrievalChannelIdV1 =
  (typeof CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS)[number]['channelId'];
export type CandidateRetrievalChannelBindingV1 = Static<
  typeof channelBindingSchema
>;
export type CandidateRetrievalChannelMatchV1 = Static<
  typeof retrievalChannelMatchV1Schema
>;
export type CandidateRetrievalLaneV1 = 'eligible' | 'evidence-needed';
export type CandidateRetrievalCandidateV1 = Static<
  typeof candidateRetrievalCandidateV1Schema
>;
export type EligibleRetrievalCandidateV1 = Static<
  typeof eligibleRetrievalCandidateV1Schema
>;
export type EvidenceNeededRetrievalCandidateV1 = Static<
  typeof evidenceNeededRetrievalCandidateV1Schema
>;
export type PreRetrievalLaneCountsV1 = Static<
  typeof preRetrievalLaneCountsV1Schema
>;
export type CandidateRetrievalResultV1 = Static<
  typeof candidateRetrievalResultV1Schema
>;

function withoutRootMetadata<T extends object>(schema: T): T {
  const embedded = { ...schema };
  Reflect.deleteProperty(embedded, '$id');
  Reflect.deleteProperty(embedded, '$schema');
  return embedded;
}

type LiteralSchemas<Values extends readonly string[]> = {
  -readonly [Index in keyof Values]: TLiteral<Values[Index]>;
};

function literals<const Values extends readonly string[]>(
  values: Values,
): TUnion<LiteralSchemas<Values>> {
  return Type.Union(
    values.map((value) => Type.Literal(value)),
  ) as unknown as TUnion<LiteralSchemas<Values>>;
}
