import { Type, type Static } from 'typebox';

import {
  capabilityFamilySchema,
  closedObject,
  componentNameSchema,
  componentVersionSchema,
  contractVersionSchema,
  dispositionSchema,
  httpsUrlSchema,
  packageNameSchema,
  reasonCodeSchema,
  regionSchema,
  repositoryNameSchema,
  responsibleOutcomeSchema,
  shortNameSchema,
  shortTextSchema,
  stableIdSchema,
  statementSchema,
  timestampSchema,
  versionTextSchema,
} from './schema-builders.ts';

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;

const repositoryFactProvenanceSchema = closedObject({
  origin: Type.Union([
    Type.Literal('manifest'),
    Type.Literal('lockfile'),
    Type.Literal('configuration-shape'),
    Type.Literal('repository-structure'),
    Type.Literal('supplied-declaration'),
  ]),
  directness: Type.Union([Type.Literal('direct'), Type.Literal('declared')]),
  confidence: Type.Union([
    Type.Literal('high'),
    Type.Literal('medium'),
    Type.Literal('low'),
    Type.Literal('unknown'),
  ]),
  observedAt: timestampSchema,
});

const successConditionSchema = closedObject({
  conditionId: stableIdSchema,
  statement: statementSchema,
});

const hardConstraintSchema = closedObject({
  constraintId: stableIdSchema,
  reasonCode: reasonCodeSchema,
  statement: statementSchema,
});

const preferenceSchema = closedObject({
  preferenceId: stableIdSchema,
  statement: statementSchema,
});

const transmissionApprovalSchema = closedObject({
  approvalId: stableIdSchema,
  approvedAt: timestampSchema,
  approvedBy: Type.Literal('request-originator'),
  scope: Type.Literal('minimized-repository-facts'),
  approvedCategories: Type.Array(
    Type.Union([
      Type.Literal('bounded-evidence'),
      Type.Literal('candidate-dossiers'),
      Type.Literal('capability-request'),
      Type.Literal('repository-fingerprint'),
    ]),
    { minItems: 1, maxItems: 4, uniqueItems: true },
  ),
});

const capabilityRequestV1Properties = {
  contractVersion: contractVersionSchema,
  requestId: stableIdSchema,
  capabilityFamily: capabilityFamilySchema,
  summary: statementSchema,
  successConditions: Type.Array(successConditionSchema, {
    minItems: 1,
    maxItems: 20,
  }),
  hardConstraints: Type.Array(hardConstraintSchema, { maxItems: 20 }),
  preferences: Type.Array(preferenceSchema, { maxItems: 20 }),
  transmissionApproval: transmissionApprovalSchema,
} as const;

const capabilityRequestV1ValueSchema = closedObject(
  capabilityRequestV1Properties,
);

export const capabilityRequestV1Schema = Type.Object(
  capabilityRequestV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/capability-request/1.0.0',
    additionalProperties: false,
  },
);

const componentFactSchema = closedObject({
  kind: Type.Literal('component'),
  factId: stableIdSchema,
  component: Type.Union([
    Type.Literal('language'),
    Type.Literal('runtime'),
    Type.Literal('framework'),
    Type.Literal('package-manager'),
    Type.Literal('database'),
    Type.Literal('orm'),
    Type.Literal('dependency'),
  ]),
  name: componentNameSchema,
  version: Type.Union([componentVersionSchema, Type.Null()]),
  provenance: repositoryFactProvenanceSchema,
});

const deploymentFactSchema = closedObject({
  kind: Type.Literal('deployment'),
  factId: stableIdSchema,
  topology: Type.Union([
    Type.Literal('serverless'),
    Type.Literal('long-running-container'),
    Type.Literal('long-running-server'),
  ]),
  workerCapability: Type.Union([
    Type.Literal('capable'),
    Type.Literal('incapable'),
    Type.Literal('unknown'),
  ]),
  replicas: Type.Union([
    Type.Integer({ minimum: 1, maximum: 10_000 }),
    Type.Null(),
  ]),
  region: Type.Union([regionSchema, Type.Null()]),
  provenance: repositoryFactProvenanceSchema,
});

