import {
  parseCandidateDossierV1,
  parseCapabilityRequestV1,
  parseFitAssessmentRequestV1,
  parseFitAssessmentResponseV1,
  parseRepositoryFingerprintV1,
  validateFitAssessmentExchangeV1,
  type CandidateDossierV1,
  type CapabilityRequestV1,
  type ContractIssue,
  type EvidenceObservationV1,
  type FitAssessmentRequestV1,
  type FitAssessmentResponseV1,
  type RepositoryFingerprintV1,
} from '@gitblocks/contracts';

import type {
  Candidate,
  CandidateDisposition,
  CaseBundle,
  CorpusManifest,
  EvaluationCase,
  EvidenceObservation,
  GoldResult,
  ReferenceDiagnostic,
} from './contracts.ts';
import { loadCorpus } from './corpus.ts';

// This bridge proves offline representability only. It does not supply
// predictions, accept the proposed gold, or participate in quality scoring.
const CONTRACT_VERSION = '1.0.0' as const;
const MAXIMUM_CONFORMANCE_DIAGNOSTICS = 500;
const CONFORMANCE_APPROVAL_CATEGORIES = [
  'bounded-evidence',
  'candidate-dossiers',
  'capability-request',
  'repository-fingerprint',
] as const;
const SINGLE_VERIFIER_PREFERENCE =
  'The team wants one maintained verifier rather than three provider-specific packages.';

type RepositoryContextCategory = 'data' | 'identity' | 'operational';
type RepositoryContextKind =
  | 'credential-policy'
  | 'data-exclusion'
  | 'data-lifecycle'
  | 'data-residency'
  | 'data-shape'
  | 'data-store'
  | 'identity-context'
  | 'infrastructure';
type RepositoryContextFactV1 = Extract<
  RepositoryFingerprintV1['facts'][number],
  { readonly kind: RepositoryContextKind }
>;
type RepositoryContextTemplateV1 = RepositoryContextFactV1 extends infer Fact
  ? Fact extends RepositoryContextFactV1
    ? Omit<Fact, 'factId' | 'provenance'>
    : never
  : never;
type RepositoryContextMapping =
  'capability-preference' | readonly RepositoryContextTemplateV1[];

