import type {
  RankingAuditAuthority,
  RankingBaselineSpecificationAuthority,
  RankingBlindCaseAuthority,
  RankingBlindStrategyInput,
  RankingCandidateEvidence,
  RankingCriterionAuthority,
  RankingCriterionBinding,
  RankingEvidenceAuthority,
  RankingGoldAuthority,
  RankingGoldCase,
  RankingHandoffAuthority,
  RankingRequestAuthority,
  RankingResolvedCase,
  RankingReviewRecord,
  RankingReviewerRationaleAuthority,
} from './contracts.ts';
import {
  compareCandidateFit,
  createPartialOrderPresentation,
  deriveCandidateFit,
  deriveDecisionEvidenceIds,
  derivePreferenceConsequences,
  type DerivedCandidateFit,
} from './evaluation-rules.ts';
import {
  compareRankingText,
  rankingDigest,
  rankingSemanticDigest,
} from './stable-json.ts';

interface CorrectedAuthority {
  readonly blind: RankingBlindCaseAuthority;
  readonly gold: RankingGoldAuthority;
  readonly rationale: RankingReviewerRationaleAuthority;
  readonly review: RankingReviewRecord;
}

export function authorCorrectedBaselineSpecifications(
  authority: RankingBaselineSpecificationAuthority,
): RankingBaselineSpecificationAuthority {
  const specifications = authority.specifications.map((specification) => {
    if (specification.baselineId === 'target-blind-candidate-feature') {
      const withoutDigest = {
        ...specification,
        baselineVersion: 'ranking-target-blind-candidate-feature/3.0.0',
        maximumResultBehavior:
          'Add whole nondominated layers only. If the next complete layer crosses three, omit that layer and every rank relation or incomparable pair involving an omitted candidate; if the maximal layer exceeds three, presentation and all ranking-reference surfaces are empty.',
      };
      const digestInput: Record<string, unknown> = { ...withoutDigest };
      delete digestInput['specificationDigest'];
      return {
        ...withoutDigest,
        specificationDigest: rankingDigest(digestInput),
      };
    }
    if (specification.baselineId === 'weak-target-aware-exact-compatibility') {
      const withoutDigest = {
        ...specification,
        baselineVersion: 'ranking-weak-target-aware-exact-compatibility/3.0.0',
        tieBehavior:
          'Success and preference vectors are ignored after disposition and coverage. Equal preregistered target-compatibility vectors form complete tie groups; independent target-vector trade-offs are incomparable. Candidate ID only canonicalizes members inside an already-derived relation.',
        maximumResultBehavior:
          'Add whole nondominated target-compatibility layers only. If the next complete layer crosses three, omit that layer and every rank relation or incomparable pair involving an omitted candidate; if the maximal layer exceeds three, presentation and all ranking-reference surfaces are empty.',
      };
      const digestInput: Record<string, unknown> = { ...withoutDigest };
      delete digestInput['specificationDigest'];
      return {
        ...withoutDigest,
        specificationDigest: rankingDigest(digestInput),
      };
    }
    return specification;
  });
  const withoutDigest = {
    ...authority,
    authorityVersion: 'ranking-v1-baseline-specifications/3.0.0' as const,
    specifications,
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

interface PopularityHardRule {
  readonly featureId: string;
  readonly expectedValue: string;
  readonly semanticFacet: string;
  readonly semanticConcept: string;
  readonly statement: string;
}

const POPULARITY_HARD_RULES: Readonly<
  Record<RankingRequestAuthority['capabilityFamily'], PopularityHardRule>
> = {
  'audit-logging': {
    featureId: 'integration-mode',
    expectedValue: 'database-extension',
    semanticFacet: 'adoption-unit',
    semanticConcept: 'database-extension-prohibited',
    statement: 'The target prohibits database-extension adoption.',
  },
  authorization: {
    featureId: 'integration-mode',
    expectedValue: 'external-policy-service',
    semanticFacet: 'adoption-unit',
    semanticConcept: 'external-policy-service-prohibited',
    statement: 'The target prohibits an external policy service.',
  },
  'background-jobs': {
    featureId: 'integration-mode',
    expectedValue: 'in-process-scheduler',
    semanticFacet: 'adoption-unit',
    semanticConcept: 'in-process-scheduler-prohibited',
    statement: 'The target prohibits an in-process scheduler.',
  },
  'rate-limiting': {
    featureId: 'operational-primitives',
    expectedValue: 'local-scheduling',
    semanticFacet: 'operational-mode',
    semanticConcept: 'local-only-scheduling-prohibited',
    statement: 'The target prohibits local-only scheduling semantics.',
  },
  webhooks: {
    featureId: 'integration-mode',
    expectedValue: 'external-webhook-service',
    semanticFacet: 'adoption-unit',
    semanticConcept: 'external-webhook-service-prohibited',
    statement: 'The target prohibits an external webhook service.',
  },
};

export function authorCorrectedRankingAuthority(
  blindInput: RankingBlindCaseAuthority,
  evidence: RankingEvidenceAuthority,
  handoff: RankingHandoffAuthority,
  audit: RankingAuditAuthority,
): CorrectedAuthority {
  const requests = blindInput.requests.map(correctRequest);
  const requestById = new Map(
    requests.map((request) => [request.requestAuthorityId, request]),
  );
  const criterionAuthorities = blindInput.criterionAuthorities.map(
    (authority) =>
      correctCriterionAuthority(
        authority,
        requireItem(requestById, authority.requestAuthorityId),
      ),
  );
  const blindWithoutDigest = {
    ...blindInput,
    authorityVersion: 'ranking-v1-blind-cases/3.0.0' as const,
    corpusVersion: '3.0.0' as const,
    requests,
    criterionAuthorities,
  };
  const blind: RankingBlindCaseAuthority = {
    ...blindWithoutDigest,
    semanticDigest: rankingSemanticDigest(blindWithoutDigest),
  };
  const cases = resolveCases(blind, evidence, handoff);
  const goldCases = cases
    .map(authorGoldCase)
    .sort((left, right) => compareRankingText(left.caseId, right.caseId));
  const goldWithoutDigest = {
    authorityVersion: 'ranking-v1-proposed-gold/3.0.0' as const,
    corpusId: 'ranking-v1' as const,
    reviewStatus: 'proposed-not-independently-reviewed' as const,
    cases: goldCases,
    controlledPairDirections: audit.controlledPairs.map((pair) => ({
      pairId: pair.pairId,
      firstCaseId: pair.firstCaseId,
      firstMaximalCandidateIds: recommendedIds(
        requireItem(
          new Map(goldCases.map((item) => [item.caseId, item])),
          pair.firstCaseId,
        ),
      ),
      secondCaseId: pair.secondCaseId,
      secondMaximalCandidateIds: recommendedIds(
        requireItem(
          new Map(goldCases.map((item) => [item.caseId, item])),
          pair.secondCaseId,
        ),
      ),
    })),
  };
  const gold: RankingGoldAuthority = {
    ...goldWithoutDigest,
    semanticDigest: rankingSemanticDigest(goldWithoutDigest),
  };
  const rationaleCases = cases
    .map((resolved) =>
      authorRationaleCase(
        resolved,
        requireItem(
          new Map(goldCases.map((item) => [item.caseId, item])),
          resolved.binding.caseId,
        ),
        audit,
        cases,
      ),
    )
    .sort((left, right) => compareRankingText(left.caseId, right.caseId));
  const rationaleWithoutDigest = {
    authorityVersion: 'ranking-v1-reviewer-rationale/2.0.0' as const,
    corpusId: 'ranking-v1' as const,
    status: 'author-rationale-for-independent-review' as const,
    cases: rationaleCases,
  };
  const rationale: RankingReviewerRationaleAuthority = {
    ...rationaleWithoutDigest,
    semanticDigest: rankingSemanticDigest(rationaleWithoutDigest),
  };
  const reviewWithoutDigest = {
    reviewRecordVersion: 'ranking-v1-review-record/3.0.0' as const,
    corpusId: 'ranking-v1' as const,
    goldAuthorityVersion: 'ranking-v1-proposed-gold/3.0.0' as const,
    reviewerRationaleVersion: 'ranking-v1-reviewer-rationale/2.0.0' as const,
    status: 'independent-review-pending' as const,
    author: 'Codex' as const,
    independentReviewer: null,
    reviewedAt: null,
    adjudication: 'not-started' as const,
    disputedCaseIds: [] as const,
    acceptedCaseIds: [] as const,
    goldDigest: gold.semanticDigest,
    reviewerRationaleDigest: rationale.semanticDigest,
  };
  const review: RankingReviewRecord = {
    ...reviewWithoutDigest,
    semanticDigest: rankingSemanticDigest(reviewWithoutDigest),
  };
  return { blind, gold, rationale, review };
}

function correctRequest(
  request: RankingRequestAuthority,
): RankingRequestAuthority {
  if (!request.requestAuthorityId.includes('-popularity-request'))
    return request;
  const rule = POPULARITY_HARD_RULES[request.capabilityFamily];
  return {
    ...request,
    hardConstraints: [
      {
        criterionId: `${request.requestAuthorityId}-hard-adoption`,
        reasonCode: 'hard-prohibited-adoption-unit',
        statement: rule.statement,
      },
    ],
  };
}

function correctCriterionAuthority(
  authority: RankingCriterionAuthority,
  request: RankingRequestAuthority,
): RankingCriterionAuthority {
  const bindings = authority.bindings.map(correctCriterionBinding);
  const hardConstraintRules = request.requestAuthorityId.includes(
    '-popularity-request',
  )
    ? [popularityHardConstraint(request)]
    : authority.hardConstraintRules;
  const withoutDigest = {
    ...authority,
    requestDigest: rankingDigest(request),
    approvalDigest: rankingDigest({ bindings, hardConstraintRules }),
    bindings,
    hardConstraintRules,
  };
  return {
    ...withoutDigest,
    semanticDigest: rankingSemanticDigest(withoutDigest),
  };
}

function correctCriterionBinding(
  binding: RankingCriterionBinding,
): RankingCriterionBinding {
  if (
    binding.criterionKind !== 'success-condition' ||
    binding.bindingState !== 'bound'
  ) {
    return binding;
  }
  const expected = binding.expectedValues[0];
  if (
    expected === 'sensitive-field-redaction' ||
    expected === 'retry-backoff-restart-survival' ||
    expected === 'distributed-shared-state' ||
    expected === 'tenant-secret-isolation'
  ) {
    return {
      ...binding,
      candidateFeatureDependencies: ['capability-features'],
    };
  }
  if (expected === 'tenant-identity-context') {
    return {
      ...binding,
      semanticFacet: 'identity-context',
      candidateFeatureDependencies: ['identity-inputs'],
      expectedValues: ['actor', 'tenant', 'organization'],
    };
  }
  return binding;
}

function popularityHardConstraint(request: RankingRequestAuthority) {
  const rule = POPULARITY_HARD_RULES[request.capabilityFamily];
  return {
    constraintId: `${request.requestAuthorityId}-hard-adoption`,
    modality: 'prohibited' as const,
    semanticFacet: rule.semanticFacet,
    semanticConcept: rule.semanticConcept,
    targetFactDependencies: [],
    candidateFeatureDependencies: [rule.featureId],
    evaluationRuleId: 'candidate-has-all/1.0.0',
    expectedValues: [rule.expectedValue],
  };
}

function resolveCases(
  blind: RankingBlindCaseAuthority,
  evidence: RankingEvidenceAuthority,
  handoff: RankingHandoffAuthority,
): RankingResolvedCase[] {
  const requests = new Map(
    blind.requests.map((item) => [item.requestAuthorityId, item]),
  );
  const criteria = new Map(
    blind.criterionAuthorities.map((item) => [item.criterionAuthorityId, item]),
  );
  const targets = new Map(
    blind.targets.map((item) => [item.targetAuthorityId, item]),
  );
  const candidateSets = new Map(
    blind.candidateSets.map((item) => [item.candidateSetId, item]),
  );
  const evidenceSets = new Map(
    evidence.evidenceSets.map((item) => [item.evidenceSetId, item]),
  );
  const handoffSets = new Map(
    handoff.handoffSets.map((item) => [item.handoffAuthorityId, item]),
  );
  return blind.cases.map((binding) => ({
    binding,
    request: requireItem(requests, binding.requestAuthorityId),
    criteria: requireItem(criteria, binding.criterionAuthorityId),
    target: requireItem(targets, binding.targetAuthorityId),
    candidateSet: requireItem(candidateSets, binding.candidateSetId),
    evidence: requireItem(evidenceSets, binding.evidenceSetId),
    handoff: requireItem(handoffSets, binding.handoffAuthorityId),
  }));
}

function authorGoldCase(resolved: RankingResolvedCase): RankingGoldCase {
  const input = strategyInput(resolved);
  const fits = input.candidates.map(({ candidateId }) =>
    deriveCandidateFit(input, candidateId, true),
  );
  const positives = fits.filter(({ disposition }) => disposition === 'viable');
  const preferenceIds = resolved.criteria.bindings
    .filter(
      ({ criterionKind, bindingState }) =>
        criterionKind === 'preference' && bindingState === 'bound',
    )
    .map(({ criterionId }) => criterionId)
    .sort(compareRankingText);
  const maximal = positives.filter(
    (candidate) =>
      !positives.some(
        (other) =>
          other.candidateId !== candidate.candidateId &&
          compareCandidateFit(other, candidate, preferenceIds) ===
            'left-higher',
      ),
  );
  const maximalIds = new Set(maximal.map(({ candidateId }) => candidateId));
  const ranking = createPartialOrderPresentation(
    positives,
    preferenceIds,
    resolved.binding.requestedMaximumResults,
  );
  const preferenceConsequences = derivePreferenceConsequences(
    fits,
    resolved.criteria.bindings,
  );
  const candidates = fits
    .map((fit) => ({
      candidateId: fit.candidateId,
      disposition:
        fit.disposition === 'viable' && maximalIds.has(fit.candidateId)
          ? ('recommended' as const)
          : fit.disposition,
      reasonCodes: fit.reasonCodes,
      evidenceIds: deriveDecisionEvidenceIds(
        fit,
        fits,
        ranking.presentation,
        preferenceIds,
        preferenceConsequences,
      ),
      unknownIds: fit.unknownIds,
    }))
    .sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    );
  const outcome =
    positives.length > 0
      ? ('recommend' as const)
      : fits.some(({ disposition }) => disposition === 'insufficient-evidence')
        ? ('insufficient-evidence' as const)
        : ('no-viable-candidate' as const);
  return {
    caseId: resolved.binding.caseId,
    outcome,
    allowedAlternativeOutcomes: [],
    candidates,
    ...ranking,
    hardConstraintConflicts: fits
      .flatMap(({ hardConflicts }) => hardConflicts)
      .sort(compareConflict),
    requiredUnknowns: fits
      .flatMap((fit) =>
        fit.unknownIds.map((unknownId) => ({
          candidateId: fit.candidateId,
          unknownId,
        })),
      )
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.unknownId}`,
          `${right.candidateId}\0${right.unknownId}`,
        ),
      ),
    evidenceNeededResolutions: fits
      .flatMap(({ resolutions }) => resolutions)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.evaluationId}`,
          `${right.candidateId}\0${right.evaluationId}`,
        ),
      ),
    successConditionCoverage: fits
      .flatMap(({ coverage }) => coverage)
      .sort((left, right) =>
        compareRankingText(
          `${left.candidateId}\0${left.criterionId}`,
          `${right.candidateId}\0${right.criterionId}`,
        ),
      ),
    preferenceConsequences,
    unboundPreferenceCounterfactuals: unboundCounterfactuals(
      positives,
      resolved.criteria.bindings,
      preferenceIds,
    ),
    noPreferenceHardening: true,
    provenance: {
      status: 'proposed',
      authoringSession: 'phase-10-m2-ranking-authoring',
      independentReviewStatus: 'not-reviewed',
      independentReviewer: null,
      reviewedAt: null,
      reviewReference: null,
    },
  };
}

