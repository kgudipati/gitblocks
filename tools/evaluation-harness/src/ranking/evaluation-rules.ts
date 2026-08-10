import type {
  EvidenceNeededResolution,
  RankingBlindStrategyInput,
  RankingCandidateEvidence,
  RankingCasePrediction,
  RankingCriterionBinding,
  RankingHardConstraintRule,
  RankingHandoffCandidate,
  RankingTargetAuthority,
  RankingUnresolvedEvaluation,
} from './contracts.ts';
import { compareRankingText } from './stable-json.ts';

export const RANKING_EVALUATION_RULE_VERSION =
  'ranking-v1-evaluation-rules/2.0.0' as const;

type RuleState = 'supported' | 'generic' | 'not-supported' | 'unknown';
export type FitRelation =
  'tie' | 'left-higher' | 'right-higher' | 'incomparable';

interface RuleResult {
  readonly state: RuleState;
  readonly evidenceIds: readonly string[];
}

export interface DerivedCandidateFit {
  readonly candidateId: string;
  readonly hardConflicts: RankingCasePrediction['hardConstraintConflicts'];
  readonly resolutions: RankingCasePrediction['evidenceNeededResolutions'];
  readonly coverage: RankingCasePrediction['successConditionCoverage'];
  readonly disposition: 'viable' | 'rejected' | 'insufficient-evidence';
  readonly reasonCodes: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly unknownIds: readonly string[];
  readonly successVector: readonly number[];
  readonly preferenceVectors: ReadonlyMap<string, number>;
  readonly targetVector: readonly number[];
}

export function deriveCandidateFit(
  input: RankingBlindStrategyInput,
  candidateId: string,
  targetAware: boolean,
): DerivedCandidateFit {
  const evidence = requireCandidateEvidence(input, candidateId);
  const handoff = requireHandoffCandidate(input, candidateId);
  const hardConflicts: RankingCasePrediction['hardConstraintConflicts'][number][] =
    [];
  const hardUnknowns: string[] = [];
  for (const rule of input.criteria.hardConstraintRules) {
    const result = evaluateHardRule(rule, evidence, input.target, targetAware);
    if (result.state === 'conflict') {
      const requestConstraint = input.request.hardConstraints.find(
        ({ criterionId }) => criterionId === rule.constraintId,
      );
      hardConflicts.push({
        candidateId,
        constraintId: rule.constraintId,
        reasonCode: requestConstraint?.reasonCode ?? 'known-hard-conflict',
        evidenceIds: result.evidenceIds,
      });
    } else if (result.state === 'unresolved') {
      hardUnknowns.push(`unknown-${candidateId}-${rule.constraintId}`);
    }
  }

  const resolutions = handoff.unresolvedHardEvaluations.map((evaluation) => {
    const result = evaluateUnresolvedRule(
      evaluation,
      evidence,
      input.target,
      targetAware,
    );
    return {
      candidateId,
      evaluationId: evaluation.evaluationId,
      resolution: result.resolution,
      evidenceIds: result.evidenceIds,
    };
  });
  const coverage: RankingCasePrediction['successConditionCoverage'][number][] =
    [];
  const successVector: number[] = [];
  const successUnknowns: string[] = [];
  let globalMaterialUnbound = false;
  for (const binding of input.criteria.bindings.filter(
    ({ criterionKind }) => criterionKind === 'success-condition',
  )) {
    if (binding.bindingState === 'unbound') {
      const failClosed = binding.materiality !== 'non-material';
      globalMaterialUnbound ||= failClosed;
      coverage.push({
        candidateId,
        criterionId: binding.criterionId,
        state: failClosed ? 'fail-closed' : 'not-counted-approved-non-material',
      });
      continue;
    }
    const result = evaluateCriterionRule(
      binding,
      evidence,
      input.target,
      targetAware,
    );
    const covered = result.state === 'supported' || result.state === 'generic';
    coverage.push({
      candidateId,
      criterionId: binding.criterionId,
      state: covered ? 'covered' : 'not-covered',
    });
    successVector.push(ruleStateValue(result.state));
    if (result.state === 'unknown') {
      successUnknowns.push(`unknown-${candidateId}-${binding.criterionId}`);
    }
  }

  const preferenceVectors = new Map<string, number>();
  for (const binding of input.criteria.bindings.filter(
    ({ criterionKind }) => criterionKind === 'preference',
  )) {
    if (binding.bindingState === 'unbound') continue;
    const result = evaluateCriterionRule(
      binding,
      evidence,
      input.target,
      targetAware,
    );
    preferenceVectors.set(binding.criterionId, ruleStateValue(result.state));
  }

  const targetVector = targetAware
    ? deriveTargetCompatibilityVector(evidence, input.target)
    : [];
  const closureConflict = resolutions.some(
    ({ resolution }) => resolution === 'conflict',
  );
  const closureUnknowns = resolutions
    .filter(({ resolution }) => resolution === 'unresolved')
    .map(({ evaluationId }) => `unknown-${candidateId}-${evaluationId}`);
  const rejected = hardConflicts.length > 0 || closureConflict;
  const insufficient =
    !rejected &&
    (globalMaterialUnbound ||
      hardUnknowns.length > 0 ||
      successUnknowns.length > 0 ||
      closureUnknowns.length > 0);
  const supportingEvidence = new Set(
    evidence.observations
      .filter(({ state }) => state === 'known')
      .map(({ evidenceId }) => evidenceId),
  );
  return {
    candidateId,
    hardConflicts,
    resolutions,
    coverage,
    disposition: rejected
      ? 'rejected'
      : insufficient
        ? 'insufficient-evidence'
        : 'viable',
    reasonCodes:
      hardConflicts.length > 0
        ? hardConflicts.map(({ reasonCode }) => reasonCode)
        : closureConflict
          ? ['evidence-needed-conflict']
          : insufficient
            ? ['material-fit-authority-insufficient']
            : successVector.some((value) => value === 0)
              ? ['bound-success-gap-known']
              : ['bound-success-supported'],
    evidenceIds: [...supportingEvidence].sort(compareRankingText),
    unknownIds: [
      ...(globalMaterialUnbound
        ? [`unknown-${candidateId}-material-unbound-success`]
        : []),
      ...hardUnknowns,
      ...successUnknowns,
      ...closureUnknowns,
    ].sort(compareRankingText),
    successVector,
    preferenceVectors,
    targetVector,
  };
}

