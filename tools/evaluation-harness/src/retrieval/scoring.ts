import type {
  HardFilterStateMetrics,
  MetricValue,
  NormalizationCasePrediction,
  NormalizationCaseScore,
  RetrievalCaseBundle,
  RetrievalCasePrediction,
  RetrievalCaseScore,
  RetrievalFamilyScore,
  RetrievalFixtureScore,
  RetrievalPredictionSet,
  RetrievalScoreReport,
  RetrievalScoringFixture,
  ValidatedRetrievalCorpus,
} from './contracts.ts';
import { RETRIEVAL_FAMILIES, RETRIEVAL_VERSIONS } from './contracts.ts';
import { retrievalSemanticDigest, retrievalStableJson } from './stable-json.ts';

const ROUNDING_DIGITS = 6;

export function metric(numerator: number, denominator: number): MetricValue {
  if (denominator === 0) {
    return {
      numerator: round(numerator),
      denominator: 0,
      value: null,
      status: 'not-applicable',
    };
  }
  return {
    numerator: round(numerator),
    denominator: round(denominator),
    value: round(numerator / denominator),
    status: 'applicable',
  };
}

export function summarizeMetrics(values: readonly MetricValue[]): MetricValue {
  const applicable = values.filter((value) => value.value !== null);
  return metric(
    applicable.reduce((sum, value) => sum + (value.value ?? 0), 0),
    applicable.length,
  );
}

export function scoreRetrievalFixture(
  fixture: RetrievalScoringFixture,
): RetrievalFixtureScore {
  const eligibleRelevant = fixture.judgments
    .filter((judgment) => judgment.eligible && judgment.grade > 0)
    .sort(
      (left, right) =>
        right.grade - left.grade ||
        compareText(left.candidateId, right.candidateId),
    );
  const gradeByCandidate = new Map(
    eligibleRelevant.map((judgment) => [judgment.candidateId, judgment.grade]),
  );
  const top10 = fixture.results.slice(0, 10);
  const uniqueResults = uniqueOccurrences(top10);
  const hitIds = new Set(
    uniqueResults
      .filter((result) => gradeByCandidate.has(result.candidateId))
      .map(({ candidateId }) => candidateId),
  );
  const firstRelevantRank = top10.findIndex((result) =>
    gradeByCandidate.has(result.candidateId),
  );
  const recallAt10 = metric(hitIds.size, eligibleRelevant.length);
  const meanReciprocalRank =
    eligibleRelevant.length === 0
      ? metric(0, 0)
      : metric(firstRelevantRank < 0 ? 0 : 1 / (firstRelevantRank + 1), 1);
  const seenDcg = new Set<string>();
  const dcg = top10.reduce((total, result, index) => {
    if (seenDcg.has(result.candidateId)) return total;
    seenDcg.add(result.candidateId);
    const grade = gradeByCandidate.get(result.candidateId) ?? 0;
    return total + (2 ** grade - 1) / Math.log2(index + 2);
  }, 0);
  const idcg = eligibleRelevant
    .slice(0, 10)
    .reduce(
      (total, judgment, index) =>
        total + (2 ** judgment.grade - 1) / Math.log2(index + 2),
      0,
    );
  const exactDuplicateCount =
    fixture.results.length - uniqueOccurrences(fixture.results).length;
  const groupByCandidate = new Map<string, number>();
  fixture.equivalenceGroups.forEach((group, index) => {
    group.forEach((candidateId) => groupByCandidate.set(candidateId, index));
  });
  const seenGroups = new Set<number>();
  let equivalenceDuplicates = 0;
  for (const result of fixture.results) {
    const group = groupByCandidate.get(result.candidateId);
    if (group === undefined) continue;
    if (seenGroups.has(group)) equivalenceDuplicates += 1;
    seenGroups.add(group);
  }
  const generatedByCandidate = new Map(
    fixture.generatedDecisions.map((decision) => [
      decision.candidateId,
      decision,
    ]),
  );
  const predictedByCandidate = new Map(
    fixture.predictedDecisions.map((decision) => [
      decision.candidateId,
      decision,
    ]),
  );
  let hardCorrect = 0;
  for (const generated of fixture.generatedDecisions) {
    if (
      predictedByCandidate.get(generated.candidateId)?.hardState ===
      generated.hardState
    ) {
      hardCorrect += 1;
    }
  }
  const violationCandidates = new Set<string>();
  let conflict = 0;
  let negativeControl = 0;
  let laneError = 0;
  for (const result of fixture.results.slice(0, 10)) {
    if (violationCandidates.has(result.candidateId)) continue;
    violationCandidates.add(result.candidateId);
    const generated = generatedByCandidate.get(result.candidateId);
    if (generated === undefined) continue;
    if (generated.hardState === 'conflict') conflict += 1;
    if (generated.negativeControl) negativeControl += 1;
    if (result.claimedLane !== generated.lane) laneError += 1;
  }
  return {
    recallAt10,
    meanReciprocalRank,
    ndcgAt10: metric(dcg, idcg),
    exactDuplicateRate: metric(exactDuplicateCount, fixture.results.length),
    equivalenceDuplicateRate: metric(
      equivalenceDuplicates,
      fixture.results.length,
    ),
    hardFilterAccuracy: metric(hardCorrect, fixture.generatedDecisions.length),
    noEligibleCandidateAccuracy: metric(
      fixture.predictedNoEligibleCandidate ===
        fixture.expectedNoEligibleCandidate
        ? 1
        : 0,
      1,
    ),
    top10Violations: { conflict, negativeControl, laneError },
  };
}

