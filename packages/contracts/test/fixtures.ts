import type {
  CandidateDossierV1,
  CapabilityRequestV1,
  ErrorEnvelopeV1,
  EvidenceObservationV1,
  FitAssessmentRequestV1,
  FitAssessmentResponseV1,
  RepositoryFingerprintV1,
} from '../src/index.ts';

export const EVIDENCE_CUTOFF = '2026-07-28T21:00:00Z';
export const PRODUCED_AT = '2026-07-28T21:30:00Z';

export type MutableValue<Value> = Value extends readonly (infer Item)[]
  ? MutableValue<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: MutableValue<Value[Key]> }
    : Value;

export function createCapabilityRequest(): MutableValue<CapabilityRequestV1> {
  return {
    contractVersion: '1.0.0',
    requestId: 'request-alpha',
    capabilityFamily: 'authorization',
    summary: 'Select a supplied authorization candidate for this repository.',
    successConditions: [
      {
        conditionId: 'success-policy',
        statement: 'The integration enforces repository policy.',
      },
    ],
    hardConstraints: [
      {
        constraintId: 'runtime-required',
        reasonCode: 'runtime-required',
        statement: 'The candidate must support the supplied runtime.',
      },
    ],
    preferences: [
      {
        preferenceId: 'prefer-small-api',
        statement: 'Prefer a narrow integration surface.',
      },
    ],
    transmissionApproval: {
      approvalId: 'approval-alpha',
      approvedAt: '2026-07-28T20:00:00Z',
      approvedBy: 'request-originator',
      scope: 'minimized-repository-facts',
      approvedCategories: [
        'bounded-evidence',
        'candidate-dossiers',
        'capability-request',
        'repository-fingerprint',
      ],
    },
  };
}

