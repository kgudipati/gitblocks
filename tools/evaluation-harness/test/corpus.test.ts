import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  derivePilotDiversity,
  loadCorpus,
  validateComparisonPairs,
  validateCorpusProvenance,
  validatePilotScope,
} from '../src/corpus.ts';
import type { CaseBundle } from '../src/contracts.ts';
import { createCase, createEvidence, createGold } from './test-documents.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('committed pilot corpus', () => {
  it('loads the exact balanced corpus with all integrity and diversity gates', () => {
    const result = loadCorpus(REPOSITORY_ROOT);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.bundles).toHaveLength(10);
    expect(result.manifest.familyCounts).toEqual({
      authorization: 2,
      'audit-logging': 2,
      'background-jobs': 2,
      'rate-limiting': 2,
      webhooks: 2,
    });
    expect(
      result.bundles.every(
        (bundle) =>
          bundle.caseDocument.candidates.length >= 3 &&
          bundle.caseDocument.candidates.length <= 5,
      ),
    ).toBe(true);
    expect(result.manifest.diversity).toEqual(
      derivePilotDiversity(result.bundles),
    );
  });

  it('keeps input candidates neutral and excludes gold-only fields', () => {
    const result = loadCorpus(REPOSITORY_ROOT);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    for (const bundle of result.bundles) {
      const candidateIds = bundle.caseDocument.candidates.map(
        (candidate) => candidate.candidateId,
      );
      expect(candidateIds).toEqual([...candidateIds].sort());
      const input = bundle.caseDocument as unknown as Record<string, unknown>;
      expect(input).not.toHaveProperty('outcome');
      expect(input).not.toHaveProperty('rankGroups');
      expect(input).not.toHaveProperty('recommendedCandidate');
      expect(input).not.toHaveProperty('rationaleNotes');
    }
  });

  it('keeps every pilot case inside the approved ecosystem', () => {
    const result = loadCorpus(REPOSITORY_ROOT);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    for (const bundle of result.bundles) {
      expect(bundle.caseDocument.repositoryProfile.framework.name).toBe(
        'nextjs',
      );
      expect(bundle.caseDocument.repositoryProfile.database.name).toBe(
        'postgresql',
      );
      expect(['prisma', 'drizzle']).toContain(
        bundle.caseDocument.repositoryProfile.orm.name,
      );
    }
  });

  it('defines at least two true controlled comparison pairs', () => {
    const result = loadCorpus(REPOSITORY_ROOT);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    const pairs = new Map<string, typeof result.bundles>();
    for (const bundle of result.bundles) {
      const pairId = bundle.caseDocument.comparisonPairId;
      if (pairId !== null) {
        pairs.set(pairId, [...(pairs.get(pairId) ?? []), bundle]);
      }
    }

    expect(pairs.size).toBeGreaterThanOrEqual(2);
    for (const pair of pairs.values()) {
      expect(pair).toHaveLength(2);
      const [left, right] = pair;
      expect(left!.caseDocument.capabilityFamily).toBe(
        right!.caseDocument.capabilityFamily,
      );
      expect(left!.caseDocument.userRequest).toBe(
        right!.caseDocument.userRequest,
      );
      expect(left!.caseDocument.successConditions).toEqual(
        right!.caseDocument.successConditions,
      );
      expect(left!.caseDocument.candidates).toEqual(
        right!.caseDocument.candidates,
      );
      expect(left!.caseDocument.repositoryProfile).not.toEqual(
        right!.caseDocument.repositoryProfile,
      );
      expect(
        left!.gold.dispositions
          .filter((item) => item.disposition === 'recommended')
          .map((item) => item.candidateId),
      ).not.toEqual(
        right!.gold.dispositions
          .filter((item) => item.disposition === 'recommended')
          .map((item) => item.candidateId),
      );
    }
  });

  it('rejects an out-of-scope Fastify pilot profile', () => {
    const bundle = createBundle();
    bundle.caseDocument.repositoryProfile.framework.name = 'fastify';

    expect(
      validatePilotScope([bundle]).some(
        (diagnostic) =>
          diagnostic.code === 'manifest.pilot-scope' &&
          diagnostic.path.includes('framework.name'),
      ),
    ).toBe(true);
  });

  it('rejects an out-of-scope SQLite pilot profile', () => {
    const bundle = createBundle();
    bundle.caseDocument.repositoryProfile.database.name = 'sqlite';

    expect(
      validatePilotScope([bundle]).some(
        (diagnostic) =>
          diagnostic.code === 'manifest.pilot-scope' &&
          diagnostic.path.includes('database.name'),
      ),
    ).toBe(true);
  });

  it('rejects an out-of-scope ORM pilot profile', () => {
    const bundle = createBundle();
    bundle.caseDocument.repositoryProfile.orm.name = 'typeorm';

    expect(
      validatePilotScope([bundle]).some(
        (diagnostic) =>
          diagnostic.code === 'manifest.pilot-scope' &&
          diagnostic.path.includes('orm.name'),
      ),
    ).toBe(true);
  });

  it('rejects a declared pair with different user requests', () => {
    const left = createBundle();
    const right = structuredClone(left);
    left.caseDocument.comparisonPairId = 'request-exploit';
    right.caseDocument.comparisonPairId = 'request-exploit';
    right.caseDocument.caseId = 'authorization-other';
    right.evidence.caseId = 'authorization-other';
    right.gold.caseId = 'authorization-other';
    right.caseDocument.userRequest = 'A materially different request.';
    right.caseDocument.repositoryProfile.hasRedis = true;
    right.gold.dispositions[0]!.disposition = 'viable';
    right.gold.dispositions[1]!.disposition = 'recommended';

    expect(
      validateComparisonPairs([left, right]).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('manifest.comparison-pair-request');
  });

  it('does not treat reordered conditioning catalogs as a repository difference', () => {
    const left = createBundle();
    left.caseDocument.comparisonPairId = 'reorder-exploit';
    left.caseDocument.repositoryProfile.dependencies = [
      { name: 'alpha', version: '1.0.0' },
      { name: 'beta', version: '1.0.0' },
    ];
    left.caseDocument.repositoryProfile.identityFacts = [
      'Identity fact alpha.',
      'Identity fact beta.',
    ];
    left.caseDocument.hardConstraints.push({
      constraintId: 'second-constraint',
      reasonCode: 'tenant-isolation-required',
      statement: 'A second semantic constraint.',
    });
    const right = structuredClone(left);
    right.caseDocument.caseId = 'authorization-other';
    right.evidence.caseId = 'authorization-other';
    right.gold.caseId = 'authorization-other';
    right.caseDocument.repositoryProfile.dependencies.reverse();
    right.caseDocument.repositoryProfile.identityFacts.reverse();
    right.caseDocument.repositoryProfile.deployment = Object.fromEntries(
      Object.entries(right.caseDocument.repositoryProfile.deployment).reverse(),
    ) as typeof right.caseDocument.repositoryProfile.deployment;
    right.caseDocument.hardConstraints.reverse();
    right.gold.dispositions[0]!.disposition = 'viable';
    right.gold.dispositions[1]!.disposition = 'recommended';

    expect(
      validateComparisonPairs([left, right]).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('manifest.comparison-pair-conditioning');
  });

  it('supports accepted corpus provenance and rejects a gold-status mismatch', () => {
    const result = loadCorpus(REPOSITORY_ROOT);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const manifest = structuredClone(result.manifest);
    const bundles = structuredClone(result.bundles);
    manifest.status = 'development-accepted';
    manifest.provenance = {
      authoringSession: 'phase-2-issue-7-authoring-session',
      goldStatus: 'accepted',
      independentReviewStatus: 'accepted',
      independentReviewer: 'reviewer-example',
      reviewedAt: '2026-07-29T20:00:00Z',
      reviewReference: 'review-record-7',
    };
    for (const bundle of bundles) {
      bundle.gold.provenance = {
        status: 'accepted',
        authoringSession: 'phase-2-issue-7-authoring-session',
        independentReviewStatus: 'accepted',
        independentReviewer: 'reviewer-example',
        reviewedAt: '2026-07-29T20:00:00Z',
        reviewReference: 'review-record-7',
      };
    }

    expect(validateCorpusProvenance(manifest, bundles)).toEqual([]);
    bundles[0]!.gold.provenance = {
      status: 'proposed',
      authoringSession: 'phase-2-issue-7-authoring-session',
      independentReviewStatus: 'not-reviewed',
      independentReviewer: null,
      reviewedAt: null,
      reviewReference: null,
    };
    expect(
      validateCorpusProvenance(manifest, bundles).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toContain('manifest.provenance');
  });
});

function createBundle(): CaseBundle {
  return {
    caseDocument: createCase(),
    evidence: createEvidence(),
    gold: createGold(),
  };
}
