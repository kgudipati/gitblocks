import { Type, type Static } from 'typebox';

import {
  closedObject,
  contractVersionSchema,
  semanticVersionSchema,
  stableIdSchema,
  timestampSchema,
} from './schema-builders.ts';

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;

export const REPOSITORY_INTERVIEW_TOPICS = Object.freeze([
  'purpose-and-scope',
  'runtime-and-framework',
  'integration-surface',
  'data-and-state',
  'deployment-and-operations',
  'security-and-trust',
  'maintenance-and-support',
  'adoption-and-limitations',
] as const);

export type RepositoryInterviewTopic =
  (typeof REPOSITORY_INTERVIEW_TOPICS)[number];

export const REPOSITORY_INTERVIEW_BOUNDS = Object.freeze({
  maximumLine: 10_000,
  maximumCitationLines: 80,
  maximumCitations: 96,
  maximumCitationsPerItem: 4,
  maximumClaims: 32,
  maximumLimitations: 12,
  maximumContradictions: 6,
  maximumUnknowns: 16,
  maximumStatementScalars: 500,
  maximumStatementUtf8Bytes: 2_048,
  maximumRationaleScalars: 750,
  maximumRationaleUtf8Bytes: 3_072,
} as const);

const HEX_64_PATTERN = '^[0-9a-f]{64}$';
const HEX_32_PATTERN = '^[0-9a-f]{32}$';
const ARTIFACT_SET_ID_PATTERN = '^artifact-set-[0-9a-f]{48}$';
const ARTIFACT_ID_PATTERN = '^artifact-[0-9a-f]{48}$';
const REQUEST_ID_PATTERN = '^intreq-[0-9a-f]{48}$';
const EXECUTION_ID_PATTERN = '^modelexec-[0-9a-f]{48}$';
const INTERVIEW_ID_PATTERN = '^interview-[0-9a-f]{48}$';
const CITATION_ID_PATTERN = '^intcite-[0-9a-f]{48}$';
const CLAIM_ID_PATTERN = '^intclaim-[0-9a-f]{48}$';
const LIMITATION_ID_PATTERN = '^intlimit-[0-9a-f]{48}$';
const CONTRADICTION_ID_PATTERN = '^intcontra-[0-9a-f]{48}$';
const UNKNOWN_ID_PATTERN = '^intunknown-[0-9a-f]{48}$';
const VERSION_CODE_PATTERN = '^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$';
const DATED_MODEL_SNAPSHOT_PATTERN =
  '^[A-Za-z0-9][A-Za-z0-9._-]{0,102}-[0-9]{4}-[0-9]{2}-[0-9]{2}$';
const PROVIDER_IDENTIFIER_PATTERN = '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$';
const SAFE_SEMANTIC_TEXT_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u0600-\\u0605\\u061c\\u06dd\\u070f\\u0890-\\u0891\\u08e2\\u180e\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff\\ufff9-\\ufffb]*$';

function patternedString(
  pattern: string,
  minLength: number,
  maxLength: number,
) {
  return Type.String({ minLength, maxLength, pattern });
}

const digestSchema = patternedString(HEX_64_PATTERN, 64, 64);
const requestIdSchema = patternedString(REQUEST_ID_PATTERN, 55, 55);
const executionIdSchema = patternedString(EXECUTION_ID_PATTERN, 58, 58);
const interviewIdSchema = patternedString(INTERVIEW_ID_PATTERN, 58, 58);
const citationIdSchema = patternedString(CITATION_ID_PATTERN, 56, 56);
const claimIdSchema = patternedString(CLAIM_ID_PATTERN, 57, 57);
const limitationIdSchema = patternedString(LIMITATION_ID_PATTERN, 57, 57);
const contradictionIdSchema = patternedString(CONTRADICTION_ID_PATTERN, 58, 58);
const unknownIdSchema = patternedString(UNKNOWN_ID_PATTERN, 59, 59);
const artifactSetIdSchema = patternedString(ARTIFACT_SET_ID_PATTERN, 61, 61);
const artifactIdSchema = patternedString(ARTIFACT_ID_PATTERN, 57, 57);
const rendererVersionSchema = patternedString(VERSION_CODE_PATTERN, 1, 64);
const nonceSchema = patternedString(HEX_32_PATTERN, 32, 32);
const providerIdentifierSchema = Type.Union([
  patternedString(PROVIDER_IDENTIFIER_PATTERN, 1, 128),
  Type.Null(),
]);
const topicSchema = Type.Enum(REPOSITORY_INTERVIEW_TOPICS);
const documentedConfidenceSchema = Type.Union([
  Type.Literal('high'),
  Type.Literal('medium'),
]);
const inferenceConfidenceSchema = Type.Union([
  Type.Literal('medium'),
  Type.Literal('low'),
]);
const statementSchema = Type.String({
  minLength: 1,
  maxLength: REPOSITORY_INTERVIEW_BOUNDS.maximumStatementScalars,
  pattern: SAFE_SEMANTIC_TEXT_PATTERN,
});
const rationaleSchema = Type.String({
  minLength: 1,
  maxLength: REPOSITORY_INTERVIEW_BOUNDS.maximumRationaleScalars,
  pattern: SAFE_SEMANTIC_TEXT_PATTERN,
});

