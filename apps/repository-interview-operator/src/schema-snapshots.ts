type Schema = Readonly<Record<string, unknown>>;
const digest = { type: 'string', pattern: '^[0-9a-f]{64}$' } as const;
const text = { type: 'string', minLength: 1 } as const;
const integer = { type: 'integer', minimum: 0 } as const;
const maximumSafeInteger = Number.MAX_SAFE_INTEGER;
const policySafeInteger = {
  type: 'integer',
  minimum: 0,
  maximum: maximumSafeInteger,
} as const;
const policyDigest = {
  type: 'string',
  minLength: 64,
  maxLength: 64,
  pattern: '^[0-9a-f]{64}$',
} as const;
const safeId = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
  pattern: '^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$',
} as const;
const candidateId = {
  type: 'string',
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$',
} as const;

function closed(properties: Readonly<Record<string, unknown>>): Schema {
  return Object.freeze({
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });
}

const usage = closed({
  inputTokens: integer,
  cachedInputTokens: integer,
  outputTokens: integer,
  reasoningTokens: integer,
  totalTokens: integer,
});

export const repositoryInterviewOperatorSelectionV1Schema = closed({
  schemaVersion: { const: '1.0.0' },
  selectionId: text,
  catalogVersion: text,
  catalogDigest: digest,
  artifactManifestVersion: text,
  artifactManifestDigest: digest,
  members: {
    type: 'array',
    minItems: 1,
    maxItems: 150,
    items: closed({
      ordinal: { type: 'integer', minimum: 0, maximum: 149 },
      candidateId: text,
      artifactSetId: text,
      artifactSetIdentityDigest: digest,
    }),
  },
  selectionDigest: digest,
});

export const repositoryInterviewCandidatePlanV1Schema = closed({
  schemaVersion: { const: '1.0.0' },
  planId: safeId,
  catalogVersion: { const: 'public-v1' },
  catalogDigest: {
    const: '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
  },
  artifactManifestVersion: { const: 'public-artifacts-v1' },
  artifactManifestDigest: {
    const: '17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c',
  },
  candidateIds: {
    type: 'array',
    minItems: 1,
    maxItems: 150,
    uniqueItems: true,
    items: candidateId,
  },
  planDigest: digest,
});

export const repositoryInterviewSelectionMaterializationV1Schema = closed({
  schemaVersion: { const: '1.0.0' },
  materializationId: safeId,
  candidatePlanId: safeId,
  candidatePlanDigest: digest,
  artifactCollectionReceiptVersion: {
    const: 'public-artifact-receipt/1.0.0',
  },
  artifactCollectionReceiptDigest: digest,
  catalogVersion: { const: 'public-v1' },
  catalogDigest: {
    const: '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
  },
  artifactManifestVersion: { const: 'public-artifacts-v1' },
  artifactManifestDigest: {
    const: '17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c',
  },
  operatorSelectionId: safeId,
  operatorSelectionDigest: digest,
  candidateCount: { type: 'integer', minimum: 1, maximum: 150 },
  materializationDigest: digest,
});

export const repositoryInterviewPreliveAuthorizationV1Schema = closed({
  schemaVersion: { const: '1.0.0' },
  authorizationId: safeId,
  scope: { const: 'calibration-six' },
  status: { const: 'approved' },
  candidatePlanId: safeId,
  candidatePlanDigest: digest,
  artifactCollectionReceiptVersion: {
    const: 'public-artifact-receipt/1.0.0',
  },
  artifactCollectionReceiptDigest: digest,
  selectionMaterializationDigest: digest,
  selectionId: safeId,
  selectionDigest: digest,
  allowedModelProfileDigests: {
    type: 'array',
    minItems: 2,
    maxItems: 2,
    uniqueItems: true,
    items: digest,
  },
  specificationDigest: digest,
  catalogDigest: digest,
  artifactManifestDigest: digest,
  operatorPolicyDigest: digest,
  pricingAuthorityDigest: digest,
  retentionAuthorityDigest: digest,
  databaseScope: { const: 'ephemeral-non-production' },
  maximumProviderCalls: { const: 12 },
  maximumCostMicroUsd: {
    type: 'integer',
    minimum: 0,
    maximum: 10_000_000,
  },
  authorizedAt: {
    type: 'string',
    pattern:
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$',
  },
  expiresAt: {
    type: 'string',
    pattern:
      '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\\.[0-9]{3}Z$',
  },
  authorizationDigest: digest,
});