const capabilityFactSchema = closedObject({
  kind: Type.Literal('capability'),
  factId: stableIdSchema,
  capabilityCode: stableIdSchema,
  state: Type.Union([Type.Literal('supported'), Type.Literal('unsupported')]),
  provenance: repositoryFactProvenanceSchema,
});

const tenantFactSchema = closedObject({
  kind: Type.Literal('tenant'),
  factId: stableIdSchema,
  tenantModel: Type.Union([
    Type.Literal('single-tenant'),
    Type.Literal('multi-tenant'),
    Type.Literal('unknown'),
  ]),
  provenance: repositoryFactProvenanceSchema,
});

const identityContextFactSchema = closedObject({
  kind: Type.Literal('identity-context'),
  factId: stableIdSchema,
  sourceContext: Type.Enum([
    'access-token',
    'job-payload',
    'request',
    'route-key',
    'session',
  ] as const),
  identifiers: Type.Array(
    Type.Enum([
      'account',
      'actor',
      'client',
      'correlation',
      'invoice',
      'media',
      'organization',
      'route',
      'source',
      'tenant',
    ] as const),
    { minItems: 1, maxItems: 6, uniqueItems: true },
  ),
  normalization: Type.Enum(['none', 'normalized'] as const),
  credentials: Type.Enum(['excluded', 'not-stated'] as const),
  provenance: repositoryFactProvenanceSchema,
});

const credentialPolicyFactSchema = closedObject({
  kind: Type.Literal('credential-policy'),
  factId: stableIdSchema,
  owner: Type.Enum(['provider', 'tenant'] as const),
  scope: Type.Literal('webhook-endpoint'),
  isolation: Type.Enum(['per-provider-endpoint', 'per-tenant'] as const),
  rotation: Type.Enum(['independently-rotatable', 'not-stated'] as const),
  provenance: repositoryFactProvenanceSchema,
});

const dataExclusionFactSchema = closedObject({
  kind: Type.Literal('data-exclusion'),
  factId: stableIdSchema,
  destination: Type.Literal('audit-payload'),
  categories: Type.Array(
    Type.Enum(['access-token', 'cookie', 'customer-email'] as const),
    { minItems: 1, maxItems: 3, uniqueItems: true },
  ),
  provenance: repositoryFactProvenanceSchema,
});

const dataResidencyFactSchema = closedObject({
  kind: Type.Literal('data-residency'),
  factId: stableIdSchema,
  categories: Type.Array(
    Type.Enum([
      'audit-data',
      'billing-data',
      'invoice-state',
      'job-state',
      'regulated-customer-data',
    ] as const),
    { minItems: 1, maxItems: 5, uniqueItems: true },
  ),
  storage: Type.Enum(['existing-postgresql', 'unspecified'] as const),
  region: Type.Enum(['eu', 'eu-central-1', 'existing-region'] as const),
  provenance: repositoryFactProvenanceSchema,
});

const dataShapeFactSchema = closedObject({
  kind: Type.Literal('data-shape'),
  factId: stableIdSchema,
  shape: Type.Enum([
    'document-tenant-owner-classification',
    'team-project-document-relationships',
  ] as const),
  provenance: repositoryFactProvenanceSchema,
});

const dataLifecycleFactSchema = Type.Union([
  closedObject({
    kind: Type.Literal('data-lifecycle'),
    factId: stableIdSchema,
    category: Type.Literal('rate-limit-counter'),
    policy: Type.Literal('reset-on-planned-restart-allowed'),
    provenance: repositoryFactProvenanceSchema,
  }),
  closedObject({
    kind: Type.Literal('data-lifecycle'),
    factId: stableIdSchema,
    category: Type.Literal('raw-webhook-body'),
    policy: Type.Literal('retain-until-signature-verification'),
    provenance: repositoryFactProvenanceSchema,
  }),
]);