// These source strings are matching keys at the evaluation boundary only.
// Their product values are generic, structured facts with no text carrier.
// Any new or changed corpus sentence therefore requires an intentional map.
const REPOSITORY_CONTEXT_FACTS_BY_STATEMENT = {
  identity: {
    'Request context already contains actor, tenant, and correlation identifiers.':
      [
        {
          kind: 'identity-context',
          sourceContext: 'request',
          identifiers: ['actor', 'tenant', 'correlation'],
          normalization: 'none',
          credentials: 'not-stated',
        },
      ],
    'Billing mutations carry verified actor and tenant identifiers.': [
      {
        kind: 'identity-context',
        sourceContext: 'request',
        identifiers: ['actor', 'tenant'],
        normalization: 'none',
        credentials: 'not-stated',
      },
    ],
    'The verified session contains actor and tenant identifiers.': [
      {
        kind: 'identity-context',
        sourceContext: 'session',
        identifiers: ['actor', 'tenant'],
        normalization: 'none',
        credentials: 'not-stated',
      },
    ],
    'The verified access token supplies actor and organization identifiers.': [
      {
        kind: 'identity-context',
        sourceContext: 'access-token',
        identifiers: ['actor', 'organization'],
        normalization: 'none',
        credentials: 'not-stated',
      },
    ],
    'Every invoice job payload contains a tenant-scoped invoice identifier.': [
      {
        kind: 'identity-context',
        sourceContext: 'job-payload',
        identifiers: ['tenant', 'invoice'],
        normalization: 'none',
        credentials: 'not-stated',
      },
    ],
    'Job payloads carry tenant-scoped media identifiers but no credentials.': [
      {
        kind: 'identity-context',
        sourceContext: 'job-payload',
        identifiers: ['tenant', 'media'],
        normalization: 'none',
        credentials: 'excluded',
      },
    ],
    'The login route normalizes account and source identifiers, and API routes derive stable client and route keys before rate-limit evaluation.':
      [
        {
          kind: 'identity-context',
          sourceContext: 'route-key',
          identifiers: ['account', 'source', 'client', 'route'],
          normalization: 'normalized',
          credentials: 'not-stated',
        },
      ],
    'Authenticated API requests contain stable tenant and route identifiers, and the login route derives normalized account and source keys.':
      [
        {
          kind: 'identity-context',
          sourceContext: 'route-key',
          identifiers: ['tenant', 'route', 'account', 'source'],
          normalization: 'normalized',
          credentials: 'not-stated',
        },
      ],
    'Each webhook endpoint has a separately stored provider secret.': [
      {
        kind: 'credential-policy',
        owner: 'provider',
        scope: 'webhook-endpoint',
        isolation: 'per-provider-endpoint',
        rotation: 'not-stated',
      },
    ],
    'Each tenant owns independently rotatable endpoint secrets.': [
      {
        kind: 'credential-policy',
        owner: 'tenant',
        scope: 'webhook-endpoint',
        isolation: 'per-tenant',
        rotation: 'independently-rotatable',
      },
    ],
  },
  data: {
    'Audit payloads must exclude access tokens, cookies, and customer email addresses.':
      [
        {
          kind: 'data-exclusion',
          destination: 'audit-payload',
          categories: ['access-token', 'cookie', 'customer-email'],
        },
      ],
    'Billing and audit data must remain in the existing EU PostgreSQL database.':
      [
        {
          kind: 'data-residency',
          categories: ['billing-data', 'audit-data'],
          storage: 'existing-postgresql',
          region: 'eu',
        },
      ],
    'Every document row contains tenantId, ownerId, and classification.': [
      {
        kind: 'data-shape',
        shape: 'document-tenant-owner-classification',
      },
    ],
    'Projects can be shared with teams, teams can be nested, and documents belong to projects.':
      [
        {
          kind: 'data-shape',
          shape: 'team-project-document-relationships',
        },
      ],
    'Invoice state and job state must remain in the existing PostgreSQL region.':
      [
        {
          kind: 'data-residency',
          categories: ['invoice-state', 'job-state'],
          storage: 'existing-postgresql',
          region: 'existing-region',
        },
      ],
    'Media metadata is stored in PostgreSQL and persistent shared queue state may use the existing durable Redis cluster.':
      [
        {
          kind: 'data-store',
          category: 'media-and-queue-state',
          stores: ['existing-postgresql', 'existing-redis'],
          contents: 'repository-declared',
        },
      ],
    'Rate-limit counters are operational data and may reset on a planned process restart.':
      [
        {
          kind: 'data-lifecycle',
          category: 'rate-limit-counter',
          policy: 'reset-on-planned-restart-allowed',
        },
      ],
    'The existing Upstash Redis database stores only operational counters.': [
      {
        kind: 'data-store',
        category: 'rate-limit-counter',
        stores: ['upstash-redis'],
        contents: 'operational-counters-only',
      },
    ],
    'The server retains the raw body bytes until signature verification completes.':
      [
        {
          kind: 'data-lifecycle',
          category: 'raw-webhook-body',
          policy: 'retain-until-signature-verification',
        },
      ],
    'Webhook payloads may contain regulated customer data that must remain in eu-central-1.':
      [
        {
          kind: 'data-residency',
          categories: ['regulated-customer-data'],
          storage: 'unspecified',
          region: 'eu-central-1',
        },
      ],
  },
  operational: {
    'The container platform collects newline-delimited JSON from standard output into an existing regional archive.':
      [infrastructure('stdout-json-regional-archive', 'available')],
    'The managed database plan does not permit shared_preload_libraries or custom extensions.':
      [
        infrastructure('database-shared-preload-libraries', 'unavailable'),
        infrastructure('database-custom-extensions', 'unavailable'),
      ],
    'The edge platform cannot run sidecars, persistent policy services, or background workers.':
      [
        infrastructure('sidecar', 'unavailable'),
        infrastructure('persistent-policy-service', 'unavailable'),
        infrastructure('background-worker', 'unavailable'),
      ],
    'The platform team can operate one additional self-hosted service backed by PostgreSQL.':
      [
        {
          kind: 'infrastructure',
          resource: 'additional-self-hosted-service',
          availability: 'available',
          backingStore: 'postgresql',
          maximumAdditionalInstances: 1,
        },
      ],
    'The platform provides a long-running Node worker deployment but will not add Redis.':
      [
        infrastructure('long-running-node-worker', 'available'),
        infrastructure('persistent-redis', 'unavailable'),
      ],
    'The team already operates persistent Redis and long-running worker containers.':
      [
        infrastructure('persistent-redis', 'available'),
        infrastructure('worker-container', 'available'),
      ],
    'The customer-controlled installation has one API process and no external network dependency is allowed.':
      [infrastructure('external-network', 'unavailable')],
    'The edge runtime supports fetch but not long-lived TCP sockets, Node worker threads, or a durable in-process singleton.':
      [
        infrastructure('fetch', 'available'),
        infrastructure('long-lived-tcp', 'unavailable'),
        infrastructure('node-worker-thread', 'unavailable'),
        infrastructure('durable-process-singleton', 'unavailable'),
      ],
    'The team wants one maintained verifier rather than three provider-specific packages.':
      'capability-preference',
    'The team can operate a containerized service using the existing PostgreSQL and Redis clusters.':
      [
        infrastructure('container-service', 'available'),
        infrastructure('persistent-redis', 'available'),
      ],
  },
} as const satisfies Readonly<
  Record<
    RepositoryContextCategory,
    Readonly<Record<string, RepositoryContextMapping>>
  >
>;

function infrastructure(
  resource: Exclude<
    Extract<RepositoryContextTemplateV1, { readonly kind: 'infrastructure' }>,
    { readonly resource: 'additional-self-hosted-service' }
  >['resource'],
  availability: 'available' | 'unavailable',
): RepositoryContextTemplateV1 {
  return {
    kind: 'infrastructure',
    resource,
    availability,
    backingStore: 'none',
    maximumAdditionalInstances: null,
  };
}

type FieldDisposition =
  | 'mapped'
  | 'mapped-or-metadata'
  | 'metadata-only'
  | 'provenance-assertion'
  | 'rationale-never-inferred'
  | 'validation-only';

const CASE_FIELD_ACCOUNTING = {
  schemaVersion: 'validation-only',
  caseId: 'mapped',
  capabilityFamily: 'mapped',
  decisionObjective: 'metadata-only',
  comparisonPairId: 'metadata-only',
  userRequest: 'mapped',
  successConditions: 'mapped',
  repositoryProfile: 'mapped',
  hardConstraints: 'mapped',
  preferences: 'mapped',
  candidates: 'mapped',
  evidenceIds: 'validation-only',
  reasonCodes: 'mapped-or-metadata',
  unknowns: 'mapped',
  difficulty: 'metadata-only',
  failureModes: 'metadata-only',
  authoredAt: 'mapped',
  evidenceCutoff: 'mapped',
} as const satisfies Readonly<Record<keyof EvaluationCase, FieldDisposition>>;

