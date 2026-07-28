import type {
  CaseBundle,
  CandidateDisposition,
  DispositionLabel,
  EvaluationCase,
  GoldResult,
  LabelMetric,
  MetricSet,
  Outcome,
  Prediction,
  SafetyReport,
  ScoreReport,
} from './contracts.ts';

const LABELS: readonly DispositionLabel[] = [
  'recommended',
  'viable',
  'rejected',
  'insufficient-evidence',
];
const OUTCOMES: readonly Outcome[] = [
  'recommend',
  'no-viable-candidate',
  'insufficient-evidence',
];

interface ScoreAccumulator {
  caseCount: number;
  dispositionCounts: Record<
    DispositionLabel,
    { truePositive: number; falsePositive: number; falseNegative: number }
  >;
  rankingCorrect: number;
  rankingTotal: number;
  outcomeCorrect: number;
  outcomeTotal: number;
  outcomeCorrectByLabel: Record<Outcome, number>;
  outcomeTotalByLabel: Record<Outcome, number>;
  unknownRecovered: number;
  unknownRequired: number;
  evidenceRecovered: number;
  evidenceRequired: number;
  reasonRecovered: number;
  reasonRequired: number;
}

export interface SingleCaseScore {
  readonly safety: SafetyReport;
  readonly metrics: MetricSet;
}

export function scoreSingleCase(
  caseDocument: EvaluationCase,
  gold: GoldResult,
  prediction: Prediction,
): SingleCaseScore {
  const accumulator = createAccumulator();
  accumulateCase(accumulator, caseDocument, gold, prediction);
  return {
    safety: scoreSafety([{ caseDocument, gold }], [prediction]),
    metrics: finalizeMetrics(accumulator),
  };
}

export function scoreCorpus(
  corpusId: string,
  predictionSetId: string,
  bundles: readonly CaseBundle[],
  predictions: readonly Prediction[],
): ScoreReport {
  const predictionsByCase = new Map(
    predictions.map((prediction) => [prediction.caseId, prediction]),
  );
  const aggregate = scoreBundleSet(bundles, predictionsByCase);
  const byFamily: ScoreReport['byFamily'] = {};
  for (const family of [
    'authorization',
    'audit-logging',
    'background-jobs',
    'rate-limiting',
    'webhooks',
  ] as const) {
    const familyBundles = bundles.filter(
      (bundle) => bundle.caseDocument.capabilityFamily === family,
    );
    if (familyBundles.length > 0) {
      byFamily[family] = scoreBundleSet(familyBundles, predictionsByCase);
    }
  }

  const failureModes = [
    ...new Set(bundles.flatMap((bundle) => bundle.caseDocument.failureModes)),
  ].sort(compareText);
  const byFailureMode: ScoreReport['byFailureMode'] = {};
  for (const failureMode of failureModes) {
    byFailureMode[failureMode] = scoreBundleSet(
      bundles.filter((bundle) =>
        bundle.caseDocument.failureModes.includes(failureMode),
      ),
      predictionsByCase,
    );
  }

  return {
    schemaVersion: '1.0.0',
    corpusId,
    predictionSetId,
    caseCount: bundles.length,
    safety: scoreSafety(bundles, predictions),
    aggregate,
    byFamily,
    byFailureMode,
  };
}

function scoreBundleSet(
  bundles: readonly CaseBundle[],
  predictionsByCase: ReadonlyMap<string, Prediction>,
): MetricSet {
  const accumulator = createAccumulator();
  for (const bundle of bundles) {
    const prediction = predictionsByCase.get(bundle.caseDocument.caseId);
    if (prediction === undefined) {
      throw new Error(
        `Prediction set omits case ${bundle.caseDocument.caseId}.`,
      );
    }
    accumulateCase(accumulator, bundle.caseDocument, bundle.gold, prediction);
  }
  return finalizeMetrics(accumulator);
}