export function scoreRetrievalPredictionSet(
  corpus: ValidatedRetrievalCorpus,
  predictionSet: RetrievalPredictionSet,
): RetrievalScoreReport {
  const predictions = new Map(
    predictionSet.predictions.map((prediction) => [
      prediction.caseId,
      prediction,
    ]),
  );
  const equivalenceGroups = corpus.equivalence.groups.map(
    ({ candidateIds }) => candidateIds,
  );
  const perCase: (NormalizationCaseScore | RetrievalCaseScore)[] = [];
  for (const bundle of corpus.normalizationCases) {
    const prediction = predictions.get(bundle.query.caseId) as
      NormalizationCasePrediction | undefined;
    if (prediction === undefined)
      throw new Error('Validated prediction case is missing.');
    perCase.push(scoreNormalizationCase(bundle, prediction));
  }
  for (const bundle of corpus.retrievalCases) {
    const prediction = predictions.get(bundle.query.caseId) as
      RetrievalCasePrediction | undefined;
    if (prediction === undefined)
      throw new Error('Validated prediction case is missing.');
    perCase.push(scoreRetrievalCase(bundle, prediction, equivalenceGroups));
  }
  perCase.sort((left, right) => compareText(left.caseId, right.caseId));
  const perFamily = RETRIEVAL_FAMILIES.map((family) =>
    scoreFamily(family, perCase),
  );
  const retrievalScores = perCase.filter(isRetrievalScore);
  const normalizationScores = perCase.filter(
    ({ caseKind }) => caseKind === 'normalization-adversarial',
  );
  const macro = {
    recallAt10: summarizeMetrics(
      retrievalScores.map(({ recallAt10 }) => recallAt10),
    ),
    meanReciprocalRank: summarizeMetrics(
      retrievalScores.map(({ meanReciprocalRank }) => meanReciprocalRank),
    ),
    ndcgAt10: summarizeMetrics(retrievalScores.map(({ ndcgAt10 }) => ndcgAt10)),
    clarificationAccuracy: summarizeMetrics(
      normalizationScores.map(
        ({ clarificationAccuracy }) => clarificationAccuracy,
      ),
    ),
    aliasExpansionCorrectness: summarizeMetrics(
      perCase.map(({ aliasExpansionCorrectness }) => aliasExpansionCorrectness),
    ),
    prohibitedConstraintPreservation: summarizeMetrics(
      perCase.map(
        ({ prohibitedConstraintPreservation }) =>
          prohibitedConstraintPreservation,
      ),
    ),
    hardFilterAccuracy: summarizeMetrics(
      retrievalScores.map(({ hardFilter }) => hardFilter.accuracy),
    ),
    noEligibleCandidateAccuracy: summarizeMetrics(
      retrievalScores.map(
        ({ noEligibleCandidateAccuracy }) => noEligibleCandidateAccuracy,
      ),
    ),
  };
  const micro = {
    recallAt10: combineCounts(
      retrievalScores.map(({ recallAt10 }) => recallAt10),
    ),
    exactDuplicateRate: combineCounts(
      retrievalScores.map(({ exactDuplicateRate }) => exactDuplicateRate),
    ),
    equivalenceDuplicateRate: combineCounts(
      retrievalScores.map(
        ({ equivalenceDuplicateRate }) => equivalenceDuplicateRate,
      ),
    ),
    hardFilterAccuracy: combineCounts(
      retrievalScores.map(({ hardFilter }) => hardFilter.accuracy),
    ),
    noEligibleCandidateAccuracy: combineCounts(
      retrievalScores.map(
        ({ noEligibleCandidateAccuracy }) => noEligibleCandidateAccuracy,
      ),
    ),
    clarificationAccuracy: combineCounts(
      normalizationScores.map(
        ({ clarificationAccuracy }) => clarificationAccuracy,
      ),
    ),
    aliasExpansionCorrectness: combineCounts(
      perCase.map(({ aliasExpansionCorrectness }) => aliasExpansionCorrectness),
    ),
    prohibitedConstraintPreservation: combineCounts(
      perCase.map(
        ({ prohibitedConstraintPreservation }) =>
          prohibitedConstraintPreservation,
      ),
    ),
  };
  const familyCoverage = metric(
    perFamily.filter(
      ({ positiveCaseHitRate }) =>
        positiveCaseHitRate.denominator > 0 &&
        positiveCaseHitRate.numerator > 0,
    ).length,
    5,
  );
  const safetyViolations = retrievalScores.reduce(
    (total, score) => ({
      conflict: total.conflict + score.top10Violations.conflict,
      negativeControl:
        total.negativeControl + score.top10Violations.negativeControl,
      laneError: total.laneError + score.top10Violations.laneError,
    }),
    { conflict: 0, negativeControl: 0, laneError: 0 },
  );
  const withoutDigest = {
    scoreReportVersion: RETRIEVAL_VERSIONS.scoreReport,
    corpusId: corpus.manifest.corpusId,
    corpusVersion: corpus.manifest.corpusVersion,
    corpusSemanticDigest: corpus.manifest.corpusSemanticDigest,
    scorerVersion: RETRIEVAL_VERSIONS.scorer,
    predictionSetId: predictionSet.predictionSetId,
    predictionSetDigest: predictionSet.semanticDigest,
    authorityBindings: {
      taxonomyVersion: corpus.manifest.taxonomyVersion,
      taxonomyDigest: corpus.manifest.taxonomyDigest,
      catalogVersion: corpus.manifest.catalogVersion,
      catalogDigest: corpus.manifest.catalogDigest,
      profileAuthorityVersion: corpus.manifest.profileAuthorityVersion,
      profileAuthorityDigest: corpus.manifest.profileAuthorityDigest,
      equivalenceVersion: corpus.equivalence.equivalenceVersion,
    },
    caseCounts: corpus.manifest.caseCounts,
    perCase,
    perFamily,
    macro,
    micro,
    familyCoverage,
    safetyViolations,
  } satisfies Omit<RetrievalScoreReport, 'semanticDigest'>;
  return {
    ...withoutDigest,
    semanticDigest: retrievalSemanticDigest(withoutDigest),
  };
}