export function compareCandidateFit(
  left: DerivedCandidateFit,
  right: DerivedCandidateFit,
  preferenceIds: readonly string[],
  includePreferences = true,
): FitRelation {
  const success = compareVector(left.successVector, right.successVector);
  if (success !== 'tie') return success;
  if (includePreferences) {
    const preference = compareVector(
      preferenceIds.map((id) => left.preferenceVectors.get(id) ?? 0),
      preferenceIds.map((id) => right.preferenceVectors.get(id) ?? 0),
    );
    if (preference !== 'tie') return preference;
  }
  return compareVector(left.targetVector, right.targetVector);
}

export function createPartialOrderPresentation(
  candidates: readonly DerivedCandidateFit[],
  preferenceIds: readonly string[],
  maximumResults: number,
): Pick<
  RankingCasePrediction,
  'presentation' | 'rankGroups' | 'rankRelations' | 'incomparablePairs'
> {
  const remaining = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const relations: RankingCasePrediction['rankRelations'][number][] = [];
  const incomparable: [string, string][] = [];
  const relationByPair = new Map<string, FitRelation>();
  const orderedCandidates = [...candidates].sort((left, right) =>
    compareRankingText(left.candidateId, right.candidateId),
  );
  for (
    let leftIndex = 0;
    leftIndex < orderedCandidates.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < orderedCandidates.length;
      rightIndex += 1
    ) {
      const left = orderedCandidates[leftIndex];
      const right = orderedCandidates[rightIndex];
      if (left === undefined || right === undefined) continue;
      const relation = compareCandidateFit(left, right, preferenceIds);
      relationByPair.set(
        pairKey(left.candidateId, right.candidateId),
        relation,
      );
      if (relation === 'left-higher') {
        relations.push({
          higherCandidateId: left.candidateId,
          lowerCandidateId: right.candidateId,
        });
      } else if (relation === 'right-higher') {
        relations.push({
          higherCandidateId: right.candidateId,
          lowerCandidateId: left.candidateId,
        });
      } else if (relation === 'incomparable') {
        incomparable.push([left.candidateId, right.candidateId]);
      }
    }
  }

  const presentation: string[] = [];
  const includedLayers: string[][] = [];
  while (remaining.size > 0) {
    const layer = [...remaining.values()]
      .filter(
        (candidate) =>
          ![...remaining.values()].some(
            (other) =>
              other.candidateId !== candidate.candidateId &&
              compareCandidateFit(other, candidate, preferenceIds) ===
                'left-higher',
          ),
      )
      .map(({ candidateId }) => candidateId)
      .sort(compareRankingText);
    if (layer.length === 0) throw new Error('Partial-order cycle detected.');
    if (presentation.length + layer.length > maximumResults) break;
    presentation.push(...layer);
    includedLayers.push(layer);
    layer.forEach((candidateId) => remaining.delete(candidateId));
  }

  const rankGroups: string[][] = [];
  for (const layer of includedLayers) {
    if (layer.length === 1) {
      rankGroups.push(layer);
      continue;
    }
    const allTied = layer.every((left, leftIndex) =>
      layer
        .slice(leftIndex + 1)
        .every((right) => relationByPair.get(pairKey(left, right)) === 'tie'),
    );
    if (allTied) rankGroups.push(layer);
  }
  return {
    presentation,
    rankGroups,
    rankRelations: relations.sort((left, right) =>
      compareRankingText(
        `${left.higherCandidateId}\0${left.lowerCandidateId}`,
        `${right.higherCandidateId}\0${right.lowerCandidateId}`,
      ),
    ),
    incomparablePairs: incomparable.sort((left, right) =>
      compareRankingText(left.join('\0'), right.join('\0')),
    ),
  };
}

