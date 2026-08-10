import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

import type {
  RankingBaselineSpecificationAuthority,
  RankingMetricSet,
  RankingPredictionSet,
  RankingFamily,
  RankingResolvedCase,
  RankingScoreReport,
  RankingValidatedCorpus,
} from './contracts.ts';
import {
  RANKING_BASELINE_IDS,
  type RankingBaselinePredictionSets,
} from './baselines.ts';
import { loadRankingBlindInputSet } from './blind-input.ts';
import { loadRankingCorpus } from './corpus.ts';
import type { RankingPerformanceReference } from './performance.ts';
import { scoreRankingPredictionSet } from './scoring.ts';
import {
  compareRankingText,
  rankingDigest,
  rankingSemanticDigest,
  rankingStableJson,
  rankingValuesDiffer,
} from './stable-json.ts';

const PREDICTION_PATHS: Readonly<
  Record<keyof RankingBaselinePredictionSets, string>
> = {
  retrievalOrder: 'baselines/predictions/retrieval-order.json',
  allInsufficient: 'baselines/predictions/all-insufficient.json',
  targetBlind: 'baselines/predictions/target-blind.json',
  targetAware: 'baselines/predictions/target-aware.json',
  hardConflictControl: 'baselines/predictions/hard-conflict-control.json',
};

export interface RankingBaselineReport {
  readonly reportVersion: 'ranking-v1-baseline-report/3.0.0';
  readonly track: 'fixed-candidate-ranking';
  readonly corpusBinding: {
    readonly corpusId: 'ranking-v1';
    readonly corpusVersion: '3.0.0';
    readonly corpusSemanticDigest: string;
    readonly goldDigest: string;
    readonly reviewDigest: string;
    readonly reviewStatus: 'independent-review-pending';
  };
  readonly denominators: ReturnType<typeof createDenominators>;
  readonly ordinaryBaselines: readonly ContentFreeBaselineMeasurement[];
  readonly negativeControls: readonly ContentFreeBaselineMeasurement[];
  readonly strongestApplicableNonOracle: {
    readonly selectionProtocol: string;
    readonly overallBaselineId: string;
    readonly byFamily: Readonly<Record<string, string>>;
  };
  readonly scorerCeilings: {
    readonly applicableExactMetrics: 1;
    readonly applicableClassificationMetrics: 1;
    readonly zeroSafetyViolations: 0;
    readonly zeroDenominatorRepresentation: 'null-not-applicable';
  };
  readonly syntheticOracleExcludedFromFloor: true;
  readonly finalQualityThresholdSelected: false;
  readonly semanticDigest: string;
}

interface ContentFreeBaselineMeasurement {
  readonly baselineId: string;
  readonly baselineVersion: string;
  readonly specificationDigest: string;
  readonly predictionDigest: string;
  readonly scoreDigest: string;
  readonly safety: RankingScoreReport['safety'];
  readonly overall: RankingMetricSet;
  readonly perFamily: RankingScoreReport['perFamily'];
  readonly controlledPairs: RankingScoreReport['controlledPairs'];
}

export interface RankingGateReviewInputs {
  readonly authorityVersion: 'ranking-v1-gate-review-inputs/3.0.0';
  readonly status: 'proposed-independent-review-pending';
  readonly bindings: {
    readonly corpusDigest: string;
    readonly goldDigest: string;
    readonly reviewDigest: string;
    readonly baselineReportDigest: string;
    readonly performanceReferenceDigest: string;
    readonly scorerVersion: 'ranking-v1-scorer/2.0.0';
  };
  readonly qualityGateEvidence: {
    readonly strongestOverallBaselineId: string;
    readonly strongestByFamily: Readonly<Record<string, string>>;
    readonly denominators: RankingBaselineReport['denominators'];
    readonly ordinaryBaselineMeasurements: readonly ContentFreeBaselineMeasurement[];
    readonly scorerCeilings: RankingBaselineReport['scorerCeilings'];
    readonly finalThresholds: null;
    readonly finalThresholdsSelected: false;
  };
  readonly deterministicReadiness: {
    readonly denominator: 18;
    readonly currentReady: 0;
    readonly candidates: readonly [
      {
        readonly count: 13;
        readonly percentage: 72.222222;
        readonly tradeoff: string;
      },
      {
        readonly count: 14;
        readonly percentage: 77.777778;
        readonly tradeoff: string;
      },
    ];
    readonly selected: null;
    readonly selectedPolicyDigest: null;
    readonly selectionStatus: 'independent-review-required-before-m3';
    readonly preFreezeM3OutputAdmissible: false;
  };
  readonly performanceGateEvidence: {
    readonly referenceDigest: string;
    readonly finalBudgetSelected: false;
    readonly proposedMarginProtocol: string;
  };
  readonly semanticDigest: string;
}

