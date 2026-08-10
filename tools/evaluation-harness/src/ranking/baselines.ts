import type {
  EvidenceNeededResolution,
  RankingBaselineSpecification,
  RankingBlindStrategyInput,
  RankingCasePrediction,
  RankingCriterionBinding,
  RankingPredictionCandidate,
  RankingPredictionSet,
  RankingDisposition,
  RankingResolvedCase,
} from './contracts.ts';
import {
  createRankingStrategyInput,
  loadRankingBlindInputSet,
} from './blind-input.ts';
import { compareRankingText, rankingSemanticDigest } from './stable-json.ts';

export const RANKING_BASELINE_VERSIONS = {
  retrievalOrder: 'ranking-retrieval-order-diagnostic/1.0.0',
  allInsufficient: 'ranking-all-insufficient-abstention/1.0.0',
  targetBlind: 'ranking-target-blind-candidate-feature/1.0.0',
  targetAware: 'ranking-weak-target-aware-exact-compatibility/1.0.0',
  hardConflictControl: 'ranking-hard-conflict-negative-control/1.0.0',
  syntheticOracle: 'ranking-synthetic-oracle/1.0.0',
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
      { target: false, evidence: true },
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
    predictionSetVersion: 'ranking-v1-prediction-set/1.0.0' as const,
    predictionSetId: `ranking-v1-${key}-predictions`,
    baselineId: specification.baselineId,
    baselineVersion: specification.baselineVersion,
    baselineSpecificationDigest: specification.specificationDigest,
    corpusId: 'ranking-v1' as const,
    corpusVersion: '1.0.0' as const,
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
  return completePrediction({
    input,
    outcome: positive.length > 0 ? 'recommend' : 'insufficient-evidence',
    candidates,
    orderedPositiveIds: positive.map(({ candidateId }) => candidateId),
    tieAll: false,
    evidenceNeededResolutions: [],
    coverage: [],
    appliedPreferenceIds: [],
    ignoredPreferenceIds: [],
    hardenedPreferenceIds: [],
    hardConstraintConflicts: [],
  });
}