const dataStoreFactSchema = Type.Union([
  closedObject({
    kind: Type.Literal('data-store'),
    factId: stableIdSchema,
    category: Type.Literal('media-and-queue-state'),
    stores: Type.Array(
      Type.Enum(['existing-postgresql', 'existing-redis'] as const),
      { minItems: 1, maxItems: 2, uniqueItems: true },
    ),
    contents: Type.Literal('repository-declared'),
    provenance: repositoryFactProvenanceSchema,
  }),
  closedObject({
    kind: Type.Literal('data-store'),
    factId: stableIdSchema,
    category: Type.Literal('rate-limit-counter'),
    stores: Type.Array(Type.Literal('upstash-redis'), {
      minItems: 1,
      maxItems: 1,
      uniqueItems: true,
    }),
    contents: Type.Literal('operational-counters-only'),
    provenance: repositoryFactProvenanceSchema,
  }),
]);

const infrastructureFactSchema = Type.Union([
  closedObject({
    kind: Type.Literal('infrastructure'),
    factId: stableIdSchema,
    resource: Type.Literal('additional-self-hosted-service'),
    availability: Type.Literal('available'),
    backingStore: Type.Literal('postgresql'),
    maximumAdditionalInstances: Type.Literal(1),
    provenance: repositoryFactProvenanceSchema,
  }),
  closedObject({
    kind: Type.Literal('infrastructure'),
    factId: stableIdSchema,
    resource: Type.Enum([
      'background-worker',
      'container-service',
      'database-custom-extensions',
      'database-shared-preload-libraries',
      'durable-process-singleton',
      'external-network',
      'fetch',
      'long-lived-tcp',
      'long-running-node-worker',
      'node-worker-thread',
      'persistent-policy-service',
      'persistent-redis',
      'sidecar',
      'stdout-json-regional-archive',
      'worker-container',
    ] as const),
    availability: Type.Enum(['available', 'unavailable'] as const),
    backingStore: Type.Literal('none'),
    maximumAdditionalInstances: Type.Null(),
    provenance: repositoryFactProvenanceSchema,
  }),
]);

const withheldCategorySchema = Type.Union([
  Type.Literal('raw-source'),
  Type.Literal('configuration-values'),
  Type.Literal('environment'),
  Type.Literal('credentials'),
  Type.Literal('logs'),
  Type.Literal('database-content'),
  Type.Literal('untracked-files'),
  Type.Literal('command-output'),
  Type.Literal('dependency-facts'),
  Type.Literal('identity-facts'),
  Type.Literal('data-facts'),
  Type.Literal('operational-facts'),
]);

const repositoryFingerprintV1Properties = {
  contractVersion: contractVersionSchema,
  fingerprintId: stableIdSchema,
  facts: Type.Array(
    Type.Union([
      componentFactSchema,
      deploymentFactSchema,
      capabilityFactSchema,
      tenantFactSchema,
      credentialPolicyFactSchema,
      dataExclusionFactSchema,
      dataLifecycleFactSchema,
      dataResidencyFactSchema,
      dataShapeFactSchema,
      dataStoreFactSchema,
      identityContextFactSchema,
      infrastructureFactSchema,
    ]),
    { maxItems: 200 },
  ),
  withheldCategories: Type.Array(withheldCategorySchema, {
    maxItems: 12,
  }),
} as const;

const repositoryFingerprintV1ValueSchema = closedObject(
  repositoryFingerprintV1Properties,
);

export const repositoryFingerprintV1Schema = Type.Object(
  repositoryFingerprintV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/repository-fingerprint/1.0.0',
    additionalProperties: false,
  },
);

