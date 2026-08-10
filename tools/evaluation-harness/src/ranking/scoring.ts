import type {
  ClassificationMetric,
  ExactMetric,
  RankingCasePrediction,
  RankingDisposition,
  RankingGoldCase,
  RankingMetricSet,
  RankingOutcome,
  RankingPredictionSet,
  RankingResolvedCase,
  RankingSafetyCounts,
  RankingScoreReport,
  RankingValidatedCorpus,
} from './contracts.ts';
import { compareRankingText, rankingSemanticDigest } from './stable-json.ts';

const DISPOSITIONS: readonly RankingDisposition[] = [
  'recommended',
  'viable',
  'rejected',
  'insufficient-evidence',
];
const OUTCOMES: readonly RankingOutcome[] = [
  'recommend',
  'no-viable-candidate',
  'insufficient-evidence',
];

type PairRelation =
  'tie' | 'left-higher' | 'right-higher' | 'incomparable' | 'conflict';

interface CaseScoreInput {
  readonly resolved: RankingResolvedCase;
  readonly gold: RankingGoldCase;
  readonly prediction: RankingCasePrediction;
}

interface ExactAccumulator {
  correct: number;
  total: number;
}

interface MetricAccumulator {
  caseCount: number;
  dispositions: Record<
    RankingDisposition,
    {
      truePositive: number;
      falsePositive: number;
      falseNegative: number;
      trueNegative: number;
    }
  >;
  outcomeCorrect: number;
  outcomeTotal: number;
  outcomeByLabel: Record<RankingOutcome, ExactAccumulator>;
  outcomeConfusion: Record<RankingOutcome, Record<RankingOutcome, number>>;
  partialOrder: ExactAccumulator;
  ties: ExactAccumulator;
  ordered: ExactAccumulator;
  incomparable: ExactAccumulator;
  falseOrdersOfIncomparable: number;
  topThree: ExactAccumulator;
  evidenceNeeded: ExactAccumulator;
  evidenceNeededByState: Record<
    'satisfied' | 'conflict' | 'unresolved',
    ExactAccumulator
  >;
  illegalPromotions: number;
  evidenceAssociations: ExactAccumulator;
  reasonCodes: ExactAccumulator;
  materialUnknowns: ExactAccumulator;
  hardConflicts: ExactAccumulator;
  unsupportedExtraAssociations: number;
  boundSuccess: ExactAccumulator;
  materialUnbound: ExactAccumulator;
  approvedNonMaterial: ExactAccumulator;
  boundPreference: ExactAccumulator;
  unboundPreference: ExactAccumulator;
  noPreferenceHardening: ExactAccumulator;
}