function allInsufficientStrategy(
  input: RankingBlindStrategyInput,
): Omit<RankingCasePrediction, 'caseId'> {
  return completePrediction({
    input,
    outcome: 'insufficient-evidence',
    candidates: input.candidates.map(({ candidateId }) => ({
      candidateId,
      disposition: 'insufficient-evidence',
      reasonCodes: ['responsible-abstention-no-fit-authority'],
      evidenceIds: [],
      unknownIds: [`unknown-${candidateId}-fit`],
    })),
    orderedPositiveIds: [],
    tieAll: false,
    evidenceNeededResolutions: [],
    coverage: [],
    appliedPreferenceIds: [],
    ignoredPreferenceIds: [],
    hardenedPreferenceIds: [],
    hardConstraintConflicts: [],
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
  const evidenceByCandidate = new Map(
    input.candidateEvidence.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const handoffByCandidate = new Map(
    input.handoffCandidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const successBindings = input.criteria.bindings.filter(
    ({ criterionKind }) => criterionKind === 'success-condition',
  );
  const preferenceBindings = input.criteria.bindings.filter(
    ({ criterionKind }) => criterionKind === 'preference',
  );
  const globallyFailClosed = successBindings.some(
    (binding) =>
      binding.bindingState === 'unbound' &&
      binding.materiality !== 'non-material',
  );
  const targetWithheld =
    targetAware &&
    input.target !== null &&
    successBindings.some((binding) =>
      binding.targetFactDependencies.some((dependency) =>
        input.target?.withheldCategories.includes(dependency),
      ),
    );
  const scored: {
    candidate: {
      candidateId: string;
      disposition: RankingDisposition;
      reasonCodes: readonly string[];
      evidenceIds: readonly string[];
      unknownIds: readonly string[];
    };
    score: number;
  }[] = [];
  const hardConstraintConflicts: RankingCasePrediction['hardConstraintConflicts'][number][] =
    [];
  const evidenceNeededResolutions: RankingCasePrediction['evidenceNeededResolutions'][number][] =
    [];
  const coverage: RankingCasePrediction['successConditionCoverage'][number][] =
    [];
  for (const identity of input.candidates) {
    const evidence = evidenceByCandidate.get(identity.candidateId);
    const handoff = handoffByCandidate.get(identity.candidateId);
    if (evidence === undefined || handoff === undefined) {
      throw new Error('Baseline candidate authority is incomplete.');
    }
    const conflictObservations = evidence.observations.filter(
      ({ feature, assertion }) =>
        feature.startsWith('hard-constraint:') && assertion === 'conflict',
    );
    for (const observation of conflictObservations) {
      hardConstraintConflicts.push({
        candidateId: identity.candidateId,
        constraintId: observation.feature.slice('hard-constraint:'.length),
        reasonCode:
          input.request.hardConstraints.find(
            ({ criterionId }) =>
              criterionId ===
              observation.feature.slice('hard-constraint:'.length),
          )?.reasonCode ?? 'known-hard-conflict',
        evidenceIds: [observation.evidenceId],
      });
    }
    const resolutions = handoff.unresolvedHardEvaluations.map((unresolved) => {
      const assertion = evidence.closureAssertions.find(
        ({ evaluationId }) => evaluationId === unresolved.evaluationId,
      );
      const resolution = assertion?.resolution ?? 'unresolved';
      const entry = {
        candidateId: identity.candidateId,
        evaluationId: unresolved.evaluationId,
        resolution,
        evidenceIds: assertion?.evidenceIds ?? [],
      };
      evidenceNeededResolutions.push(entry);
      return resolution;
    });
    const boundSuccessIds = successBindings
      .filter(({ bindingState }) => bindingState === 'bound')
      .map(({ criterionId }) => criterionId);
    for (const binding of successBindings) {
      coverage.push({
        candidateId: identity.candidateId,
        criterionId: binding.criterionId,
        state:
          binding.bindingState === 'unbound'
            ? binding.materiality === 'non-material'
              ? 'not-counted-approved-non-material'
              : 'fail-closed'
            : evidence.supportedSuccessConditionIds.includes(
                  binding.criterionId,
                )
              ? 'covered'
              : 'not-covered',
      });
    }
    const allBoundSuccess = boundSuccessIds.every((criterionId) =>
      evidence.supportedSuccessConditionIds.includes(criterionId),
    );
    const closureConflict = resolutions.includes('conflict');
    const closureUnresolved = resolutions.includes('unresolved');
    const hardConflict = conflictObservations.length > 0 || closureConflict;
    const insufficient =
      globallyFailClosed ||
      targetWithheld ||
      closureUnresolved ||
      !allBoundSuccess;
    let score = evidence.supportedSuccessConditionIds.length * 100;
    const boundPreferenceIds = new Set(
      preferenceBindings
        .filter(({ bindingState }) => bindingState === 'bound')
        .map(({ criterionId }) => criterionId),
    );
    score +=
      evidence.supportedPreferenceIds.filter((id) => boundPreferenceIds.has(id))
        .length * 5;
    if (targetAware && input.target !== null) {
      score += exactCompatibilityScore(
        evidence.compatibility,
        input.target.facts,
      );
    }
    scored.push({
      score,
      candidate: {
        candidateId: identity.candidateId,
        disposition: hardConflict
          ? 'rejected'
          : insufficient
            ? 'insufficient-evidence'
            : 'viable',
        reasonCodes: hardConflict
          ? [
              hardConstraintConflicts.find(
                (conflict) => conflict.candidateId === identity.candidateId,
              )?.reasonCode ?? 'known-hard-conflict',
            ]
          : insufficient
            ? ['material-fit-authority-insufficient']
            : ['bound-success-supported'],
        evidenceIds: evidence.observations
          .filter(({ assertion }) => assertion !== 'unknown')
          .map(({ evidenceId }) => evidenceId),
        unknownIds: insufficient ? [`unknown-${identity.candidateId}-fit`] : [],
      },
    });
  }
  const positives = scored
    .filter(({ candidate }) => candidate.disposition === 'viable')
    .sort(
      (left, right) =>
        right.score - left.score ||
        compareRankingText(
          left.candidate.candidateId,
          right.candidate.candidateId,
        ),
    );
  if (positives.length > 0) {
    const topScore = positives[0]?.score;
    for (const item of positives) {
      if (item.score === topScore) item.candidate.disposition = 'recommended';
    }
  }
  const candidates = scored
    .map(({ candidate }) => candidate)
    .sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    );
  const unresolvedExists = candidates.some(
    ({ disposition }) => disposition === 'insufficient-evidence',
  );
  const outcome =
    positives.length > 0
      ? 'recommend'
      : unresolvedExists
        ? 'insufficient-evidence'
        : 'no-viable-candidate';
  const appliedPreferenceIds = preferenceBindings
    .filter(
      (binding) =>
        binding.bindingState === 'bound' &&
        input.candidateEvidence.some((candidate) =>
          candidate.supportedPreferenceIds.includes(binding.criterionId),
        ),
    )
    .map(({ criterionId }) => criterionId)
    .sort(compareRankingText);
  const ignoredPreferenceIds = preferenceBindings
    .filter(({ bindingState }) => bindingState === 'unbound')
    .map(({ criterionId }) => criterionId)
    .sort(compareRankingText);
  return completePrediction({
    input,
    outcome,
    candidates,
    orderedPositiveIds: positives.map(({ candidate }) => candidate.candidateId),
    tieAll:
      positives.length > 1 &&
      positives.every(({ score }) => score === positives[0]?.score),
    evidenceNeededResolutions,
    coverage,
    appliedPreferenceIds,
    ignoredPreferenceIds,
    hardenedPreferenceIds: [],
    hardConstraintConflicts,
  });
}

function hardConflictControlStrategy(
  input: RankingBlindStrategyInput,
): Omit<RankingCasePrediction, 'caseId'> {
  const conflict = input.candidateEvidence
    .flatMap((candidate) =>
      candidate.observations
        .filter(
          ({ feature, assertion }) =>
            feature.startsWith('hard-constraint:') && assertion === 'conflict',
        )
        .map((observation) => ({ candidate, observation })),
    )
    .sort((left, right) =>
      compareRankingText(
        left.candidate.candidateId,
        right.candidate.candidateId,
      ),
    )[0];
  if (conflict === undefined) {
    throw new Error('Negative control requires a known hard conflict.');
  }
  const candidates = input.candidates.map(({ candidateId }) => ({
    candidateId,
    disposition:
      candidateId === conflict.candidate.candidateId
        ? ('recommended' as const)
        : ('rejected' as const),
    reasonCodes:
      candidateId === conflict.candidate.candidateId
        ? ['negative-control-promoted-known-conflict']
        : ['negative-control-rejected'],
    evidenceIds:
      candidateId === conflict.candidate.candidateId
        ? [conflict.observation.evidenceId]
        : [],
    unknownIds: [],
  }));
  return completePrediction({
    input,
    outcome: 'recommend',
    candidates,
    orderedPositiveIds: [conflict.candidate.candidateId],
    tieAll: false,
    evidenceNeededResolutions: [],
    coverage: [],
    appliedPreferenceIds: [],
    ignoredPreferenceIds: [],
    hardenedPreferenceIds: [],
    hardConstraintConflicts: [],
  });
}

function completePrediction(input: {
  readonly input: RankingBlindStrategyInput;
  readonly outcome: RankingCasePrediction['outcome'];
  readonly candidates: readonly RankingPredictionCandidate[];
  readonly orderedPositiveIds: readonly string[];
  readonly tieAll: boolean;
  readonly evidenceNeededResolutions: RankingCasePrediction['evidenceNeededResolutions'];
  readonly coverage: RankingCasePrediction['successConditionCoverage'];
  readonly appliedPreferenceIds: readonly string[];
  readonly ignoredPreferenceIds: readonly string[];
  readonly hardenedPreferenceIds: readonly string[];
  readonly hardConstraintConflicts: RankingCasePrediction['hardConstraintConflicts'];
}): Omit<RankingCasePrediction, 'caseId'> {
  const visible = input.orderedPositiveIds.slice(
    0,
    input.input.requestedMaximumResults,
  );
  const rankGroups = input.tieAll
    ? visible.length > 0
      ? [visible]
      : []
    : visible.map((candidateId) => [candidateId]);
  return {
    outcome: input.outcome,
    candidates: [...input.candidates].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    ),
    presentation: visible,
    rankGroups,
    rankRelations: [],
    incomparablePairs: [],
    hardConstraintConflicts: [...input.hardConstraintConflicts].sort(
      (left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.constraintId}`,
          `${right.candidateId}\0${right.constraintId}`,
        ),
    ),
    evidenceNeededResolutions: [...input.evidenceNeededResolutions].sort(
      (left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.evaluationId}`,
          `${right.candidateId}\0${right.evaluationId}`,
        ),
    ),
    successConditionCoverage: [...input.coverage].sort((left, right) =>
      compareRankingText(
        `${left.candidateId}\0${left.criterionId}`,
        `${right.candidateId}\0${right.criterionId}`,
      ),
    ),
    appliedPreferenceIds: [...input.appliedPreferenceIds],
    ignoredPreferenceIds: [...input.ignoredPreferenceIds],
    hardenedPreferenceIds: [...input.hardenedPreferenceIds],
  };
}

function exactCompatibilityScore(
  compatibility: Readonly<Record<string, string>>,
  target: NonNullable<RankingBlindStrategyInput['target']>['facts'],
): number {
  const approved = [
    'runtime',
    'framework',
    'redis',
    'workerCapability',
    'deployment',
  ] as const;
  let score = 0;
  for (const facet of approved) {
    const candidateValue = compatibility[facet];
    if (candidateValue === '*' || candidateValue === target[facet]) {
      score += 10;
    }
  }
  if (
    compatibility['identity'] !== undefined &&
    target.identity.includes(compatibility['identity'])
  ) {
    score += 10;
  }
  if (
    compatibility['resource'] !== undefined &&
    target.resources.includes(compatibility['resource'])
  ) {
    score += 10;
  }
  if (
    compatibility['dataPolicy'] !== undefined &&
    target.dataPolicies.includes(compatibility['dataPolicy'])
  ) {
    score += 10;
  }
  return score;
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
