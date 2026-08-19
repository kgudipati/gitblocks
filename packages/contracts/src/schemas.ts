import { Type, type Static } from 'typebox';

import {
  capabilityFamilySchema,
  closedObject,
  componentNameSchema,
  componentVersionSchema,
  contractVersionSchema,
  dispositionSchema,
  exactPackageVersionSchema,
  exactRevisionSchema,
  gitCommitShaSchema,
  httpsUrlSchema,
  packageNameSchema,
  reasonCodeSchema,
  regionSchema,
  repositoryNameSchema,
  responsibleOutcomeSchema,
  semanticVersionSchema,
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
    Type.Literal('scanner-analysis'),
    Type.Literal('supplied-declaration'),
  ]),
  epistemicStatus: Type.Union([
    Type.Literal('direct'),
    Type.Literal('declared'),
    Type.Literal('derived'),
  ]),
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

export const transmissionApprovalV1Schema = closedObject({
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
    {
      minItems: 1,
      maxItems: 4,
      uniqueItems: true,
      description:
        'After explicit transmission approval, use all four approved categories exactly as shown. Example: ["bounded-evidence","candidate-dossiers","capability-request","repository-fingerprint"].',
    },
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
  transmissionApproval: transmissionApprovalV1Schema,
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

const codedFactValueSchema = Type.Union([
  closedObject({
    kind: Type.Literal('presence'),
    state: Type.Union([
      Type.Literal('present'),
      Type.Literal('absent'),
      Type.Literal('unknown'),
    ]),
  }),
  closedObject({
    kind: Type.Literal('classification'),
    code: stableIdSchema,
  }),
  closedObject({
    kind: Type.Literal('code-set'),
    codes: Type.Array(stableIdSchema, {
      minItems: 1,
      maxItems: 20,
      uniqueItems: true,
    }),
  }),
  closedObject({
    kind: Type.Literal('integer'),
    value: Type.Integer({ minimum: 0, maximum: 10_000 }),
  }),
]);

const codedFactSchema = closedObject({
  kind: Type.Literal('coded'),
  factId: stableIdSchema,
  category: Type.Union([
    Type.Literal('repository-capability'),
    Type.Literal('repository-structure'),
    Type.Literal('identity'),
    Type.Literal('data-policy'),
    Type.Literal('operations'),
  ]),
  code: stableIdSchema,
  subjectCode: Type.Union([stableIdSchema, Type.Null()]),
  value: codedFactValueSchema,
  provenance: repositoryFactProvenanceSchema,
});

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
  factVocabularyVersion: semanticVersionSchema,
  fingerprintId: stableIdSchema,
  facts: Type.Array(
    Type.Union([componentFactSchema, deploymentFactSchema, codedFactSchema]),
    { maxItems: 200 },
  ),
  withheldCategories: Type.Array(withheldCategorySchema, {
    maxItems: 12,
  }),
} as const;

export const repositoryFingerprintV1ValueSchema = closedObject(
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

const repositoryOrDocumentationSourceTypeSchema = Type.Union([
  Type.Literal('official-repository'),
  Type.Literal('official-documentation'),
  Type.Literal('license'),
]);

const evidenceSourceSchema = Type.Union([
  closedObject({
    kind: Type.Literal('git-commit'),
    sourceType: repositoryOrDocumentationSourceTypeSchema,
    sourceUrl: httpsUrlSchema,
    commitSha: gitCommitShaSchema,
    immutableUrl: httpsUrlSchema,
    publishedAt: timestampSchema,
    collectedAt: timestampSchema,
  }),
  closedObject({
    kind: Type.Literal('tag'),
    sourceType: repositoryOrDocumentationSourceTypeSchema,
    sourceUrl: httpsUrlSchema,
    tag: exactRevisionSchema,
    immutableUrl: httpsUrlSchema,
    publishedAt: timestampSchema,
    collectedAt: timestampSchema,
  }),
  closedObject({
    kind: Type.Literal('release'),
    sourceType: Type.Literal('official-release'),
    sourceUrl: httpsUrlSchema,
    release: exactRevisionSchema,
    immutableUrl: httpsUrlSchema,
    publishedAt: timestampSchema,
    collectedAt: timestampSchema,
  }),
  closedObject({
    kind: Type.Literal('package-version'),
    sourceType: Type.Literal('package-registry'),
    sourceUrl: httpsUrlSchema,
    packageVersion: exactPackageVersionSchema,
    immutableUrl: httpsUrlSchema,
    publishedAt: timestampSchema,
    collectedAt: timestampSchema,
  }),
  closedObject({
    kind: Type.Literal('security-advisory'),
    sourceType: Type.Literal('security-advisory'),
    sourceUrl: httpsUrlSchema,
    advisoryId: stableIdSchema,
    immutableUrl: httpsUrlSchema,
    publishedAt: timestampSchema,
    collectedAt: timestampSchema,
  }),
  closedObject({
    kind: Type.Literal('mutable-documentation'),
    sourceType: Type.Literal('official-documentation'),
    sourceUrl: httpsUrlSchema,
    limitationCode: Type.Literal('source-is-mutable'),
    collectedAt: timestampSchema,
  }),
  closedObject({
    kind: Type.Literal('approved-validation'),
    sourceType: Type.Literal('approved-validation'),
    validationReferenceId: stableIdSchema,
    scope: stableIdSchema,
    validatedAt: timestampSchema,
  }),
]);

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
  limitationCode: stableIdSchema,
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

export const assessmentUnknownV1Schema = closedObject({
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
  assessmentUnknownV1Schema,
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
  limitationIds: Type.Array(stableIdSchema, {
    maxItems: 40,
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

const fitAssessmentResponseV1Properties = {
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
  candidateLimitations: Type.Array(candidateLimitationSchema, {
    maxItems: 800,
  }),
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
  assessmentProcessing: Type.Union([
    closedObject({
      state: Type.Literal('complete'),
      incompleteReasonCodes: Type.Array(stableIdSchema, {
        maxItems: 0,
        uniqueItems: true,
      }),
    }),
    closedObject({
      state: Type.Literal('partial-evidence'),
      incompleteReasonCodes: Type.Array(stableIdSchema, {
        minItems: 1,
        maxItems: 20,
        uniqueItems: true,
      }),
    }),
  ]),
};

export const fitAssessmentResponseV1ValueSchema = closedObject(
  fitAssessmentResponseV1Properties,
);

export const fitAssessmentResponseV1Schema = Type.Object(
  fitAssessmentResponseV1Properties,
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
  'assessment-processing',
  'assessment-request-id',
  'candidate-assessments',
  'candidate-dossiers',
  'candidate-identity',
  'candidate-limitations',
  'capability-family',
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

const hexSha256Schema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: '^[0-9a-f]{64}$',
});

const sha1ObjectIdSchema = Type.String({
  minLength: 40,
  maxLength: 40,
  pattern: '^[0-9a-f]{40}$',
});

const githubRepositoryIdSchema = Type.String({
  minLength: 1,
  maxLength: 20,
  pattern: '^(?:0|[1-9][0-9]{0,19})$',
});

const artifactPathSchema = Type.String({
  minLength: 1,
  maxLength: 512,
});

const repositoryArtifactFirstMaterializationSchema = closedObject({
  catalogOwner: repositoryNameSchema,
  catalogRepository: repositoryNameSchema,
  providerOwner: repositoryNameSchema,
  providerRepository: repositoryNameSchema,
  collectedAt: timestampSchema,
});

const repositoryArtifactV1Properties = {
  contractVersion: contractVersionSchema,
  artifactId: stableIdSchema,
  candidateId: stableIdSchema,
  provider: Type.Literal('github'),
  providerRepositoryId: githubRepositoryIdSchema,
  gitObjectAlgorithm: Type.Literal('sha1'),
  commitObjectId: sha1ObjectIdSchema,
  path: artifactPathSchema,
  blobObjectId: sha1ObjectIdSchema,
  blobApiUrl: httpsUrlSchema,
  displayUrl: Type.Union([httpsUrlSchema, Type.Null()]),
  mediaType: Type.Literal('text/plain'),
  encoding: Type.Literal('utf-8'),
  contentSha256: hexSha256Schema,
  byteCount: Type.Integer({ minimum: 0, maximum: 256 * 1_024 }),
  lineCount: Type.Integer({ minimum: 1, maximum: 10_000 }),
  content: Type.String({ maxLength: 256 * 1_024 }),
  firstMaterialization: repositoryArtifactFirstMaterializationSchema,
  identityDigest: hexSha256Schema,
  recordDigest: hexSha256Schema,
} as const;

export const repositoryArtifactV1Schema = Type.Object(
  repositoryArtifactV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/repository-artifact/1.0.0',
    additionalProperties: false,
  },
);

const repositoryArtifactChunkV1Properties = {
  contractVersion: contractVersionSchema,
  chunkId: stableIdSchema,
  artifactId: stableIdSchema,
  candidateId: stableIdSchema,
  chunkerVersion: Type.Literal('exact-lines-v1'),
  ordinal: Type.Integer({ minimum: 0, maximum: 63 }),
  startByte: Type.Integer({ minimum: 0, maximum: 256 * 1_024 }),
  endByteExclusive: Type.Integer({ minimum: 0, maximum: 256 * 1_024 }),
  byteCount: Type.Integer({ minimum: 0, maximum: 16 * 1_024 }),
  startLine: Type.Integer({ minimum: 1, maximum: 10_000 }),
  endLine: Type.Integer({ minimum: 1, maximum: 10_000 }),
  contentSha256: hexSha256Schema,
  content: Type.String({ maxLength: 16 * 1_024 }),
  identityDigest: hexSha256Schema,
  recordDigest: hexSha256Schema,
} as const;

export const repositoryArtifactChunkV1Schema = Type.Object(
  repositoryArtifactChunkV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/repository-artifact-chunk/1.0.0',
    additionalProperties: false,
  },
);

const repositoryArtifactKindSchema = Type.Union([
  Type.Literal('readme'),
  Type.Literal('contributing'),
  Type.Literal('security-policy'),
  Type.Literal('changelog'),
  Type.Literal('documentation'),
  Type.Literal('license'),
]);

const repositoryArtifactSetEntryBase = {
  selectionId: stableIdSchema,
  ordinal: Type.Integer({ minimum: 0, maximum: 3 }),
  selector: Type.Union([Type.Literal('root-readme'), Type.Literal('path')]),
  artifactKind: repositoryArtifactKindSchema,
  requirement: Type.Union([Type.Literal('required'), Type.Literal('optional')]),
  rationale: Type.Union([shortTextSchema, Type.Null()]),
  requestedPath: Type.Union([artifactPathSchema, Type.Null()]),
} as const;

const repositoryArtifactSetEntrySchema = Type.Union([
  closedObject({
    ...repositoryArtifactSetEntryBase,
    resolvedPath: artifactPathSchema,
    outcome: Type.Literal('present'),
    artifactId: stableIdSchema,
  }),
  closedObject({
    ...repositoryArtifactSetEntryBase,
    requirement: Type.Literal('optional'),
    resolvedPath: Type.Null(),
    outcome: Type.Literal('not-found'),
    artifactId: Type.Null(),
  }),
]);

const repositoryArtifactSetV1Properties = {
  contractVersion: contractVersionSchema,
  artifactSetId: stableIdSchema,
  candidateId: stableIdSchema,
  catalogVersion: Type.Literal('public-v1'),
  catalogDigest: hexSha256Schema,
  artifactManifestVersion: Type.Literal('public-artifacts-v1'),
  artifactManifestDigest: hexSha256Schema,
  collectorVersion: Type.Literal('repository-artifacts-v1'),
  chunkerVersion: Type.Literal('exact-lines-v1'),
  provider: Type.Literal('github'),
  providerRepositoryId: githubRepositoryIdSchema,
  providerCanonicalOwner: repositoryNameSchema,
  providerCanonicalRepository: repositoryNameSchema,
  gitObjectAlgorithm: Type.Literal('sha1'),
  commitObjectId: sha1ObjectIdSchema,
  entries: Type.Array(repositoryArtifactSetEntrySchema, {
    minItems: 1,
    maxItems: 4,
  }),
  publishedAt: timestampSchema,
  identityDigest: hexSha256Schema,
  recordDigest: hexSha256Schema,
} as const;

export const repositoryArtifactSetV1Schema = Type.Object(
  repositoryArtifactSetV1Properties,
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/repository-artifact-set/1.0.0',
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
export type RepositoryArtifactV1 = Static<typeof repositoryArtifactV1Schema>;
export type RepositoryArtifactChunkV1 = Static<
  typeof repositoryArtifactChunkV1Schema
>;
export type RepositoryArtifactSetEntryV1 = Static<
  typeof repositoryArtifactSetEntrySchema
>;
export type RepositoryArtifactSetV1 = Static<
  typeof repositoryArtifactSetV1Schema
>;
