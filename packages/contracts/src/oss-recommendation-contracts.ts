import type { FitAssessmentExchange } from '@gitblocks/domain';

import { contractCanonicalDigest } from './artifact-identity.ts';
import {
  capabilityQueryInputDigest,
  parseCapabilityQueryInputV1,
  parseCapabilityQueryNormalizationResultV1,
} from './capability-query-contracts.ts';
import type { CapabilityQueryNormalizationResultV1 } from './capability-query-schemas.ts';
import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import type { CandidateRetrievalCandidateV1 } from './candidate-retrieval-schemas.ts';
import type {
  OssRecommendationRequestV1,
  RecommendationAssessmentResponseV1,
  TargetFitAssessmentResponseV1,
} from './oss-recommendation-schemas.ts';
import {
  parseCapabilityRequestV1,
  parseFitAssessmentResponseV1,
  parseRepositoryFingerprintV1,
  validateFitAssessmentExchangeV1,
} from './parsers.ts';
import type {
  CapabilityRequestV1,
  FitAssessmentRequestV1,
  RepositoryFingerprintV1,
} from './schemas.ts';
import {
  ossRecommendationRequestV1Validator,
  recommendationAssessmentResponseV1Validator,
  structurallyValidate,
  targetFitAssessmentResponseV1Validator,
} from './structural-validation.ts';

const REQUIRED_RECOMMENDATION_APPROVAL_CATEGORIES = Object.freeze([
  'bounded-evidence',
  'candidate-dossiers',
  'capability-request',
  'repository-fingerprint',
] as const);
const MAXIMUM_FIT_HARD_CONSTRAINTS = 20;
const MAXIMUM_FIT_PREFERENCES = 20;
const UTC_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/u;

