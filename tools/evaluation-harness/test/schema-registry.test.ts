import { describe, expect, it } from 'vitest';

import { createSchemaRegistry } from '../src/schema-registry.ts';

const caseDocument = {
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
  evidenceIds: ['alpha-license'],
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

const evidenceDocument = {
  schemaVersion: '1.0.0',
  caseId: 'authorization-example',
  evidenceCutoff: '2026-07-28',
  observations: [
    {
      evidenceId: 'alpha-license',
      subjectType: 'candidate',
      candidateId: 'alpha',
      sourceType: 'license',
      sourceUrl: 'https://example.com/license',
      collectedAt: '2026-07-28T20:00:00Z',
      publishedAt: null,
      observation: 'The project uses the MIT license.',
      freshnessScope: 'Repository license at the cutoff.',
      directness: 'direct',
      limitation: 'No legal interpretation is asserted.',
    },
  ],
};

const goldDocument = {
  schemaVersion: '1.0.0',
  caseId: 'authorization-example',
  outcome: 'recommend',
  allowedAlternativeOutcomes: [],
  dispositions: [
    {
      candidateId: 'alpha',
      disposition: 'recommended',
      reasonCodes: [],
      evidenceIds: ['alpha-license'],
    },
    {
      candidateId: 'beta',
      disposition: 'viable',
      reasonCodes: [],
      evidenceIds: ['alpha-license'],
    },
    {
      candidateId: 'gamma',
      disposition: 'rejected',
      reasonCodes: ['tenant-isolation-required'],
      evidenceIds: ['alpha-license'],
    },
  ],
  rankGroups: [['alpha'], ['beta']],
  rankRelations: [],
  incomparablePairs: [],
  hardConstraintConflicts: [
    {
      candidateId: 'gamma',
      constraintId: 'tenant-isolation',
      reasonCode: 'tenant-isolation-required',
      evidenceIds: ['alpha-license'],
    },
  ],
  requiredUnknownIds: ['migration-effort'],
  requiredEvidenceIds: ['alpha-license'],
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

const predictionDocument = {
  schemaVersion: '1.0.0',
  caseId: 'authorization-example',
  outcome: 'recommend',
  candidates: [
    {
      candidateId: 'alpha',
      disposition: 'recommended',
      reasonCodes: [],
      evidenceIds: ['alpha-license'],
    },
    {
      candidateId: 'beta',
      disposition: 'viable',
      reasonCodes: [],
      evidenceIds: ['alpha-license'],
    },
    {
      candidateId: 'gamma',
      disposition: 'rejected',
      reasonCodes: ['tenant-isolation-required'],
      evidenceIds: ['alpha-license'],
    },
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

const manifestDocument = {
  schemaVersion: '1.0.0',
  corpusId: 'pilot-v1',
  corpusVersion: '1.0.0',
  evidenceCutoff: '2026-07-28',
  status: 'development-proposed',
  cases: [
    {
      caseId: 'authorization-example',
      capabilityFamily: 'authorization',
      casePath: 'cases/authorization-example.json',
      caseSha256: 'a'.repeat(64),
      evidencePath: 'evidence/authorization-example.json',
      evidenceSha256: 'b'.repeat(64),
      goldPath: 'gold/authorization-example.json',
      goldSha256: 'c'.repeat(64),
    },
  ],
  familyCounts: {
    authorization: 1,
    'audit-logging': 0,
    'background-jobs': 0,
    'rate-limiting': 0,
    webhooks: 0,
  },
  diversity: {
    pairedDifferentWinners: 2,
    responsibleAbstentions: 2,
    popularHardConstraintRejections: 3,
    includesPrisma: true,
    includesDrizzle: true,
    includesServerless: true,
    includesLongRunning: true,
    includesWorkerCapable: true,
    includesWorkerIncapable: true,
    includesRedis: true,
    includesNoRedis: true,
    includesSingleTenant: true,
    includesMultiTenant: true,
    includesLicenseConstraint: true,
    includesRuntimeConstraint: true,
    includesResidencyConstraint: true,
    includesEvidenceInsufficiency: true,
    includesTieOrPartialOrder: true,
    popularityDiffersFromFit: true,
  },
  provenance: {
    authoringSession: 'phase-2-authoring-session',
    goldStatus: 'proposed',
    independentReviewStatus: 'not-reviewed',
  },
};

const scoreDocument = {
  schemaVersion: '1.0.0',
  corpusId: 'pilot-v1',
  predictionSetId: 'perfect',
  caseCount: 1,
  safety: { safe: true, unsafeCount: 0, violations: [] },
  aggregate: metricSet(),
  byFamily: { authorization: metricSet() },
  byFailureMode: { 'popularity-over-fit': metricSet() },
};

function metricSet() {
  const labelMetric = {
    counts: { truePositive: 1, falsePositive: 0, falseNegative: 0 },
    precision: 1,
    recall: 1,
    f1: 1,
  };
  return {
    caseCount: 1,
    dispositions: {
      recommended: labelMetric,
      viable: labelMetric,
      rejected: labelMetric,
      'insufficient-evidence': labelMetric,
    },
    macroDisposition: { precision: 1, recall: 1, f1: 1 },
    rankingAgreement: 1,
    outcomeAccuracy: 1,
    outcomeByLabel: {
      recommend: 1,
      'no-viable-candidate': 0,
      'insufficient-evidence': 0,
    },
    unknownRecall: 1,
    evidenceRecall: 1,
    reasonRecall: 1,
  };
}

describe('evaluation JSON Schemas', () => {
  const documents = {
    case: caseDocument,
    evidence: evidenceDocument,
    gold: goldDocument,
    manifest: manifestDocument,
    prediction: predictionDocument,
    score: scoreDocument,
  } as const;

  it.each(Object.entries(documents))(
    'accepts a valid %s document',
    (name, value) => {
      const registry = createSchemaRegistry();
      expect(registry.validate(name, value)).toEqual([]);
    },
  );

  it.each(Object.entries(documents))(
    'rejects an invalid %s document with an unknown field',
    (name, value) => {
      const registry = createSchemaRegistry();
      expect(
        registry.validate(name, { ...value, hiddenAnswer: true }),
      ).not.toEqual([]);
    },
  );

  it('rejects invalid nested forms rather than coercing values', () => {
    const registry = createSchemaRegistry();
    const invalidCase = structuredClone(caseDocument);
    invalidCase.repositoryProfile.deployment.replicas = '2' as never;

    expect(registry.validate('case', invalidCase)).not.toEqual([]);
    expect(invalidCase.repositoryProfile.deployment.replicas).toBe('2');
  });

  it('rejects catalogs that exceed the stable-ID bounds', () => {
    const registry = createSchemaRegistry();
    const invalidCase = structuredClone(caseDocument);
    invalidCase.unknowns = Array.from({ length: 65 }, (_, index) => ({
      id: `unknown-${String(index)}`,
      description: `Unknown ${String(index)}`,
    }));

    expect(registry.validate('case', invalidCase)).not.toEqual([]);
  });
});