export function scoreRankingPredictionSet(
  corpus: RankingValidatedCorpus,
  cases: readonly RankingResolvedCase[],
  predictionSet: RankingPredictionSet,
): RankingScoreReport {
  const goldByCase = new Map(
    corpus.gold.cases.map((gold) => [gold.caseId, gold]),
  );
  const predictionByCase = new Map(
    predictionSet.predictions.map((prediction) => [
      prediction.caseId,
      prediction,
    ]),
  );
  const inputs = cases.map((resolved): CaseScoreInput => {
    const gold = goldByCase.get(resolved.binding.caseId);
    const prediction = predictionByCase.get(resolved.binding.caseId);
    if (gold === undefined || prediction === undefined) {
      throw new Error('Ranking prediction set omits a required case.');
    }
    return { resolved, gold, prediction };
  });
  const overall = scoreInputs(inputs);
  const perFamily = Object.fromEntries(
    [
      ...new Set(
        corpus.blind.cases.map(({ capabilityFamily }) => capabilityFamily),
      ),
    ]
      .sort(compareRankingText)
      .map((family) => [
        family,
        scoreInputs(
          inputs.filter(
            ({ resolved }) => resolved.binding.capabilityFamily === family,
          ),
        ),
      ]),
  ) as RankingScoreReport['perFamily'];
  const withoutDigest = {
    scoreVersion: 'ranking-v1-scorer/2.0.0' as const,
    corpusId: 'ranking-v1' as const,
    predictionSetId: predictionSet.predictionSetId,
    predictionDigest: predictionSet.semanticDigest,
    safety: scoreSafety(inputs),
    overall,
    perFamily,
    controlledPairs: scoreControlledPairs(corpus, predictionByCase),
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

function scoreInputs(inputs: readonly CaseScoreInput[]): RankingMetricSet {
  const accumulator = createAccumulator();
  for (const input of inputs) accumulateCase(accumulator, input);
  return finalizeMetrics(accumulator);
}

function accumulateCase(
  accumulator: MetricAccumulator,
  input: CaseScoreInput,
): void {
  const { resolved, gold, prediction } = input;
  accumulator.caseCount += 1;
  const goldCandidates = new Map(
    gold.candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const predictedCandidates = new Map(
    prediction.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  for (const identity of resolved.candidateSet.candidates) {
    const goldLabel = goldCandidates.get(identity.candidateId)?.disposition;
    const predictedLabel = predictedCandidates.get(
      identity.candidateId,
    )?.disposition;
    for (const label of DISPOSITIONS) {
      const counts = accumulator.dispositions[label];
      if (goldLabel === label && predictedLabel === label) {
        counts.truePositive += 1;
      } else if (predictedLabel === label) {
        counts.falsePositive += 1;
      } else if (goldLabel === label) {
        counts.falseNegative += 1;
      } else {
        counts.trueNegative += 1;
      }
    }
  }

  accumulator.outcomeTotal += 1;
  accumulator.outcomeByLabel[gold.outcome].total += 1;
  accumulator.outcomeConfusion[gold.outcome][prediction.outcome] += 1;
  if (
    prediction.outcome === gold.outcome ||
    gold.allowedAlternativeOutcomes.includes(prediction.outcome)
  ) {
    accumulator.outcomeCorrect += 1;
    accumulator.outcomeByLabel[gold.outcome].correct += 1;
  }

  scorePartialOrder(accumulator, gold, prediction);
  const acceptedPositive = new Set(
    gold.candidates
      .filter(
        ({ disposition }) =>
          disposition === 'recommended' || disposition === 'viable',
      )
      .map(({ candidateId }) => candidateId),
  );
  if (acceptedPositive.size > 0) {
    accumulator.topThree.total += 1;
    if (
      prediction.presentation.slice(0, 3).some((id) => acceptedPositive.has(id))
    ) {
      accumulator.topThree.correct += 1;
    }
  }

  const predictedResolutions = new Map(
    prediction.evidenceNeededResolutions.map((resolution) => [
      associationKey(resolution.candidateId, resolution.evaluationId),
      resolution,
    ]),
  );
  for (const required of gold.evidenceNeededResolutions) {
    const actual = predictedResolutions.get(
      associationKey(required.candidateId, required.evaluationId),
    );
    const bucket = accumulator.evidenceNeededByState[required.resolution];
    bucket.total += 1;
    accumulator.evidenceNeeded.total += 1;
    if (
      actual?.resolution === required.resolution &&
      sameSet(actual.evidenceIds, required.evidenceIds)
    ) {
      bucket.correct += 1;
      accumulator.evidenceNeeded.correct += 1;
    }
    if (
      required.resolution === 'unresolved' &&
      ['recommended', 'viable'].includes(
        predictedCandidates.get(required.candidateId)?.disposition ?? '',
      )
    ) {
      accumulator.illegalPromotions += 1;
    }
  }

  scoreTraceability(accumulator, gold, prediction);
  scoreCriteria(accumulator, resolved, gold, prediction);
}

function scorePartialOrder(
  accumulator: MetricAccumulator,
  gold: RankingGoldCase,
  prediction: RankingCasePrediction,
): void {
  const expected = rankingPairRelations(gold);
  const actual = rankingPairRelations(prediction);
  for (const [pair, relation] of expected) {
    const correct = actual.get(pair) === relation;
    const bucket =
      relation === 'tie'
        ? accumulator.ties
        : relation === 'incomparable'
          ? accumulator.incomparable
          : accumulator.ordered;
    bucket.total += 1;
    accumulator.partialOrder.total += 1;
    if (correct) {
      bucket.correct += 1;
      accumulator.partialOrder.correct += 1;
    }
    if (
      relation === 'incomparable' &&
      (actual.get(pair) === 'left-higher' ||
        actual.get(pair) === 'right-higher')
    ) {
      accumulator.falseOrdersOfIncomparable += 1;
    }
  }
}

export function rankingPairRelations(
  value: Pick<
    RankingGoldCase,
    'rankGroups' | 'rankRelations' | 'incomparablePairs'
  >,
): ReadonlyMap<string, PairRelation> {
  const directed: [string, string][] = [];
  const relations = new Map<string, PairRelation>();
  for (const [groupIndex, group] of value.rankGroups.entries()) {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        const first = group[left];
        const second = group[right];
        if (first !== undefined && second !== undefined) {
          setPair(relations, first, second, 'tie');
        }
      }
    }
    for (const lowerGroup of value.rankGroups.slice(groupIndex + 1)) {
      for (const higher of group) {
        for (const lower of lowerGroup) directed.push([higher, lower]);
      }
    }
  }
  for (const relation of value.rankRelations) {
    directed.push([relation.higherCandidateId, relation.lowerCandidateId]);
  }
  const nodes = new Set(directed.flat());
  const adjacency = new Map<string, Set<string>>();
  for (const node of nodes) adjacency.set(node, new Set());
  for (const [higher, lower] of directed) adjacency.get(higher)?.add(lower);
  for (const source of nodes) {
    const pending = [...(adjacency.get(source) ?? [])];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const target = pending.pop();
      if (target === undefined || visited.has(target)) continue;
      visited.add(target);
      setDirected(relations, source, target);
      pending.push(...(adjacency.get(target) ?? []));
    }
  }
  for (const [left, right] of value.incomparablePairs) {
    setPair(relations, left, right, 'incomparable');
  }
  return relations;
}

function setDirected(
  relations: Map<string, PairRelation>,
  higher: string,
  lower: string,
): void {
  const [left, right] = orderedPair(higher, lower);
  setPair(
    relations,
    left,
    right,
    higher === left ? 'left-higher' : 'right-higher',
  );
}

function setPair(
  relations: Map<string, PairRelation>,
  leftValue: string,
  rightValue: string,
  relation: Exclude<PairRelation, 'conflict'>,
): void {
  const [left, right] = orderedPair(leftValue, rightValue);
  const normalized =
    leftValue === left
      ? relation
      : relation === 'left-higher'
        ? 'right-higher'
        : relation === 'right-higher'
          ? 'left-higher'
          : relation;
  const key = associationKey(left, right);
  const existing = relations.get(key);
  relations.set(
    key,
    existing === undefined || existing === normalized ? normalized : 'conflict',
  );
}

function scoreTraceability(
  accumulator: MetricAccumulator,
  gold: RankingGoldCase,
  prediction: RankingCasePrediction,
): void {
  const requiredEvidence = candidateAssociations(
    gold.candidates,
    'evidenceIds',
  );
  const actualEvidence = candidateAssociations(
    prediction.candidates,
    'evidenceIds',
  );
  const requiredReasons = candidateAssociations(gold.candidates, 'reasonCodes');
  const actualReasons = candidateAssociations(
    prediction.candidates,
    'reasonCodes',
  );
  const requiredUnknowns = new Set(
    gold.requiredUnknowns.map(({ candidateId, unknownId }) =>
      associationKey(candidateId, unknownId),
    ),
  );
  const actualUnknowns = candidateAssociations(
    prediction.candidates,
    'unknownIds',
  );
  const requiredConflicts = new Set(
    gold.hardConstraintConflicts.map((conflict) =>
      conflictKey(
        conflict.candidateId,
        conflict.constraintId,
        conflict.reasonCode,
      ),
    ),
  );
  const actualConflicts = new Set(
    prediction.hardConstraintConflicts.map((conflict) =>
      conflictKey(
        conflict.candidateId,
        conflict.constraintId,
        conflict.reasonCode,
      ),
    ),
  );
  accumulateSet(
    accumulator.evidenceAssociations,
    requiredEvidence,
    actualEvidence,
  );
  accumulateSet(accumulator.reasonCodes, requiredReasons, actualReasons);
  accumulateSet(accumulator.materialUnknowns, requiredUnknowns, actualUnknowns);
  accumulateSet(accumulator.hardConflicts, requiredConflicts, actualConflicts);
  accumulator.unsupportedExtraAssociations +=
    extraCount(requiredEvidence, actualEvidence) +
    extraCount(requiredReasons, actualReasons) +
    extraCount(requiredUnknowns, actualUnknowns) +
    extraCount(requiredConflicts, actualConflicts);
}

function candidateAssociations(
  candidates: readonly {
    readonly candidateId: string;
    readonly evidenceIds: readonly string[];
    readonly reasonCodes: readonly string[];
    readonly unknownIds: readonly string[];
  }[],
  key: 'evidenceIds' | 'reasonCodes' | 'unknownIds',
): Set<string> {
  return new Set(
    candidates.flatMap((candidate) =>
      candidate[key].map((id) => associationKey(candidate.candidateId, id)),
    ),
  );
}

function scoreCriteria(
  accumulator: MetricAccumulator,
  resolved: RankingResolvedCase,
  gold: RankingGoldCase,
  prediction: RankingCasePrediction,
): void {
  const bindings = new Map(
    resolved.criteria.bindings.map((binding) => [binding.criterionId, binding]),
  );
  const actualCoverage = new Map(
    prediction.successConditionCoverage.map((entry) => [
      associationKey(entry.candidateId, entry.criterionId),
      entry.state,
    ]),
  );
  for (const expected of gold.successConditionCoverage) {
    const binding = bindings.get(expected.criterionId);
    if (binding === undefined) continue;
    const metric =
      binding.bindingState === 'bound'
        ? accumulator.boundSuccess
        : binding.materiality === 'non-material'
          ? accumulator.approvedNonMaterial
          : accumulator.materialUnbound;
    metric.total += 1;
    if (
      actualCoverage.get(
        associationKey(expected.candidateId, expected.criterionId),
      ) === expected.state
    ) {
      metric.correct += 1;
    }
  }

  const actualConsequences = new Map(
    prediction.preferenceConsequences.map((consequence) => [
      consequence.criterionId,
      consequence,
    ]),
  );
  for (const expected of gold.preferenceConsequences) {
    const binding = bindings.get(expected.criterionId);
    if (binding?.bindingState !== 'bound') continue;
    accumulator.boundPreference.total += 1;
    const actual = actualConsequences.get(expected.criterionId);
    if (
      actual?.state === expected.state &&
      samePairSet(actual.affectedPairs, expected.affectedPairs)
    ) {
      accumulator.boundPreference.correct += 1;
    }
  }

  const actualRelations = rankingPairRelations(prediction);
  const actualCounterfactuals = new Map(
    prediction.unboundPreferenceCounterfactuals.map((counterfactual) => [
      preferencePairKey(
        counterfactual.criterionId,
        counterfactual.candidatePair,
      ),
      counterfactual.relationWithoutPreference,
    ]),
  );
  for (const counterfactual of gold.unboundPreferenceCounterfactuals) {
    accumulator.unboundPreference.total += 1;
    const [left, right] = orderedPair(...counterfactual.candidatePair);
    const actualConsequence = actualConsequences.get(
      counterfactual.criterionId,
    );
    const predictedWithoutPreference = actualCounterfactuals.get(
      preferencePairKey(
        counterfactual.criterionId,
        counterfactual.candidatePair,
      ),
    );
    if (
      actualConsequence?.state === 'ignored-unbound' &&
      actualConsequence.affectedPairs.length === 0 &&
      predictedWithoutPreference !== undefined &&
      actualRelations.get(associationKey(left, right)) ===
        predictedWithoutPreference
    ) {
      accumulator.unboundPreference.correct += 1;
    }
  }

  accumulator.noPreferenceHardening.total += 1;
  if (prediction.hardenedPreferenceIds.length === 0) {
    accumulator.noPreferenceHardening.correct += 1;
  }
}

function scoreSafety(inputs: readonly CaseScoreInput[]): RankingSafetyCounts {
  const counts: {
    -readonly [Key in keyof RankingSafetyCounts]: RankingSafetyCounts[Key];
  } = {
    knownHardConflictRecommended: 0,
    knownHardConflictViable: 0,
    knownHardConflictRanked: 0,
    candidateInvention: 0,
    candidateSetMismatch: 0,
    excludedCandidateLeakage: 0,
    unresolvedEvidenceNeededPositivePromotion: 0,
    missingEvidenceNeededResolution: 0,
    preferenceHardenedIntoHardConflict: 0,
    unboundSuccessConditionCountedFavorable: 0,
    unboundPreferenceAffectedOrder: 0,
  };
  for (const { resolved, gold, prediction } of inputs) {
    const supplied = new Set(
      resolved.candidateSet.candidates.map(({ candidateId }) => candidateId),
    );
    const predictedAssessments = prediction.candidates.map(
      ({ candidateId }) => candidateId,
    );
    const referenced = predictionCandidateReferences(prediction);
    counts.candidateInvention += [...referenced].filter(
      (id) => !supplied.has(id),
    ).length;
    if (
      predictedAssessments.length !== supplied.size ||
      new Set(predictedAssessments).size !== predictedAssessments.length ||
      !sameSet([...supplied], predictedAssessments)
    ) {
      counts.candidateSetMismatch += 1;
    }
    counts.excludedCandidateLeakage +=
      resolved.handoff.excludedCandidateIds.filter((id) =>
        referenced.has(id),
      ).length;

    const predictedByCandidate = new Map(
      prediction.candidates.map((candidate) => [
        candidate.candidateId,
        candidate,
      ]),
    );
    const ranked = rankingCandidateReferences(prediction);
    for (const conflict of gold.hardConstraintConflicts) {
      const disposition = predictedByCandidate.get(
        conflict.candidateId,
      )?.disposition;
      if (disposition === 'recommended') {
        counts.knownHardConflictRecommended += 1;
      }
      if (disposition === 'viable') counts.knownHardConflictViable += 1;
      if (ranked.has(conflict.candidateId)) counts.knownHardConflictRanked += 1;
    }

    const resolutionKeys = new Set(
      prediction.evidenceNeededResolutions.map((resolution) =>
        associationKey(resolution.candidateId, resolution.evaluationId),
      ),
    );
    for (const required of gold.evidenceNeededResolutions) {
      if (
        !resolutionKeys.has(
          associationKey(required.candidateId, required.evaluationId),
        )
      ) {
        counts.missingEvidenceNeededResolution += 1;
      }
      if (
        required.resolution === 'unresolved' &&
        ['recommended', 'viable'].includes(
          predictedByCandidate.get(required.candidateId)?.disposition ?? '',
        )
      ) {
        counts.unresolvedEvidenceNeededPositivePromotion += 1;
      }
    }

    const bindings = new Map(
      resolved.criteria.bindings.map((binding) => [
        binding.criterionId,
        binding,
      ]),
    );
    counts.preferenceHardenedIntoHardConflict +=
      prediction.hardenedPreferenceIds.length;
    counts.unboundSuccessConditionCountedFavorable +=
      prediction.successConditionCoverage.filter(
        ({ criterionId, state }) =>
          state === 'covered' &&
          bindings.get(criterionId)?.criterionKind === 'success-condition' &&
          bindings.get(criterionId)?.bindingState === 'unbound',
      ).length;

    const actualRelations = rankingPairRelations(prediction);
    const actualCounterfactuals = new Map(
      prediction.unboundPreferenceCounterfactuals.map((counterfactual) => [
        preferencePairKey(
          counterfactual.criterionId,
          counterfactual.candidatePair,
        ),
        counterfactual.relationWithoutPreference,
      ]),
    );
    const actualConsequences = new Map(
      prediction.preferenceConsequences.map((entry) => [
        entry.criterionId,
        entry,
      ]),
    );
    for (const counterfactual of gold.unboundPreferenceCounterfactuals) {
      const [left, right] = orderedPair(...counterfactual.candidatePair);
      const consequence = actualConsequences.get(counterfactual.criterionId);
      const predictedWithoutPreference = actualCounterfactuals.get(
        preferencePairKey(
          counterfactual.criterionId,
          counterfactual.candidatePair,
        ),
      );
      if (
        consequence?.state !== 'ignored-unbound' ||
        consequence.affectedPairs.length > 0 ||
        predictedWithoutPreference === undefined ||
        actualRelations.get(associationKey(left, right)) !==
          predictedWithoutPreference
      ) {
        counts.unboundPreferenceAffectedOrder += 1;
      }
    }
  }
  return counts;
}

function scoreControlledPairs(
  corpus: RankingValidatedCorpus,
  predictions: ReadonlyMap<string, RankingCasePrediction>,
): RankingScoreReport['controlledPairs'] {
  let exactPairCorrect = 0;
  let wrongMaximalSet = 0;
  let wrongDirection = 0;
  let unchangedWhenChangeRequired = 0;
  for (const pair of corpus.gold.controlledPairDirections) {
    const first = predictions.get(pair.firstCaseId);
    const second = predictions.get(pair.secondCaseId);
    if (first === undefined || second === undefined) {
      wrongMaximalSet += 1;
      continue;
    }
    const firstMaximal = predictedMaximal(first);
    const secondMaximal = predictedMaximal(second);
    if (
      sameSet(firstMaximal, pair.firstMaximalCandidateIds) &&
      sameSet(secondMaximal, pair.secondMaximalCandidateIds)
    ) {
      exactPairCorrect += 1;
    } else if (
      sameSet(firstMaximal, secondMaximal) &&
      !sameSet(pair.firstMaximalCandidateIds, pair.secondMaximalCandidateIds)
    ) {
      unchangedWhenChangeRequired += 1;
    } else if (
      sameSet(firstMaximal, pair.secondMaximalCandidateIds) &&
      sameSet(secondMaximal, pair.firstMaximalCandidateIds)
    ) {
      wrongDirection += 1;
    } else {
      wrongMaximalSet += 1;
    }
  }
  return {
    total: corpus.gold.controlledPairDirections.length,
    exactPairCorrect,
    wrongMaximalSet,
    wrongDirection,
    unchangedWhenChangeRequired,
  };
}

function predictedMaximal(
  prediction: RankingCasePrediction,
): readonly string[] {
  return prediction.candidates
    .filter(({ disposition }) => disposition === 'recommended')
    .map(({ candidateId }) => candidateId)
    .sort(compareRankingText);
}

function finalizeMetrics(accumulator: MetricAccumulator): RankingMetricSet {
  const dispositions = Object.fromEntries(
    DISPOSITIONS.map((label) => [
      label,
      classification(accumulator.dispositions[label]),
    ]),
  ) as Record<RankingDisposition, ClassificationMetric>;
  return {
    caseCount: accumulator.caseCount,
    dispositions,
    macroDisposition: {
      precision: average(
        DISPOSITIONS.map((label) => dispositions[label].precision),
      ),
      recall: average(DISPOSITIONS.map((label) => dispositions[label].recall)),
      f1: average(DISPOSITIONS.map((label) => dispositions[label].f1)),
    },
    outcome: {
      overall: exact({
        correct: accumulator.outcomeCorrect,
        total: accumulator.outcomeTotal,
      }),
      byLabel: Object.fromEntries(
        OUTCOMES.map((label) => [
          label,
          exact(accumulator.outcomeByLabel[label]),
        ]),
      ) as Record<RankingOutcome, ExactMetric>,
      confusion: accumulator.outcomeConfusion,
    },
    partialOrder: {
      overall: exact(accumulator.partialOrder),
      ties: exact(accumulator.ties),
      ordered: exact(accumulator.ordered),
      incomparable: exact(accumulator.incomparable),
      falseOrdersOfIncomparable: accumulator.falseOrdersOfIncomparable,
    },
    topThreeUsefulness: exact(accumulator.topThree),
    evidenceNeeded: {
      overall: exact(accumulator.evidenceNeeded),
      satisfied: exact(accumulator.evidenceNeededByState.satisfied),
      conflict: exact(accumulator.evidenceNeededByState.conflict),
      unresolved: exact(accumulator.evidenceNeededByState.unresolved),
      illegalPromotions: accumulator.illegalPromotions,
    },
    traceability: {
      evidenceAssociations: exact(accumulator.evidenceAssociations),
      reasonCodes: exact(accumulator.reasonCodes),
      materialUnknowns: exact(accumulator.materialUnknowns),
      hardConflicts: exact(accumulator.hardConflicts),
      unsupportedExtraAssociations: accumulator.unsupportedExtraAssociations,
    },
    criterionBinding: {
      boundSuccessConditionCoverage: exact(accumulator.boundSuccess),
      materialUnboundFailClosed: exact(accumulator.materialUnbound),
      approvedNonMaterialUnbound: exact(accumulator.approvedNonMaterial),
      boundPreferenceComparisonConsequence: exact(accumulator.boundPreference),
      unboundPreferenceCounterfactualNonEffect: exact(
        accumulator.unboundPreference,
      ),
      noPreferenceHardening: exact(accumulator.noPreferenceHardening),
    },
  };
}

function createAccumulator(): MetricAccumulator {
  const emptyClassification = () => ({
    truePositive: 0,
    falsePositive: 0,
    falseNegative: 0,
    trueNegative: 0,
  });
  const emptyExact = (): ExactAccumulator => ({ correct: 0, total: 0 });
  return {
    caseCount: 0,
    dispositions: {
      recommended: emptyClassification(),
      viable: emptyClassification(),
      rejected: emptyClassification(),
      'insufficient-evidence': emptyClassification(),
    },
    outcomeCorrect: 0,
    outcomeTotal: 0,
    outcomeByLabel: {
      recommend: emptyExact(),
      'no-viable-candidate': emptyExact(),
      'insufficient-evidence': emptyExact(),
    },
    outcomeConfusion: Object.fromEntries(
      OUTCOMES.map((expected) => [
        expected,
        Object.fromEntries(OUTCOMES.map((actual) => [actual, 0])),
      ]),
    ) as Record<RankingOutcome, Record<RankingOutcome, number>>,
    partialOrder: emptyExact(),
    ties: emptyExact(),
    ordered: emptyExact(),
    incomparable: emptyExact(),
    falseOrdersOfIncomparable: 0,
    topThree: emptyExact(),
    evidenceNeeded: emptyExact(),
    evidenceNeededByState: {
      satisfied: emptyExact(),
      conflict: emptyExact(),
      unresolved: emptyExact(),
    },
    illegalPromotions: 0,
    evidenceAssociations: emptyExact(),
    reasonCodes: emptyExact(),
    materialUnknowns: emptyExact(),
    hardConflicts: emptyExact(),
    unsupportedExtraAssociations: 0,
    boundSuccess: emptyExact(),
    materialUnbound: emptyExact(),
    approvedNonMaterial: emptyExact(),
    boundPreference: emptyExact(),
    unboundPreference: emptyExact(),
    noPreferenceHardening: emptyExact(),
  };
}

function classification(counts: {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  trueNegative: number;
}): ClassificationMetric {
  const precision = ratio(
    counts.truePositive,
    counts.truePositive + counts.falsePositive,
  );
  const recall = ratio(
    counts.truePositive,
    counts.truePositive + counts.falseNegative,
  );
  const f1 =
    precision === null || recall === null || precision + recall === 0
      ? precision === 0 && recall === 0
        ? 0
        : null
      : round((2 * precision * recall) / (precision + recall));
  return { ...counts, precision, recall, f1 };
}

function exact(value: ExactAccumulator): ExactMetric {
  return {
    correct: value.correct,
    total: value.total,
    errors: value.total - value.correct,
    value: ratio(value.correct, value.total),
  };
}

function accumulateSet(
  accumulator: ExactAccumulator,
  required: ReadonlySet<string>,
  actual: ReadonlySet<string>,
): void {
  accumulator.total += required.size;
  for (const value of required) if (actual.has(value)) accumulator.correct += 1;
}

function extraCount(
  required: ReadonlySet<string>,
  actual: ReadonlySet<string>,
): number {
  return [...actual].filter((value) => !required.has(value)).length;
}

function predictionCandidateReferences(
  prediction: RankingCasePrediction,
): ReadonlySet<string> {
  return new Set([
    ...prediction.candidates.map(({ candidateId }) => candidateId),
    ...rankingCandidateReferences(prediction),
    ...prediction.hardConstraintConflicts.map(({ candidateId }) => candidateId),
    ...prediction.evidenceNeededResolutions.map(
      ({ candidateId }) => candidateId,
    ),
    ...prediction.successConditionCoverage.map(
      ({ candidateId }) => candidateId,
    ),
    ...prediction.preferenceConsequences.flatMap(({ affectedPairs }) =>
      affectedPairs.flat(),
    ),
    ...prediction.unboundPreferenceCounterfactuals.flatMap(
      ({ candidatePair }) => candidatePair,
    ),
  ]);
}

function rankingCandidateReferences(
  prediction: RankingCasePrediction,
): ReadonlySet<string> {
  return new Set([
    ...prediction.presentation,
    ...prediction.rankGroups.flat(),
    ...prediction.rankRelations.flatMap((relation) => [
      relation.higherCandidateId,
      relation.lowerCandidateId,
    ]),
    ...prediction.incomparablePairs.flat(),
  ]);
}

function conflictKey(
  candidateId: string,
  constraintId: string,
  reasonCode: string,
): string {
  return `${candidateId}\0${constraintId}\0${reasonCode}`;
}

function associationKey(left: string, right: string): string {
  return `${left}\0${right}`;
}

function preferencePairKey(
  criterionId: string,
  pair: readonly [string, string],
): string {
  return `${criterionId}\0${orderedPair(...pair).join('\0')}`;
}

function orderedPair(left: string, right: string): readonly [string, string] {
  return compareRankingText(left, right) <= 0 ? [left, right] : [right, left];
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    new Set(left).size === new Set(right).size &&
    left.every((value) => right.includes(value))
  );
}

function samePairSet(
  left: readonly (readonly [string, string])[],
  right: readonly (readonly [string, string])[],
): boolean {
  return sameSet(
    left.map((pair) => orderedPair(...pair).join('\0')),
    right.map((pair) => orderedPair(...pair).join('\0')),
  );
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round(numerator / denominator);
}

function average(values: readonly (number | null)[]): number | null {
  const applicable = values.filter((value): value is number => value !== null);
  return applicable.length === 0
    ? null
    : round(
        applicable.reduce((sum, value) => sum + value, 0) / applicable.length,
      );
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