function scoreNormalizationCase(
  bundle: ValidatedRetrievalCorpus['normalizationCases'][number],
  prediction: NormalizationCasePrediction,
): NormalizationCaseScore {
  return {
    caseId: bundle.query.caseId,
    caseKind: 'normalization-adversarial',
    family: bundle.query.capabilityFamily,
    clarificationAccuracy: scoreClarificationAccuracy(
      bundle.normalizationGold.expected.outcome,
      bundle.clarificationGold.clarifications,
      prediction.normalization,
    ),
    aliasExpansionCorrectness: scoreAlias(bundle, prediction.normalization),
    prohibitedConstraintPreservation: scoreProhibited(
      bundle.query,
      bundle.normalizationGold.expected.normalizedConstraints,
      prediction.normalization.normalizedConstraints,
    ),
  };
}

function scoreRetrievalCase(
  bundle: RetrievalCaseBundle,
  prediction: RetrievalCasePrediction,
  equivalenceGroups: readonly (readonly string[])[],
): RetrievalCaseScore {
  const generatedById = new Map(
    bundle.generatedProjection.decisions.map((decision) => [
      decision.candidateId,
      decision,
    ]),
  );
  const relevanceById = new Map(
    bundle.relevanceGold.judgments.map((judgment) => [
      judgment.candidateId,
      judgment,
    ]),
  );
  const fixture = scoreRetrievalFixture({
    family: bundle.query.capabilityFamily,
    judgments: bundle.relevanceGold.judgments.map((judgment) => ({
      candidateId: judgment.candidateId,
      grade: judgment.grade,
      eligible: generatedById.get(judgment.candidateId)?.lane === 'eligible',
    })),
    results: prediction.results,
    equivalenceGroups,
    generatedDecisions: bundle.generatedProjection.decisions,
    predictedDecisions: prediction.candidateDecisions,
    expectedNoEligibleCandidate:
      bundle.noResultGold.expectedOutcome === 'no-eligible-candidate',
    predictedNoEligibleCandidate: prediction.noEligibleCandidate,
  });
  const eligibleRelevantHit =
    fixture.recallAt10.denominator === 0
      ? null
      : prediction.results.slice(0, 10).some(({ candidateId }) => {
          const relevance = relevanceById.get(candidateId);
          return (
            relevance !== undefined &&
            relevance.grade > 0 &&
            generatedById.get(candidateId)?.lane === 'eligible'
          );
        });
  return {
    caseId: bundle.query.caseId,
    caseKind: 'retrieval',
    family: bundle.query.capabilityFamily,
    clarificationAccuracy: metric(0, 0),
    aliasExpansionCorrectness: scoreAlias(bundle, prediction.normalization),
    prohibitedConstraintPreservation: scoreProhibited(
      bundle.query,
      bundle.normalizationGold.expected.normalizedConstraints,
      prediction.normalization.normalizedConstraints,
    ),
    recallAt10: fixture.recallAt10,
    meanReciprocalRank: fixture.meanReciprocalRank,
    ndcgAt10: fixture.ndcgAt10,
    exactDuplicateRate: fixture.exactDuplicateRate,
    equivalenceDuplicateRate: fixture.equivalenceDuplicateRate,
    hardFilter: hardFilterMetrics(
      bundle.generatedProjection.decisions,
      prediction.candidateDecisions,
    ),
    noEligibleCandidateAccuracy: fixture.noEligibleCandidateAccuracy,
    eligibleRelevantHit,
    top10Violations: fixture.top10Violations,
  };
}