const repositoryInterviewRequestProperties = {
  contractVersion: contractVersionSchema,
  requestId: requestIdSchema,
  candidateId: stableIdSchema,
  artifactSetId: artifactSetIdSchema,
  artifactSetIdentityDigest: digestSchema,
  specificationVersion: semanticVersionSchema,
  specificationDigest: digestSchema,
  rendererVersion: rendererVersionSchema,
  providerOutputSchemaVersion: semanticVersionSchema,
  providerOutputSchemaDigest: digestSchema,
  promptDigest: digestSchema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
} as const;

export const repositoryInterviewRequestV1Schema = Type.Object(
  repositoryInterviewRequestProperties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/repository-interview-request/1.0.0',
    additionalProperties: false,
  },
);

export const modelExecutionModelProfileV1Schema = closedObject({
  provider: Type.Literal('openai'),
  endpointProfile: Type.Literal('responses-v1'),
  modelSnapshot: patternedString(DATED_MODEL_SNAPSHOT_PATTERN, 12, 128),
  providerProjectionVersion: semanticVersionSchema,
  providerProjectionDigest: digestSchema,
  reasoningEffort: Type.Union([
    Type.Literal('low'),
    Type.Literal('medium'),
    Type.Literal('high'),
  ]),
  maximumOutputTokens: Type.Integer({ minimum: 1, maximum: 8_192 }),
  maximumResponseBytes: Type.Integer({
    minimum: 1,
    maximum: 2_097_152,
  }),
  store: Type.Literal(false),
  toolsEnabled: Type.Literal(false),
  background: Type.Literal(false),
  conversationState: Type.Literal(false),
  previousResponseState: Type.Literal(false),
  truncation: Type.Literal('disabled'),
  promptCacheRetention: Type.Literal('in-memory'),
  serviceTier: Type.Literal('default'),
  retryPolicyVersion: Type.Literal('repository-interview-retry-v1'),
});

const nullableSafeIntegerSchema = Type.Union([
  Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  Type.Null(),
]);
const nullableDurationSchema = Type.Union([
  Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  Type.Null(),
]);
const retryDelaySchema = Type.Union([
  Type.Integer({ minimum: 0, maximum: 30_000 }),
  Type.Null(),
]);

export const modelExecutionAttemptV1Schema = closedObject({
  ordinal: Type.Integer({ minimum: 1, maximum: 2 }),
  startedAt: timestampSchema,
  completedAt: timestampSchema,
  transportOutcome: Type.Union([
    Type.Literal('response'),
    Type.Literal('network-error'),
    Type.Literal('deadline-exceeded'),
    Type.Literal('cancelled'),
  ]),
  httpStatus: Type.Union([
    Type.Integer({ minimum: 100, maximum: 599 }),
    Type.Null(),
  ]),
  providerRequestId: providerIdentifierSchema,
  responseId: providerIdentifierSchema,
  responseBytes: Type.Integer({ minimum: 0, maximum: 2_097_152 }),
  providerProcessingMilliseconds: nullableDurationSchema,
  retryAfterMilliseconds: retryDelaySchema,
  remainingRequests: nullableSafeIntegerSchema,
  remainingTokens: nullableSafeIntegerSchema,
  resetRequestsMilliseconds: nullableDurationSchema,
  resetTokensMilliseconds: nullableDurationSchema,
});