const REPOSITORY_PROFILE_FIELD_ACCOUNTING = {
  language: 'mapped',
  runtime: 'mapped',
  framework: 'mapped',
  packageManager: 'mapped',
  database: 'mapped',
  orm: 'mapped',
  deployment: 'mapped',
  dependencies: 'mapped',
  hasRedis: 'mapped',
  tenantModel: 'mapped',
  identityFacts: 'mapped',
  dataFacts: 'mapped',
  operationalFacts: 'mapped',
} as const satisfies Readonly<
  Record<keyof EvaluationCase['repositoryProfile'], FieldDisposition>
>;

const EVIDENCE_SET_FIELD_ACCOUNTING = {
  schemaVersion: 'validation-only',
  caseId: 'validation-only',
  evidenceCutoff: 'validation-only',
  observations: 'mapped',
} as const satisfies Readonly<
  Record<keyof CaseBundle['evidence'], FieldDisposition>
>;

const EVIDENCE_OBSERVATION_FIELD_ACCOUNTING = {
  evidenceId: 'mapped',
  subjectType: 'validation-only',
  candidateId: 'mapped',
  sourceType: 'mapped',
  sourceUrl: 'mapped',
  sourceRevision: 'mapped',
  collectedAt: 'mapped',
  publishedAt: 'mapped',
  observation: 'mapped',
  freshnessScope: 'mapped',
  directness: 'mapped',
  limitation: 'mapped',
} as const satisfies Readonly<
  Record<keyof EvidenceObservation, FieldDisposition>
>;

const GOLD_FIELD_ACCOUNTING = {
  schemaVersion: 'validation-only',
  caseId: 'validation-only',
  outcome: 'mapped',
  allowedAlternativeOutcomes: 'validation-only',
  dispositions: 'mapped',
  rankGroups: 'mapped',
  rankRelations: 'mapped',
  incomparablePairs: 'mapped',
  hardConstraintConflicts: 'mapped',
  requiredUnknownIds: 'mapped',
  rationaleNotes: 'rationale-never-inferred',
  evidenceCutoff: 'validation-only',
  provenance: 'provenance-assertion',
} as const satisfies Readonly<Record<keyof GoldResult, FieldDisposition>>;

const GOLD_PROVENANCE_FIELD_ACCOUNTING = {
  status: 'provenance-assertion',
  authoringSession: 'metadata-only',
  independentReviewStatus: 'provenance-assertion',
  independentReviewer: 'provenance-assertion',
  reviewedAt: 'provenance-assertion',
  reviewReference: 'provenance-assertion',
} as const satisfies Readonly<
  Record<keyof GoldResult['provenance'], FieldDisposition>
>;

export interface ContractConformanceSummary {
  readonly caseCount: number;
  readonly candidateCount: number;
  readonly contractVersion: typeof CONTRACT_VERSION;
  readonly goldStatus: 'proposed';
  readonly independentReviewStatus: 'not-reviewed';
  readonly purpose: 'representability-only';
}

export type ContractConformanceResult =
  | {
      readonly ok: true;
      readonly summary: ContractConformanceSummary;
      readonly diagnostics: readonly [];
    }
  | {
      readonly ok: false;
      readonly diagnostics: readonly ReferenceDiagnostic[];
    };

export function validateCorpusContractConformance(
  repositoryRoot: string,
): ContractConformanceResult {
  const corpus = loadCorpus(repositoryRoot);
  if (!corpus.ok) {
    return {
      ok: false,
      diagnostics: corpus.diagnostics,
    };
  }
  return validateLoadedCorpusContractConformance(
    corpus.manifest,
    corpus.bundles,
  );
}

export function validateLoadedCorpusContractConformance(
  manifest: CorpusManifest,
  bundles: readonly CaseBundle[],
): ContractConformanceResult {
  const diagnostics: ReferenceDiagnostic[] = [];
  diagnostics.push(...validateProposedManifest(manifest));
  for (const bundle of bundles) {
    diagnostics.push(...validateBundleContractConformance(bundle));
  }
  const finalized = finalizeDiagnostics(diagnostics);
  if (finalized.length > 0) {
    return { ok: false, diagnostics: finalized };
  }
  return {
    ok: true,
    summary: {
      caseCount: bundles.length,
      candidateCount: bundles.reduce(
        (total, bundle) => total + bundle.caseDocument.candidates.length,
        0,
      ),
      contractVersion: CONTRACT_VERSION,
      goldStatus: 'proposed',
      independentReviewStatus: 'not-reviewed',
      purpose: 'representability-only',
    },
    diagnostics: [],
  };
}

export function validateBundleContractConformance(
  bundle: CaseBundle,
): readonly ReferenceDiagnostic[] {
  const caseId = bundle.caseDocument.caseId;
  const diagnostics = [
    ...validateEvaluationFieldAccounting(bundle),
    ...validateProposedGold(bundle.gold),
  ];
  if (diagnostics.length > 0) {
    return finalizeDiagnostics(diagnostics);
  }

  let mapped: MappedContractBundle;
  try {
    mapped = mapBundleForContractConformance(bundle);
  } catch {
    return [
      diagnostic(
        'contracts.mapping',
        'Evaluation fields could not be mapped into the product contracts.',
        caseId,
      ),
    ];
  }

  const capabilityRequest = parseCapabilityRequestV1(mapped.capabilityRequest);
  appendContractIssues(
    diagnostics,
    caseId,
    'capabilityRequest',
    capabilityRequest.issues,
  );

  const repositoryFingerprint = parseRepositoryFingerprintV1(
    mapped.repositoryFingerprint,
  );
  appendContractIssues(
    diagnostics,
    caseId,
    'repositoryFingerprint',
    repositoryFingerprint.issues,
  );

  for (const [index, dossier] of mapped.candidateDossiers.entries()) {
    const parsed = parseCandidateDossierV1(dossier);
    appendContractIssues(
      diagnostics,
      caseId,
      `candidateDossiers/${String(index)}`,
      parsed.issues,
    );
  }

  const assessmentRequest = parseFitAssessmentRequestV1(
    mapped.assessmentRequest,
  );
  appendContractIssues(
    diagnostics,
    caseId,
    'assessmentRequest',
    assessmentRequest.issues,
  );

  const assessmentResponse = parseFitAssessmentResponseV1(
    mapped.assessmentResponse,
  );
  appendContractIssues(
    diagnostics,
    caseId,
    'assessmentResponse',
    assessmentResponse.issues,
  );

  if (assessmentRequest.ok && assessmentResponse.ok) {
    const exchange = validateFitAssessmentExchangeV1(
      assessmentRequest.value,
      assessmentResponse.value,
    );
    appendContractIssues(
      diagnostics,
      caseId,
      'assessmentExchange',
      exchange.issues,
    );
  }

  return finalizeDiagnostics(diagnostics);
}