function scoreAlias(
  bundle:
    | ValidatedRetrievalCorpus['normalizationCases'][number]
    | ValidatedRetrievalCorpus['retrievalCases'][number],
  prediction: NormalizationCasePrediction['normalization'],
): MetricValue {
  return scoreAliasExpansionCorrectness(
    bundle.query.tags.includes('alias-evaluation'),
    bundle.normalizationGold.expected.normalizedConcepts,
    prediction.normalizedConcepts,
  );
}

export function scoreProhibited(
  query: RetrievalCaseBundle['query'],
  expected: RetrievalCaseBundle['normalizationGold']['expected']['normalizedConstraints'],
  predicted: RetrievalCasePrediction['normalization']['normalizedConstraints'],
): MetricValue {
  const sourceIds = query.queryInput.draftConstraints
    .filter(({ modality }) => modality === 'prohibited')
    .map(({ constraintId }) => constraintId);
  let preserved = 0;
  for (const sourceId of sourceIds) {
    const gold = expected.find(({ sourceConstraintIds }) =>
      sourceConstraintIds.includes(sourceId),
    );
    const candidate = predicted.find(({ sourceConstraintIds }) =>
      sourceConstraintIds.includes(sourceId),
    );
    if (
      gold !== undefined &&
      candidate?.modality === 'prohibited' &&
      candidate.conceptId === gold.conceptId &&
      candidate.resolutionBasis === gold.resolutionBasis
    )
      preserved += 1;
  }
  return metric(preserved, sourceIds.length);
}