const candidateIdentitySchema = closedObject({
  candidateId: stableIdSchema,
  displayName: shortNameSchema,
  repository: closedObject({
    host: Type.Literal('github'),
    owner: repositoryNameSchema,
    name: repositoryNameSchema,
  }),
  package: Type.Union([
    closedObject({
      registry: Type.Literal('npm'),
      name: packageNameSchema,
    }),
    Type.Null(),
  ]),
});

const evidenceSourceSchema = closedObject({
  sourceType: Type.Union([
    Type.Literal('official-documentation'),
    Type.Literal('official-repository'),
    Type.Literal('official-release'),
    Type.Literal('package-registry'),
    Type.Literal('security-advisory'),
    Type.Literal('license'),
    Type.Literal('approved-validation'),
  ]),
  sourceUrl: httpsUrlSchema,
  revision: closedObject({
    kind: Type.Union([
      Type.Literal('git-commit'),
      Type.Literal('tag'),
      Type.Literal('release'),
      Type.Literal('version'),
      Type.Literal('mutable-documentation'),
    ]),
    value: versionTextSchema,
    immutableUrl: Type.Union([httpsUrlSchema, Type.Null()]),
  }),
  collectedAt: timestampSchema,
  publishedAt: Type.Union([timestampSchema, Type.Null()]),
});

export const evidenceObservationV1Schema = closedObject({
  kind: Type.Literal('evidence'),
  evidenceId: stableIdSchema,
  candidateId: stableIdSchema,
  topic: stableIdSchema,
  dimension: Type.Union([
    Type.Literal('identity'),
    Type.Literal('repository-package'),
    Type.Literal('version-release'),
    Type.Literal('license'),
    Type.Literal('runtime-framework'),
    Type.Literal('deployment'),
    Type.Literal('data-store'),
    Type.Literal('maintenance'),
    Type.Literal('security'),
    Type.Literal('integration'),
  ]),
  observation: statementSchema,
  source: evidenceSourceSchema,
  freshness: closedObject({
    status: Type.Union([
      Type.Literal('current'),
      Type.Literal('stale'),
      Type.Literal('unknown'),
    ]),
    asOf: timestampSchema,
    scope: shortTextSchema,
  }),
  directness: Type.Literal('direct'),
  limitation: Type.Union([shortTextSchema, Type.Null()]),
});

const candidateLimitationSchema = closedObject({
  limitationId: stableIdSchema,
  candidateId: stableIdSchema,
  statement: statementSchema,
  evidenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

const candidateUnknownSchema = closedObject({
  scope: Type.Literal('candidate'),
  unknownId: stableIdSchema,
  candidateId: stableIdSchema,
  topic: stableIdSchema,
  statement: statementSchema,
  evidenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

const candidateDossierV1Properties = {
  contractVersion: contractVersionSchema,
  identity: candidateIdentitySchema,
  capabilityFamily: capabilityFamilySchema,
  versionScope: Type.Union([versionTextSchema, Type.Null()]),
  observations: Type.Array(evidenceObservationV1Schema, {
    maxItems: 100,
  }),
  limitations: Type.Array(candidateLimitationSchema, { maxItems: 40 }),
  unknowns: Type.Array(candidateUnknownSchema, { maxItems: 40 }),
} as const;

const candidateDossierV1ValueSchema = closedObject(
  candidateDossierV1Properties,
);

export const candidateDossierV1Schema = Type.Object(
  candidateDossierV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/candidate-dossier/1.0.0',
    additionalProperties: false,
  },
);

export const fitAssessmentRequestV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    assessmentRequestId: stableIdSchema,
    capabilityRequest: capabilityRequestV1ValueSchema,
    repositoryFingerprint: repositoryFingerprintV1ValueSchema,
    candidates: Type.Array(candidateDossierV1ValueSchema, {
      minItems: 1,
      maxItems: 20,
    }),
    evidenceCutoff: timestampSchema,
    requestedMaximumResults: Type.Integer({ minimum: 1, maximum: 20 }),
    correlationId: stableIdSchema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/fit-assessment-request/1.0.0',
    additionalProperties: false,
  },
);

export const inferenceV1Schema = closedObject({
  kind: Type.Literal('inference'),
  inferenceId: stableIdSchema,
  candidateId: stableIdSchema,
  topic: stableIdSchema,
  statement: statementSchema,
  rationale: statementSchema,
  evidenceIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: 20,
    uniqueItems: true,
  }),
});