export function validateEvaluationFieldAccounting(
  bundle: CaseBundle,
): readonly ReferenceDiagnostic[] {
  const diagnostics: ReferenceDiagnostic[] = [];
  const base = bundle.caseDocument.caseId;
  accountPolicyObject(
    diagnostics,
    bundle.caseDocument,
    CASE_FIELD_ACCOUNTING,
    {},
    `${base}.case`,
  );
  if (diagnostics.length > 0) {
    return finalizeDiagnostics(diagnostics);
  }
  accountPolicyObject(
    diagnostics,
    bundle.caseDocument.repositoryProfile,
    REPOSITORY_PROFILE_FIELD_ACCOUNTING,
    {},
    `${base}.case.repositoryProfile`,
  );
  for (const field of [
    'language',
    'runtime',
    'framework',
    'packageManager',
    'database',
    'orm',
  ] as const) {
    accountObject(
      diagnostics,
      bundle.caseDocument.repositoryProfile[field],
      ['name', 'version'],
      [],
      `${base}.case.repositoryProfile.${field}`,
    );
  }
  for (const [
    index,
    dependency,
  ] of bundle.caseDocument.repositoryProfile.dependencies.entries()) {
    accountObject(
      diagnostics,
      dependency,
      ['name', 'version'],
      [],
      `${base}.case.repositoryProfile.dependencies/${String(index)}`,
    );
  }
  accountObject(
    diagnostics,
    bundle.caseDocument.repositoryProfile.deployment,
    ['topology', 'workerCapability', 'replicas', 'region'],
    [],
    `${base}.case.repositoryProfile.deployment`,
  );
  accountArrayObjects(
    diagnostics,
    bundle.caseDocument.hardConstraints,
    ['constraintId', 'reasonCode', 'statement'],
    [],
    `${base}.case.hardConstraints`,
  );
  accountArrayObjects(
    diagnostics,
    bundle.caseDocument.preferences,
    ['preferenceId', 'statement'],
    [],
    `${base}.case.preferences`,
  );
  accountArrayObjects(
    diagnostics,
    bundle.caseDocument.candidates,
    ['candidateId', 'project', 'package', 'repository'],
    [],
    `${base}.case.candidates`,
  );
  accountArrayObjects(
    diagnostics,
    bundle.caseDocument.reasonCodes,
    ['id', 'description'],
    [],
    `${base}.case.reasonCodes`,
  );
  const usedReasonCodes = new Set([
    ...bundle.caseDocument.hardConstraints.map(
      (constraint) => constraint.reasonCode,
    ),
    ...bundle.gold.dispositions.flatMap(
      (disposition) => disposition.reasonCodes,
    ),
    ...bundle.gold.hardConstraintConflicts.map(
      (conflict) => conflict.reasonCode,
    ),
  ]);
  for (const [index, reason] of bundle.caseDocument.reasonCodes.entries()) {
    if (!usedReasonCodes.has(reason.id)) {
      diagnostics.push(
        diagnostic(
          'contracts.field-accounting.unmapped',
          'A reason catalog entry is neither mapped to a product reason nor retained as hard-constraint metadata.',
          `${base}.case.reasonCodes/${String(index)}`,
        ),
      );
    }
  }
  accountArrayObjects(
    diagnostics,
    bundle.caseDocument.unknowns,
    ['id', 'description'],
    [],
    `${base}.case.unknowns`,
  );

  accountPolicyObject(
    diagnostics,
    bundle.evidence,
    EVIDENCE_SET_FIELD_ACCOUNTING,
    {},
    `${base}.evidence`,
  );
  if (diagnostics.length > 0) {
    return finalizeDiagnostics(diagnostics);
  }
  accountArrayPolicyObjects(
    diagnostics,
    bundle.evidence.observations,
    EVIDENCE_OBSERVATION_FIELD_ACCOUNTING,
    {},
    `${base}.evidence.observations`,
  );
  for (const [index, observation] of bundle.evidence.observations.entries()) {
    accountObject(
      diagnostics,
      observation.sourceRevision,
      ['kind', 'value', 'immutableUrl'],
      [],
      `${base}.evidence.observations/${String(index)}/sourceRevision`,
    );
  }

  accountPolicyObject(
    diagnostics,
    bundle.gold,
    GOLD_FIELD_ACCOUNTING,
    {},
    `${base}.gold`,
  );
  if (diagnostics.length > 0) {
    return finalizeDiagnostics(diagnostics);
  }
  accountArrayPolicyObjects(
    diagnostics,
    bundle.gold.dispositions,
    {
      candidateId: 'mapped',
      disposition: 'mapped',
      reasonCodes: 'mapped',
      evidenceIds: 'mapped',
    },
    { rationale: 'rationale-never-inferred' },
    `${base}.gold.dispositions`,
  );
  accountArrayObjects(
    diagnostics,
    bundle.gold.rankRelations,
    ['higherCandidateId', 'lowerCandidateId'],
    [],
    `${base}.gold.rankRelations`,
  );
  accountArrayObjects(
    diagnostics,
    bundle.gold.hardConstraintConflicts,
    ['candidateId', 'constraintId', 'reasonCode', 'evidenceIds'],
    [],
    `${base}.gold.hardConstraintConflicts`,
  );
  accountPolicyObject(
    diagnostics,
    bundle.gold.provenance,
    GOLD_PROVENANCE_FIELD_ACCOUNTING,
    {},
    `${base}.gold.provenance`,
  );

  if (bundle.gold.allowedAlternativeOutcomes.length > 0) {
    diagnostics.push(
      diagnostic(
        'contracts.field-accounting.unrepresentable',
        'Non-empty evaluation alternatives require an explicit product-contract decision.',
        `${base}.gold.allowedAlternativeOutcomes`,
      ),
    );
  }
  for (const [index, observation] of bundle.evidence.observations.entries()) {
    if (
      observation.subjectType !== 'candidate' ||
      observation.candidateId === null ||
      observation.sourceType === 'case-local-fact' ||
      observation.directness !== 'direct'
    ) {
      diagnostics.push(
        diagnostic(
          'contracts.field-accounting.unrepresentable',
          'Product candidate evidence must be direct evidence associated with one supplied candidate.',
          `${base}.evidence.observations/${String(index)}`,
        ),
      );
    }
  }
  return finalizeDiagnostics(diagnostics);
}

