import type {
  EvaluationCase,
  EvidenceSet,
  GoldResult,
  Prediction,
} from '../src/contracts.ts';

export function createCase(): EvaluationCase {
  return {
    schemaVersion: '1.0.0',
    caseId: 'authorization-example',
    capabilityFamily: 'authorization',
    userRequest: 'Select an authorization library.',
    successConditions: ['Enforce record access.'],
    repositoryProfile: {
      runtime: { name: 'node', version: '24.18.0' },
      framework: { name: 'nextjs', version: '16.4.0' },
      packageManager: { name: 'pnpm', version: '11.17.0' },
      database: { name: 'postgresql', version: '17' },
      orm: { name: 'prisma', version: '7.2.0' },
      deployment: {
        topology: 'long-running-container',
        workerCapability: 'capable',
        replicas: 2,
        region: 'us-west',
      },
      dependencies: [],
      hasRedis: false,
      tenantModel: 'multi-tenant',
      identityFacts: ['JWT subject identifies the actor.'],
      dataFacts: ['Every record has a tenant identifier.'],
      operationalFacts: ['No external policy service is deployed.'],
    },
    hardConstraints: [
      {
        constraintId: 'tenant-isolation',
        reasonCode: 'tenant-isolation-required',
        statement: 'The candidate must support tenant-aware decisions.',
      },
    ],
    preferences: [],
    candidates: [
      {
        candidateId: 'alpha',
        project: 'Alpha',
        package: 'alpha',
        repository: 'example/alpha',
      },
      {
        candidateId: 'beta',
        project: 'Beta',
        package: 'beta',
        repository: 'example/beta',
      },
      {
        candidateId: 'gamma',
        project: 'Gamma',
        package: null,
        repository: 'example/gamma',
      },
    ],
    evidenceIds: [
      'alpha-license',
      'beta-license',
      'case-tenant-fact',
      'gamma-conflict',
    ],
    reasonCodes: [
      {
        id: 'tenant-isolation-required',
        description: 'Tenant isolation is mandatory.',
      },
    ],
    unknowns: [
      {
        id: 'migration-effort',
        description: 'Migration effort is not established.',
      },
    ],
    difficulty: 'medium',
    failureModes: ['popularity-over-fit'],
    authoredAt: '2026-07-28',
    evidenceCutoff: '2026-07-28',
  };
}

export function createEvidence(): EvidenceSet {
  return {
    schemaVersion: '1.0.0',
    caseId: 'authorization-example',
    evidenceCutoff: '2026-07-28',
    observations: [
      observation('alpha-license', 'alpha'),
      observation('beta-license', 'beta'),
      {
        ...observation('case-tenant-fact', null),
        subjectType: 'case',
        sourceType: 'case-local-fact',
        sourceUrl: 'case://authorization-example/tenant-fact',
        directness: 'case-local',
      },
      observation('gamma-conflict', 'gamma'),
    ],
  };
}

export function createGold(): GoldResult {
  return {
    schemaVersion: '1.0.0',
    caseId: 'authorization-example',
    outcome: 'recommend',
    allowedAlternativeOutcomes: [],
    dispositions: [
      disposition('alpha', 'recommended', [], ['alpha-license']),
      disposition('beta', 'viable', [], ['beta-license']),
      disposition(
        'gamma',
        'rejected',
        ['tenant-isolation-required'],
        ['gamma-conflict'],
      ),
    ],
    rankGroups: [['alpha'], ['beta']],
    rankRelations: [],
    incomparablePairs: [],
    hardConstraintConflicts: [
      {
        candidateId: 'gamma',
        constraintId: 'tenant-isolation',
        reasonCode: 'tenant-isolation-required',
        evidenceIds: ['gamma-conflict'],
      },
    ],
    requiredUnknownIds: ['migration-effort'],
    requiredEvidenceIds: ['alpha-license', 'beta-license', 'gamma-conflict'],
    requiredReasonCodes: ['tenant-isolation-required'],
    rationaleNotes: ['Proposed for review.'],
    evidenceCutoff: '2026-07-28',
    provenance: {
      status: 'proposed',
      authoringSession: 'phase-2-authoring-session',
      independentReviewStatus: 'not-reviewed',
      independentReviewer: null,
      reviewedAt: null,
    },
  };
}

export function createPrediction(): Prediction {
  return {
    schemaVersion: '1.0.0',
    caseId: 'authorization-example',
    outcome: 'recommend',
    candidates: [
      disposition('alpha', 'recommended', [], ['alpha-license']),
      disposition('beta', 'viable', [], ['beta-license']),
      disposition(
        'gamma',
        'rejected',
        ['tenant-isolation-required'],
        ['gamma-conflict'],
      ),
    ],
    rankGroups: [['alpha'], ['beta']],
    rankRelations: [],
    disclosedUnknownIds: ['migration-effort'],
    run: {
      runId: 'fixture-run',
      producer: 'deterministic fixture',
      producedAt: '2026-07-28T20:00:00Z',
    },
  };
}

function observation(evidenceId: string, candidateId: string | null) {
  return {
    evidenceId,
    subjectType: 'candidate' as const,
    candidateId,
    sourceType: 'license' as const,
    sourceUrl: 'https://example.com/license',
    collectedAt: '2026-07-28T20:00:00Z',
    publishedAt: null,
    observation: 'The project uses a reviewed license.',
    freshnessScope: 'Repository license at the cutoff.',
    directness: 'direct' as const,
    limitation: 'No legal interpretation is asserted.',
  };
}

function disposition(
  candidateId: string,
  dispositionValue:
    'recommended' | 'viable' | 'rejected' | 'insufficient-evidence',
  reasonCodes: string[],
  evidenceIds: string[],
) {
  return {
    candidateId,
    disposition: dispositionValue,
    reasonCodes,
    evidenceIds,
  };
}