export function derivePreferenceConsequences(
  candidates: readonly DerivedCandidateFit[],
  bindings: readonly RankingCriterionBinding[],
): RankingCasePrediction['preferenceConsequences'] {
  const positives = candidates.filter(
    ({ disposition }) => disposition === 'viable',
  );
  return bindings
    .filter(({ criterionKind }) => criterionKind === 'preference')
    .map((binding) => {
      if (binding.bindingState === 'unbound') {
        return {
          criterionId: binding.criterionId,
          state: 'ignored-unbound' as const,
          affectedPairs: [],
        };
      }
      const affectedPairs: [string, string][] = [];
      for (let leftIndex = 0; leftIndex < positives.length; leftIndex += 1) {
        for (
          let rightIndex = leftIndex + 1;
          rightIndex < positives.length;
          rightIndex += 1
        ) {
          const left = positives[leftIndex];
          const right = positives[rightIndex];
          if (left === undefined || right === undefined) continue;
          const without = compareCandidateFit(left, right, [], false);
          const withPreference = compareCandidateFit(
            left,
            right,
            [binding.criterionId],
            true,
          );
          if (without !== withPreference) {
            affectedPairs.push(
              [left.candidateId, right.candidateId].sort(
                compareRankingText,
              ) as [string, string],
            );
          }
        }
      }
      return {
        criterionId: binding.criterionId,
        state:
          affectedPairs.length > 0
            ? ('applied-and-changed-supported-comparison' as const)
            : ('bound-but-no-applicable-positive-comparison' as const),
        affectedPairs: affectedPairs.sort((left, right) =>
          compareRankingText(left.join('\0'), right.join('\0')),
        ),
      };
    })
    .sort((left, right) =>
      compareRankingText(left.criterionId, right.criterionId),
    );
}