export function createRankingBaselineReport(
  corpus: RankingValidatedCorpus,
  cases: readonly RankingResolvedCase[],
  manifestDigest: string,
  predictions: RankingBaselinePredictionSets,
): RankingBaselineReport {
  const score = (prediction: RankingPredictionSet): RankingScoreReport =>
    scoreRankingPredictionSet(corpus, cases, prediction);
  const scores: Record<
    keyof RankingBaselinePredictionSets,
    RankingScoreReport
  > = {
    retrievalOrder: score(predictions.retrievalOrder),
    allInsufficient: score(predictions.allInsufficient),
    targetBlind: score(predictions.targetBlind),
    targetAware: score(predictions.targetAware),
    hardConflictControl: score(predictions.hardConflictControl),
  };
  const measurements: Record<
    keyof RankingBaselinePredictionSets,
    ContentFreeBaselineMeasurement
  > = {
    retrievalOrder: measurement(
      predictions.retrievalOrder,
      scores.retrievalOrder,
    ),
    allInsufficient: measurement(
      predictions.allInsufficient,
      scores.allInsufficient,
    ),
    targetBlind: measurement(predictions.targetBlind, scores.targetBlind),
    targetAware: measurement(predictions.targetAware, scores.targetAware),
    hardConflictControl: measurement(
      predictions.hardConflictControl,
      scores.hardConflictControl,
    ),
  };
  const ordinary = [
    measurements.retrievalOrder,
    measurements.allInsufficient,
    measurements.targetBlind,
    measurements.targetAware,
  ];
  const selectionProtocol =
    'Choose the ordinary non-oracle baseline lexicographically by responsible-outcome accuracy, macro disposition F1, partial-order agreement, then top-three usefulness; never use a negative control or synthetic oracle.';
  const overallBaselineId = strongest(
    ordinary,
    (item) => item.overall,
  ).baselineId;
  const byFamily = Object.fromEntries(
    (Object.keys(measurements.targetAware.perFamily) as RankingFamily[])
      .sort(compareRankingText)
      .map((family) => [
        family,
        strongest(ordinary, (item) => item.perFamily[family]).baselineId,
      ]),
  );
  const withoutDigest = {
    reportVersion: 'ranking-v1-baseline-report/3.0.0' as const,
    track: 'fixed-candidate-ranking' as const,
    corpusBinding: {
      corpusId: 'ranking-v1' as const,
      corpusVersion: '3.0.0' as const,
      corpusSemanticDigest: manifestDigest,
      goldDigest: corpus.gold.semanticDigest,
      reviewDigest: corpus.review.semanticDigest,
      reviewStatus: 'independent-review-pending' as const,
    },
    denominators: createDenominators(corpus),
    ordinaryBaselines: ordinary,
    negativeControls: [measurements.hardConflictControl],
    strongestApplicableNonOracle: {
      selectionProtocol,
      overallBaselineId,
      byFamily,
    },
    scorerCeilings: {
      applicableExactMetrics: 1 as const,
      applicableClassificationMetrics: 1 as const,
      zeroSafetyViolations: 0 as const,
      zeroDenominatorRepresentation: 'null-not-applicable' as const,
    },
    syntheticOracleExcludedFromFloor: true as const,
    finalQualityThresholdSelected: false as const,
  };
  const report: RankingBaselineReport = {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
  auditContentFreeReport(report);
  return report;
}

export function rankingCoreAuthorityDigest(
  corpus: RankingValidatedCorpus,
): string {
  return rankingDigest({
    blind: corpus.blind.semanticDigest,
    evidence: corpus.evidence.semanticDigest,
    handoff: corpus.handoff.semanticDigest,
    gold: corpus.gold.semanticDigest,
    audit: corpus.audit.semanticDigest,
    reviewerRationale: corpus.reviewerRationale.semanticDigest,
    review: corpus.review.semanticDigest,
  });
}

export function createRankingGateReviewInputs(
  corpus: RankingValidatedCorpus,
  manifestDigest: string,
  report: RankingBaselineReport,
  performance: RankingPerformanceReference,
): RankingGateReviewInputs {
  const withoutDigest = {
    authorityVersion: 'ranking-v1-gate-review-inputs/3.0.0' as const,
    status: 'proposed-independent-review-pending' as const,
    bindings: {
      corpusDigest: manifestDigest,
      goldDigest: corpus.gold.semanticDigest,
      reviewDigest: corpus.review.semanticDigest,
      baselineReportDigest: report.semanticDigest,
      performanceReferenceDigest: performance.semanticDigest,
      scorerVersion: 'ranking-v1-scorer/2.0.0' as const,
    },
    qualityGateEvidence: {
      strongestOverallBaselineId:
        report.strongestApplicableNonOracle.overallBaselineId,
      strongestByFamily: report.strongestApplicableNonOracle.byFamily,
      denominators: report.denominators,
      ordinaryBaselineMeasurements: report.ordinaryBaselines,
      scorerCeilings: report.scorerCeilings,
      finalThresholds: null,
      finalThresholdsSelected: false as const,
    },
    deterministicReadiness: {
      denominator: 18 as const,
      currentReady: 0 as const,
      candidates: [
        {
          count: 13 as const,
          percentage: 72.222222 as const,
          tradeoff:
            '13/18 is the least integer inside the accepted 70–80% band and leaves greater tolerance for bounded deterministic unknowns, at the cost of one fewer decision-bearing field proven ready.',
        },
        {
          count: 14 as const,
          percentage: 77.777778 as const,
          tradeoff:
            '14/18 stays inside the accepted band and demands one additional decision-bearing field, increasing deterministic coverage before ranking while raising pre-M4 authority cost and schedule risk.',
        },
      ] as const,
      selected: null,
      selectedPolicyDigest: null,
      selectionStatus: 'independent-review-required-before-m3' as const,
      preFreezeM3OutputAdmissible: false as const,
    },
    performanceGateEvidence: {
      referenceDigest: performance.semanticDigest,
      finalBudgetSelected: false as const,
      proposedMarginProtocol: performance.marginProtocol.proposal,
    },
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

export function loadCommittedRankingPredictions(
  repositoryRoot: string,
): RankingBaselinePredictionSets {
  const root = join(repositoryRoot, 'evals/ranking-v1');
  return Object.fromEntries(
    Object.entries(PREDICTION_PATHS).map(([key, path]) => [
      key,
      readJson(root, path) as RankingPredictionSet,
    ]),
  ) as unknown as RankingBaselinePredictionSets;
}

export function validateRankingBaselineArtifacts(repositoryRoot: string): {
  readonly report: RankingBaselineReport;
  readonly predictions: RankingBaselinePredictionSets;
} {
  const loaded = loadRankingCorpus(repositoryRoot);
  if (!loaded.ok) throw new Error('Ranking corpus is invalid.');
  const blind = loadRankingBlindInputSet(repositoryRoot);
  validateSpecifications(blind.specifications);
  const predictions = loadCommittedRankingPredictions(repositoryRoot);
  validatePredictions(predictions, blind, loaded.cases);
  const report = createRankingBaselineReport(
    loaded.corpus,
    loaded.cases,
    rankingCoreAuthorityDigest(loaded.corpus),
    predictions,
  );
  return { report, predictions };
}

export function rankingPredictionPaths(): typeof PREDICTION_PATHS {
  return PREDICTION_PATHS;
}

function validatePredictions(
  predictions: RankingBaselinePredictionSets,
  blind: ReturnType<typeof loadRankingBlindInputSet>,
  cases: readonly RankingResolvedCase[],
): void {
  const specifications = new Map(
    blind.specifications.specifications.map((specification) => [
      specification.baselineId,
      specification,
    ]),
  );
  const expectedCaseIds = cases.map(({ binding }) => binding.caseId);
  for (const prediction of Object.values(
    predictions,
  ) as RankingPredictionSet[]) {
    const specification = specifications.get(prediction.baselineId);
    if (
      rankingValuesDiffer(
        prediction.predictionSetVersion,
        'ranking-v1-prediction-set/3.0.0',
      ) ||
      rankingValuesDiffer(prediction.corpusId, 'ranking-v1') ||
      rankingValuesDiffer(prediction.corpusVersion, '3.0.0') ||
      prediction.blindInputDigest !== blind.blindInputDigest ||
      prediction.semanticDigest !== rankingSemanticDigest(prediction) ||
      prediction.baselineVersion !== specification?.baselineVersion ||
      prediction.baselineSpecificationDigest !==
        specification.specificationDigest ||
      !sameOrderedValues(
        prediction.predictions.map(({ caseId }) => caseId),
        expectedCaseIds,
      )
    ) {
      throw new Error('Committed ranking baseline prediction is inconsistent.');
    }
  }
}

function validateSpecifications(
  authority: RankingBaselineSpecificationAuthority,
): void {
  if (
    rankingValuesDiffer(authority.frozenBeforeScoring, true) ||
    authority.semanticDigest !== rankingSemanticDigest(authority) ||
    authority.specifications.length !== 6 ||
    authority.omissions.length !== 1 ||
    authority.omissions[0]?.baseline !== 'popularity-health'
  ) {
    throw new Error('Ranking baseline specification authority is invalid.');
  }
  for (const specification of authority.specifications) {
    if (
      digestWithoutNamedField(specification, 'specificationDigest') !==
      specification.specificationDigest
    ) {
      throw new Error('Ranking baseline specification digest drifted.');
    }
  }
}

function digestWithoutNamedField(value: object, field: string): string {
  const { [field]: _removed, ...semantic } = value as Record<string, unknown>;
  void _removed;
  return createDigest(semantic);
}

function createDigest(value: unknown): string {
  return createHash('sha256').update(rankingStableJson(value)).digest('hex');
}

function createDenominators(corpus: RankingValidatedCorpus) {
  const ties = corpus.gold.cases.reduce(
    (sum, gold) =>
      sum +
      gold.rankGroups.reduce(
        (groupSum, group) => groupSum + (group.length * (group.length - 1)) / 2,
        0,
      ),
    0,
  );
  const evidenceNeededByState = {
    satisfied: 0,
    conflict: 0,
    unresolved: 0,
  };
  for (const resolution of corpus.gold.cases.flatMap(
    ({ evidenceNeededResolutions }) => evidenceNeededResolutions,
  )) {
    evidenceNeededByState[resolution.resolution] += 1;
  }
  return {
    cases: 30,
    perFamilyCases: 6,
    controlledPairs: corpus.gold.controlledPairDirections.length,
    hardConflictOpportunities: corpus.gold.cases.reduce(
      (sum, item) => sum + item.hardConstraintConflicts.length,
      0,
    ),
    noViableCases: corpus.gold.cases.filter(
      ({ outcome }) => outcome === 'no-viable-candidate',
    ).length,
    insufficientEvidenceCases: corpus.gold.cases.filter(
      ({ outcome }) => outcome === 'insufficient-evidence',
    ).length,
    tiePairs: ties,
    incomparablePairs: corpus.gold.cases.reduce(
      (sum, item) => sum + item.incomparablePairs.length,
      0,
    ),
    evidenceNeededTransitions:
      evidenceNeededByState.satisfied +
      evidenceNeededByState.conflict +
      evidenceNeededByState.unresolved,
    evidenceNeededByState,
  } as const;
}

function measurement(
  prediction: RankingPredictionSet,
  score: RankingScoreReport,
): ContentFreeBaselineMeasurement {
  return {
    baselineId: prediction.baselineId,
    baselineVersion: prediction.baselineVersion,
    specificationDigest: prediction.baselineSpecificationDigest,
    predictionDigest: prediction.semanticDigest,
    scoreDigest: score.semanticDigest,
    safety: score.safety,
    overall: score.overall,
    perFamily: score.perFamily,
    controlledPairs: score.controlledPairs,
  };
}

function strongest(
  measurements: readonly ContentFreeBaselineMeasurement[],
  metrics: (measurement: ContentFreeBaselineMeasurement) => RankingMetricSet,
): ContentFreeBaselineMeasurement {
  const [first] = [...measurements].sort((left, right) => {
    const leftMetrics = metrics(left);
    const rightMetrics = metrics(right);
    return (
      numeric(rightMetrics.outcome.overall.value) -
        numeric(leftMetrics.outcome.overall.value) ||
      numeric(rightMetrics.macroDisposition.f1) -
        numeric(leftMetrics.macroDisposition.f1) ||
      numeric(rightMetrics.partialOrder.overall.value) -
        numeric(leftMetrics.partialOrder.overall.value) ||
      numeric(rightMetrics.topThreeUsefulness.value) -
        numeric(leftMetrics.topThreeUsefulness.value) ||
      compareRankingText(left.baselineId, right.baselineId)
    );
  });
  if (first === undefined) {
    throw new Error('Ranking baseline selection requires a measurement.');
  }
  return first;
}

function numeric(value: number | null): number {
  return value ?? -1;
}

function auditContentFreeReport(report: RankingBaselineReport): void {
  const forbiddenKeys = new Set([
    'candidateId',
    'caseId',
    'evidenceIds',
    'goldWinner',
    'rationale',
    'recommendations',
    'sourceUrl',
    'winner',
  ]);
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) return;
    for (const [key, child] of Object.entries(value)) {
      if (forbiddenKeys.has(key)) {
        throw new Error('Ranking baseline report contains case-level content.');
      }
      visit(child);
    }
  };
  visit(report);
}

function readJson(root: string, relativePath: string): unknown {
  const rootReal = realpathSync(root);
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${rootReal}${sep}`)) throw new Error('Path escape.');
  const status = lstatSync(path);
  if (
    !status.isFile() ||
    status.isSymbolicLink() ||
    status.size > 16 * 1024 * 1024
  )
    throw new Error('Unsafe ranking report artifact.');
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

function sameOrderedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function baselineIdInventory(): readonly string[] {
  return Object.values(RANKING_BASELINE_IDS).sort(compareRankingText);
}
