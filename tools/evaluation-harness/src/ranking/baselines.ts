import type {
  EvidenceNeededResolution,
  RankingBaselineSpecification,
  RankingBlindStrategyInput,
  RankingCasePrediction,
  RankingCriterionBinding,
  RankingPredictionCandidate,
  RankingPredictionSet,
  RankingResolvedCase,
} from './contracts.ts';
import {
  createRankingStrategyInput,
  loadRankingBlindInputSet,
} from './blind-input.ts';
import {
  compareCandidateFit,
  createPartialOrderPresentation,
  deriveCandidateFit,
  derivePreferenceConsequences,
  type DerivedCandidateFit,
} from './evaluation-rules.ts';
import { compareRankingText, rankingSemanticDigest } from './stable-json.ts';

export const RANKING_BASELINE_VERSIONS = {
  retrievalOrder: 'ranking-retrieval-order-diagnostic/2.0.0',
  allInsufficient: 'ranking-all-insufficient-abstention/2.0.0',
  targetBlind: 'ranking-target-blind-candidate-feature/3.0.0',
  targetAware: 'ranking-weak-target-aware-exact-compatibility/3.0.0',
  hardConflictControl: 'ranking-hard-conflict-negative-control/2.0.0',
  syntheticOracle: 'ranking-synthetic-oracle/2.0.0',
} as const;

export const RANKING_BASELINE_IDS = {
  retrievalOrder: 'retrieval-order-diagnostic',
  allInsufficient: 'all-insufficient-responsible-abstention',
  targetBlind: 'target-blind-candidate-feature',
  targetAware: 'weak-target-aware-exact-compatibility',
  hardConflictControl: 'hard-conflict-violating-negative-control',
  syntheticOracle: 'synthetic-oracle-scorer-only',
} as const;

export interface RankingBaselinePredictionSets {
  readonly retrievalOrder: RankingPredictionSet;
  readonly allInsufficient: RankingPredictionSet;
  readonly targetBlind: RankingPredictionSet;
  readonly targetAware: RankingPredictionSet;
  readonly hardConflictControl: RankingPredictionSet;
}

type Strategy = (
  input: RankingBlindStrategyInput,
) => Omit<RankingCasePrediction, 'caseId'>;

export function generateRankingBaselinePredictionSets(
  repositoryRoot: string,
  order: 'forward' | 'reverse' = 'forward',
): RankingBaselinePredictionSets {
  const loaded = loadRankingBlindInputSet(repositoryRoot, order);
  const specs = new Map(
    loaded.specifications.specifications.map((specification) => [
      specification.baselineId,
      specification,
    ]),
  );
  const create = (
    key: keyof RankingBaselinePredictionSets,
    baselineId: string,
    version: string,
    strategy: Strategy,
    options: { readonly target: boolean; readonly evidence: boolean },
  ): RankingPredictionSet => {
    const specification = specs.get(baselineId);
    if (
      specification?.baselineVersion !== version ||
      specification.role === 'scorer-only-oracle'
    ) {
      throw new Error(
        'Ranking baseline specification binding is inconsistent.',
      );
    }
    return createPredictionSet(
      key,
      loaded.cases,
      loaded.blindInputDigest,
      specification,
      strategy,
      options,
    );
  };
  return {
    retrievalOrder: create(
      'retrievalOrder',
      RANKING_BASELINE_IDS.retrievalOrder,
      RANKING_BASELINE_VERSIONS.retrievalOrder,
      retrievalOrderStrategy,
      { target: false, evidence: false },
    ),
    allInsufficient: create(
      'allInsufficient',
      RANKING_BASELINE_IDS.allInsufficient,
      RANKING_BASELINE_VERSIONS.allInsufficient,
      allInsufficientStrategy,
      { target: false, evidence: false },
    ),
    targetBlind: create(
      'targetBlind',
      RANKING_BASELINE_IDS.targetBlind,
      RANKING_BASELINE_VERSIONS.targetBlind,
      targetBlindStrategy,
      { target: false, evidence: true },
    ),
    targetAware: create(
      'targetAware',
      RANKING_BASELINE_IDS.targetAware,
      RANKING_BASELINE_VERSIONS.targetAware,
      targetAwareStrategy,
      { target: true, evidence: true },
    ),
    hardConflictControl: create(
      'hardConflictControl',
      RANKING_BASELINE_IDS.hardConflictControl,
      RANKING_BASELINE_VERSIONS.hardConflictControl,
      hardConflictControlStrategy,
      { target: true, evidence: true },
    ),
  };
}