export const repositoryInterviewOperatorPolicyV1Schema = closed({
  schemaVersion: { const: '1.0.0' },
  policyId: {
    type: 'string',
    minLength: 1,
    maxLength: 128,
    pattern: '^[a-z0-9](?:[a-z0-9._-]{0,126}[a-z0-9])?$',
  },
  maximumCandidates: { type: 'integer', minimum: 1, maximum: 150 },
  concurrency: { enum: [1, 2] },
  candidateDeadlineMilliseconds: {
    type: 'integer',
    minimum: 300_000,
    maximum: 86_400_000,
  },
  runDeadlineMilliseconds: {
    type: 'integer',
    minimum: 1,
    maximum: 86_400_000,
  },
  statementTimeoutMilliseconds: {
    type: 'integer',
    minimum: 1,
    maximum: 60_000,
  },
  lockTimeoutMilliseconds: {
    type: 'integer',
    minimum: 1,
    maximum: 30_000,
  },
  maximumInputTokensPerProviderCall: {
    type: 'integer',
    minimum: 1,
    maximum: 10_000_000,
  },
  maximumOutputTokensPerProviderCall: {
    type: 'integer',
    minimum: 1,
    maximum: 8_192,
  },
  maximumRunInputTokens: policySafeInteger,
  maximumRunCachedInputTokens: policySafeInteger,
  maximumRunOutputTokens: policySafeInteger,
  maximumRunReasoningTokens: policySafeInteger,
  maximumRunTotalTokens: policySafeInteger,
  maximumRunCostMicroUsd: {
    type: 'integer',
    minimum: 0,
    maximum: 120_000_000,
  },
  pricing: closed({
    provider: { const: 'openai' },
    modelSnapshot: {
      type: 'string',
      minLength: 12,
      maxLength: 128,
      pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,102}-[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    },
    inputMicroUsdPerMillionTokens: policySafeInteger,
    cachedInputMicroUsdPerMillionTokens: policySafeInteger,
    outputMicroUsdPerMillionTokens: policySafeInteger,
    pricingAuthorityDate: {
      type: 'string',
      minLength: 10,
      maxLength: 10,
      pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2}$',
    },
    pricingAuthorityDigest: policyDigest,
  }),
  policyDigest,
});

const candidateResult = closed({
  ordinal: integer,
  candidateId: text,
  artifactSetId: text,
  artifactSetIdentityDigest: digest,
  status: {
    enum: [
      'completed',
      'provider-failed',
      'application-failed',
      'persistence-failed',
    ],
  },
  disposition: {
    type: ['string', 'null'],
    enum: ['created', 'idempotent', 'reused', 'provider-failed', null],
  },
  failureCode: { type: ['string', 'null'] },
  requestId: { type: ['string', 'null'] },
  requestRecordDigest: { anyOf: [digest, { type: 'null' }] },
  executionId: { type: ['string', 'null'] },
  executionRecordDigest: { anyOf: [digest, { type: 'null' }] },
  interviewId: { type: ['string', 'null'] },
  interviewRecordDigest: { anyOf: [digest, { type: 'null' }] },
  attemptCount: integer,
  retryCount: integer,
  publicationStatus: { type: ['string', 'null'] },
  claims: integer,
  citations: integer,
  limitations: integer,
  contradictions: integer,
  unknowns: integer,
  usage,
  costMicroUsd: integer,
  durationMilliseconds: integer,
});