interface MappedContractBundle {
  readonly capabilityRequest: CapabilityRequestV1;
  readonly repositoryFingerprint: RepositoryFingerprintV1;
  readonly candidateDossiers: readonly CandidateDossierV1[];
  readonly assessmentRequest: FitAssessmentRequestV1;
  readonly assessmentResponse: FitAssessmentResponseV1;
}

export function mapBundleForContractConformance(
  bundle: CaseBundle,
): MappedContractBundle {
  const capabilityRequest = mapCapabilityRequest(bundle.caseDocument);
  const repositoryFingerprint = mapRepositoryFingerprint(bundle.caseDocument);
  const candidateDossiers = bundle.caseDocument.candidates.map((candidate) =>
    mapCandidateDossier(bundle, candidate),
  );
  const assessmentRequest: FitAssessmentRequestV1 = {
    contractVersion: CONTRACT_VERSION,
    assessmentRequestId: `${bundle.caseDocument.caseId}-assessment-request`,
    capabilityRequest,
    repositoryFingerprint,
    candidates: candidateDossiers,
    evidenceCutoff: conformanceCutoffTimestamp(bundle),
    requestedMaximumResults: bundle.caseDocument.candidates.length,
    correlationId: `${bundle.caseDocument.caseId}-correlation`,
  };
  const assessmentResponse = mapAssessmentResponse(bundle);
  return {
    capabilityRequest,
    repositoryFingerprint,
    candidateDossiers,
    assessmentRequest,
    assessmentResponse,
  };
}

function mapCapabilityRequest(
  caseDocument: EvaluationCase,
): CapabilityRequestV1 {
  return {
    contractVersion: CONTRACT_VERSION,
    requestId: `${caseDocument.caseId}-request`,
    capabilityFamily: caseDocument.capabilityFamily,
    summary: caseDocument.userRequest,
    successConditions: caseDocument.successConditions.map(
      (statement, index) => ({
        conditionId: `${caseDocument.caseId}-success-${String(index + 1)}`,
        statement,
      }),
    ),
    hardConstraints: caseDocument.hardConstraints.map((constraint) => ({
      constraintId: constraint.constraintId,
      reasonCode: constraint.reasonCode,
      statement: constraint.statement,
    })),
    preferences: [
      ...caseDocument.preferences.map((preference) => ({
        preferenceId: preference.preferenceId,
        statement: preference.statement,
      })),
      ...(caseDocument.repositoryProfile.operationalFacts.includes(
        SINGLE_VERIFIER_PREFERENCE,
      )
        ? [
            {
              preferenceId: `${caseDocument.caseId}-integration-shape`,
              statement: SINGLE_VERIFIER_PREFERENCE,
            },
          ]
        : []),
    ],
    transmissionApproval: {
      // This is synthetic fixture metadata for offline representability. It
      // never authorizes a real transmission or leaves the local harness.
      approvalId: `${caseDocument.caseId}-conformance-approval`,
      approvedAt: authoredTimestamp(caseDocument.authoredAt),
      approvedBy: 'request-originator',
      scope: 'minimized-repository-facts',
      approvedCategories: [...CONFORMANCE_APPROVAL_CATEGORIES],
    },
  };
}

