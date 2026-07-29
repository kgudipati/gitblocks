import type {
  CandidateAssessment,
  CandidateDossier,
  CandidateId,
  CandidateIdentity,
  CandidateMaterialUnknown,
  CapabilityRequest,
  EvidenceId,
  EvidenceObservation,
  EvidenceReference,
  FitAssessmentRequest,
  FitAssessmentResult,
  MaterialClaim,
  RepositoryFingerprint,
  StableId,
  StableIdKind,
  TopicId,
} from '../src/index.ts';

export type Mutable<Value> = Value extends
  boolean | null | number | string | undefined
  ? Value
  : Value extends readonly (infer Item)[]
    ? Mutable<Item>[]
    : Value extends object
      ? { -readonly [Key in keyof Value]: Mutable<Value[Key]> }
      : Value;

export function stableId<Kind extends StableIdKind>(
  value: string,
): StableId<Kind> {
  return value as StableId<Kind>;
}

export function candidateId(value: string): CandidateId {
  return stableId<'candidate'>(value);
}

export function evidenceReference(
  candidate: string,
  evidence: string,
): EvidenceReference {
  return {
    kind: 'evidence-reference',
    candidateId: candidateId(candidate),
    evidenceId: stableId<'evidence'>(evidence),
  };
}

export function createCapabilityRequest(): Mutable<CapabilityRequest> {
  return {
    requestId: stableId<'request'>('request-1'),
    capabilityFamily: 'authorization',
    summary: 'Select an authorization library for record-level access.',
    successConditions: [
      {
        successConditionId: stableId<'success-condition'>('tenant-access'),
        statement: 'Enforce tenant-aware record access.',
      },
    ],
    hardConstraints: [
      {
        hardConstraintId: stableId<'hard-constraint'>('permissive-license'),
        reasonCode: stableId<'reason-code'>('license-required'),
        statement: 'The project must use an approved permissive license.',
      },
    ],
    preferences: [
      {
        preferenceId: stableId<'preference'>('typescript-api'),
        statement: 'Prefer a TypeScript-first API.',
      },
    ],
    transmissionApproval: {
      approvalId: stableId<'approval'>('approval-1'),
      status: 'approved',
      approvedBy: 'request-originator',
      scope: 'minimized-repository-facts',
      approvedAt: '2026-07-28T18:00:00Z',
      approvedFactCategories: [
        'capability-request',
        'repository-fingerprint',
        'candidate-dossiers',
        'bounded-evidence',
      ],
    },
  };
}

export function createRepositoryFingerprint(): Mutable<RepositoryFingerprint> {
  const provenance = {
    kind: 'repository-local' as const,
    source: 'manifest' as const,
    directness: 'direct' as const,
    confidence: 'high' as const,
    collectedAt: '2026-07-28T18:00:00Z',
  };
  return {
    fingerprintId: stableId<'fingerprint'>('fingerprint-1'),
    facts: [
      {
        kind: 'named-version' as const,
        repositoryFactId: stableId<'repository-fact'>('runtime-node'),
        category: 'runtime' as const,
        name: 'node',
        version: '24.18.0',
        provenance,
      },
      {
        kind: 'named-version' as const,
        repositoryFactId: stableId<'repository-fact'>('language-typescript'),
        category: 'language' as const,
        name: 'typescript',
        version: '6.0.3',
        provenance,
      },
      {
        kind: 'tenant' as const,
        repositoryFactId: stableId<'repository-fact'>('tenant-model'),
        tenantModel: 'multi-tenant',
        provenance: {
          ...provenance,
          source: 'configuration-shape' as const,
          directness: 'derived' as const,
        },
      },
    ],
    omittedCategories: ['configuration-values', 'raw-source'],
  };
}

export function createCandidateIdentity(
  rawCandidateId: string,
): Mutable<CandidateIdentity> {
  return {
    candidateId: candidateId(rawCandidateId),
    project: `${rawCandidateId} project`,
    packageName: `@example/${rawCandidateId}`,
    repository: `example/${rawCandidateId}`,
  };
}

export function createEvidence(
  rawCandidateId: string,
  rawEvidenceId: string,
  rawTopic = 'license',
): Mutable<EvidenceObservation> {
  return {
    kind: 'evidence-observation',
    evidenceId: stableId<'evidence'>(rawEvidenceId),
    candidateId: candidateId(rawCandidateId),
    topic: stableId<'topic'>(rawTopic),
    dimension: 'license',
    observation: 'The published license metadata identifies the MIT license.',
    provenance: {
      sourceType: 'package-registry',
      sourceUrl: `https://registry.example/${rawCandidateId}`,
      revision: {
        kind: 'version',
        value: '1.0.0',
        immutableUrl: `https://registry.example/${rawCandidateId}/1.0.0`,
      },
      collectedAt: '2026-07-28T18:00:00Z',
      publishedAt: '2026-07-20T18:00:00Z',
    },
    directness: 'direct',
    freshness: {
      status: 'current',
      asOf: '2026-07-28T18:00:00Z',
      scope: 'Published package metadata at the evidence cutoff.',
    },
    limitation: 'No legal interpretation is asserted.',
  };
}