export const repositoryInterviewOperatorReceiptV1Schema = closed({
  schemaVersion: { const: '1.0.0' },
  kind: { const: 'repository-interview-operator-receipt' },
  runId: text,
  startedAt: text,
  completedAt: text,
  durationMilliseconds: integer,
  status: { enum: ['completed', 'stopped', 'failed'] },
  stopCode: { type: ['string', 'null'] },
  selection: closed({
    selectionId: text,
    selectionDigest: digest,
    candidateCount: integer,
  }),
  authorities: closed({
    catalogVersion: text,
    catalogDigest: digest,
    artifactManifestVersion: text,
    artifactManifestDigest: digest,
    specificationVersion: text,
    specificationDigest: digest,
    rendererVersion: text,
    providerOutputSchemaVersion: text,
    providerOutputSchemaDigest: digest,
    providerProjectionVersion: text,
    providerProjectionDigest: digest,
    modelProfileDigest: digest,
    operatorPolicyDigest: digest,
    pricingAuthorityDate: text,
    pricingAuthorityDigest: digest,
  }),
  database: closed({
    postgresqlVersion: text,
    latestMigrationVersion: integer,
    migrationInventoryDigest: digest,
    migrationCount: integer,
  }),
  executionPolicy: closed({
    executionMode: { enum: ['normal', 'forced'] },
    forceReasonCode: { type: ['string', 'null'] },
    concurrency: { enum: [1, 2] },
    candidateDeadlineMilliseconds: integer,
    runDeadlineMilliseconds: integer,
    maximumRunInputTokens: integer,
    maximumRunCachedInputTokens: integer,
    maximumRunOutputTokens: integer,
    maximumRunReasoningTokens: integer,
    maximumRunTotalTokens: integer,
    maximumRunCostMicroUsd: integer,
    immediateReuseRequested: { type: 'boolean' },
  }),
  counts: closed({
    requestedCandidates: integer,
    startedCandidates: integer,
    completedCandidates: integer,
    reusedCandidates: integer,
    createdCandidates: integer,
    idempotentCandidates: integer,
    providerFailedCandidates: integer,
    applicationFailedCandidates: integer,
    persistenceFailedCandidates: integer,
    notStartedCandidates: integer,
    providerCalls: integer,
    providerAttempts: integer,
    providerRetries: integer,
  }),
  semanticCounts: closed({
    interviews: integer,
    claims: integer,
    citations: integer,
    limitations: integer,
    contradictions: integer,
    unknowns: integer,
  }),
  usage,
  cost: closed({
    currency: { const: 'USD' },
    unit: { const: 'micro-usd' },
    totalMicroUsd: integer,
    maximumMicroUsd: integer,
  }),
  providerSummary: closed({
    responses: integer,
    networkErrors: integer,
    deadlines: integer,
    cancellations: integer,
    refusals: integer,
    incomplete: integer,
    safetyInterruptions: integer,
    rateLimited: integer,
    quotaExceeded: integer,
    providerErrors: integer,
    invalidResponses: integer,
    invalidUsage: integer,
    responseTooLarge: integer,
    minimumRemainingRequests: { type: ['integer', 'null'] },
    minimumRemainingTokens: { type: ['integer', 'null'] },
    maximumResetRequestsMilliseconds: { type: ['integer', 'null'] },
    maximumResetTokensMilliseconds: { type: ['integer', 'null'] },
  }),
  candidateResults: { type: 'array', maxItems: 150, items: candidateResult },
  immediateReuse: {
    anyOf: [
      closed({ requested: { const: false } }),
      closed({
        requested: { const: true },
        passed: { type: 'boolean' },
        candidateCount: integer,
        reusedCount: integer,
        providerCalls: integer,
        providerAttempts: integer,
        tokenUsage: integer,
        costMicroUsd: integer,
      }),
    ],
  },
  telemetry: closed({ eventCount: integer, telemetryFailureCount: integer }),
  receiptDigest: digest,
});

export const REPOSITORY_INTERVIEW_OPERATOR_SCHEMA_SNAPSHOTS = Object.freeze({
  'repository-interview-candidate-plan-v1.schema.json':
    repositoryInterviewCandidatePlanV1Schema,
  'repository-interview-operator-selection-v1.schema.json':
    repositoryInterviewOperatorSelectionV1Schema,
  'repository-interview-operator-policy-v1.schema.json':
    repositoryInterviewOperatorPolicyV1Schema,
  'repository-interview-operator-receipt-v1.schema.json':
    repositoryInterviewOperatorReceiptV1Schema,
  'repository-interview-prelive-authorization-v1.schema.json':
    repositoryInterviewPreliveAuthorizationV1Schema,
  'repository-interview-selection-materialization-v1.schema.json':
    repositoryInterviewSelectionMaterializationV1Schema,
});
