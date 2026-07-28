import { describe, expect, it } from 'vitest';

import { createSchemaRegistry } from '../src/schema-registry.ts';

interface MutableEvidenceObservation {
  subjectType: string;
  candidateId: string | null;
  sourceType: string;
  sourceUrl: string;
  sourceRevision: {
    kind: string;
    value: string;
    immutableUrl: string | null;
  };
  publishedAt: string | null;
  directness: string;
}

const caseDocument = {
  schemaVersion: '1.0.0',
  caseId: 'authorization-example',
  capabilityFamily: 'authorization',
  decisionObjective: 'select-authorization-fit',
  comparisonPairId: null,
  userRequest: 'Select an authorization library.',
  successConditions: ['Enforce record access.'],
  repositoryProfile: {
    language: { name: 'typescript', version: '6.0.3' },
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
      sourceRevision: {
        kind: 'git-commit',
        value: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        immutableUrl:
          'https://github.com/example/alpha/blob/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/LICENSE',
      },
      collectedAt: '2026-07-28T20:00:00Z',
      publishedAt: '2026-07-27T20:00:00Z',
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
  rationaleNotes: ['Proposed for review.'],
  evidenceCutoff: '2026-07-28',
  provenance: {
    status: 'proposed',
    authoringSession: 'phase-2-authoring-session',
    independentReviewStatus: 'not-reviewed',
    independentReviewer: null,
    reviewedAt: null,
    reviewReference: null,
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
    independentReviewer: null,
    reviewedAt: null,
    reviewReference: null,
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

  it('represents independently accepted gold with bounded review evidence', () => {
    const registry = createSchemaRegistry();
    const acceptedGold = structuredClone(goldDocument);
    acceptedGold.provenance = {
      status: 'accepted',
      authoringSession: 'phase-2-authoring-session',
      independentReviewStatus: 'accepted',
      independentReviewer: 'reviewer-example',
      reviewedAt: '2026-07-29T20:00:00Z',
      reviewReference: 'review-record-7',
    } as never;

    expect(registry.validate('gold', acceptedGold)).toEqual([]);
  });

  it('rejects accepted provenance without independent reviewer evidence', () => {
    const registry = createSchemaRegistry();
    const acceptedGold = structuredClone(goldDocument);
    acceptedGold.provenance = {
      status: 'accepted',
      authoringSession: 'phase-2-authoring-session',
      independentReviewStatus: 'accepted',
      independentReviewer: null,
      reviewedAt: null,
      reviewReference: null,
    };

    expect(registry.validate('gold', acceptedGold)).not.toEqual([]);
  });

  it('rejects accepted provenance with a whitespace-only review reference', () => {
    const registry = createSchemaRegistry();
    const acceptedGold = structuredClone(goldDocument);
    acceptedGold.provenance = {
      status: 'accepted',
      authoringSession: 'phase-2-authoring-session',
      independentReviewStatus: 'accepted',
      independentReviewer: 'reviewer-example',
      reviewedAt: '2026-07-29T20:00:00Z',
      reviewReference: '  ',
    } as never;

    expect(registry.validate('gold', acceptedGold)).not.toEqual([]);
  });

  it('rejects proposed provenance that falsely carries a review timestamp', () => {
    const registry = createSchemaRegistry();
    const proposedGold = structuredClone(goldDocument);
    proposedGold.provenance.reviewedAt = '2026-07-29T20:00:00Z' as never;

    expect(registry.validate('gold', proposedGold)).not.toEqual([]);
  });

  it('represents an independently accepted corpus manifest', () => {
    const registry = createSchemaRegistry();
    const acceptedManifest = structuredClone(manifestDocument);
    acceptedManifest.status = 'development-accepted';
    acceptedManifest.provenance = {
      authoringSession: 'phase-2-authoring-session',
      goldStatus: 'accepted',
      independentReviewStatus: 'reviewed',
      independentReviewer: 'reviewer-example',
      reviewedAt: '2026-07-29T20:00:00Z',
      reviewReference: 'review-record-7',
    } as never;

    expect(registry.validate('manifest', acceptedManifest)).toEqual([]);
  });

  it('rejects accepted manifest provenance without reviewer evidence', () => {
    const registry = createSchemaRegistry();
    const acceptedManifest = structuredClone(manifestDocument);
    acceptedManifest.status = 'development-accepted';
    acceptedManifest.provenance = {
      authoringSession: 'phase-2-authoring-session',
      goldStatus: 'accepted',
      independentReviewStatus: 'accepted',
      independentReviewer: null,
      reviewedAt: null,
      reviewReference: null,
    };

    expect(registry.validate('manifest', acceptedManifest)).not.toEqual([]);
  });

  it('rejects an accepted manifest with a whitespace-only review reference', () => {
    const registry = createSchemaRegistry();
    const acceptedManifest = structuredClone(manifestDocument);
    acceptedManifest.status = 'development-accepted';
    acceptedManifest.provenance = {
      authoringSession: 'phase-2-authoring-session',
      goldStatus: 'accepted',
      independentReviewStatus: 'accepted',
      independentReviewer: 'reviewer-example',
      reviewedAt: '2026-07-29T20:00:00Z',
      reviewReference: '  ',
    } as never;

    expect(registry.validate('manifest', acceptedManifest)).not.toEqual([]);
  });

  it('rejects proposed manifest provenance that falsely carries a review timestamp', () => {
    const registry = createSchemaRegistry();
    const proposedManifest = structuredClone(manifestDocument);
    proposedManifest.provenance.reviewedAt = '2026-07-29T20:00:00Z' as never;

    expect(registry.validate('manifest', proposedManifest)).not.toEqual([]);
  });

  it('rejects manifest status and gold lifecycle mismatches in both directions', () => {
    const registry = createSchemaRegistry();
    const proposedWithAcceptedGold = structuredClone(manifestDocument);
    proposedWithAcceptedGold.provenance = {
      authoringSession: 'phase-2-authoring-session',
      goldStatus: 'accepted',
      independentReviewStatus: 'accepted',
      independentReviewer: 'reviewer-example',
      reviewedAt: '2026-07-29T20:00:00Z',
      reviewReference: 'review-record-7',
    } as never;
    expect(registry.validate('manifest', proposedWithAcceptedGold)).not.toEqual(
      [],
    );

    const acceptedWithProposedGold = structuredClone(manifestDocument);
    acceptedWithProposedGold.status = 'development-accepted';
    expect(registry.validate('manifest', acceptedWithProposedGold)).not.toEqual(
      [],
    );
  });

  it('requires bounded source revision metadata', () => {
    const registry = createSchemaRegistry();
    const unrevisedEvidence = structuredClone(evidenceDocument);
    delete (
      unrevisedEvidence.observations[0] as Partial<
        (typeof unrevisedEvidence.observations)[number]
      >
    ).sourceRevision;

    expect(registry.validate('evidence', unrevisedEvidence)).not.toEqual([]);
  });

  it.each([
    {
      sourceType: 'official-documentation',
      revision: {
        kind: 'git-commit',
        value: 'a'.repeat(40),
        immutableUrl: `https://github.com/example/alpha/tree/${'a'.repeat(40)}/docs`,
      },
    },
    {
      sourceType: 'official-repository',
      revision: {
        kind: 'git-commit',
        value: 'a'.repeat(40),
        immutableUrl: `https://github.com/example/alpha/tree/${'a'.repeat(40)}`,
      },
    },
    {
      sourceType: 'official-release',
      revision: {
        kind: 'release',
        value: 'v1.2.3',
        immutableUrl: 'https://github.com/example/alpha/releases/tag/v1.2.3',
      },
    },
    {
      sourceType: 'package-registry',
      revision: {
        kind: 'version',
        value: '1.2.3',
        immutableUrl: 'https://www.npmjs.com/package/alpha/v/1.2.3',
      },
    },
    {
      sourceType: 'security-advisory',
      revision: {
        kind: 'version',
        value: 'GHSA-abcd-efgh-ijkl',
        immutableUrl: 'https://github.com/advisories/GHSA-abcd-efgh-ijkl',
      },
    },
    {
      sourceType: 'license',
      revision: {
        kind: 'git-commit',
        value: 'a'.repeat(40),
        immutableUrl: `https://github.com/example/alpha/blob/${'a'.repeat(40)}/LICENSE`,
      },
    },
    {
      sourceType: 'case-local-fact',
      revision: {
        kind: 'case-version',
        value: '1.0.0',
        immutableUrl: null,
      },
      caseLocal: true,
    },
  ])(
    'accepts appropriate $sourceType revision metadata',
    ({ sourceType, revision, caseLocal }) => {
      const registry = createSchemaRegistry();
      const evidence = structuredClone(evidenceDocument);
      const observation: MutableEvidenceObservation = evidence.observations[0]!;
      observation.sourceType = sourceType;
      observation.sourceRevision = revision;
      if (caseLocal === true) {
        observation.subjectType = 'case';
        observation.candidateId = null;
        observation.sourceUrl =
          'case://authorization-example/repository-runtime';
        observation.publishedAt = null;
        observation.directness = 'case-local';
      }

      expect(registry.validate('evidence', evidence)).toEqual([]);
    },
  );

  it.each([
    ['official-documentation', 'case-version'],
    ['official-repository', 'version'],
    ['official-release', 'git-commit'],
    ['package-registry', 'release'],
    ['security-advisory', 'git-commit'],
    ['license', 'version'],
    ['case-local-fact', 'release'],
  ] as const)(
    'rejects %s evidence with revision kind %s',
    (sourceType, kind) => {
      const registry = createSchemaRegistry();
      const evidence = structuredClone(evidenceDocument);
      const observation: MutableEvidenceObservation = evidence.observations[0]!;
      observation.sourceType = sourceType;
      observation.sourceRevision = {
        kind,
        value: kind === 'git-commit' ? 'a'.repeat(40) : 'v1.2.3',
        immutableUrl:
          kind === 'case-version'
            ? null
            : 'https://github.com/example/alpha/releases/tag/v1.2.3',
      };
      if (sourceType === 'case-local-fact') {
        observation.subjectType = 'case';
        observation.candidateId = null;
        observation.sourceUrl =
          'case://authorization-example/repository-runtime';
        observation.publishedAt = null;
        observation.directness = 'case-local';
      }

      expect(registry.validate('evidence', evidence)).not.toEqual([]);
    },
  );

  it('rejects mutable package aliases and release/source revision mismatches', () => {
    const registry = createSchemaRegistry();
    const mutablePackage = structuredClone(evidenceDocument);
    mutablePackage.observations[0]!.sourceType = 'package-registry';
    mutablePackage.observations[0]!.sourceRevision = {
      kind: 'version',
      value: 'latest',
      immutableUrl: 'https://registry.example.com/alpha/latest',
    };
    expect(registry.validate('evidence', mutablePackage)).not.toEqual([]);

    const mismatchedRelease = structuredClone(evidenceDocument);
    mismatchedRelease.observations[0]!.sourceType = 'official-release';
    expect(registry.validate('evidence', mismatchedRelease)).not.toEqual([]);
  });
});