function accumulateCase(
  accumulator: ScoreAccumulator,
  caseDocument: EvaluationCase,
  gold: GoldResult,
  prediction: Prediction,
): void {
  accumulator.caseCount += 1;
  const goldByCandidate = new Map(
    gold.dispositions.map((disposition) => [
      disposition.candidateId,
      disposition.disposition,
    ]),
  );
  const predictionByCandidate = new Map(
    prediction.candidates.map((disposition) => [
      disposition.candidateId,
      disposition.disposition,
    ]),
  );
  for (const candidate of caseDocument.candidates) {
    const goldLabel = goldByCandidate.get(candidate.candidateId);
    const predictedLabel = predictionByCandidate.get(candidate.candidateId);
    for (const label of LABELS) {
      const counts = accumulator.dispositionCounts[label];
      if (goldLabel === label && predictedLabel === label) {
        counts.truePositive += 1;
      } else {
        if (predictedLabel === label) {
          counts.falsePositive += 1;
        }
        if (goldLabel === label) {
          counts.falseNegative += 1;
        }
      }
    }
  }

  const ranking = rankingCounts(gold, prediction);
  accumulator.rankingCorrect += ranking.correct;
  accumulator.rankingTotal += ranking.total;

  const allowedOutcomes = new Set([
    gold.outcome,
    ...gold.allowedAlternativeOutcomes,
  ]);
  const outcomeCorrect = allowedOutcomes.has(prediction.outcome);
  accumulator.outcomeTotal += 1;
  accumulator.outcomeTotalByLabel[gold.outcome] += 1;
  if (outcomeCorrect) {
    accumulator.outcomeCorrect += 1;
    accumulator.outcomeCorrectByLabel[gold.outcome] += 1;
  }

  const disclosedUnknowns = new Set(prediction.disclosedUnknownIds);
  accumulateRecall(
    accumulator,
    'unknown',
    gold.requiredUnknownIds,
    disclosedUnknowns,
  );
  const predictedEvidence = new Set(
    prediction.candidates.flatMap((candidate) => candidate.evidenceIds),
  );
  accumulateRecall(
    accumulator,
    'evidence',
    gold.requiredEvidenceIds,
    predictedEvidence,
  );
  const predictedReasons = new Set(
    prediction.candidates.flatMap((candidate) => candidate.reasonCodes),
  );
  accumulateRecall(
    accumulator,
    'reason',
    gold.requiredReasonCodes,
    predictedReasons,
  );
}

function accumulateRecall(
  accumulator: ScoreAccumulator,
  category: 'unknown' | 'evidence' | 'reason',
  requiredValues: readonly string[],
  predictedValues: ReadonlySet<string>,
): void {
  const requiredKey = `${category}Required` as const;
  const recoveredKey = `${category}Recovered` as const;
  if (requiredValues.length === 0) {
    accumulator[requiredKey] += 1;
    accumulator[recoveredKey] += 1;
    return;
  }
  accumulator[requiredKey] += requiredValues.length;
  accumulator[recoveredKey] += requiredValues.filter((value) =>
    predictedValues.has(value),
  ).length;
}

function rankingCounts(
  gold: GoldResult,
  prediction: Prediction,
): { readonly correct: number; readonly total: number } {
  const incomparable = new Set(
    gold.incomparablePairs.map(([left, right]) =>
      pairKey(left ?? '', right ?? ''),
    ),
  );
  const goldRelations = pairRelations(
    gold.dispositions,
    gold.rankGroups,
    gold.rankRelations,
  );
  const predictedRelations = pairRelations(
    prediction.candidates,
    prediction.rankGroups,
    prediction.rankRelations,
  );
  for (const pair of incomparable) {
    goldRelations.delete(pair);
    predictedRelations.delete(pair);
  }
  if (goldRelations.size === 0) {
    return { correct: predictedRelations.size === 0 ? 1 : 0, total: 1 };
  }
  let correct = 0;
  for (const [pair, relation] of goldRelations) {
    if (predictedRelations.get(pair) === relation) {
      correct += 1;
    }
  }
  return { correct, total: goldRelations.size };
}

function pairRelations(
  dispositions: readonly CandidateDisposition[],
  rankGroups: readonly (readonly string[])[],
  explicitRelations: readonly {
    readonly higherCandidateId: string;
    readonly lowerCandidateId: string;
  }[],
): Map<string, 'left-higher' | 'right-higher' | 'tie'> {
  const viable = dispositions
    .filter(
      (disposition) =>
        disposition.disposition === 'recommended' ||
        disposition.disposition === 'viable',
    )
    .map((disposition) => disposition.candidateId);
  const adjacency = new Map<string, Set<string>>(
    viable.map((candidateId) => [candidateId, new Set()]),
  );
  const ties = new Set<string>();
  for (let index = 0; index < rankGroups.length; index += 1) {
    const group = rankGroups[index] ?? [];
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < group.length;
        rightIndex += 1
      ) {
        ties.add(pairKey(group[leftIndex] ?? '', group[rightIndex] ?? ''));
      }
    }
    for (
      let lowerIndex = index + 1;
      lowerIndex < rankGroups.length;
      lowerIndex += 1
    ) {
      for (const higher of group) {
        for (const lower of rankGroups[lowerIndex] ?? []) {
          adjacency.get(higher)?.add(lower);
        }
      }
    }
  }
  for (const relation of explicitRelations) {
    adjacency.get(relation.higherCandidateId)?.add(relation.lowerCandidateId);
  }

  const relations = new Map<string, 'left-higher' | 'right-higher' | 'tie'>();
  for (let leftIndex = 0; leftIndex < viable.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < viable.length;
      rightIndex += 1
    ) {
      const left = viable[leftIndex] ?? '';
      const right = viable[rightIndex] ?? '';
      const key = pairKey(left, right);
      if (ties.has(key)) {
        relations.set(key, 'tie');
      } else if (isReachable(adjacency, left, right)) {
        relations.set(key, left < right ? 'left-higher' : 'right-higher');
      } else if (isReachable(adjacency, right, left)) {
        relations.set(key, right < left ? 'left-higher' : 'right-higher');
      }
    }
  }
  return relations;
}