function mapRepositoryFingerprint(
  caseDocument: EvaluationCase,
): RepositoryFingerprintV1 {
  const { repositoryProfile } = caseDocument;
  const components = (
    [
      ['language', repositoryProfile.language],
      ['runtime', repositoryProfile.runtime],
      ['framework', repositoryProfile.framework],
      ['package-manager', repositoryProfile.packageManager],
      ['database', repositoryProfile.database],
      ['orm', repositoryProfile.orm],
    ] as const
  ).map(([component, value]) => ({
    kind: 'component' as const,
    factId: `${caseDocument.caseId}-${component}`,
    component,
    name: value.name,
    version: value.version,
    provenance: repositoryFactProvenance(caseDocument.authoredAt),
  }));
  const dependencies = repositoryProfile.dependencies.map(
    (dependency, index) => ({
      kind: 'component' as const,
      factId: `${caseDocument.caseId}-dependency-${String(index + 1)}`,
      component: 'dependency' as const,
      name: dependency.name,
      version: dependency.version,
      provenance: repositoryFactProvenance(caseDocument.authoredAt),
    }),
  );
  const contextFacts = [
    ...repositoryProfile.identityFacts.flatMap((statement, index) =>
      repositoryContextFact(
        caseDocument.caseId,
        'identity',
        statement,
        index,
        caseDocument.authoredAt,
      ),
    ),
    ...repositoryProfile.dataFacts.flatMap((statement, index) =>
      repositoryContextFact(
        caseDocument.caseId,
        'data',
        statement,
        index,
        caseDocument.authoredAt,
      ),
    ),
    ...repositoryProfile.operationalFacts.flatMap((statement, index) =>
      repositoryContextFact(
        caseDocument.caseId,
        'operational',
        statement,
        index,
        caseDocument.authoredAt,
      ),
    ),
  ];
  return {
    contractVersion: CONTRACT_VERSION,
    fingerprintId: `${caseDocument.caseId}-fingerprint`,
    facts: [
      ...components,
      ...dependencies,
      {
        kind: 'deployment',
        factId: `${caseDocument.caseId}-deployment`,
        topology: repositoryProfile.deployment.topology,
        workerCapability: repositoryProfile.deployment.workerCapability,
        replicas: repositoryProfile.deployment.replicas,
        region: repositoryProfile.deployment.region,
        provenance: repositoryFactProvenance(caseDocument.authoredAt),
      },
      {
        kind: 'capability',
        factId: `${caseDocument.caseId}-redis`,
        capabilityCode: 'redis',
        state: repositoryProfile.hasRedis ? 'supported' : 'unsupported',
        provenance: repositoryFactProvenance(caseDocument.authoredAt),
      },
      {
        kind: 'tenant',
        factId: `${caseDocument.caseId}-tenant`,
        tenantModel: repositoryProfile.tenantModel,
        provenance: repositoryFactProvenance(caseDocument.authoredAt),
      },
      ...contextFacts,
    ],
    withheldCategories: [
      'raw-source',
      'configuration-values',
      'environment',
      'credentials',
      'logs',
      'database-content',
      'untracked-files',
      'command-output',
    ],
  };
}

function repositoryContextFact(
  caseId: string,
  category: RepositoryContextCategory,
  statement: string,
  index: number,
  authoredAt: string,
): readonly RepositoryContextFactV1[] {
  const mappings: Readonly<Record<string, RepositoryContextMapping>> =
    REPOSITORY_CONTEXT_FACTS_BY_STATEMENT[category];
  const mapping = mappings[statement];
  if (mapping === undefined) {
    throw new Error('Repository context fact has no finite product mapping.');
  }
  if (mapping === 'capability-preference') {
    if (statement !== SINGLE_VERIFIER_PREFERENCE) {
      throw new Error('Repository preference mapping is inconsistent.');
    }
    return [];
  }
  return mapping.map((template, templateIndex) => ({
    ...template,
    factId: [
      caseId,
      category,
      String(index + 1),
      String(templateIndex + 1),
    ].join('-'),
    provenance: repositoryFactProvenance(authoredAt),
  }));
}

function repositoryFactProvenance(authoredAt: string) {
  return {
    origin: 'supplied-declaration' as const,
    directness: 'declared' as const,
    confidence: 'unknown' as const,
    observedAt: authoredTimestamp(authoredAt),
  };
}

function mapCandidateDossier(
  bundle: CaseBundle,
  candidate: Candidate,
): CandidateDossierV1 {
  const observations = bundle.evidence.observations
    .filter((observation) => observation.candidateId === candidate.candidateId)
    .map((observation) => mapEvidenceObservation(observation));
  const repository = splitRepository(candidate.repository);
  return {
    contractVersion: CONTRACT_VERSION,
    identity: {
      candidateId: candidate.candidateId,
      displayName: candidate.project,
      repository: {
        host: 'github',
        owner: repository.owner,
        name: repository.name,
      },
      package:
        candidate.package === null
          ? null
          : {
              registry: 'npm',
              name: candidate.package,
            },
    },
    capabilityFamily: bundle.caseDocument.capabilityFamily,
    // The evaluation candidate identity has no version or release scope.
    versionScope: null,
    observations,
    limitations: observations.flatMap((observation) =>
      observation.limitation === null
        ? []
        : [
            {
              limitationId: `${observation.evidenceId}-limitation`,
              candidateId: candidate.candidateId,
              statement: observation.limitation,
              evidenceIds: [observation.evidenceId],
            },
          ],
    ),
    unknowns: [],
  };
}

function mapEvidenceObservation(
  observation: EvidenceObservation,
): EvidenceObservationV1 {
  if (
    observation.candidateId === null ||
    observation.sourceType === 'case-local-fact' ||
    observation.directness !== 'direct'
  ) {
    throw new Error('Candidate dossiers require direct candidate evidence.');
  }
  const dimension = evidenceDimension(observation.sourceType);
  return {
    kind: 'evidence',
    evidenceId: observation.evidenceId,
    candidateId: observation.candidateId,
    topic: dimension,
    dimension,
    observation: observation.observation,
    source: {
      sourceType: productEvidenceSourceType(observation.sourceType),
      sourceUrl: observation.sourceUrl,
      revision: {
        kind: productEvidenceRevisionKind(observation.sourceRevision.kind),
        value: observation.sourceRevision.value,
        immutableUrl: observation.sourceRevision.immutableUrl,
      },
      collectedAt: observation.collectedAt,
      publishedAt: observation.publishedAt,
    },
    freshness: {
      // A freshness scope is not itself evidence that the source is current.
      status: 'unknown',
      asOf: observation.collectedAt,
      scope: observation.freshnessScope,
    },
    directness: 'direct',
    limitation: observation.limitation,
  };
}

function productEvidenceRevisionKind(
  kind: EvidenceObservation['sourceRevision']['kind'],
): EvidenceObservationV1['source']['revision']['kind'] {
  if (kind === 'case-version') {
    throw new Error('Case versions are not product evidence revisions.');
  }
  return kind;
}