function evaluateCriterionRule(
  binding: RankingCriterionBinding,
  evidence: RankingCandidateEvidence,
  target: RankingTargetAuthority | null,
  targetAware: boolean,
): RuleResult {
  if (binding.comparisonRuleId === null)
    return { state: 'unknown', evidenceIds: [] };
  const observation = observationFor(
    evidence,
    binding.candidateFeatureDependencies[0],
  );
  if (observation === undefined || observation.state === 'unknown') {
    return {
      state: 'unknown',
      evidenceIds: observation ? [observation.evidenceId] : [],
    };
  }
  if (binding.comparisonRuleId === 'candidate-has-all/1.0.0') {
    return {
      state: binding.expectedValues.every((value) =>
        observation.values.includes(value),
      )
        ? 'supported'
        : observation.completeness === 'complete'
          ? 'not-supported'
          : 'unknown',
      evidenceIds: [observation.evidenceId],
    };
  }
  if (binding.comparisonRuleId === 'candidate-target-match/1.0.0') {
    if (!targetAware || target === null)
      return { state: 'unknown', evidenceIds: [observation.evidenceId] };
    const targetValues = targetDependencyValues(
      target,
      binding.targetFactDependencies[0],
    );
    if (targetValues === null)
      return { state: 'unknown', evidenceIds: [observation.evidenceId] };
    if (observation.values.some((value) => targetValues.includes(value))) {
      return { state: 'supported', evidenceIds: [observation.evidenceId] };
    }
    if (observation.values.includes('universal')) {
      return { state: 'generic', evidenceIds: [observation.evidenceId] };
    }
    return {
      state:
        observation.completeness === 'complete' ? 'not-supported' : 'unknown',
      evidenceIds: [observation.evidenceId],
    };
  }
  if (binding.comparisonRuleId === 'candidate-requirements-available/1.0.0') {
    if (!targetAware || target === null)
      return { state: 'unknown', evidenceIds: [observation.evidenceId] };
    const available = targetDependencyValues(
      target,
      binding.targetFactDependencies[0],
    );
    if (available === null)
      return { state: 'unknown', evidenceIds: [observation.evidenceId] };
    return {
      state: observation.values.every((value) => available.includes(value))
        ? 'supported'
        : observation.completeness === 'complete'
          ? 'not-supported'
          : 'unknown',
      evidenceIds: [observation.evidenceId],
    };
  }
  if (binding.comparisonRuleId === 'prefer-available-candidate-values/1.0.0') {
    if (!targetAware || target === null) {
      return { state: 'unknown', evidenceIds: [observation.evidenceId] };
    }
    const available = targetDependencyValues(
      target,
      binding.targetFactDependencies[0],
    );
    if (available === null) {
      return { state: 'unknown', evidenceIds: [observation.evidenceId] };
    }
    return {
      state: observation.values.some((value) => available.includes(value))
        ? 'supported'
        : observation.completeness === 'complete'
          ? 'not-supported'
          : 'unknown',
      evidenceIds: [observation.evidenceId],
    };
  }
  if (binding.comparisonRuleId === 'prefer-candidate-values/1.0.0') {
    return {
      state: observation.values.some((value) =>
        binding.expectedValues.includes(value),
      )
        ? 'supported'
        : observation.completeness === 'complete'
          ? 'not-supported'
          : 'unknown',
      evidenceIds: [observation.evidenceId],
    };
  }
  throw new Error('Unknown ranking criterion evaluation rule.');
}

function evaluateHardRule(
  rule: RankingHardConstraintRule,
  evidence: RankingCandidateEvidence,
  target: RankingTargetAuthority | null,
  targetAware: boolean,
): {
  readonly state: 'satisfied' | 'conflict' | 'unresolved';
  readonly evidenceIds: readonly string[];
} {
  return evaluateHardLikeRule(rule, evidence, target, targetAware);
}

function evaluateUnresolvedRule(
  rule: RankingUnresolvedEvaluation,
  evidence: RankingCandidateEvidence,
  target: RankingTargetAuthority | null,
  targetAware: boolean,
): {
  readonly resolution: EvidenceNeededResolution;
  readonly evidenceIds: readonly string[];
} {
  const result = evaluateHardLikeRule(
    {
      constraintId: rule.evaluationId,
      modality: rule.modality,
      semanticFacet: rule.facet,
      semanticConcept: rule.conceptId ?? 'unresolved-evaluation',
      targetFactDependencies: rule.targetFactDependencies,
      candidateFeatureDependencies: rule.candidateFeatureDependencies,
      evaluationRuleId: rule.ruleId,
      expectedValues: rule.expectedValues,
    },
    evidence,
    target,
    targetAware,
  );
  return { resolution: result.state, evidenceIds: result.evidenceIds };
}

function evaluateHardLikeRule(
  rule: RankingHardConstraintRule,
  evidence: RankingCandidateEvidence,
  target: RankingTargetAuthority | null,
  targetAware: boolean,
): {
  readonly state: 'satisfied' | 'conflict' | 'unresolved';
  readonly evidenceIds: readonly string[];
} {
  const observation = observationFor(
    evidence,
    rule.candidateFeatureDependencies[0],
  );
  if (observation === undefined || observation.state === 'unknown') {
    return {
      state: 'unresolved',
      evidenceIds: observation ? [observation.evidenceId] : [],
    };
  }
  let matches: boolean;
  if (rule.evaluationRuleId === 'candidate-has-all/1.0.0') {
    matches = rule.expectedValues.every((value) =>
      observation.values.includes(value),
    );
  } else if (rule.evaluationRuleId === 'candidate-target-match/1.0.0') {
    if (!targetAware || target === null)
      return { state: 'unresolved', evidenceIds: [observation.evidenceId] };
    const targetValues = targetDependencyValues(
      target,
      rule.targetFactDependencies[0],
    );
    if (targetValues === null)
      return { state: 'unresolved', evidenceIds: [observation.evidenceId] };
    matches =
      observation.values.includes('universal') ||
      observation.values.some((value) => targetValues.includes(value));
  } else if (
    rule.evaluationRuleId === 'candidate-requirements-available/1.0.0'
  ) {
    if (!targetAware || target === null)
      return { state: 'unresolved', evidenceIds: [observation.evidenceId] };
    const available = targetDependencyValues(
      target,
      rule.targetFactDependencies[0],
    );
    if (available === null)
      return { state: 'unresolved', evidenceIds: [observation.evidenceId] };
    matches = observation.values.every((value) => available.includes(value));
  } else {
    throw new Error('Unknown ranking hard-constraint evaluation rule.');
  }
  if (!matches && observation.completeness !== 'complete') {
    return { state: 'unresolved', evidenceIds: [observation.evidenceId] };
  }
  const conflict = rule.modality === 'required' ? !matches : matches;
  return {
    state: conflict ? 'conflict' : 'satisfied',
    evidenceIds: [observation.evidenceId],
  };
}

