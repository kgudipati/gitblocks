type Schema = Readonly<Record<string, unknown>>;
const digest = { type: 'string', pattern: '^[0-9a-f]{64}$' } as const;
const text = { type: 'string', minLength: 1 } as const;
const integer = { type: 'integer', minimum: 0 } as const;

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

export const repositoryInterviewOperatorPolicyV1Schema = closed({
  schemaVersion: { const: '1.0.0' },
  policyId: text,
  maximumCandidates: { type: 'integer', minimum: 1, maximum: 150 },
  concurrency: { enum: [1, 2] },
  candidateDeadlineMilliseconds: integer,
  runDeadlineMilliseconds: integer,
  statementTimeoutMilliseconds: integer,
  lockTimeoutMilliseconds: integer,
  maximumInputTokensPerProviderCall: integer,
  maximumOutputTokensPerProviderCall: integer,
  maximumRunInputTokens: integer,
  maximumRunCachedInputTokens: integer,
  maximumRunOutputTokens: integer,
  maximumRunReasoningTokens: integer,
  maximumRunTotalTokens: integer,
  maximumRunCostMicroUsd: integer,
  pricing: closed({
    provider: { const: 'openai' },
    modelSnapshot: text,
    inputMicroUsdPerMillionTokens: integer,
    cachedInputMicroUsdPerMillionTokens: integer,
    outputMicroUsdPerMillionTokens: integer,
    pricingAuthorityDate: text,
    pricingAuthorityDigest: digest,
  }),
  policyDigest: digest,
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
  'repository-interview-operator-selection-v1.schema.json':
    repositoryInterviewOperatorSelectionV1Schema,
  'repository-interview-operator-policy-v1.schema.json':
    repositoryInterviewOperatorPolicyV1Schema,
  'repository-interview-operator-receipt-v1.schema.json':
    repositoryInterviewOperatorReceiptV1Schema,
});