function productEvidenceSourceType(
  sourceType: EvidenceObservation['sourceType'],
): EvidenceObservationV1['source']['sourceType'] {
  if (sourceType === 'case-local-fact') {
    throw new Error('Case-local evidence is not a candidate dossier source.');
  }
  return sourceType;
}

function evidenceDimension(
  sourceType: EvidenceObservation['sourceType'],
): EvidenceObservationV1['dimension'] {
  // Phase 2 did not assign product dimensions. Derive only from its structured
  // source type and never interpret the free-text observation.
  switch (sourceType) {
    case 'license':
      return 'license';
    case 'security-advisory':
      return 'security';
    case 'official-release':
    case 'package-registry':
      return 'version-release';
    case 'official-repository':
      return 'repository-package';
    case 'case-local-fact':
      return 'integration';
    case 'official-documentation':
      return 'integration';
  }
}

function mapAssessmentResponse(bundle: CaseBundle): FitAssessmentResponseV1 {
  const { caseDocument, evidence, gold } = bundle;
  const reasonDescriptions = new Map(
    caseDocument.reasonCodes.map((item) => [item.id, item.description]),
  );
  const dispositions = new Map(
    gold.dispositions.map((item) => [item.candidateId, item]),
  );
  const hardConflicts = gold.hardConstraintConflicts.map((conflict) => ({
    conflictId: hardConflictId(conflict.candidateId, conflict.constraintId),
    candidateId: conflict.candidateId,
    constraintId: conflict.constraintId,
    reasonCode: conflict.reasonCode,
    evidenceIds: [...conflict.evidenceIds],
  }));
  const materialClaims = gold.dispositions.map((disposition) => ({
    claimId: fitClaimId(disposition.candidateId),
    candidateId: disposition.candidateId,
    topic: `${caseDocument.capabilityFamily}-fit`,
    direction: dispositionDirection(disposition.disposition),
    statement: `The proposed evaluation disposition is ${disposition.disposition}.`,
    evidenceIds: [...disposition.evidenceIds],
    inferenceIds: [],
  }));
  const candidateAssessments = caseDocument.candidates.map((candidate) => {
    const disposition = requireMapValue(dispositions, candidate.candidateId);
    return {
      candidateId: candidate.candidateId,
      disposition: disposition.disposition,
      reasons: disposition.reasonCodes.map((reasonCode) => ({
        candidateId: candidate.candidateId,
        reasonCode,
        statement: requireMapValue(reasonDescriptions, reasonCode),
        evidenceIds: [...disposition.evidenceIds],
        inferenceIds: [],
        unknownIds: [],
      })),
      evidenceIds: [...disposition.evidenceIds],
      inferenceIds: [],
      claimIds: [fitClaimId(candidate.candidateId)],
      unknownIds: [],
      hardConstraintConflictIds: hardConflicts
        .filter((conflict) => conflict.candidateId === candidate.candidateId)
        .map((conflict) => conflict.conflictId),
    };
  });
  const unknownDescriptions = new Map(
    caseDocument.unknowns.map((unknown) => [unknown.id, unknown.description]),
  );
  return {
    contractVersion: CONTRACT_VERSION,
    assessmentId: `${caseDocument.caseId}-assessment`,
    assessmentRequestId: `${caseDocument.caseId}-assessment-request`,
    correlationId: `${caseDocument.caseId}-correlation`,
    outcome: gold.outcome,
    suppliedCandidateIds: caseDocument.candidates.map(
      (candidate) => candidate.candidateId,
    ),
    candidateAssessments,
    evidence: evidence.observations.map((observation) =>
      mapEvidenceObservation(observation),
    ),
    inferences: [],
    materialClaims,
    materialUnknowns: gold.requiredUnknownIds.map((unknownId) => ({
      scope: 'assessment',
      unknownId,
      topic: unknownId,
      statement: requireMapValue(unknownDescriptions, unknownId),
      evidenceIds: [],
    })),
    hardConstraintConflicts: hardConflicts,
    rankGroups: gold.rankGroups.map((candidateIds) => ({
      candidateIds,
    })),
    rankRelations: gold.rankRelations.map((relation) => ({
      higherCandidateId: relation.higherCandidateId,
      lowerCandidateId: relation.lowerCandidateId,
    })),
    incomparablePairs: gold.incomparablePairs.map((pair) => {
      const [leftCandidateId, rightCandidateId] = pair;
      if (leftCandidateId === undefined || rightCandidateId === undefined) {
        throw new Error('Incomparable pairs require exactly two candidates.');
      }
      return { leftCandidateId, rightCandidateId };
    }),
    evidenceCutoff: conformanceCutoffTimestamp(bundle),
    producedAt: latestCollectedAt(evidence.observations),
    completeness: 'partial-evidence',
  };
}

function dispositionDirection(
  disposition: CandidateDisposition['disposition'],
): 'favorable' | 'neutral' | 'unfavorable' {
  switch (disposition) {
    case 'recommended':
    case 'viable':
      return 'favorable';
    case 'insufficient-evidence':
      return 'neutral';
    case 'rejected':
      return 'unfavorable';
  }
}

function fitClaimId(candidateId: string): string {
  return `${candidateId}-fit-claim`;
}

function hardConflictId(candidateId: string, constraintId: string): string {
  return `${candidateId}-${constraintId}-conflict`;
}

function splitRepository(repository: string): {
  readonly owner: string;
  readonly name: string;
} {
  const [owner, name, extra] = repository.split('/');
  if (owner === undefined || name === undefined || extra !== undefined) {
    throw new Error('Candidate repositories must use owner/name form.');
  }
  return { owner, name };
}