export function scoreClarificationAccuracy(
  expectedOutcome: NormalizationCasePrediction['normalization']['outcome'],
  expectedClarifications: NormalizationCasePrediction['normalization']['clarifications'],
  prediction: NormalizationCasePrediction['normalization'],
): MetricValue {
  return metric(
    prediction.outcome === expectedOutcome &&
      retrievalStableJson(prediction.clarifications) ===
        retrievalStableJson(expectedClarifications)
      ? 1
      : 0,
    1,
  );
}

export function scoreAliasExpansionCorrectness(
  applicable: boolean,
  expected: NormalizationCasePrediction['normalization']['normalizedConcepts'],
  predicted: NormalizationCasePrediction['normalization']['normalizedConcepts'],
): MetricValue {
  if (!applicable) return metric(0, 0);
  return metric(
    retrievalStableJson(predicted) === retrievalStableJson(expected) ? 1 : 0,
    1,
  );
}

export function hardFilterMetrics(
  generated: RetrievalScoringFixture['generatedDecisions'],
  predicted: RetrievalScoringFixture['predictedDecisions'],
): HardFilterStateMetrics {
  const predictedById = new Map(
    predicted.map((value) => [value.candidateId, value]),
  );
  const states = ['conflict', 'satisfied', 'unresolved'] as const;
  const correct = generated.filter(
    (actual) =>
      predictedById.get(actual.candidateId)?.hardState === actual.hardState,
  ).length;
  return {
    accuracy: metric(correct, generated.length),
    perState: Object.fromEntries(
      states.map((state) => {
        const actual = generated.filter(
          ({ hardState }) => hardState === state,
        ).length;
        const predictedCount = predicted.filter(
          ({ hardState }) => hardState === state,
        ).length;
        const truePositive = generated.filter(
          (decision) =>
            decision.hardState === state &&
            predictedById.get(decision.candidateId)?.hardState === state,
        ).length;
        return [
          state,
          {
            precision: metric(truePositive, predictedCount),
            recall: metric(truePositive, actual),
          },
        ];
      }),
    ) as unknown as HardFilterStateMetrics['perState'],
  };
}

function scoreFamily(
  family: (typeof RETRIEVAL_FAMILIES)[number],
  cases: readonly (NormalizationCaseScore | RetrievalCaseScore)[],
): RetrievalFamilyScore {
  const familyCases = cases.filter((value) => value.family === family);
  const retrieval = familyCases.filter(isRetrievalScore);
  const positive = retrieval.filter(
    ({ eligibleRelevantHit }) => eligibleRelevantHit !== null,
  );
  return {
    family,
    retrievalCases: retrieval.length,
    positiveCases: positive.length,
    positiveCaseHitRate: metric(
      positive.filter(({ eligibleRelevantHit }) => eligibleRelevantHit === true)
        .length,
      positive.length,
    ),
    hardFilterAccuracy: combineCounts(
      retrieval.map(({ hardFilter }) => hardFilter.accuracy),
    ),
    clarificationAccuracy: combineCounts(
      familyCases.map(({ clarificationAccuracy }) => clarificationAccuracy),
    ),
    aliasExpansionCorrectness: combineCounts(
      familyCases.map(
        ({ aliasExpansionCorrectness }) => aliasExpansionCorrectness,
      ),
    ),
    prohibitedConstraintPreservation: combineCounts(
      familyCases.map(
        ({ prohibitedConstraintPreservation }) =>
          prohibitedConstraintPreservation,
      ),
    ),
  };
}

function combineCounts(values: readonly MetricValue[]): MetricValue {
  return metric(
    values.reduce((sum, value) => sum + value.numerator, 0),
    values.reduce((sum, value) => sum + value.denominator, 0),
  );
}

function isRetrievalScore(
  value: NormalizationCaseScore | RetrievalCaseScore,
): value is RetrievalCaseScore {
  return value.caseKind === 'retrieval';
}

function uniqueOccurrences<Occurrence extends { readonly candidateId: string }>(
  occurrences: readonly Occurrence[],
): Occurrence[] {
  const seen = new Set<string>();
  return occurrences.filter((occurrence) => {
    if (seen.has(occurrence.candidateId)) return false;
    seen.add(occurrence.candidateId);
    return true;
  });
}

function round(value: number): number {
  return Number(value.toFixed(ROUNDING_DIGITS));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
