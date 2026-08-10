import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  createRankingAcceptedGateAuthority,
  createRankingAcceptedReviewRecord,
} from '../src/ranking/acceptance.ts';
import { loadRankingCorpus } from '../src/ranking/corpus.ts';
import { rankingStableJson } from '../src/ranking/stable-json.ts';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

describe('ranking-v1 Milestone 2 acceptance', () => {
  it('binds independent acceptance to the exact reviewed content', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    expect(loaded.manifest).toMatchObject({
      manifestVersion: 'ranking-v1-manifest/4.0.0',
      corpusVersion: '3.0.0',
      status: 'accepted',
      caseCount: 30,
    });
    expect(loaded.corpus.acceptedReview).toMatchObject({
      reviewRecordVersion: 'ranking-v1-accepted-review/1.0.0',
      status: 'accepted',
      author: 'Codex',
      reviewRole: 'independent-maintainer-review',
      reviewerIdentity: null,
      productRankingOutputObservedBeforeReview: false,
      candidateAuthorityM3OutputObservedBeforeReview: false,
      adjudication: 'accepted-as-authored-after-published-correction-sequence',
    });
    expect(loaded.corpus.acceptedReview.acceptedCaseIds).toHaveLength(30);
    expect(loaded.corpus.acceptedReview.disputedCaseIds).toEqual([]);
    expect(loaded.corpus.acceptedReview.bindings).toMatchObject({
      goldDigest:
        '48644422e325ecf385ae8fe3ef71a936549eab6ae0f1f75b98feaadc8640b081',
      coreAuthorityDigest:
        '061e4774c1ab5f9a3793aaa46dfd917597f0378fb882c80f30b15a6431fb225e',
      scorerVersion: 'ranking-v1-scorer/2.0.0',
      baselineSpecificationAuthorityDigest:
        '7b26826f7e85eef3c6bbd887a21f76a2bb4d2519e2997ddb7a11148e38823061',
      reviewerRationaleDigest:
        '3be6bd29185c67be39b6c09bd0976d47da09731824b1ca3199746594c19ea779',
    });
    expect(loaded.corpus.acceptedReview.reviewedContentFiles).toHaveLength(21);
    expect(loaded.corpus.gold.reviewStatus).toBe(
      'proposed-not-independently-reviewed',
    );
    expect(loaded.corpus.review.status).toBe('independent-review-pending');
    expect(rankingStableJson(loaded.corpus.acceptedReview)).toBe(
      rankingStableJson(createRankingAcceptedReviewRecord()),
    );
  });

  it('freezes every exact fixed-candidate quality gate', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const gate = loaded.corpus.acceptedGates.fixedCandidateQualityGate;

    expect(gate.safety.requiredValue).toBe(0);
    expect(gate.safety.metrics).toHaveLength(11);
    expect(gate.safety.rankingReferenceInvariants).toHaveLength(3);
    expect(gate.responsibleOutcome.overall).toEqual({ correct: 30, total: 30 });
    expect(gate.responsibleOutcome.byLabel).toEqual({
      recommend: { correct: 20, total: 20 },
      'no-viable-candidate': { correct: 5, total: 5 },
      'insufficient-evidence': { correct: 5, total: 5 },
    });
    expect(gate.candidateDispositions).toMatchObject({
      exactAssessments: { correct: 120, total: 120 },
      maximumOffDiagonalConfusion: 0,
      applicablePerDispositionPrecision: 1,
      applicablePerDispositionRecall: 1,
      applicablePerDispositionF1: 1,
    });
    expect(gate.controlledTargetPairs).toMatchObject({
      exactPairCorrect: { correct: 5, total: 5 },
      wrongMaximalSet: 0,
      wrongDirection: 0,
      unchangedWhenChangeRequired: 0,
      supersetRecommendationPasses: false,
    });
    expect(gate.partialOrder).toEqual({
      overall: { correct: 22, total: 22 },
      ordered: { correct: 16, total: 16 },
      ties: { correct: 4, total: 4 },
      incomparable: { correct: 2, total: 2 },
      falseOrdersOfIncomparable: 0,
    });
    expect(gate.topThreeUsefulness).toEqual({ correct: 20, total: 20 });
    expect(gate.evidenceNeededClosure).toEqual({
      overall: { correct: 35, total: 35 },
      satisfied: { correct: 15, total: 15 },
      conflict: { correct: 10, total: 10 },
      unresolved: { correct: 10, total: 10 },
      illegalPromotions: 0,
    });
    expect(gate.criterionBinding).toEqual({
      boundSuccessConditionCoverage: { correct: 208, total: 208 },
      materialUnboundFailClosed: { correct: 20, total: 20 },
      approvedNonMaterialUnbound: { correct: 12, total: 12 },
      boundPreferenceComparisonConsequence: { correct: 25, total: 25 },
      unboundPreferenceCounterfactualNonEffect: { correct: 5, total: 5 },
      noPreferenceHardening: { correct: 30, total: 30 },
    });
    expect(gate.traceability).toMatchObject({
      requiredEvidenceAssociations: { correct: 225, total: 225 },
      requiredReasonCodes: { correct: 120, total: 120 },
      requiredMaterialUnknowns: { correct: 30, total: 30 },
      requiredHardConflicts: { correct: 70, total: 70 },
      unsupportedExtraAssociations: 0,
    });
  });

  it('freezes readiness, baseline, composition, performance, and determinism', () => {
    const loaded = loadRankingCorpus(REPOSITORY_ROOT);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const gate = loaded.corpus.acceptedGates;

    expect(gate.deterministicReadiness).toMatchObject({
      denominatorAuthority: 'ranking-decision-denominator/1.0.0',
      denominatorSize: 18,
      minimumReadyFields: 13,
      exactPercentage: 72.222222,
      coverageObservedBeforeSelection: false,
    });
    expect(
      Object.values(gate.deterministicReadiness.breadthQualification.groups),
    ).toHaveLength(4);
    expect(
      Object.values(
        gate.deterministicReadiness.breadthQualification.groups,
      ).every((fields) => fields.length > 0),
    ).toBe(true);
    expect(gate.baselineReferenceFloor).toMatchObject({
      baselineId: 'weak-target-aware-exact-compatibility',
      baselineVersion: 'ranking-weak-target-aware-exact-compatibility/3.0.0',
      observedReference: {
        responsibleOutcome: { correct: 30, total: 30 },
        topThreeUsefulness: { correct: 20, total: 20 },
        safetyViolations: 0,
        controlledTargetPairs: { correct: 2, total: 5 },
        partialOrder: { correct: 6, total: 22 },
      },
    });
    expect(gate.compositionDiagnostic).toMatchObject({
      authorityScope: 'five-case-retrieval-to-ranking-handoff-diagnostic-only',
      temporaryInsufficientEvidenceOutcomesAreProductionTargets: false,
      fixedCandidateQualityGate: false,
    });
    expect(gate.performanceResourceGate).toMatchObject({
      maximumLegalEnvelope: {
        candidates: 20,
        candidateEvidenceObservations: 2000,
        rankingCriteria: 60,
        unorderedCandidatePairs: 190,
      },
      productionPureEngineBudgets: {
        parseValidationP95Milliseconds: 50,
        candidateEvidenceTraversalP95Milliseconds: 25,
        pairEnumerationP95Milliseconds: 10,
        canonicalizationP95Milliseconds: 75,
        combinedBoundedRankingWorkP95Milliseconds: 100,
        combinedMaximumMilliseconds: 250,
        retainedHeapGrowthMaximumMebibytes: 16,
        retainedHeapGrowthMaximumBytes: 16_777_216,
      },
    });
    expect(gate.determinismMechanicalGate).toMatchObject({
      repeatedIdenticalExecutions: 100,
      inputOrderPermutations: 20,
      freshProcessExecutions: 10,
      candidateIdMayDecideFit: false,
      candidateIdMayCanonicalizeAlreadyDerivedRelation: true,
      retrievalOrderOrScoreMayDecideFit: false,
    });
    expect(gate.milestoneAuthorization).toMatchObject({
      milestone2: 'accepted',
      milestone3: 'authorized-but-not-begun',
      milestone3WorkBeganInAcceptanceOperation: false,
    });
    expect(rankingStableJson(gate)).toBe(
      rankingStableJson(createRankingAcceptedGateAuthority()),
    );
    expect(existsSync(join(REPOSITORY_ROOT, 'packages/ranking'))).toBe(false);
  });
});