export const modelExecutionUsageV1Schema = closedObject({
  inputTokens: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  cachedInputTokens: Type.Integer({
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  outputTokens: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
  reasoningTokens: Type.Integer({
    minimum: 0,
    maximum: Number.MAX_SAFE_INTEGER,
  }),
  totalTokens: Type.Integer({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }),
});

const modelExecutionFailureCodeSchema = Type.Union([
  Type.Literal('refused'),
  Type.Literal('incomplete'),
  Type.Literal('safety-interrupted'),
  Type.Literal('deadline-exceeded'),
  Type.Literal('cancelled'),
  Type.Literal('not-authorized'),
  Type.Literal('quota-exceeded'),
  Type.Literal('rate-limited'),
  Type.Literal('provider-error'),
  Type.Literal('transport-error'),
  Type.Literal('response-too-large'),
  Type.Literal('invalid-response'),
  Type.Literal('invalid-usage'),
  Type.Literal('provider-output-invalid'),
]);

export const modelExecutionOutcomeV1Schema = Type.Union([
  closedObject({
    status: Type.Literal('succeeded'),
    failureCode: Type.Null(),
    providerOutputDigest: digestSchema,
    usage: modelExecutionUsageV1Schema,
  }),
  closedObject({
    status: Type.Literal('failed'),
    failureCode: modelExecutionFailureCodeSchema,
    providerOutputDigest: Type.Null(),
    usage: Type.Union([modelExecutionUsageV1Schema, Type.Null()]),
  }),
]);

const modelExecutionProperties = {
  contractVersion: contractVersionSchema,
  executionId: executionIdSchema,
  requestId: requestIdSchema,
  requestIdentityDigest: digestSchema,
  executionNonce: nonceSchema,
  executionMode: Type.Union([Type.Literal('normal'), Type.Literal('forced')]),
  forceReason: Type.Union([
    Type.Literal('calibration'),
    Type.Literal('review-rejected'),
    Type.Literal('operator-recovery'),
    Type.Null(),
  ]),
  modelProfile: modelExecutionModelProfileV1Schema,
  modelProfileDigest: digestSchema,
  reuseKeyDigest: digestSchema,
  startedAt: timestampSchema,
  completedAt: timestampSchema,
  attempts: Type.Array(modelExecutionAttemptV1Schema, {
    minItems: 1,
    maxItems: 2,
  }),
  outcome: modelExecutionOutcomeV1Schema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
} as const;

export const modelExecutionV1Schema = Type.Object(modelExecutionProperties, {
  ...SCHEMA_ROOT_OPTIONS,
  $id: 'https://gitblocks.dev/schemas/contracts/model-execution/1.0.0',
  additionalProperties: false,
});

export const repositoryInterviewCitationV1Schema = closedObject({
  citationId: citationIdSchema,
  artifactId: artifactIdSchema,
  startLine: Type.Integer({
    minimum: 1,
    maximum: REPOSITORY_INTERVIEW_BOUNDS.maximumLine,
  }),
  endLine: Type.Integer({
    minimum: 1,
    maximum: REPOSITORY_INTERVIEW_BOUNDS.maximumLine,
  }),
  identityDigest: digestSchema,
  recordDigest: digestSchema,
});

const oneToFourCitationIdsSchema = Type.Array(citationIdSchema, {
  minItems: 1,
  maxItems: REPOSITORY_INTERVIEW_BOUNDS.maximumCitationsPerItem,
});
const zeroToFourCitationIdsSchema = Type.Array(citationIdSchema, {
  minItems: 0,
  maxItems: REPOSITORY_INTERVIEW_BOUNDS.maximumCitationsPerItem,
});

const documentedClaimSchema = closedObject({
  claimId: claimIdSchema,
  kind: Type.Literal('documented-position'),
  topic: topicSchema,
  statement: statementSchema,
  rationale: Type.Null(),
  confidence: documentedConfidenceSchema,
  citationIds: oneToFourCitationIdsSchema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
});
const inferenceClaimSchema = closedObject({
  claimId: claimIdSchema,
  kind: Type.Literal('inference'),
  topic: topicSchema,
  statement: statementSchema,
  rationale: rationaleSchema,
  confidence: inferenceConfidenceSchema,
  citationIds: oneToFourCitationIdsSchema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
});
export const repositoryInterviewClaimV1Schema = Type.Union([
  documentedClaimSchema,
  inferenceClaimSchema,
]);

const documentedLimitationSchema = closedObject({
  limitationId: limitationIdSchema,
  topic: topicSchema,
  basis: Type.Literal('documented-position'),
  statement: statementSchema,
  rationale: Type.Null(),
  confidence: documentedConfidenceSchema,
  citationIds: oneToFourCitationIdsSchema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
});
const inferenceLimitationSchema = closedObject({
  limitationId: limitationIdSchema,
  topic: topicSchema,
  basis: Type.Literal('inference'),
  statement: statementSchema,
  rationale: rationaleSchema,
  confidence: inferenceConfidenceSchema,
  citationIds: oneToFourCitationIdsSchema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
});
export const repositoryInterviewLimitationV1Schema = Type.Union([
  documentedLimitationSchema,
  inferenceLimitationSchema,
]);

export const repositoryInterviewContradictionPositionV1Schema = closedObject({
  statement: statementSchema,
  citationIds: Type.Array(citationIdSchema, { minItems: 1, maxItems: 2 }),
});
export const repositoryInterviewContradictionV1Schema = closedObject({
  contradictionId: contradictionIdSchema,
  topic: topicSchema,
  kind: Type.Union([
    Type.Literal('direct'),
    Type.Literal('scope-dependent'),
    Type.Literal('version-dependent'),
  ]),
  explanation: rationaleSchema,
  positions: Type.Array(repositoryInterviewContradictionPositionV1Schema, {
    minItems: 2,
    maxItems: 2,
  }),
  identityDigest: digestSchema,
  recordDigest: digestSchema,
});

export const repositoryInterviewUnknownV1Schema = closedObject({
  unknownId: unknownIdSchema,
  topic: topicSchema,
  reason: Type.Union([
    Type.Literal('not-documented'),
    Type.Literal('ambiguous'),
    Type.Literal('conflicting'),
    Type.Literal('insufficient-detail'),
    Type.Literal('artifact-unavailable'),
  ]),
  statement: statementSchema,
  partialCitationIds: zeroToFourCitationIdsSchema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
});

const repositoryInterviewProperties = {
  contractVersion: contractVersionSchema,
  interviewId: interviewIdSchema,
  candidateId: stableIdSchema,
  artifactSetId: artifactSetIdSchema,
  artifactSetIdentityDigest: digestSchema,
  requestId: requestIdSchema,
  requestIdentityDigest: digestSchema,
  executionId: executionIdSchema,
  executionIdentityDigest: digestSchema,
  providerOutputDigest: digestSchema,
  specificationVersion: semanticVersionSchema,
  specificationDigest: digestSchema,
  rendererVersion: rendererVersionSchema,
  providerOutputSchemaVersion: semanticVersionSchema,
  providerOutputSchemaDigest: digestSchema,
  providerProjectionVersion: semanticVersionSchema,
  providerProjectionDigest: digestSchema,
  promptDigest: digestSchema,
  modelProfileDigest: digestSchema,
  processingState: Type.Union([
    Type.Literal('complete'),
    Type.Literal('partial-evidence'),
    Type.Literal('insufficient-evidence'),
  ]),
  citations: Type.Array(repositoryInterviewCitationV1Schema, {
    minItems: 0,
    maxItems: REPOSITORY_INTERVIEW_BOUNDS.maximumCitations,
  }),
  claims: Type.Array(repositoryInterviewClaimV1Schema, {
    minItems: 0,
    maxItems: REPOSITORY_INTERVIEW_BOUNDS.maximumClaims,
  }),
  limitations: Type.Array(repositoryInterviewLimitationV1Schema, {
    minItems: 0,
    maxItems: REPOSITORY_INTERVIEW_BOUNDS.maximumLimitations,
  }),
  contradictions: Type.Array(repositoryInterviewContradictionV1Schema, {
    minItems: 0,
    maxItems: REPOSITORY_INTERVIEW_BOUNDS.maximumContradictions,
  }),
  unknowns: Type.Array(repositoryInterviewUnknownV1Schema, {
    minItems: 0,
    maxItems: REPOSITORY_INTERVIEW_BOUNDS.maximumUnknowns,
  }),
  publishedAt: timestampSchema,
  identityDigest: digestSchema,
  recordDigest: digestSchema,
} as const;

export const repositoryInterviewV1Schema = Type.Object(
  repositoryInterviewProperties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/repository-interview/1.0.0',
    additionalProperties: false,
  },
);

export type RepositoryInterviewRequestV1 = Static<
  typeof repositoryInterviewRequestV1Schema
>;
export type ModelExecutionModelProfileV1 = Static<
  typeof modelExecutionModelProfileV1Schema
>;
export type ModelExecutionAttemptV1 = Static<
  typeof modelExecutionAttemptV1Schema
>;
export type ModelExecutionUsageV1 = Static<typeof modelExecutionUsageV1Schema>;
export type ModelExecutionOutcomeV1 = Static<
  typeof modelExecutionOutcomeV1Schema
>;
export type ModelExecutionV1 = Static<typeof modelExecutionV1Schema>;
export type RepositoryInterviewCitationV1 = Static<
  typeof repositoryInterviewCitationV1Schema
>;
export type RepositoryInterviewClaimV1 = Static<
  typeof repositoryInterviewClaimV1Schema
>;
export type RepositoryInterviewLimitationV1 = Static<
  typeof repositoryInterviewLimitationV1Schema
>;
export type RepositoryInterviewContradictionPositionV1 = Static<
  typeof repositoryInterviewContradictionPositionV1Schema
>;
export type RepositoryInterviewContradictionV1 = Static<
  typeof repositoryInterviewContradictionV1Schema
>;
export type RepositoryInterviewUnknownV1 = Static<
  typeof repositoryInterviewUnknownV1Schema
>;
export type RepositoryInterviewV1 = Static<typeof repositoryInterviewV1Schema>;