const assessmentUnknownSchema = closedObject({
  scope: Type.Literal('assessment'),
  unknownId: stableIdSchema,
  topic: stableIdSchema,
  statement: statementSchema,
  evidenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

export const materialUnknownV1Schema = Type.Union([
  candidateUnknownSchema,
  assessmentUnknownSchema,
]);

export const materialClaimV1Schema = closedObject({
  claimId: stableIdSchema,
  candidateId: stableIdSchema,
  topic: stableIdSchema,
  direction: Type.Union([
    Type.Literal('favorable'),
    Type.Literal('neutral'),
    Type.Literal('unfavorable'),
  ]),
  statement: statementSchema,
  evidenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
  inferenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

const candidateReasonSchema = closedObject({
  candidateId: stableIdSchema,
  reasonCode: reasonCodeSchema,
  statement: statementSchema,
  evidenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
  inferenceIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
  unknownIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

export const hardConstraintConflictV1Schema = closedObject({
  conflictId: stableIdSchema,
  candidateId: stableIdSchema,
  constraintId: stableIdSchema,
  reasonCode: reasonCodeSchema,
  evidenceIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: 20,
    uniqueItems: true,
  }),
});

const candidateAssessmentSchema = closedObject({
  candidateId: stableIdSchema,
  disposition: dispositionSchema,
  reasons: Type.Array(candidateReasonSchema, { minItems: 1, maxItems: 20 }),
  evidenceIds: Type.Array(stableIdSchema, {
    maxItems: 100,
    uniqueItems: true,
  }),
  inferenceIds: Type.Array(stableIdSchema, {
    maxItems: 40,
    uniqueItems: true,
  }),
  claimIds: Type.Array(stableIdSchema, {
    maxItems: 40,
    uniqueItems: true,
  }),
  unknownIds: Type.Array(stableIdSchema, {
    maxItems: 40,
    uniqueItems: true,
  }),
  hardConstraintConflictIds: Type.Array(stableIdSchema, {
    maxItems: 20,
    uniqueItems: true,
  }),
});

const rankGroupSchema = closedObject({
  candidateIds: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: 20,
    uniqueItems: true,
  }),
});

const rankRelationSchema = closedObject({
  higherCandidateId: stableIdSchema,
  lowerCandidateId: stableIdSchema,
});

const incomparablePairSchema = closedObject({
  leftCandidateId: stableIdSchema,
  rightCandidateId: stableIdSchema,
});

export const fitAssessmentResponseV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    assessmentId: stableIdSchema,
    assessmentRequestId: stableIdSchema,
    correlationId: stableIdSchema,
    outcome: responsibleOutcomeSchema,
    suppliedCandidateIds: Type.Array(stableIdSchema, {
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
    }),
    candidateAssessments: Type.Array(candidateAssessmentSchema, {
      minItems: 1,
      maxItems: 20,
    }),
    evidence: Type.Array(evidenceObservationV1Schema, { maxItems: 2_000 }),
    inferences: Type.Array(inferenceV1Schema, { maxItems: 400 }),
    materialClaims: Type.Array(materialClaimV1Schema, { maxItems: 800 }),
    materialUnknowns: Type.Array(materialUnknownV1Schema, { maxItems: 800 }),
    hardConstraintConflicts: Type.Array(hardConstraintConflictV1Schema, {
      maxItems: 400,
    }),
    rankGroups: Type.Array(rankGroupSchema, { maxItems: 20 }),
    rankRelations: Type.Array(rankRelationSchema, { maxItems: 190 }),
    incomparablePairs: Type.Array(incomparablePairSchema, { maxItems: 190 }),
    evidenceCutoff: timestampSchema,
    producedAt: timestampSchema,
    completeness: Type.Union([
      Type.Literal('complete'),
      Type.Literal('partial-evidence'),
    ]),
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/fit-assessment-response/1.0.0',
    additionalProperties: false,
  },
);