function deriveTargetCompatibilityVector(
  evidence: RankingCandidateEvidence,
  target: RankingTargetAuthority | null,
): readonly number[] {
  if (target === null) return [];
  const facets = [
    ['runtime-support', 'runtime'],
    ['framework-support', 'framework'],
    ['deployment-support', 'deployment'],
  ] as const;
  return facets.map(([featureId, targetDependency]) => {
    const observation = observationFor(evidence, featureId);
    const targetValues = targetDependencyValues(target, targetDependency);
    if (
      observation === undefined ||
      observation.state === 'unknown' ||
      targetValues === null
    )
      return 0;
    if (observation.values.some((value) => targetValues.includes(value)))
      return 2;
    if (observation.values.includes('universal')) return 1;
    return 0;
  });
}

function observationFor(
  evidence: RankingCandidateEvidence,
  featureId: string | undefined,
) {
  if (featureId === undefined) return undefined;
  return evidence.observations.find(
    (observation) => observation.featureId === featureId,
  );
}

function targetDependencyValues(
  target: RankingTargetAuthority,
  dependency: string | undefined,
): readonly string[] | null {
  if (
    dependency === undefined ||
    target.withheldCategories.includes(dependency)
  )
    return null;
  const facts = target.facts;
  if (dependency === 'identity') return facts.identity;
  if (dependency === 'resources') return facts.resources;
  if (dependency === 'data-policy') return facts.dataPolicies;
  if (dependency === 'runtime') return [facts.runtime];
  if (dependency === 'framework') return [facts.framework];
  if (dependency === 'package-manager') return [facts.packageManager];
  if (dependency === 'database') return [facts.database];
  if (dependency === 'redis') return [facts.redis];
  if (dependency === 'orm') return [facts.orm];
  if (dependency === 'worker-capability') return [facts.workerCapability];
  if (dependency === 'deployment') return [facts.deployment];
  if (dependency === 'region') return [facts.region];
  if (dependency === 'external-network') return [facts.externalNetwork];
  return null;
}

function ruleStateValue(state: RuleState): number {
  return state === 'supported' ? 2 : state === 'generic' ? 1 : 0;
}

function compareVector(
  left: readonly number[],
  right: readonly number[],
): FitRelation {
  const length = Math.max(left.length, right.length);
  let leftBetter = false;
  let rightBetter = false;
  for (let index = 0; index < length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;
    leftBetter ||= leftValue > rightValue;
    rightBetter ||= rightValue > leftValue;
  }
  if (leftBetter && rightBetter) return 'incomparable';
  if (leftBetter) return 'left-higher';
  if (rightBetter) return 'right-higher';
  return 'tie';
}

function requireCandidateEvidence(
  input: RankingBlindStrategyInput,
  candidateId: string,
): RankingCandidateEvidence {
  const evidence = input.candidateEvidence.find(
    (candidate) => candidate.candidateId === candidateId,
  );
  if (evidence === undefined)
    throw new Error('Candidate evidence is incomplete.');
  return evidence;
}

function requireHandoffCandidate(
  input: RankingBlindStrategyInput,
  candidateId: string,
): RankingHandoffCandidate {
  const handoff = input.handoffCandidates.find(
    (candidate) => candidate.candidateId === candidateId,
  );
  if (handoff === undefined)
    throw new Error('Candidate handoff is incomplete.');
  return handoff;
}

function pairKey(left: string, right: string): string {
  return [left, right].sort(compareRankingText).join('\0');
}