function isReachable(
  adjacency: ReadonlyMap<string, ReadonlySet<string>>,
  source: string,
  target: string,
): boolean {
  const pending = [...(adjacency.get(source) ?? [])];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) {
      break;
    }
    if (current === target) {
      return true;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

function scoreSafety(
  bundles: readonly Pick<CaseBundle, 'caseDocument' | 'gold'>[],
  predictions: readonly Prediction[],
): SafetyReport {
  const predictionsByCase = new Map(
    predictions.map((prediction) => [prediction.caseId, prediction]),
  );
  const violations: SafetyReport['violations'][number][] = [];
  for (const bundle of bundles) {
    const prediction = predictionsByCase.get(bundle.caseDocument.caseId);
    if (prediction === undefined) {
      continue;
    }
    const conflicts = new Map<string, Set<string>>();
    for (const conflict of bundle.gold.hardConstraintConflicts) {
      const reasons = conflicts.get(conflict.candidateId) ?? new Set<string>();
      reasons.add(conflict.reasonCode);
      conflicts.set(conflict.candidateId, reasons);
    }
    for (const candidate of prediction.candidates) {
      const reasons = conflicts.get(candidate.candidateId);
      if (
        reasons !== undefined &&
        (candidate.disposition === 'recommended' ||
          candidate.disposition === 'viable')
      ) {
        violations.push({
          caseId: bundle.caseDocument.caseId,
          candidateId: candidate.candidateId,
          reasonCodes: [...reasons].sort(compareText),
        });
      }
    }
  }
  violations.sort((left, right) =>
    compareText(
      `${left.caseId}\0${left.candidateId}`,
      `${right.caseId}\0${right.candidateId}`,
    ),
  );
  return {
    safe: violations.length === 0,
    unsafeCount: violations.length,
    violations,
  };
}

function createAccumulator(): ScoreAccumulator {
  return {
    caseCount: 0,
    dispositionCounts: {
      recommended: emptyCounts(),
      viable: emptyCounts(),
      rejected: emptyCounts(),
      'insufficient-evidence': emptyCounts(),
    },
    rankingCorrect: 0,
    rankingTotal: 0,
    outcomeCorrect: 0,
    outcomeTotal: 0,
    outcomeCorrectByLabel: {
      recommend: 0,
      'no-viable-candidate': 0,
      'insufficient-evidence': 0,
    },
    outcomeTotalByLabel: {
      recommend: 0,
      'no-viable-candidate': 0,
      'insufficient-evidence': 0,
    },
    unknownRecovered: 0,
    unknownRequired: 0,
    evidenceRecovered: 0,
    evidenceRequired: 0,
    reasonRecovered: 0,
    reasonRequired: 0,
  };
}

function finalizeMetrics(accumulator: ScoreAccumulator): MetricSet {
  const dispositions = Object.fromEntries(
    LABELS.map((label) => [
      label,
      metricFromCounts(accumulator.dispositionCounts[label]),
    ]),
  ) as Record<DispositionLabel, LabelMetric>;
  return {
    caseCount: accumulator.caseCount,
    dispositions,
    macroDisposition: {
      precision: mean(LABELS.map((label) => dispositions[label].precision)),
      recall: mean(LABELS.map((label) => dispositions[label].recall)),
      f1: mean(LABELS.map((label) => dispositions[label].f1)),
    },
    rankingAgreement: ratio(
      accumulator.rankingCorrect,
      accumulator.rankingTotal,
    ),
    outcomeAccuracy: ratio(
      accumulator.outcomeCorrect,
      accumulator.outcomeTotal,
    ),
    outcomeByLabel: Object.fromEntries(
      OUTCOMES.map((outcome) => [
        outcome,
        ratio(
          accumulator.outcomeCorrectByLabel[outcome],
          accumulator.outcomeTotalByLabel[outcome],
        ),
      ]),
    ) as Record<Outcome, number>,
    unknownRecall: ratio(
      accumulator.unknownRecovered,
      accumulator.unknownRequired,
    ),
    evidenceRecall: ratio(
      accumulator.evidenceRecovered,
      accumulator.evidenceRequired,
    ),
    reasonRecall: ratio(
      accumulator.reasonRecovered,
      accumulator.reasonRequired,
    ),
  };
}

function metricFromCounts(
  counts: ScoreAccumulator['dispositionCounts'][DispositionLabel],
): LabelMetric {
  const precision = ratio(
    counts.truePositive,
    counts.truePositive + counts.falsePositive,
  );
  const recall = ratio(
    counts.truePositive,
    counts.truePositive + counts.falseNegative,
  );
  return {
    counts: { ...counts },
    precision,
    recall,
    f1:
      precision + recall === 0
        ? 0
        : round(2 * ((precision * recall) / (precision + recall))),
  };
}

function emptyCounts() {
  return { truePositive: 0, falsePositive: 0, falseNegative: 0 };
}

function mean(values: readonly number[]): number {
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : round(numerator / denominator);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function pairKey(left: string, right: string): string {
  return left < right ? `${left}\0${right}` : `${right}\0${left}`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