const errorCodeSchema = Type.Union([
  Type.Literal('invalid-request'),
  Type.Literal('unsupported-contract-version'),
  Type.Literal('not-authorized'),
  Type.Literal('not-found'),
  Type.Literal('conflict'),
  Type.Literal('rate-limited'),
  Type.Literal('temporarily-unavailable'),
  Type.Literal('deadline-exceeded'),
  Type.Literal('internal-error'),
]);

const safeErrorMessageSchema = Type.Union([
  Type.Literal('The request is invalid.'),
  Type.Literal('The contract version is unsupported.'),
  Type.Literal('The operation is not authorized.'),
  Type.Literal('The requested resource was not found.'),
  Type.Literal('The request conflicts with the current state.'),
  Type.Literal('The request rate limit was exceeded.'),
  Type.Literal('The service is temporarily unavailable.'),
  Type.Literal('The operation deadline was exceeded.'),
  Type.Literal('The operation could not be completed.'),
]);

const errorIssueCodeSchema = Type.Union([
  Type.Literal('field.required'),
  Type.Literal('field.invalid'),
  Type.Literal('field.unsupported'),
  Type.Literal('reference.unresolved'),
  Type.Literal('reference.duplicate'),
  Type.Literal('invariant.conflict'),
]);

const errorIssuePathSchema = Type.Enum([
  'assessment',
  'assessment-id',
  'assessment-request-id',
  'candidate-assessments',
  'candidate-dossiers',
  'candidate-identity',
  'capability-family',
  'completeness',
  'contract',
  'contract-version',
  'correlation-id',
  'evidence',
  'evidence-cutoff',
  'hard-constraint-conflicts',
  'hard-constraints',
  'inferences',
  'limitations',
  'material-claims',
  'material-unknowns',
  'observations',
  'preferences',
  'produced-at',
  'ranking',
  'repository-facts',
  'repository-fingerprint',
  'request',
  'request-id',
  'retry',
  'success-conditions',
  'summary',
  'supplied-candidates',
  'transmission-approval',
  'withheld-categories',
] as const);

export const errorEnvelopeV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    code: errorCodeSchema,
    message: safeErrorMessageSchema,
    issues: Type.Array(
      closedObject({
        code: errorIssueCodeSchema,
        path: errorIssuePathSchema,
      }),
      { maxItems: 20 },
    ),
    retry: Type.Union([
      Type.Literal('never'),
      Type.Literal('after-correction'),
      Type.Literal('later'),
    ]),
    correlationId: Type.Optional(stableIdSchema),
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/error-envelope/1.0.0',
    additionalProperties: false,
  },
);

export type CapabilityRequestV1 = Static<typeof capabilityRequestV1Schema>;
export type RepositoryFingerprintV1 = Static<
  typeof repositoryFingerprintV1Schema
>;
export type CandidateDossierV1 = Static<typeof candidateDossierV1Schema>;
export type FitAssessmentRequestV1 = Static<
  typeof fitAssessmentRequestV1Schema
>;
export type FitAssessmentResponseV1 = Static<
  typeof fitAssessmentResponseV1Schema
>;
export type ErrorEnvelopeV1 = Static<typeof errorEnvelopeV1Schema>;
export type EvidenceObservationV1 = Static<typeof evidenceObservationV1Schema>;
export type InferenceV1 = Static<typeof inferenceV1Schema>;
export type MaterialClaimV1 = Static<typeof materialClaimV1Schema>;
export type MaterialUnknownV1 = Static<typeof materialUnknownV1Schema>;
export type HardConstraintConflictV1 = Static<
  typeof hardConstraintConflictV1Schema
>;