export function createRepositoryFingerprint(): MutableValue<RepositoryFingerprintV1> {
  const provenance = {
    origin: 'supplied-declaration' as const,
    epistemicStatus: 'declared' as const,
    confidence: 'high' as const,
    observedAt: '2026-07-28T20:00:00Z',
  };
  return {
    contractVersion: '1.0.0',
    factVocabularyVersion: '1.0.0',
    fingerprintId: 'fingerprint-alpha',
    facts: [
      {
        kind: 'component',
        factId: 'fact-runtime',
        component: 'runtime',
        name: 'node',
        version: '24.18.0',
        provenance,
      },
      {
        kind: 'deployment',
        factId: 'fact-deployment',
        topology: 'long-running-container',
        workerCapability: 'capable',
        replicas: 2,
        region: 'us-west',
        provenance,
      },
      {
        kind: 'coded',
        factId: 'fact-redis',
        category: 'repository-capability',
        code: 'redis',
        subjectCode: null,
        value: { kind: 'presence', state: 'present' },
        provenance,
      },
      {
        kind: 'coded',
        factId: 'fact-tenant',
        category: 'identity',
        code: 'tenant-model',
        subjectCode: null,
        value: { kind: 'classification', code: 'multi-tenant' },
        provenance,
      },
      {
        kind: 'coded',
        factId: 'fact-identity-identifiers',
        category: 'identity',
        code: 'context-identifiers',
        subjectCode: 'session',
        value: { kind: 'code-set', codes: ['actor', 'tenant'] },
        provenance,
      },
      {
        kind: 'coded',
        factId: 'fact-identity-normalization',
        category: 'identity',
        code: 'identifier-normalization',
        subjectCode: 'session',
        value: { kind: 'classification', code: 'none' },
        provenance,
      },
      {
        kind: 'coded',
        factId: 'fact-identity-credentials',
        category: 'identity',
        code: 'credential-presence',
        subjectCode: 'session',
        value: { kind: 'classification', code: 'not-stated' },
        provenance,
      },
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

export function createEvidence(
  candidateId: 'candidate-alpha' | 'candidate-beta',
): MutableValue<EvidenceObservationV1> {
  const suffix = candidateId === 'candidate-alpha' ? 'alpha' : 'beta';
  const commitSha =
    candidateId === 'candidate-alpha'
      ? '0123456789abcdef0123456789abcdef01234567'
      : '89abcdef0123456789abcdef0123456789abcdef';
  return {
    kind: 'evidence',
    evidenceId: `evidence-${suffix}`,
    candidateId,
    topic: 'runtime-support',
    dimension: 'runtime-framework',
    observation:
      candidateId === 'candidate-alpha'
        ? 'Official evidence establishes support for the supplied runtime.'
        : 'Official evidence establishes a conflicting runtime requirement.',
    source: {
      kind: 'git-commit',
      sourceType: 'official-repository',
      sourceUrl: `https://github.com/example/${suffix}`,
      commitSha,
      immutableUrl: `https://github.com/example/${suffix}/tree/${commitSha}`,
      collectedAt: '2026-07-28T20:30:00Z',
      publishedAt: '2026-07-28T19:00:00Z',
    },
    freshness: {
      status: 'current',
      asOf: EVIDENCE_CUTOFF,
      scope: 'Runtime compatibility at the pinned revision.',
    },
    directness: 'direct',
    limitation: 'No live candidate code was installed or executed.',
  };
}

export function createCandidateDossier(
  candidateId: 'candidate-alpha' | 'candidate-beta',
): MutableValue<CandidateDossierV1> {
  const suffix = candidateId === 'candidate-alpha' ? 'alpha' : 'beta';
  const evidence = createEvidence(candidateId);
  return {
    contractVersion: '1.0.0',
    identity: {
      candidateId,
      displayName: `Candidate ${suffix}`,
      repository: {
        host: 'github',
        owner: 'example',
        name: suffix,
      },
      package: {
        registry: 'npm',
        name: `example-${suffix}`,
      },
    },
    capabilityFamily: 'authorization',
    versionScope: '1.0.0',
    observations: [evidence],
    limitations: [
      {
        limitationId: `limitation-${suffix}`,
        limitationCode: 'live-validation-not-performed',
        candidateId,
        statement:
          evidence.limitation ?? 'No separate candidate limitation is known.',
        evidenceIds: [evidence.evidenceId],
      },
    ],
    unknowns: [],
  };
}

export function createFitAssessmentRequest(): MutableValue<FitAssessmentRequestV1> {
  return {
    contractVersion: '1.0.0',
    assessmentRequestId: 'assessment-request-alpha',
    capabilityRequest: createCapabilityRequest(),
    repositoryFingerprint: createRepositoryFingerprint(),
    candidates: [
      createCandidateDossier('candidate-alpha'),
      createCandidateDossier('candidate-beta'),
    ],
    evidenceCutoff: EVIDENCE_CUTOFF,
    requestedMaximumResults: 1,
    correlationId: 'correlation-alpha',
  };
}

export function createFitAssessmentResponse(): MutableValue<FitAssessmentResponseV1> {
  const alphaEvidence = createEvidence('candidate-alpha');
  const betaEvidence = createEvidence('candidate-beta');
  return {
    contractVersion: '1.0.0',
    assessmentId: 'assessment-alpha',
    assessmentRequestId: 'assessment-request-alpha',
    correlationId: 'correlation-alpha',
    outcome: 'recommend',
    suppliedCandidateIds: ['candidate-alpha', 'candidate-beta'],
    candidateAssessments: [
      {
        candidateId: 'candidate-alpha',
        disposition: 'recommended',
        reasons: [
          {
            candidateId: 'candidate-alpha',
            reasonCode: 'runtime-compatible',
            statement: 'The supplied evidence establishes runtime fit.',
            evidenceIds: [alphaEvidence.evidenceId],
            inferenceIds: [],
            unknownIds: [],
          },
        ],
        evidenceIds: [alphaEvidence.evidenceId],
        inferenceIds: [],
        claimIds: ['claim-alpha'],
        unknownIds: [],
        hardConstraintConflictIds: [],
        limitationIds: ['limitation-alpha'],
      },
      {
        candidateId: 'candidate-beta',
        disposition: 'rejected',
        reasons: [
          {
            candidateId: 'candidate-beta',
            reasonCode: 'runtime-required',
            statement: 'The supplied runtime conflicts with the candidate.',
            evidenceIds: [betaEvidence.evidenceId],
            inferenceIds: [],
            unknownIds: [],
          },
        ],
        evidenceIds: [betaEvidence.evidenceId],
        inferenceIds: [],
        claimIds: ['claim-beta'],
        unknownIds: [],
        hardConstraintConflictIds: ['conflict-beta'],
        limitationIds: ['limitation-beta'],
      },
    ],
    evidence: [alphaEvidence, betaEvidence],
    inferences: [],
    candidateLimitations: [
      {
        limitationId: 'limitation-alpha',
        limitationCode: 'live-validation-not-performed',
        candidateId: 'candidate-alpha',
        statement: 'No live candidate code was installed or executed.',
        evidenceIds: ['evidence-alpha'],
      },
      {
        limitationId: 'limitation-beta',
        limitationCode: 'live-validation-not-performed',
        candidateId: 'candidate-beta',
        statement: 'No live candidate code was installed or executed.',
        evidenceIds: ['evidence-beta'],
      },
    ],
    materialClaims: [
      {
        claimId: 'claim-alpha',
        candidateId: 'candidate-alpha',
        topic: 'runtime-support',
        direction: 'favorable',
        statement: 'Candidate alpha fits the supplied runtime.',
        evidenceIds: [alphaEvidence.evidenceId],
        inferenceIds: [],
      },
      {
        claimId: 'claim-beta',
        candidateId: 'candidate-beta',
        topic: 'runtime-support',
        direction: 'unfavorable',
        statement: 'Candidate beta conflicts with the supplied runtime.',
        evidenceIds: [betaEvidence.evidenceId],
        inferenceIds: [],
      },
    ],
    materialUnknowns: [],
    hardConstraintConflicts: [
      {
        conflictId: 'conflict-beta',
        candidateId: 'candidate-beta',
        constraintId: 'runtime-required',
        reasonCode: 'runtime-required',
        evidenceIds: [betaEvidence.evidenceId],
      },
    ],
    rankGroups: [{ candidateIds: ['candidate-alpha'] }],
    rankRelations: [],
    incomparablePairs: [],
    evidenceCutoff: EVIDENCE_CUTOFF,
    producedAt: PRODUCED_AT,
    assessmentProcessing: {
      state: 'complete',
      incompleteReasonCodes: [],
    },
  };
}

export function createErrorEnvelope(): MutableValue<ErrorEnvelopeV1> {
  return {
    contractVersion: '1.0.0',
    code: 'invalid-request',
    message: 'The request is invalid.',
    issues: [{ code: 'field.invalid', path: 'capability-family' }],
    retry: 'after-correction',
    correlationId: 'correlation-alpha',
  };
}

export function cloneValue<Value>(value: Value): Value {
  return structuredClone(value);
}