function authorRationaleCase(
  resolved: RankingResolvedCase,
  gold: RankingGoldCase,
  audit: RankingAuditAuthority,
  allCases: readonly RankingResolvedCase[],
): RankingReviewerRationaleAuthority['cases'][number] {
  const evidenceByCandidate = new Map(
    resolved.evidence.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const coverageByKey = new Map(
    gold.successConditionCoverage.map((entry) => [
      `${entry.candidateId}\0${entry.criterionId}`,
      entry.state,
    ]),
  );
  const successBindings = resolved.criteria.bindings.filter(
    ({ criterionKind }) => criterionKind === 'success-condition',
  );
  const criterionBindingCrosswalk = successBindings.map((binding) => ({
    criterionId: binding.criterionId,
    bindingState: binding.bindingState,
    candidateFeatureDependencies: binding.candidateFeatureDependencies,
    expectedValues: binding.expectedValues,
    candidateFacts: resolved.candidateSet.candidates.map(({ candidateId }) => {
      const observation = findObservation(
        requireItem(evidenceByCandidate, candidateId),
        binding.candidateFeatureDependencies[0],
      );
      return {
        candidateId,
        evidenceId: observation?.evidenceId ?? null,
        observedValues: observation?.values ?? [],
        coverageState: requireItem(
          coverageByKey,
          `${candidateId}\0${binding.criterionId}`,
        ),
      };
    }),
  }));
  const coverageEvidence = criterionBindingCrosswalk.flatMap((crosswalk) =>
    crosswalk.candidateFacts.map((fact) =>
      crosswalk.bindingState === 'bound'
        ? `${fact.candidateId} ${fact.coverageState} ${crosswalk.criterionId}: feature=${crosswalk.candidateFeatureDependencies.join(',')}; expected=${crosswalk.expectedValues.join(',')}; observed=${fact.observedValues.join(',') || 'none'}; evidence=${fact.evidenceId ?? 'none'}.`
        : `${fact.candidateId} ${fact.coverageState} ${crosswalk.criterionId}: criterion is explicitly unbound; no candidate fact is interpreted as coverage.`,
    ),
  );
  const controlledPair = audit.controlledPairs.find(
    ({ firstCaseId, secondCaseId }) =>
      firstCaseId === resolved.binding.caseId ||
      secondCaseId === resolved.binding.caseId,
  );
  return {
    caseId: resolved.binding.caseId,
    requestRequirements: [
      resolved.request.summary,
      ...resolved.request.successConditions.map(({ statement }) => statement),
      ...resolved.request.hardConstraints.map(({ statement }) => statement),
    ],
    materialTargetFacts: [
      `runtime=${resolved.target.facts.runtime}; framework=${resolved.target.facts.framework}; deployment=${resolved.target.facts.deployment}`,
      `resources=${resolved.target.facts.resources.join(',') || 'none'}; redis=${resolved.target.facts.redis}; worker=${resolved.target.facts.workerCapability}`,
      `region=${resolved.target.facts.region}; dataPolicies=${resolved.target.facts.dataPolicies.join(',') || 'none'}; withheld=${resolved.target.withheldCategories.join(',') || 'none'}`,
    ],
    coverageEvidence,
    hardConflictEvidence:
      gold.hardConstraintConflicts.length === 0
        ? ['No candidate has a known hard conflict in this case authority.']
        : gold.hardConstraintConflicts.map(
            (conflict) =>
              `${conflict.candidateId} conflicts with ${conflict.constraintId}; reason=${conflict.reasonCode}; evidence=${conflict.evidenceIds.join(',')}.`,
          ),
    materialInsufficiency:
      gold.requiredUnknowns.length === 0
        ? ['No material unknown controls this proposed outcome.']
        : gold.requiredUnknowns.map(
            ({ candidateId, unknownId }) =>
              `${candidateId} remains materially insufficient because ${unknownId}.`,
          ),
    preferenceAnalysis: gold.preferenceConsequences.map((consequence) => {
      const binding = requireItem(
        new Map(
          resolved.criteria.bindings.map((item) => [item.criterionId, item]),
        ),
        consequence.criterionId,
      );
      const facts = resolved.candidateSet.candidates.map(({ candidateId }) => {
        const observation = findObservation(
          requireItem(evidenceByCandidate, candidateId),
          binding.candidateFeatureDependencies[0],
        );
        const values =
          observation === undefined || observation.values.length === 0
            ? 'none'
            : observation.values.join(',');
        return `${candidateId}=${values}@${observation?.evidenceId ?? 'none'}`;
      });
      return `${consequence.criterionId}: ${consequence.state}; facts=${facts.join(';')}; affected=${consequence.affectedPairs.map((pair) => pair.join('/')).join(',') || 'none'}.`;
    }),
    maximalSetAnalysis: [
      `Proposed outcome=${gold.outcome}; maximal/recommended set=${recommendedIds(gold).join(',') || 'none'}; other positive candidates=${
        gold.candidates
          .filter(({ disposition }) => disposition === 'viable')
          .map(({ candidateId }) => candidateId)
          .join(',') || 'none'
      }.`,
    ],
    partialOrderAnalysis: [
      `Presented=${gold.presentation.join(',') || 'none'}; rank groups=${gold.rankGroups.map((group) => group.join('=')).join(';') || 'none'}; ordered=${gold.rankRelations.map(({ higherCandidateId, lowerCandidateId }) => `${higherCandidateId}>${lowerCandidateId}`).join(';') || 'none'}; incomparable=${gold.incomparablePairs.map((pair) => pair.join('~')).join(';') || 'none'}; omitted candidates have no ranking references.`,
    ],
    controlledPairChange:
      controlledPair === undefined
        ? null
        : controlledChange(controlledPair, allCases),
    criterionBindingCrosswalk,
  };
}

function controlledChange(
  pair: RankingAuditAuthority['controlledPairs'][number],
  cases: readonly RankingResolvedCase[],
): string {
  const first = requireItem(
    new Map(cases.map((item) => [item.binding.caseId, item])),
    pair.firstCaseId,
  );
  const second = requireItem(
    new Map(cases.map((item) => [item.binding.caseId, item])),
    pair.secondCaseId,
  );
  const changes = pair.changedTargetPaths.map((path) => {
    const parts = path.split('/').filter(Boolean);
    return `${path}: ${String(pathValue(first.target, parts))} -> ${String(pathValue(second.target, parts))}`;
  });
  return `Only declared authoritative target facts change between ${pair.firstCaseId} and ${pair.secondCaseId}: ${changes.join('; ')}; request, criteria, candidates, evidence, handoff, and cutoff are unchanged.`;
}

function pathValue(value: unknown, parts: readonly string[]): unknown {
  let current = value;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Readonly<Record<string, unknown>>)[part];
  }
  return current;
}