export type TargetFitAssessmentExchangeValidationResult =
  | {
      readonly ok: true;
      readonly request: FitAssessmentRequestV1;
      readonly response: TargetFitAssessmentResponseV1;
      readonly domain: FitAssessmentExchange;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

export type RecommendationRetrievalFinalistV1 = Pick<
  CandidateRetrievalCandidateV1,
  'candidateId' | 'lane' | 'unresolvedHardEvaluations'
>;

export type RecommendationAssessmentExchangeValidationResult =
  | {
      readonly ok: true;
      readonly request: FitAssessmentRequestV1;
      readonly response: RecommendationAssessmentResponseV1;
      readonly domain: FitAssessmentExchange;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

export function repositoryFingerprintDigestV1(
  value: RepositoryFingerprintV1,
): string {
  const parsed = parseRepositoryFingerprintV1(value);
  if (!parsed.ok) {
    throw new TypeError('Repository fingerprint is invalid.');
  }
  return contractCanonicalDigest(
    canonicalizeRepositoryFingerprint(parsed.value),
  );
}

export function parseOssRecommendationRequestV1(
  value: unknown,
): ContractParseResult<OssRecommendationRequestV1, OssRecommendationRequestV1> {
  const structural = structurallyValidate(
    value,
    ossRecommendationRequestV1Validator,
  );
  if (!structural.ok) return structural;

  const query = parseCapabilityQueryInputV1(structural.value.capabilityQuery);
  const fingerprint = parseRepositoryFingerprintV1(
    structural.value.repositoryFingerprint,
  );
  const issues = finalizeContractIssues([
    ...prefixIssues(query.ok ? [] : query.issues, '/capabilityQuery'),
    ...prefixIssues(
      fingerprint.ok ? [] : fingerprint.issues,
      '/repositoryFingerprint',
    ),
    ...(query.ok && fingerprint.ok
      ? recommendationSemanticIssues(structural.value)
      : []),
  ]);
  if (issues.length > 0 || !query.ok || !fingerprint.ok) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function createCapabilityRequestFromRecommendationV1(input: {
  readonly recommendationRequest: OssRecommendationRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
}): CapabilityRequestV1 {
  const request = parseOssRecommendationRequestV1(input.recommendationRequest);
  const normalization = parseCapabilityQueryNormalizationResultV1(
    input.normalization,
  );
  if (
    !request.ok ||
    !normalization.ok ||
    normalization.value.outcome !== 'normalized' ||
    normalization.value.primaryFamilyId === null ||
    normalization.value.queryInputId !==
      request.value.capabilityQuery.queryInputId ||
    normalization.value.queryInputDigest !==
      capabilityQueryInputDigest(request.value.capabilityQuery) ||
    !sameFingerprintReference(
      normalization.value.repositoryFingerprintReference,
      request.value.capabilityQuery.repositoryFingerprintReference,
    )
  ) {
    throw new TypeError('Recommendation capability request bridge failed.');
  }

  const hardConstraints: CapabilityRequestV1['hardConstraints'] = [];
  const preferences: CapabilityRequestV1['preferences'] = [];
  for (const constraint of request.value.capabilityQuery.draftConstraints) {
    if (constraint.modality === 'preferred') {
      preferences.push({
        preferenceId: constraint.constraintId,
        statement: constraint.statement,
      });
      continue;
    }
    if (constraint.reasonCode === null) {
      throw new TypeError('Recommendation capability request bridge failed.');
    }
    hardConstraints.push({
      constraintId: constraint.constraintId,
      reasonCode: constraint.reasonCode,
      statement: constraint.statement,
    });
  }

  const bridged = {
    contractVersion: '1.0.0',
    requestId: request.value.capabilityQuery.queryInputId,
    capabilityFamily: normalization.value.primaryFamilyId,
    summary: request.value.capabilityQuery.summary,
    successConditions: request.value.capabilityQuery.successConditions.map(
      (condition) => ({ ...condition }),
    ),
    hardConstraints,
    preferences,
    transmissionApproval: { ...request.value.transmissionApproval },
  } satisfies CapabilityRequestV1;
  const parsed = parseCapabilityRequestV1(bridged);
  if (!parsed.ok) {
    throw new TypeError('Recommendation capability request bridge failed.');
  }
  return parsed.value;
}

export function parseTargetFitAssessmentResponseV1(
  value: unknown,
): ContractParseResult<
  TargetFitAssessmentResponseV1,
  TargetFitAssessmentResponseV1
> {
  const structural = structurallyValidate(
    value,
    targetFitAssessmentResponseV1Validator,
  );
  if (!structural.ok) return structural;

  const fit = parseFitAssessmentResponseV1(structural.value.fitAssessment);
  const issues = finalizeContractIssues([
    ...prefixIssues(fit.ok ? [] : fit.issues, '/fitAssessment'),
    ...bindingInferenceIssues(structural.value),
  ]);
  if (issues.length > 0 || !fit.ok) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function parseRecommendationAssessmentResponseV1(
  value: unknown,
): ContractParseResult<
  RecommendationAssessmentResponseV1,
  RecommendationAssessmentResponseV1
> {
  const structural = structurallyValidate(
    value,
    recommendationAssessmentResponseV1Validator,
  );
  if (!structural.ok) return structural;

  const targetFit = parseTargetFitAssessmentResponseV1(
    structural.value.targetFitAssessment,
  );
  const issues = finalizeContractIssues(
    prefixIssues(targetFit.ok ? [] : targetFit.issues, '/targetFitAssessment'),
  );
  if (issues.length > 0 || !targetFit.ok) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function validateTargetFitAssessmentExchangeV1(
  request: FitAssessmentRequestV1,
  response: unknown,
): TargetFitAssessmentExchangeValidationResult {
  const parsedResponse = parseTargetFitAssessmentResponseV1(response);
  if (!parsedResponse.ok) return parsedResponse;

  const fitExchange = validateFitAssessmentExchangeV1(
    request,
    parsedResponse.value.fitAssessment,
  );
  if (!fitExchange.ok) return fitExchange;

  const issues = finalizeContractIssues([
    ...repositoryFactBindingIssues(request, parsedResponse.value),
    ...positiveTargetSupportIssues(parsedResponse.value),
  ]);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    request: fitExchange.request,
    response: parsedResponse.value,
    domain: fitExchange.domain,
    issues: [],
  };
}

export function validateRecommendationAssessmentExchangeV1(input: {
  readonly request: FitAssessmentRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
  readonly response: unknown;
}): RecommendationAssessmentExchangeValidationResult {
  const parsedResponse = parseRecommendationAssessmentResponseV1(
    input.response,
  );
  if (!parsedResponse.ok) return parsedResponse;

  const normalization = parseCapabilityQueryNormalizationResultV1(
    input.normalization,
  );
  if (!normalization.ok) return normalization;

  const targetFit = validateTargetFitAssessmentExchangeV1(
    input.request,
    parsedResponse.value.targetFitAssessment,
  );
  if (!targetFit.ok) return targetFit;

  const issues = finalizeContractIssues([
    ...recommendationFinalistIssues(
      input.request,
      normalization.value,
      input.retrievalFinalists,
    ),
    ...hardResolutionIssues({
      request: input.request,
      normalization: normalization.value,
      retrievalFinalists: input.retrievalFinalists,
      response: parsedResponse.value,
    }),
  ]);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    request: targetFit.request,
    response: parsedResponse.value,
    domain: targetFit.domain,
    issues: [],
  };
}

function recommendationFinalistIssues(
  request: FitAssessmentRequestV1,
  normalization: CapabilityQueryNormalizationResultV1,
  finalists: readonly RecommendationRetrievalFinalistV1[],
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const requestIds = request.candidates.map(
    ({ identity }) => identity.candidateId,
  );
  const finalistIds = finalists.map(({ candidateId }) => candidateId);
  if (
    requestIds.length !== finalistIds.length ||
    requestIds.some((candidateId, index) => candidateId !== finalistIds[index])
  ) {
    issues.push(
      domainIssue(
        'recommendation-assessment.finalist-binding',
        '/retrievalFinalists',
      ),
    );
  }
  if (new Set(finalistIds).size !== finalistIds.length) {
    issues.push(
      domainIssue(
        'recommendation-assessment.finalist-duplicate',
        '/retrievalFinalists',
      ),
    );
  }
  if (
    finalists.length < 1 ||
    finalists.length > 5 ||
    normalization.outcome !== 'normalized' ||
    normalization.queryInputId !== request.capabilityRequest.requestId ||
    normalization.primaryFamilyId !== request.capabilityRequest.capabilityFamily
  ) {
    issues.push(
      domainIssue(
        'recommendation-assessment.context-binding',
        '/retrievalFinalists',
      ),
    );
  }
  let enteredEvidenceNeededLane = false;
  for (const finalist of finalists) {
    if (finalist.lane === 'evidence-needed') {
      enteredEvidenceNeededLane = true;
      if (finalist.unresolvedHardEvaluations.length === 0) {
        issues.push(
          domainIssue(
            'recommendation-assessment.finalist-lane',
            '/retrievalFinalists',
          ),
        );
      }
      continue;
    }
    if (
      enteredEvidenceNeededLane ||
      finalist.unresolvedHardEvaluations.length > 0
    ) {
      issues.push(
        domainIssue(
          'recommendation-assessment.finalist-lane',
          '/retrievalFinalists',
        ),
      );
    }
  }
  return issues;
}

function hardResolutionIssues(input: {
  readonly request: FitAssessmentRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
  readonly response: RecommendationAssessmentResponseV1;
}): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const finalistById = new Map(
    input.retrievalFinalists.map((finalist) => [
      finalist.candidateId,
      finalist,
    ]),
  );
  const expected = new Map<
    string,
    {
      readonly finalist: RecommendationRetrievalFinalistV1;
      readonly evaluation: RecommendationRetrievalFinalistV1['unresolvedHardEvaluations'][number];
    }
  >();
  for (const finalist of input.retrievalFinalists) {
    for (const evaluation of finalist.unresolvedHardEvaluations) {
      expected.set(`${finalist.candidateId}\0${evaluation.evaluationId}`, {
        finalist,
        evaluation,
      });
    }
  }

  const resolutions = new Map<string, number>();
  const assessmentByCandidate = new Map(
    input.response.targetFitAssessment.fitAssessment.candidateAssessments.map(
      (assessment) => [assessment.candidateId, assessment],
    ),
  );
  const inferenceById = new Map(
    input.response.targetFitAssessment.fitAssessment.inferences.map(
      (inference) => [inference.inferenceId, inference],
    ),
  );
  const evidenceById = new Map(
    input.response.targetFitAssessment.fitAssessment.evidence.map(
      (evidence) => [evidence.evidenceId, evidence],
    ),
  );
  const ranked = rankedCandidateIds(
    input.response.targetFitAssessment.fitAssessment,
  );

  for (const [
    index,
    resolution,
  ] of input.response.evidenceNeededHardConstraintResolutions.entries()) {
    const path = `/evidenceNeededHardConstraintResolutions/${String(index)}`;
    const key = `${resolution.candidateId}\0${resolution.evaluationId}`;
    const occurrence = (resolutions.get(key) ?? 0) + 1;
    resolutions.set(key, occurrence);
    if (occurrence > 1) {
      issues.push(domainIssue('hard-resolution.duplicate', path));
    }

    const expectedResolution = expected.get(key);
    const finalist = finalistById.get(resolution.candidateId);
    if (
      expectedResolution === undefined ||
      finalist?.lane !== 'evidence-needed'
    ) {
      issues.push(domainIssue('hard-resolution.reference', path));
      continue;
    }

    const sourceConstraintIds = resolutionSourceConstraintIds(
      input.request,
      input.normalization,
      expectedResolution.evaluation,
      path,
      issues,
    );
    const assessment = assessmentByCandidate.get(resolution.candidateId);
    const grounded = resolution.inferenceIds.every((inferenceId) => {
      const inference = inferenceById.get(inferenceId);
      return (
        inference?.candidateId === resolution.candidateId &&
        inference.evidenceIds.length > 0 &&
        inference.evidenceIds.every(
          (evidenceId) =>
            evidenceById.get(evidenceId)?.candidateId ===
            resolution.candidateId,
        ) &&
        assessment?.inferenceIds.includes(inferenceId) === true
      );
    });
    if (
      resolution.state === 'unresolved'
        ? resolution.inferenceIds.length > 0
        : resolution.inferenceIds.length === 0 || !grounded
    ) {
      issues.push(domainIssue('hard-resolution.inference-grounding', path));
    }

    if (resolution.state === 'unresolved') {
      if (
        assessment?.disposition !== 'insufficient-evidence' ||
        ranked.has(resolution.candidateId)
      ) {
        issues.push(
          domainIssue('hard-resolution.unresolved-disposition', path),
        );
      }
    }
    if (resolution.state === 'conflict') {
      if (
        assessment?.disposition !== 'rejected' ||
        ranked.has(resolution.candidateId)
      ) {
        issues.push(domainIssue('hard-resolution.conflict-disposition', path));
      }
      for (const constraintId of sourceConstraintIds) {
        const hardConstraint =
          input.request.capabilityRequest.hardConstraints.find(
            (constraint) => constraint.constraintId === constraintId,
          );
        const matchingConflict =
          input.response.targetFitAssessment.fitAssessment.hardConstraintConflicts.some(
            (conflict) =>
              conflict.candidateId === resolution.candidateId &&
              conflict.constraintId === constraintId &&
              conflict.reasonCode === hardConstraint?.reasonCode,
          );
        if (!matchingConflict) {
          issues.push(domainIssue('hard-resolution.conflict-binding', path));
        }
      }
    }
  }

  for (const [key, value] of expected) {
    if (resolutions.get(key) !== 1) {
      issues.push(
        domainIssue(
          'hard-resolution.coverage',
          `/retrievalFinalists/${value.finalist.candidateId}/${value.evaluation.evaluationId}`,
        ),
      );
    }
  }

  for (const finalist of input.retrievalFinalists) {
    if (finalist.lane !== 'evidence-needed') continue;
    const assessment = assessmentByCandidate.get(finalist.candidateId);
    if (
      assessment?.disposition !== 'recommended' &&
      assessment?.disposition !== 'viable'
    ) {
      continue;
    }
    const allSatisfied = finalist.unresolvedHardEvaluations.every(
      (evaluation) =>
        input.response.evidenceNeededHardConstraintResolutions.some(
          (resolution) =>
            resolution.candidateId === finalist.candidateId &&
            resolution.evaluationId === evaluation.evaluationId &&
            resolution.state === 'satisfied',
        ),
    );
    if (!allSatisfied) {
      issues.push(
        domainIssue(
          'hard-resolution.positive-disposition',
          `/targetFitAssessment/fitAssessment/candidateAssessments/${finalist.candidateId}`,
        ),
      );
    }
  }
  return issues;
}

function resolutionSourceConstraintIds(
  request: FitAssessmentRequestV1,
  normalization: CapabilityQueryNormalizationResultV1,
  evaluation: RecommendationRetrievalFinalistV1['unresolvedHardEvaluations'][number],
  path: string,
  issues: ContractIssue[],
): readonly string[] {
  const hardConstraintIds = new Set(
    request.capabilityRequest.hardConstraints.map(
      ({ constraintId }) => constraintId,
    ),
  );
  if (normalization.outcome !== 'normalized') {
    issues.push(domainIssue('hard-resolution.normalization-binding', path));
    return [];
  }
  if (evaluation.sourceKind === 'normalized-constraint') {
    const normalized = normalization.normalizedConstraints.find(
      ({ normalizedConstraintId }) =>
        normalizedConstraintId === evaluation.evaluationId,
    );
    if (
      normalized?.modality !== evaluation.modality ||
      normalized.facet !== evaluation.facet ||
      normalized.conceptId !== evaluation.conceptId ||
      normalized.sourceConstraintIds.some(
        (constraintId) => !hardConstraintIds.has(constraintId),
      )
    ) {
      issues.push(domainIssue('hard-resolution.normalization-binding', path));
      return [];
    }
    return normalized.sourceConstraintIds;
  }
  if (evaluation.sourceKind === 'preserved-declaration') {
    const declaration = normalization.preservedDeclarations.find(
      ({ constraintId }) => constraintId === evaluation.evaluationId,
    );
    if (
      declaration?.modality !== evaluation.modality ||
      declaration.facet !== evaluation.facet ||
      evaluation.conceptId !== null ||
      !hardConstraintIds.has(declaration.constraintId)
    ) {
      issues.push(domainIssue('hard-resolution.normalization-binding', path));
      return [];
    }
    return [declaration.constraintId];
  }
  if (
    evaluation.evaluationId !== 'primary-capability-family' ||
    evaluation.modality !== 'required' ||
    evaluation.facet !== 'capability' ||
    evaluation.conceptId !== normalization.primaryFamilyId
  ) {
    issues.push(domainIssue('hard-resolution.normalization-binding', path));
  }
  return [];
}

function rankedCandidateIds(
  response: TargetFitAssessmentResponseV1['fitAssessment'],
): ReadonlySet<string> {
  const ranked = new Set<string>();
  for (const group of response.rankGroups) {
    group.candidateIds.forEach((candidateId) => ranked.add(candidateId));
  }
  for (const relation of response.rankRelations) {
    ranked.add(relation.higherCandidateId);
    ranked.add(relation.lowerCandidateId);
  }
  for (const pair of response.incomparablePairs) {
    ranked.add(pair.leftCandidateId);
    ranked.add(pair.rightCandidateId);
  }
  return ranked;
}

function recommendationSemanticIssues(
  value: OssRecommendationRequestV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const reference = value.capabilityQuery.repositoryFingerprintReference;
  if (reference === null) {
    issues.push(
      domainIssue(
        'recommendation.fingerprint-reference',
        '/capabilityQuery/repositoryFingerprintReference',
      ),
    );
  } else {
    if (reference.fingerprintId !== value.repositoryFingerprint.fingerprintId) {
      issues.push(
        domainIssue(
          'recommendation.fingerprint-binding',
          '/capabilityQuery/repositoryFingerprintReference/fingerprintId',
        ),
      );
    }
    if (
      reference.fingerprintDigest !==
      repositoryFingerprintDigestV1(value.repositoryFingerprint)
    ) {
      issues.push(
        domainIssue(
          'recommendation.fingerprint-binding',
          '/capabilityQuery/repositoryFingerprintReference/fingerprintDigest',
        ),
      );
    }
  }

  const hardCount = value.capabilityQuery.draftConstraints.filter(
    ({ modality }) => modality !== 'preferred',
  ).length;
  const preferenceCount =
    value.capabilityQuery.draftConstraints.length - hardCount;
  if (hardCount > MAXIMUM_FIT_HARD_CONSTRAINTS) {
    issues.push(
      domainIssue(
        'recommendation.fit-request-bounds',
        '/capabilityQuery/draftConstraints',
      ),
    );
  }
  if (preferenceCount > MAXIMUM_FIT_PREFERENCES) {
    issues.push(
      domainIssue(
        'recommendation.fit-request-bounds',
        '/capabilityQuery/draftConstraints',
      ),
    );
  }
  if (!isValidUtcTimestamp(value.transmissionApproval.approvedAt)) {
    issues.push(
      domainIssue('timestamp.invalid', '/transmissionApproval/approvedAt'),
    );
  }
  const approved = new Set(value.transmissionApproval.approvedCategories);
  if (
    REQUIRED_RECOMMENDATION_APPROVAL_CATEGORIES.some(
      (category) => !approved.has(category),
    )
  ) {
    issues.push(
      domainIssue(
        'recommendation.transmission-approval',
        '/transmissionApproval/approvedCategories',
      ),
    );
  }
  return issues;
}

function bindingInferenceIssues(
  response: TargetFitAssessmentResponseV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const inferenceIds = new Set(
    response.fitAssessment.inferences.map(({ inferenceId }) => inferenceId),
  );
  const bound = new Set<string>();
  for (const [
    index,
    binding,
  ] of response.inferenceRepositoryFactBindings.entries()) {
    if (bound.has(binding.inferenceId)) {
      issues.push(
        domainIssue(
          'target-fit.binding-duplicate',
          `/inferenceRepositoryFactBindings/${String(index)}/inferenceId`,
        ),
      );
    }
    bound.add(binding.inferenceId);
    if (!inferenceIds.has(binding.inferenceId)) {
      issues.push(
        domainIssue(
          'target-fit.inference-reference',
          `/inferenceRepositoryFactBindings/${String(index)}/inferenceId`,
        ),
      );
    }
  }
  return issues;
}

function repositoryFactBindingIssues(
  request: FitAssessmentRequestV1,
  response: TargetFitAssessmentResponseV1,
): readonly ContractIssue[] {
  const factIds = new Set(
    request.repositoryFingerprint.facts.map(({ factId }) => factId),
  );
  const issues: ContractIssue[] = [];
  for (const [
    bindingIndex,
    binding,
  ] of response.inferenceRepositoryFactBindings.entries()) {
    for (const [
      factIndex,
      repositoryFactId,
    ] of binding.repositoryFactIds.entries()) {
      if (!factIds.has(repositoryFactId)) {
        issues.push(
          domainIssue(
            'target-fit.repository-fact-reference',
            `/inferenceRepositoryFactBindings/${String(bindingIndex)}/repositoryFactIds/${String(factIndex)}`,
          ),
        );
      }
    }
  }
  return issues;
}

function positiveTargetSupportIssues(
  response: TargetFitAssessmentResponseV1,
): readonly ContractIssue[] {
  const bindingByInference = new Map(
    response.inferenceRepositoryFactBindings.map((binding) => [
      binding.inferenceId,
      binding.repositoryFactIds,
    ]),
  );
  const claimById = new Map(
    response.fitAssessment.materialClaims.map((claim) => [
      claim.claimId,
      claim,
    ]),
  );
  const issues: ContractIssue[] = [];
  for (const [
    index,
    assessment,
  ] of response.fitAssessment.candidateAssessments.entries()) {
    if (
      assessment.disposition !== 'recommended' &&
      assessment.disposition !== 'viable'
    ) {
      continue;
    }
    const targetGrounded = assessment.claimIds.some((claimId) => {
      const claim = claimById.get(claimId);
      return (
        claim?.candidateId === assessment.candidateId &&
        claim.direction === 'favorable' &&
        claim.inferenceIds.some(
          (inferenceId) =>
            (bindingByInference.get(inferenceId)?.length ?? 0) > 0,
        )
      );
    });
    if (!targetGrounded) {
      issues.push(
        domainIssue(
          'target-fit.positive-support',
          `/fitAssessment/candidateAssessments/${String(index)}`,
        ),
      );
    }
  }
  return issues;
}

function canonicalizeRepositoryFingerprint(
  value: RepositoryFingerprintV1,
): RepositoryFingerprintV1 {
  return {
    contractVersion: value.contractVersion,
    factVocabularyVersion: value.factVocabularyVersion,
    fingerprintId: value.fingerprintId,
    facts: value.facts
      .map((fact) =>
        fact.kind === 'coded' && fact.value.kind === 'code-set'
          ? {
              ...fact,
              value: {
                ...fact.value,
                codes: [...fact.value.codes].sort(compareText),
              },
            }
          : { ...fact },
      )
      .sort((left, right) => compareText(left.factId, right.factId)),
    withheldCategories: [...value.withheldCategories].sort(compareText),
  };
}

function sameFingerprintReference(
  left: CapabilityQueryNormalizationResultV1['repositoryFingerprintReference'],
  right: OssRecommendationRequestV1['capabilityQuery']['repositoryFingerprintReference'],
): boolean {
  return (
    left !== null &&
    right !== null &&
    left.fingerprintId === right.fingerprintId &&
    left.fingerprintDigest === right.fingerprintDigest
  );
}

function isValidUtcTimestamp(value: string): boolean {
  const match = UTC_TIMESTAMP_PATTERN.exec(value);
  if (match === null) return false;
  const [year, month, day, hour, minute, second] = match
    .slice(1, 7)
    .map(Number);
  const milliseconds = Number((match[7] ?? '').padEnd(3, '0'));
  const timestamp = Date.UTC(
    year ?? 0,
    (month ?? 0) - 1,
    day,
    hour,
    minute,
    second,
    milliseconds,
  );
  const parsed = new Date(timestamp);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day &&
    parsed.getUTCHours() === hour &&
    parsed.getUTCMinutes() === minute &&
    parsed.getUTCSeconds() === second &&
    parsed.getUTCMilliseconds() === milliseconds
  );
}

function domainIssue(code: string, path: string): ContractIssue {
  return contractIssue(`domain.${code}`, path, 'Domain validation failed.');
}

function prefixIssues(
  issues: readonly ContractIssue[],
  prefix: string,
): readonly ContractIssue[] {
  return issues.map((issue) =>
    contractIssue(
      issue.code,
      `${prefix}${issue.path === '' ? '' : issue.path.startsWith('/') ? issue.path : `/${issue.path}`}`,
      issue.message,
    ),
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