function requireMapValue<Key, Value>(
  values: ReadonlyMap<Key, Value>,
  key: Key,
): Value {
  const value = values.get(key);
  if (value === undefined) {
    throw new Error('Evaluation reference did not resolve during mapping.');
  }
  return value;
}

function authoredTimestamp(date: string): string {
  return `${date}T00:00:00Z`;
}

function latestCollectedAt(
  observations: readonly EvidenceObservation[],
): string {
  const timestamps = observations
    .map((observation) => observation.collectedAt)
    .sort(compareText);
  const last = timestamps.at(-1);
  if (last === undefined) {
    throw new Error('A conformance case requires bounded evidence.');
  }
  return last;
}

function conformanceCutoffTimestamp(bundle: CaseBundle): string {
  const timestamp = latestCollectedAt(bundle.evidence.observations);
  if (!timestamp.startsWith(`${bundle.caseDocument.evidenceCutoff}T`)) {
    throw new Error('Evidence collection must fall on the declared cutoff.');
  }
  return timestamp;
}

function validateProposedManifest(
  manifest: CorpusManifest,
): readonly ReferenceDiagnostic[] {
  if (
    manifest.status === 'development-proposed' &&
    hasProposedUnreviewedProvenance(manifest.provenance, 'goldStatus')
  ) {
    return [];
  }
  return [
    diagnostic(
      'contracts.provenance',
      'Contract conformance is restricted to proposed, independently unreviewed gold.',
      'manifest.provenance',
    ),
  ];
}

function validateProposedGold(
  gold: GoldResult,
): readonly ReferenceDiagnostic[] {
  if (hasProposedUnreviewedProvenance(gold.provenance, 'status')) {
    return [];
  }
  return [
    diagnostic(
      'contracts.provenance',
      'Fit-response representability is restricted to proposed, independently unreviewed gold.',
      `${gold.caseId}.gold.provenance`,
    ),
  ];
}

function hasProposedUnreviewedProvenance(
  value: unknown,
  statusKey: 'goldStatus' | 'status',
): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const provenance = value as Readonly<Record<string, unknown>>;
  return (
    provenance[statusKey] === 'proposed' &&
    provenance['independentReviewStatus'] === 'not-reviewed' &&
    provenance['independentReviewer'] === null &&
    provenance['reviewedAt'] === null &&
    provenance['reviewReference'] === null
  );
}

function appendContractIssues(
  diagnostics: ReferenceDiagnostic[],
  caseId: string,
  contractPath: string,
  issues: readonly ContractIssue[],
): void {
  for (const issue of issues) {
    diagnostics.push(
      diagnostic(
        `contracts.${issue.code}`,
        'Mapped evaluation data did not conform to the product contract.',
        `${caseId}.${contractPath}${issue.path}`,
      ),
    );
  }
}

function accountArrayObjects(
  diagnostics: ReferenceDiagnostic[],
  values: readonly unknown[],
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  path: string,
): void {
  for (const [index, value] of values.entries()) {
    accountObject(
      diagnostics,
      value,
      requiredKeys,
      optionalKeys,
      `${path}/${String(index)}`,
    );
  }
}

function accountArrayPolicyObjects(
  diagnostics: ReferenceDiagnostic[],
  values: readonly unknown[],
  requiredPolicy: Readonly<Record<string, FieldDisposition>>,
  optionalPolicy: Readonly<Record<string, FieldDisposition>>,
  path: string,
): void {
  for (const [index, value] of values.entries()) {
    accountPolicyObject(
      diagnostics,
      value,
      requiredPolicy,
      optionalPolicy,
      `${path}/${String(index)}`,
    );
  }
}

function accountPolicyObject(
  diagnostics: ReferenceDiagnostic[],
  value: unknown,
  requiredPolicy: Readonly<Record<string, FieldDisposition>>,
  optionalPolicy: Readonly<Record<string, FieldDisposition>>,
  path: string,
): void {
  accountObject(
    diagnostics,
    value,
    Object.keys(requiredPolicy),
    Object.keys(optionalPolicy),
    path,
  );
}

function accountObject(
  diagnostics: ReferenceDiagnostic[],
  value: unknown,
  requiredKeys: readonly string[],
  optionalKeys: readonly string[],
  path: string,
): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    diagnostics.push(
      diagnostic(
        'contracts.field-accounting.shape',
        'Evaluation field accounting requires an object.',
        path,
      ),
    );
    return;
  }
  const present = new Set(Object.keys(value));
  const accounted = new Set([...requiredKeys, ...optionalKeys]);
  for (const key of requiredKeys) {
    if (!present.has(key)) {
      diagnostics.push(
        diagnostic(
          'contracts.field-accounting.missing',
          'A decision-relevant evaluation field is missing from the mapping input.',
          `${path}/${key}`,
        ),
      );
    }
  }
  for (const key of present) {
    if (!accounted.has(key)) {
      diagnostics.push(
        diagnostic(
          'contracts.field-accounting.unmapped',
          'An evaluation field has no explicit product-conformance disposition.',
          `${path}/${key}`,
        ),
      );
    }
  }
}

function diagnostic(
  code: string,
  message: string,
  path: string,
): ReferenceDiagnostic {
  return { code, message, path };
}

function finalizeDiagnostics(
  diagnostics: readonly ReferenceDiagnostic[],
): readonly ReferenceDiagnostic[] {
  const unique = new Map<string, ReferenceDiagnostic>();
  for (const item of diagnostics) {
    unique.set(`${item.path}\u0000${item.code}`, item);
  }
  return [...unique.values()]
    .sort((left, right) =>
      compareText(
        `${left.path}\u0000${left.code}`,
        `${right.path}\u0000${right.code}`,
      ),
    )
    .slice(0, MAXIMUM_CONFORMANCE_DIAGNOSTICS);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