function strategyInput(
  resolved: RankingResolvedCase,
): RankingBlindStrategyInput {
  return {
    capabilityFamily: resolved.binding.capabilityFamily,
    request: resolved.request,
    criteria: resolved.criteria,
    target: resolved.target,
    candidates: [...resolved.candidateSet.candidates].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    ),
    candidateEvidence: [...resolved.evidence.candidates].sort((left, right) =>
      compareRankingText(left.candidateId, right.candidateId),
    ),
    handoffCandidates: [...resolved.handoff.candidates].sort(
      (left, right) => left.retrievalOrder - right.retrievalOrder,
    ),
    requestedMaximumResults: resolved.binding.requestedMaximumResults,
  };
}

function unboundCounterfactuals(
  positives: readonly DerivedCandidateFit[],
  bindings: readonly RankingCriterionBinding[],
  appliedPreferenceIds: readonly string[],
): RankingGoldCase['unboundPreferenceCounterfactuals'] {
  const candidates = [...positives].sort((left, right) =>
    compareRankingText(left.candidateId, right.candidateId),
  );
  return bindings
    .filter(
      ({ criterionKind, bindingState }) =>
        criterionKind === 'preference' && bindingState === 'unbound',
    )
    .flatMap((binding) =>
      candidates.flatMap((left, index) =>
        candidates.slice(index + 1).map((right) => ({
          criterionId: binding.criterionId,
          candidatePair: [left.candidateId, right.candidateId] as const,
          relationWithoutPreference: compareCandidateFit(
            left,
            right,
            appliedPreferenceIds,
          ),
        })),
      ),
    );
}

function findObservation(
  evidence: RankingCandidateEvidence,
  featureId: string | undefined,
) {
  return evidence.observations.find(
    (observation) => observation.featureId === featureId,
  );
}

function recommendedIds(gold: RankingGoldCase): string[] {
  return gold.candidates
    .filter(({ disposition }) => disposition === 'recommended')
    .map(({ candidateId }) => candidateId)
    .sort(compareRankingText);
}

function compareConflict(
  left: RankingGoldCase['hardConstraintConflicts'][number],
  right: RankingGoldCase['hardConstraintConflicts'][number],
): number {
  return compareRankingText(
    `${left.candidateId}\0${left.constraintId}`,
    `${right.candidateId}\0${right.constraintId}`,
  );
}

function requireItem<Key, Value>(
  map: ReadonlyMap<Key, Value>,
  key: Key,
): Value {
  const value = map.get(key);
  if (value === undefined)
    throw new Error('Ranking authoring reference missing.');
  return value;
}