function createPredictionSet(
  key: keyof RankingBaselinePredictionSets,
  cases: readonly RankingResolvedCase[],
  blindInputDigest: string,
  specification: RankingBaselineSpecification,
  strategy: Strategy,
  options: { readonly target: boolean; readonly evidence: boolean },
): RankingPredictionSet {
  const predictions = cases
    .map((resolved): RankingCasePrediction => ({
      caseId: resolved.binding.caseId,
      ...strategy(
        createRankingStrategyInput(resolved, options.target, options.evidence),
      ),
    }))
    .sort((left, right) => compareRankingText(left.caseId, right.caseId));
  const withoutDigest = {
    predictionSetVersion: 'ranking-v1-prediction-set/3.0.0' as const,
    predictionSetId: `ranking-v1-${key}-predictions`,
    baselineId: specification.baselineId,
    baselineVersion: specification.baselineVersion,
    baselineSpecificationDigest: specification.specificationDigest,
    corpusId: 'ranking-v1' as const,
    corpusVersion: '3.0.0' as const,
    blindInputDigest,
    predictions,
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

function retrievalOrderStrategy(
  input: RankingBlindStrategyInput,
): Omit<RankingCasePrediction, 'caseId'> {
  const ordered = [...input.handoffCandidates].sort(
    (left, right) => left.retrievalOrder - right.retrievalOrder,
  );
  const eligible = ordered.filter(({ lane }) => lane === 'eligible');
  const candidates: RankingPredictionCandidate[] = ordered.map((candidate) => ({
    candidateId: candidate.candidateId,
    disposition:
      candidate.lane === 'evidence-needed'
        ? 'insufficient-evidence'
        : candidate.candidateId === eligible[0]?.candidateId
          ? 'recommended'
          : 'viable',
    reasonCodes:
      candidate.lane === 'evidence-needed'
        ? ['phase9-evidence-needed-unresolved']
        : ['phase9-retrieval-order-diagnostic'],
    evidenceIds: [],
    unknownIds:
      candidate.lane === 'evidence-needed'
        ? candidate.unresolvedHardEvaluations.map(
            ({ evaluationId }) => `unknown-${evaluationId}`,
          )
        : [],
  }));
  const positive = candidates.filter(
    ({ disposition }) =>
      disposition === 'recommended' || disposition === 'viable',
  );
  const visible = positive
    .map(({ candidateId }) => candidateId)
    .slice(0, input.requestedMaximumResults);
  return emptyDerivedPrediction({
    outcome: positive.length > 0 ? 'recommend' : 'insufficient-evidence',
    candidates,
    presentation: visible,
    rankGroups: visible.map((candidateId) => [candidateId]),
  });
}

function allInsufficientStrategy(
  input: RankingBlindStrategyInput,
): Omit<RankingCasePrediction, 'caseId'> {
  return emptyDerivedPrediction({
    outcome: 'insufficient-evidence',
    candidates: input.candidates.map(({ candidateId }) => ({
      candidateId,
      disposition: 'insufficient-evidence',
      reasonCodes: ['responsible-abstention-no-fit-authority'],
      evidenceIds: [],
      unknownIds: [`unknown-${candidateId}-fit`],
    })),
    presentation: [],
    rankGroups: [],
  });
}

function targetBlindStrategy(
  input: RankingBlindStrategyInput,
): Omit<RankingCasePrediction, 'caseId'> {
  if (input.target !== null) {
    throw new Error('Target-blind baseline received target facts.');
  }
  return featureStrategy(input, false);
}

function targetAwareStrategy(
  input: RankingBlindStrategyInput,
): Omit<RankingCasePrediction, 'caseId'> {
  if (input.target === null) {
    throw new Error('Target-aware baseline requires target facts.');
  }
  return featureStrategy(input, true);
}

function featureStrategy(
  input: RankingBlindStrategyInput,
  targetAware: boolean,
): Omit<RankingCasePrediction, 'caseId'> {
  const derived = input.candidates.map(({ candidateId }) =>
    deriveCandidateFit(input, candidateId, targetAware),
  );
  const positives = derived.filter(
    ({ disposition }) => disposition === 'viable',
  );
  const boundPreferenceIds = input.criteria.bindings
    .filter(
      ({ criterionKind, bindingState }) =>
        criterionKind === 'preference' && bindingState === 'bound',
    )
    .map(({ criterionId }) => criterionId)
    .sort(compareRankingText);
  const comparisonCandidates = targetAware
    ? positives.map((candidate) => ({
        ...candidate,
        successVector: [],
        preferenceVectors: new Map<string, number>(),
      }))
    : positives;
  const comparisonById = new Map(
    comparisonCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const preferenceIds = targetAware ? [] : boundPreferenceIds;
  const maximal = comparisonCandidates.filter(
    (candidate) =>
      !comparisonCandidates.some(
        (other) =>
          other.candidateId !== candidate.candidateId &&
          compareCandidateFit(other, candidate, preferenceIds) ===
            'left-higher',
      ),
  );
  const maximalIds = new Set(maximal.map(({ candidateId }) => candidateId));
  const preferenceConsequences = targetAware
    ? input.criteria.bindings
        .filter(({ criterionKind }) => criterionKind === 'preference')
        .map((binding) => ({
          criterionId: binding.criterionId,
          state:
            binding.bindingState === 'unbound'
              ? ('ignored-unbound' as const)
              : ('bound-but-no-applicable-positive-comparison' as const),
          affectedPairs: [],
        }))
        .sort((left, right) =>
          compareRankingText(left.criterionId, right.criterionId),
        )
    : derivePreferenceConsequences(derived, input.criteria.bindings);
  const ranked = createPartialOrderPresentation(
    positives.map(
      (candidate) => comparisonById.get(candidate.candidateId) ?? candidate,
    ),
    preferenceIds,
    input.requestedMaximumResults,
  );
  const presentedCandidateIds = new Set(ranked.presentation);
  const candidates = derived
    .map((candidate): RankingPredictionCandidate => {
      const evidenceIds = new Set(candidate.evidenceIds);
      if (targetAware) {
        if (
          positives.length > 1 &&
          presentedCandidateIds.has(candidate.candidateId)
        ) {
          candidate.targetEvidenceIds.forEach((evidenceId) =>
            evidenceIds.add(evidenceId),
          );
        }
      } else {
        for (const consequence of preferenceConsequences) {
          if (
            consequence.affectedPairs.some((pair) =>
              pair.includes(candidate.candidateId),
            )
          ) {
            candidate.preferenceEvidenceIds
              .get(consequence.criterionId)
              ?.forEach((evidenceId) => evidenceIds.add(evidenceId));
          }
        }
      }
      return {
        candidateId: candidate.candidateId,
        disposition:
          candidate.disposition === 'viable' &&
          maximalIds.has(candidate.candidateId)
            ? 'recommended'
            : candidate.disposition,
        reasonCodes: candidate.reasonCodes,
        evidenceIds: [...evidenceIds].sort(compareRankingText),
        unknownIds: candidate.unknownIds,
      };
    })
    .sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    );
  const outcome =
    positives.length > 0
      ? 'recommend'
      : derived.some(
            ({ disposition }) => disposition === 'insufficient-evidence',
          )
        ? 'insufficient-evidence'
        : 'no-viable-candidate';
  return {
    outcome,
    candidates,
    ...ranked,
    hardConstraintConflicts: derived
      .flatMap(({ hardConflicts }) => hardConflicts)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.constraintId}`,
          `${right.candidateId}\0${right.constraintId}`,
        ),
      ),
    evidenceNeededResolutions: derived
      .flatMap(({ resolutions }) => resolutions)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.evaluationId}`,
          `${right.candidateId}\0${right.evaluationId}`,
        ),
      ),
    successConditionCoverage: derived
      .flatMap(({ coverage }) => coverage)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.criterionId}`,
          `${right.candidateId}\0${right.criterionId}`,
        ),
      ),
    preferenceConsequences,
    unboundPreferenceCounterfactuals: deriveUnboundPreferenceCounterfactuals(
      comparisonCandidates,
      input.criteria.bindings,
      preferenceIds,
    ),
    hardenedPreferenceIds: [],
  };
}

function hardConflictControlStrategy(
  input: RankingBlindStrategyInput,
): Omit<RankingCasePrediction, 'caseId'> {
  const derived = input.candidates.map(({ candidateId }) =>
    deriveCandidateFit(input, candidateId, true),
  );
  const conflict = derived.find(
    ({ hardConflicts }) => hardConflicts.length > 0,
  );
  if (conflict === undefined) {
    throw new Error('Negative control requires a known hard conflict.');
  }
  return emptyDerivedPrediction({
    outcome: 'recommend',
    candidates: input.candidates.map(({ candidateId }) => ({
      candidateId,
      disposition:
        candidateId === conflict.candidateId ? 'recommended' : 'rejected',
      reasonCodes:
        candidateId === conflict.candidateId
          ? ['negative-control-promoted-known-conflict']
          : ['negative-control-rejected'],
      evidenceIds:
        candidateId === conflict.candidateId
          ? (conflict.hardConflicts[0]?.evidenceIds ?? [])
          : [],
      unknownIds: [],
    })),
    presentation: [conflict.candidateId],
    rankGroups: [[conflict.candidateId]],
  });
}

function emptyDerivedPrediction(input: {
  readonly outcome: RankingCasePrediction['outcome'];
  readonly candidates: readonly RankingPredictionCandidate[];
  readonly presentation: readonly string[];
  readonly rankGroups: readonly (readonly string[])[];
}): Omit<RankingCasePrediction, 'caseId'> {
  return {
    outcome: input.outcome,
    candidates: [...input.candidates].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    ),
    presentation: [...input.presentation],
    rankGroups: input.rankGroups.map((group) => [...group]),
    rankRelations: [],
    incomparablePairs: [],
    hardConstraintConflicts: [],
    evidenceNeededResolutions: [],
    successConditionCoverage: [],
    preferenceConsequences: [],
    unboundPreferenceCounterfactuals: [],
    hardenedPreferenceIds: [],
  };
}

export function expectedCriterionState(
  binding: RankingCriterionBinding,
): 'fail-closed' | 'not-counted-approved-non-material' | null {
  if (binding.bindingState === 'bound') return null;
  return binding.materiality === 'non-material'
    ? 'not-counted-approved-non-material'
    : 'fail-closed';
}

export function resolutionPriority(
  resolution: EvidenceNeededResolution,
): number {
  return resolution === 'conflict' ? 0 : resolution === 'unresolved' ? 1 : 2;
}

export function maximalCandidateIds(
  candidates: readonly DerivedCandidateFit[],
  preferenceIds: readonly string[],
): readonly string[] {
  return candidates
    .filter(
      (candidate) =>
        !candidates.some(
          (other) =>
            other.candidateId !== candidate.candidateId &&
            compareCandidateFit(other, candidate, preferenceIds) ===
              'left-higher',
        ),
    )
    .map(({ candidateId }) => candidateId)
    .sort(compareRankingText);
}

function deriveUnboundPreferenceCounterfactuals(
  candidates: readonly DerivedCandidateFit[],
  bindings: readonly RankingCriterionBinding[],
  appliedBoundPreferenceIds: readonly string[],
): RankingCasePrediction['unboundPreferenceCounterfactuals'] {
  const ordered = [...candidates].sort((left, right) =>
    compareRankingText(left.candidateId, right.candidateId),
  );
  return bindings
    .filter(
      ({ criterionKind, bindingState }) =>
        criterionKind === 'preference' && bindingState === 'unbound',
    )
    .flatMap((binding) =>
      ordered.flatMap((left, leftIndex) =>
        ordered.slice(leftIndex + 1).map((right) => ({
          criterionId: binding.criterionId,
          candidatePair: [left.candidateId, right.candidateId] as const,
          relationWithoutPreference: compareCandidateFit(
            left,
            right,
            appliedBoundPreferenceIds,
          ),
        })),
      ),
    )
    .sort((left, right) =>
      compareRankingText(
        `${left.criterionId}\0${left.candidatePair.join('\0')}`,
        `${right.criterionId}\0${right.candidatePair.join('\0')}`,
      ),
    );
}