export function createUnknown(
  rawCandidateId: string,
  rawUnknownId: string,
  rawTopic = 'maintenance',
): Mutable<CandidateMaterialUnknown> {
  return {
    kind: 'material-unknown',
    scope: 'candidate',
    unknownId: stableId<'unknown'>(rawUnknownId),
    candidateId: candidateId(rawCandidateId),
    topic: stableId<'topic'>(rawTopic),
    statement: 'Long-term maintenance capacity is not established.',
    evidenceReferences: [],
  };
}

export function createCandidateDossier(
  rawCandidateId: string,
): Mutable<CandidateDossier> {
  return {
    identity: createCandidateIdentity(rawCandidateId),
    capabilityFamily: 'authorization',
    versionScope: '1.x',
    evidence: [
      createEvidence(rawCandidateId, `${rawCandidateId}-license`, 'license'),
    ],
    limitations: [],
    unknowns:
      rawCandidateId === 'beta'
        ? [createUnknown('beta', 'beta-maintenance')]
        : [],
  };
}

export function createClaim(
  rawCandidateId: string,
  rawClaimId: string,
  rawEvidenceId: string,
  rawTopic = 'license',
): Mutable<MaterialClaim> {
  return {
    kind: 'material-claim',
    claimId: stableId<'claim'>(rawClaimId),
    candidateId: candidateId(rawCandidateId),
    topic: stableId<'topic'>(rawTopic),
    direction: 'favorable',
    statement: 'The license satisfies the stated license constraint.',
    evidenceReferences: [evidenceReference(rawCandidateId, rawEvidenceId)],
    inferenceIds: [],
  };
}

function createAssessment(
  rawCandidateId: string,
  disposition: CandidateAssessment['disposition'],
  rawEvidenceId: string,
  rawClaimId: string,
  rawUnknownIds: readonly string[] = [],
): Mutable<CandidateAssessment> {
  return {
    candidateId: candidateId(rawCandidateId),
    disposition,
    reasons: [],
    evidenceReferences: [evidenceReference(rawCandidateId, rawEvidenceId)],
    inferenceIds: [],
    unknownIds: rawUnknownIds.map((value) => stableId<'unknown'>(value)),
    claimIds: [stableId<'claim'>(rawClaimId)],
    hardConflictIds: [],
  };
}

export function createFitAssessmentRequest(): Mutable<FitAssessmentRequest> {
  return {
    assessmentRequestId: stableId<'assessment-request'>('assessment-request-1'),
    capabilityRequest: createCapabilityRequest(),
    repositoryFingerprint: createRepositoryFingerprint(),
    candidateDossiers: [
      createCandidateDossier('alpha'),
      createCandidateDossier('beta'),
    ],
    evidenceCutoff: '2026-07-28T18:00:00Z',
    requestedMaximumResults: 2,
    correlationId: 'trace-1',
  };
}

export function createFitAssessmentResult(): Mutable<FitAssessmentResult> {
  const alphaEvidence = createEvidence('alpha', 'alpha-license');
  const betaEvidence = createEvidence('beta', 'beta-license');
  const betaUnknown = createUnknown('beta', 'beta-maintenance');
  return {
    assessmentId: stableId<'assessment'>('assessment-1'),
    assessmentRequestId: stableId<'assessment-request'>('assessment-request-1'),
    correlationId: 'trace-1',
    outcome: 'recommend',
    suppliedCandidateIds: [candidateId('alpha'), candidateId('beta')],
    assessments: [
      createAssessment(
        'alpha',
        'recommended',
        'alpha-license',
        'alpha-license-fit',
      ),
      createAssessment('beta', 'viable', 'beta-license', 'beta-license-fit', [
        'beta-maintenance',
      ]),
    ],
    evidence: [alphaEvidence, betaEvidence],
    inferences: [],
    unknowns: [betaUnknown],
    claims: [
      createClaim('alpha', 'alpha-license-fit', 'alpha-license'),
      createClaim('beta', 'beta-license-fit', 'beta-license'),
    ],
    hardConstraintConflicts: [],
    rankGroups: [
      { candidateIds: [candidateId('alpha')] },
      { candidateIds: [candidateId('beta')] },
    ],
    rankRelations: [],
    incomparablePairs: [],
    evidenceCutoff: '2026-07-28T18:00:00Z',
    producedAt: '2026-07-28T19:00:00Z',
    completeness: 'partial-evidence',
  };
}

export function evidenceId(value: string): EvidenceId {
  return stableId<'evidence'>(value);
}

export function topicId(value: string): TopicId {
  return stableId<'topic'>(value);
}
