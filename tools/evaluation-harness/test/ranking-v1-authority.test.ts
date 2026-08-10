import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  authorCorrectedBaselineSpecifications,
  authorCorrectedRankingAuthority,
} from '../src/ranking/authority-authoring.ts';
import { loadRankingBlindInputSet } from '../src/ranking/blind-input.ts';
import type { RankingBaselineSpecificationAuthority } from '../src/ranking/contracts.ts';
import {
  isBoundMaterialSuccessReachable,
  loadRankingCorpus,
} from '../src/ranking/corpus.ts';
import { rankingStableJson } from '../src/ranking/stable-json.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('ranking-v1 authority', () => {
  it('preserves thirty authored cases with six per family under additive acceptance', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.cases).toHaveLength(30);
    expect(
      Object.fromEntries(
        [...new Set(loaded.cases.map((item) => item.binding.capabilityFamily))]
          .sort()
          .map((family) => [
            family,
            loaded.cases.filter(
              (item) => item.binding.capabilityFamily === family,
            ).length,
          ]),
      ),
    ).toEqual({
      authorization: 6,
      'audit-logging': 6,
      'background-jobs': 6,
      'rate-limiting': 6,
      webhooks: 6,
    });
    expect(loaded.corpus.gold.reviewStatus).toBe(
      'proposed-not-independently-reviewed',
    );
    expect(
      loaded.corpus.gold.cases.map(({ provenance }) => ({
        status: provenance.status,
        independentReviewStatus: provenance.independentReviewStatus,
      })),
    ).toEqual(
      Array.from({ length: 30 }, () => ({
        status: 'proposed',
        independentReviewStatus: 'not-reviewed',
      })),
    );
    expect(loaded.corpus.review.status).toBe('independent-review-pending');
    expect(loaded.corpus.review.independentReviewer).toBeNull();
    expect('milestone2Accepted' in loaded.corpus.review).toBe(false);
    expect(loaded.corpus.acceptedReview.status).toBe('accepted');
    expect(loaded.corpus.acceptedReview.acceptedCaseIds).toHaveLength(30);
  });

  it('keeps blind, evidence, handoff, audit, gold, and review authority physical', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'evals/ranking-v1/manifest.json'),
        'utf8',
      ),
    ) as { files: readonly { path: string }[] };
    const paths = manifest.files.map(({ path }) => path);
    expect(paths).toContain('blind/cases.json');
    expect(paths).toContain('evidence/candidate-evidence.json');
    expect(paths).toContain('handoff/phase9-lanes.json');
    expect(paths).toContain('audit/case-classifications.json');
    expect(paths).toContain('gold/outcomes.json');
    expect(paths).toContain('reviews/reviewer-rationale.json');
    expect(paths).toContain('reviews/proposed-review-record.json');
    expect(paths).toContain('reviews/accepted-review-record.json');
    expect(paths).toContain('gates/accepted-gates.json');

    const blind = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'evals/ranking-v1/blind/cases.json'),
        'utf8',
      ),
    ) as unknown;
    const forbiddenKeys = new Set([
      'auditLabels',
      'controlledPairExpectedDirection',
      'disposition',
      'gold',
      'incomparablePairs',
      'outcome',
      'primaryClass',
      'rankGroups',
      'rankRelations',
      'reviewStatus',
    ]);
    expect(collectKeys(blind).filter((key) => forbiddenKeys.has(key))).toEqual(
      [],
    );
  });

  it('keeps candidate evidence request-independent and provenance scoped', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const criterionIds = new Set(
      loaded.corpus.blind.requests.flatMap((request) => [
        ...request.successConditions.map(({ criterionId }) => criterionId),
        ...request.hardConstraints.map(({ criterionId }) => criterionId),
        ...request.preferences.map(({ criterionId }) => criterionId),
      ]),
    );
    const evidence = loaded.corpus.evidence.evidenceSets.flatMap(
      ({ candidates }) =>
        candidates.flatMap(({ observations }) => observations),
    );
    expect(evidence).not.toHaveLength(0);
    expect(
      evidence.every(
        (observation) =>
          !/(?:success-condition|preference|hard-constraint|evidence-needed-closure)/u.test(
            observation.featureId,
          ) &&
          observation.values.every(
            (value) =>
              !criterionIds.has(value) &&
              !['satisfied', 'conflict', 'unresolved'].includes(value),
          ) &&
          Object.is(observation.provenance.productionAuthority, false) &&
          (observation.provenance.basis === 'committed-pilot-evidence-concept'
            ? observation.provenance.sourceReference?.startsWith(
                'evals/pilot-v1/evidence/',
              ) === true &&
              observation.provenance.claimScope ===
                'concept-crosswalk-not-current-project-authority'
            : observation.provenance.basis === 'ranking-v1-controlled-fixture'
              ? observation.provenance.sourceReference === null &&
                observation.provenance.claimScope ===
                  'scenario-synthetic-not-project-authority'
              : false),
      ),
    ).toBe(true);
    expect(
      collectKeys(loaded.corpus.evidence).filter((key) =>
        [
          'supportedSuccessConditionIds',
          'supportedPreferenceIds',
          'closureAssertions',
          'resolution',
        ].includes(key),
      ),
    ).toEqual([]);
  });

  it('binds every material success value to a reachable candidate fact dimension', () => {
    const cases = loadRankingBlindInputSet(REPOSITORY_ROOT).cases;
    const expectedMappings = new Map([
      ['child-logger-context', 'capability-features'],
      ['distributed-shared-state', 'capability-features'],
      ['durable-shared-job-state', 'capability-features'],
      ['express-store-interface-support', 'capability-features'],
      ['fixed-window', 'operational-primitives'],
      ['policy-enforcement', 'capability-features'],
      ['per-transport-format', 'operational-primitives'],
      ['raw-body-signature-verification', 'capability-features'],
      ['retry-backoff-restart-survival', 'capability-features'],
      ['sensitive-field-redaction', 'capability-features'],
      ['stable-keyed-counters', 'capability-features'],
      ['structured-event-output', 'capability-features'],
      ['tenant-secret-isolation', 'capability-features'],
    ]);
    for (const resolved of cases) {
      for (const binding of resolved.criteria.bindings.filter(
        (item) =>
          item.criterionKind === 'success-condition' &&
          item.bindingState === 'bound' &&
          item.materiality === 'material',
      )) {
        expect(
          isBoundMaterialSuccessReachable(binding, resolved.evidence),
          `${resolved.binding.caseId}/${binding.criterionId}`,
        ).toBe(true);
        if (
          binding.expectedValues.join('\0') === 'actor\0tenant\0organization'
        ) {
          expect(binding.candidateFeatureDependencies).toEqual([
            'identity-inputs',
          ]);
        } else {
          expect(binding.candidateFeatureDependencies).toEqual([
            expectedMappings.get(binding.expectedValues[0]!),
          ]);
        }
      }
    }

    const audit = cases.find(
      ({ binding }) => binding.caseId === 'rank-audit-01-controlled-a',
    );
    expect(audit).toBeDefined();
    if (audit === undefined) return;
    const redaction = audit.criteria.bindings.find(({ expectedValues }) =>
      expectedValues.includes('sensitive-field-redaction'),
    );
    expect(redaction).toBeDefined();
    if (redaction === undefined) return;
    expect(
      isBoundMaterialSuccessReachable(
        {
          ...redaction,
          candidateFeatureDependencies: ['operational-primitives'],
        },
        audit.evidence,
      ),
    ).toBe(false);
  });

  it('retains one genuinely causal bound preference effect per family', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const caseFamily = new Map(
      loaded.cases.map(({ binding }) => [
        binding.caseId,
        binding.capabilityFamily,
      ]),
    );
    const causal = loaded.corpus.gold.cases.flatMap((gold) =>
      gold.preferenceConsequences
        .filter(
          ({ state, affectedPairs }) =>
            state === 'applied-and-changed-supported-comparison' &&
            affectedPairs.length > 0,
        )
        .map(({ criterionId, affectedPairs }) => ({
          caseId: gold.caseId,
          family: caseFamily.get(gold.caseId),
          criterionId,
          affectedPairs,
        })),
    );
    expect(causal).toHaveLength(5);
    expect(causal.map(({ family }) => family).sort()).toEqual([
      'audit-logging',
      'authorization',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ]);
    expect(
      causal.every(({ caseId }) => caseId.endsWith('-05-popularity-over-fit')),
    ).toBe(true);
    expect(
      loaded.corpus.gold.cases
        .filter(({ caseId }) => caseId.endsWith('-03-no-viable'))
        .flatMap(({ preferenceConsequences }) => preferenceConsequences)
        .every(
          ({ state, affectedPairs }) =>
            state !== 'applied-and-changed-supported-comparison' &&
            affectedPairs.length === 0,
        ),
    ).toBe(true);
  });

  it('uses candidate-owned decision-minimal gold evidence associations', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    for (const resolved of loaded.cases) {
      const owners = new Map(
        resolved.evidence.candidates.flatMap((candidate) =>
          candidate.observations.map(
            ({ evidenceId }) => [evidenceId, candidate.candidateId] as const,
          ),
        ),
      );
      const gold = loaded.corpus.gold.cases.find(
        ({ caseId }) => caseId === resolved.binding.caseId,
      );
      expect(gold).toBeDefined();
      if (gold === undefined) continue;
      for (const candidate of gold.candidates) {
        expect(
          candidate.evidenceIds.every(
            (evidenceId) => owners.get(evidenceId) === candidate.candidateId,
          ),
          `${gold.caseId}/${candidate.candidateId}`,
        ).toBe(true);
        expect(candidate.evidenceIds.length).toBeLessThan(
          resolved.evidence.candidates.find(
            ({ candidateId }) => candidateId === candidate.candidateId,
          )!.observations.length,
        );
      }
    }
  });

  it('binds a substantive author rationale to every proposed case', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.corpus.reviewerRationale.cases).toHaveLength(30);
    expect(loaded.corpus.review.reviewerRationaleDigest).toBe(
      loaded.corpus.reviewerRationale.semanticDigest,
    );
    expect(
      loaded.corpus.reviewerRationale.cases.every(
        (rationale) =>
          rationale.requestRequirements.length > 2 &&
          rationale.materialTargetFacts.length > 1 &&
          rationale.coverageEvidence.length > 0 &&
          rationale.hardConflictEvidence.length > 0 &&
          rationale.materialInsufficiency.length > 0 &&
          rationale.preferenceAnalysis.length > 0 &&
          rationale.maximalSetAnalysis.length > 0 &&
          rationale.partialOrderAnalysis.length > 0,
      ),
    ).toBe(true);
    expect(
      loaded.corpus.reviewerRationale.cases.every((rationale) =>
        rationale.criterionBindingCrosswalk.every((crosswalk) =>
          crosswalk.candidateFacts.every((fact) =>
            rationale.coverageEvidence.some(
              (entry) =>
                entry.startsWith(
                  `${fact.candidateId} ${fact.coverageState} ${crosswalk.criterionId}:`,
                ) &&
                (crosswalk.bindingState === 'unbound' ||
                  (entry.includes(
                    `feature=${crosswalk.candidateFeatureDependencies.join(',')}`,
                  ) &&
                    entry.includes(`evidence=${fact.evidenceId ?? 'none'}`))),
            ),
          ),
        ),
      ),
    ).toBe(true);
  });

  it('reproduces corrected authored authority byte-identically', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const authored = authorCorrectedRankingAuthority(
      loaded.corpus.blind,
      loaded.corpus.evidence,
      loaded.corpus.handoff,
      loaded.corpus.audit,
    );
    expect(rankingStableJson(authored.blind)).toBe(
      rankingStableJson(loaded.corpus.blind),
    );
    expect(rankingStableJson(authored.gold)).toBe(
      rankingStableJson(loaded.corpus.gold),
    );
    expect(rankingStableJson(authored.rationale)).toBe(
      rankingStableJson(loaded.corpus.reviewerRationale),
    );
    expect(rankingStableJson(authored.review)).toBe(
      rankingStableJson(loaded.corpus.review),
    );

    const specifications = JSON.parse(
      readFileSync(
        join(REPOSITORY_ROOT, 'evals/ranking-v1/baselines/specifications.json'),
        'utf8',
      ),
    ) as RankingBaselineSpecificationAuthority;
    expect(
      rankingStableJson(authorCorrectedBaselineSpecifications(specifications)),
    ).toBe(rankingStableJson(specifications));
  });
});

function collectKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectKeys);
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, child]) => [
    key,
    ...collectKeys(child),
  ]);
}
