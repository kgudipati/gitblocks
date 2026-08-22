import {
  deriveCapabilityQueryConstraintFacet,
  isCapabilityQueryTargetFitContext,
  type FitAssessmentExchange,
} from '@gitblocks/domain';

import { contractCanonicalDigest } from './artifact-identity.ts';
import {
  capabilityQueryInputDigest,
  parseCapabilityQueryInputV1,
  parseCapabilityQueryNormalizationResultV1,
} from './capability-query-contracts.ts';
import type { CapabilityQueryNormalizationResultV1 } from './capability-query-schemas.ts';
import { parseCapabilityTaxonomyV1 } from './capability-taxonomy-contracts.ts';
import type { CapabilityTaxonomyV1 } from './capability-taxonomy-schemas.ts';
import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import type { CandidateRetrievalCandidateV1 } from './candidate-retrieval-schemas.ts';
import type {
  OssRecommendationRequest,
  OssRecommendationRequestV1,
  OssRecommendationRequestV2,
  RecommendationAssessmentModelFitRequestV1,
  RecommendationAssessmentModelResponseV1,
  RecommendationAssessmentResponseV1,
  ResponsibleOptionV1,
  TargetFitAssessmentResponseV1,
} from './oss-recommendation-schemas.ts';
import {
  parseCapabilityRequestV1,
  parseFitAssessmentRequestV1,
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
  ossRecommendationRequestValidator,
  ossRecommendationRequestV1Validator,
  ossRecommendationRequestV2Validator,
  recommendationAssessmentModelFitRequestV1Validator,
  recommendationAssessmentModelResponseV1Validator,
  recommendationAssessmentResponseV1Validator,
  responsibleOptionV1Validator,
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

export function parseOssRecommendationRequestV2(
  value: unknown,
): ContractParseResult<OssRecommendationRequestV2, OssRecommendationRequestV2> {
  const structural = structurallyValidate(
    value,
    ossRecommendationRequestV2Validator,
  );
  if (!structural.ok) return structural;

  const fingerprint = parseRepositoryFingerprintV1(
    structural.value.repositoryFingerprint,
  );
  const issues = finalizeContractIssues([
    ...prefixIssues(
      fingerprint.ok ? [] : fingerprint.issues,
      '/repositoryFingerprint',
    ),
    ...(fingerprint.ok ? recommendationV2SemanticIssues(structural.value) : []),
  ]);
  if (issues.length > 0 || !fingerprint.ok) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function parseOssRecommendationRequest(
  value: unknown,
): ContractParseResult<OssRecommendationRequest, OssRecommendationRequest> {
  if (isRecordWithContractVersion(value, '1.0.0')) {
    return parseOssRecommendationRequestV1(value);
  }
  if (isRecordWithContractVersion(value, '2.0.0')) {
    return parseOssRecommendationRequestV2(value);
  }
  const structural = structurallyValidate(
    value,
    ossRecommendationRequestValidator,
  );
  return structural.ok
    ? {
        ok: true,
        value: structural.value,
        domain: structural.value,
        issues: [],
      }
    : structural;
}

export function expandOssRecommendationRequest(input: {
  readonly recommendationRequest: unknown;
  readonly taxonomy: unknown;
}): ContractParseResult<
  OssRecommendationRequestV1,
  OssRecommendationRequestV1
> {
  const request = parseOssRecommendationRequest(input.recommendationRequest);
  if (!request.ok) return request;
  if (request.value.contractVersion === '1.0.0') {
    return {
      ok: true,
      value: request.value,
      domain: request.value,
      issues: [],
    };
  }

  const taxonomy = parseCapabilityTaxonomyV1(input.taxonomy);
  if (!taxonomy.ok) return taxonomy;
  return expandParsedOssRecommendationRequestV2(request.value, taxonomy.value);
}

export function ossRecommendationRequestId(
  request: OssRecommendationRequest,
): string {
  return request.contractVersion === '1.0.0'
    ? request.recommendationRequestId
    : generatedRootId('recommendation', contractCanonicalDigest(request));
}

function expandParsedOssRecommendationRequestV2(
  request: OssRecommendationRequestV2,
  taxonomy: CapabilityTaxonomyV1,
): ContractParseResult<OssRecommendationRequestV1, OssRecommendationRequestV1> {
  const requestDigest = contractCanonicalDigest(request);
  const expanded = {
    contractVersion: '1.0.0',
    recommendationRequestId: generatedRootId('recommendation', requestDigest),
    capabilityQuery: {
      contractVersion: '1.0.0',
      queryInputId: generatedRootId('query', requestDigest),
      scope: 'local-pre-approval',
      summary: request.summary,
      capabilityTerms: request.capabilityTerms.map((originalTerm, index) => ({
        termId: generatedSequenceId('term', index),
        originalTerm,
      })),
      successConditions: request.successConditions.map((statement, index) => ({
        conditionId: generatedSequenceId('condition', index),
        statement,
      })),
      draftConstraints: request.constraints.map((constraint, index) => ({
        constraintId: generatedSequenceId('constraint', index),
        modality: constraint.modality,
        statement: constraint.statement,
        originalTerm: constraint.term,
        facetHint: deriveRecommendationConstraintFacet(
          constraint.term,
          taxonomy,
          request.repositoryFingerprint,
        ),
        reasonCode:
          constraint.modality === 'required'
            ? 'user-required'
            : constraint.modality === 'prohibited'
              ? 'user-prohibited'
              : null,
      })),
      candidateReferences: (request.candidateReferences ?? []).map(
        (reference, index) => ({
          referenceId: generatedSequenceId('reference', index),
          ...reference,
        }),
      ),
      repositoryFingerprintReference: {
        fingerprintId: request.repositoryFingerprint.fingerprintId,
        fingerprintDigest: request.transmissionApproval.fingerprintDigest,
      },
    },
    repositoryFingerprint: request.repositoryFingerprint,
    transmissionApproval: {
      approvalId: generatedRootId('approval', requestDigest),
      approvedAt: request.transmissionApproval.approvedAt,
      approvedBy: request.transmissionApproval.approvedBy,
      scope: 'minimized-repository-facts',
      approvedCategories: [...request.transmissionApproval.approvedCategories],
    },
  } satisfies OssRecommendationRequestV1;
  return parseOssRecommendationRequestV1(expanded);
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

export function parseResponsibleOptionV1(
  value: unknown,
): ContractParseResult<ResponsibleOptionV1, ResponsibleOptionV1> {
  const structural = structurallyValidate(value, responsibleOptionV1Validator);
  if (!structural.ok) return structural;
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function parseRecommendationAssessmentModelResponseV1(
  value: unknown,
): ContractParseResult<
  RecommendationAssessmentModelResponseV1,
  RecommendationAssessmentModelResponseV1
> {
  const structural = structurallyValidate(
    value,
    recommendationAssessmentModelResponseV1Validator,
  );
  if (!structural.ok) return structural;
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function parseRecommendationAssessmentModelFitRequestV1(
  value: unknown,
): ContractParseResult<
  RecommendationAssessmentModelFitRequestV1,
  RecommendationAssessmentModelFitRequestV1
> {
  const structural = structurallyValidate(
    value,
    recommendationAssessmentModelFitRequestV1Validator,
  );
  if (!structural.ok) return structural;
  const fitRequest = parseFitAssessmentRequestV1(structural.value);
  if (!fitRequest.ok) return fitRequest;
  return {
    ok: true,
    value: structural.value,
    domain: structural.value,
    issues: [],
  };
}

export function createRecommendationAssessmentModelFitRequestV1(
  request: FitAssessmentRequestV1,
): RecommendationAssessmentModelFitRequestV1 {
  const parsed = parseFitAssessmentRequestV1(request);
  if (!parsed.ok) {
    throw new TypeError('Fit assessment request is invalid.');
  }
  return modelFitRequestProjection(parsed.value).request;
}

export function validateTargetFitAssessmentExchangeV1(
  request: FitAssessmentRequestV1,
  response: unknown,
): TargetFitAssessmentExchangeValidationResult {
  const structuralResponse = structurallyValidate(
    response,
    targetFitAssessmentResponseV1Validator,
  );
  if (!structuralResponse.ok) return structuralResponse;

  const fitExchange = validateFitAssessmentExchangeV1(
    request,
    structuralResponse.value.fitAssessment,
  );
  if (!fitExchange.ok) return fitExchange;

  const issues = finalizeContractIssues([
    ...bindingInferenceIssues(structuralResponse.value),
    ...repositoryFactBindingIssues(request, structuralResponse.value),
    ...positiveTargetSupportIssues(structuralResponse.value),
  ]);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    request: fitExchange.request,
    response: structuralResponse.value,
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
  const structuralResponse = structurallyValidate(
    input.response,
    recommendationAssessmentResponseV1Validator,
  );
  if (!structuralResponse.ok) return structuralResponse;

  const normalization = parseCapabilityQueryNormalizationResultV1(
    input.normalization,
  );
  if (!normalization.ok) return normalization;

  const targetFit = validateTargetFitAssessmentExchangeV1(
    input.request,
    structuralResponse.value.targetFitAssessment,
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
      response: structuralResponse.value,
    }),
    ...responsibleOptionIssues({
      request: input.request,
      normalization: normalization.value,
      retrievalFinalists: input.retrievalFinalists,
      response: structuralResponse.value,
    }),
  ]);
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    request: targetFit.request,
    response: structuralResponse.value,
    domain: targetFit.domain,
    issues: [],
  };
}

export function validateRecommendationModelAssessmentExchangeV1(input: {
  readonly request: FitAssessmentRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
  readonly response: unknown;
  readonly assessmentId: string;
  readonly producedAt: string;
}): RecommendationAssessmentExchangeValidationResult {
  const parsedResponse = parseRecommendationAssessmentModelResponseV1(
    input.response,
  );
  if (!parsedResponse.ok) return parsedResponse;

  const expandedResponse = expandRecommendationAssessmentModelResponseV1({
    request: input.request,
    response: parsedResponse.value,
    assessmentId: input.assessmentId,
  });
  if (!expandedResponse.ok) return expandedResponse;

  const collisionIssues = compactCatalogCollisionIssues(
    input.request,
    expandedResponse.value,
  );
  if (collisionIssues.length > 0) {
    return { ok: false, issues: finalizeContractIssues(collisionIssues) };
  }

  return validateRecommendationAssessmentExchangeV1({
    request: input.request,
    normalization: input.normalization,
    retrievalFinalists: input.retrievalFinalists,
    response: hydrateRecommendationAssessmentResponseV1({
      request: input.request,
      normalization: input.normalization,
      retrievalFinalists: input.retrievalFinalists,
      response: expandedResponse.value,
      assessmentId: input.assessmentId,
      producedAt: input.producedAt,
    }),
  });
}

interface ModelFitRequestProjectionV1 {
  readonly request: RecommendationAssessmentModelFitRequestV1;
  readonly evidenceTokenToId: ReadonlyMap<string, string>;
  readonly limitationTokenToId: ReadonlyMap<string, string>;
  readonly unknownTokenToId: ReadonlyMap<string, string>;
}

function modelFitRequestProjection(
  request: FitAssessmentRequestV1,
): ModelFitRequestProjectionV1 {
  const evidenceIdToToken = new Map<string, string>();
  const limitationIdToToken = new Map<string, string>();
  const unknownIdToToken = new Map<string, string>();
  const evidenceTokenToId = new Map<string, string>();
  const limitationTokenToId = new Map<string, string>();
  const unknownTokenToId = new Map<string, string>();

  for (const candidate of request.candidates) {
    for (const evidence of candidate.observations) {
      registerSurrogate(
        evidenceIdToToken,
        evidenceTokenToId,
        evidence.evidenceId,
        `e${String(evidenceIdToToken.size + 1)}`,
      );
    }
  }
  for (const candidate of request.candidates) {
    for (const limitation of candidate.limitations) {
      registerSurrogate(
        limitationIdToToken,
        limitationTokenToId,
        limitation.limitationId,
        `l${String(limitationIdToToken.size + 1)}`,
      );
    }
  }
  for (const candidate of request.candidates) {
    for (const unknown of candidate.unknowns) {
      registerSurrogate(
        unknownIdToToken,
        unknownTokenToId,
        unknown.unknownId,
        `u${String(unknownIdToToken.size + 1)}`,
      );
    }
  }

  return {
    request: {
      ...request,
      candidates: request.candidates.map((candidate) => ({
        ...candidate,
        observations: candidate.observations.map((evidence) => ({
          ...evidence,
          evidenceId: requiredSurrogate(evidenceIdToToken, evidence.evidenceId),
        })),
        limitations: candidate.limitations.map((limitation) => ({
          ...limitation,
          limitationId: requiredSurrogate(
            limitationIdToToken,
            limitation.limitationId,
          ),
          evidenceIds: limitation.evidenceIds.map((evidenceId) =>
            requiredSurrogate(evidenceIdToToken, evidenceId),
          ),
        })),
        unknowns: candidate.unknowns.map((unknown) => ({
          ...unknown,
          unknownId: requiredSurrogate(unknownIdToToken, unknown.unknownId),
          evidenceIds: unknown.evidenceIds.map((evidenceId) =>
            requiredSurrogate(evidenceIdToToken, evidenceId),
          ),
        })),
      })),
    },
    evidenceTokenToId,
    limitationTokenToId,
    unknownTokenToId,
  };
}

function registerSurrogate(
  idToToken: Map<string, string>,
  tokenToId: Map<string, string>,
  id: string,
  token: string,
): void {
  if (idToToken.has(id) || tokenToId.has(token)) {
    throw new TypeError('Fit assessment request catalog is invalid.');
  }
  idToToken.set(id, token);
  tokenToId.set(token, id);
}

function requiredSurrogate(
  idToToken: ReadonlyMap<string, string>,
  id: string,
): string {
  const token = idToToken.get(id);
  if (token === undefined) {
    throw new TypeError('Fit assessment request catalog is invalid.');
  }
  return token;
}

type ExpandedModelResponseResult =
  | {
      readonly ok: true;
      readonly value: RecommendationAssessmentModelResponseV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

function expandRecommendationAssessmentModelResponseV1(input: {
  readonly request: FitAssessmentRequestV1;
  readonly response: RecommendationAssessmentModelResponseV1;
  readonly assessmentId: string;
}): ExpandedModelResponseResult {
  const projection = modelFitRequestProjection(input.request);
  const issues: ContractIssue[] = [];
  const fit = input.response.targetFitAssessment.fitAssessment;
  const evidenceId = (token: string, path: string): string =>
    expandSuppliedSurrogate(projection.evidenceTokenToId, token, path, issues);
  const limitationId = (token: string, path: string): string =>
    expandSuppliedSurrogate(
      projection.limitationTokenToId,
      token,
      path,
      issues,
    );
  const unknownId = (token: string, path: string): string =>
    token.startsWith('u')
      ? expandSuppliedSurrogate(
          projection.unknownTokenToId,
          token,
          path,
          issues,
        )
      : mintModelRecordId(input.assessmentId, 'assessment-unknown', token);
  const inferenceId = (token: string): string =>
    mintModelRecordId(input.assessmentId, 'inference', token);
  const claimId = (token: string): string =>
    mintModelRecordId(input.assessmentId, 'claim', token);
  const conflictId = (token: string): string =>
    mintModelRecordId(input.assessmentId, 'conflict', token);

  const expanded: RecommendationAssessmentModelResponseV1 = {
    targetFitAssessment: {
      fitAssessment: {
        ...fit,
        candidateAssessments: fit.candidateAssessments.map(
          (assessment, assessmentIndex) => ({
            ...assessment,
            reasons: assessment.reasons.map((reason, reasonIndex) => ({
              ...reason,
              evidenceIds: reason.evidenceIds.map((token, referenceIndex) =>
                evidenceId(
                  token,
                  `/targetFitAssessment/fitAssessment/candidateAssessments/${String(assessmentIndex)}/reasons/${String(reasonIndex)}/evidenceIds/${String(referenceIndex)}`,
                ),
              ),
              inferenceIds: reason.inferenceIds.map(inferenceId),
              unknownIds: reason.unknownIds.map((token, referenceIndex) =>
                unknownId(
                  token,
                  `/targetFitAssessment/fitAssessment/candidateAssessments/${String(assessmentIndex)}/reasons/${String(reasonIndex)}/unknownIds/${String(referenceIndex)}`,
                ),
              ),
            })),
            evidenceIds: assessment.evidenceIds.map((token, referenceIndex) =>
              evidenceId(
                token,
                `/targetFitAssessment/fitAssessment/candidateAssessments/${String(assessmentIndex)}/evidenceIds/${String(referenceIndex)}`,
              ),
            ),
            inferenceIds: assessment.inferenceIds.map(inferenceId),
            claimIds: assessment.claimIds.map(claimId),
            unknownIds: assessment.unknownIds.map((token, referenceIndex) =>
              unknownId(
                token,
                `/targetFitAssessment/fitAssessment/candidateAssessments/${String(assessmentIndex)}/unknownIds/${String(referenceIndex)}`,
              ),
            ),
            hardConstraintConflictIds:
              assessment.hardConstraintConflictIds.map(conflictId),
            limitationIds: assessment.limitationIds.map(
              (token, referenceIndex) =>
                limitationId(
                  token,
                  `/targetFitAssessment/fitAssessment/candidateAssessments/${String(assessmentIndex)}/limitationIds/${String(referenceIndex)}`,
                ),
            ),
          }),
        ),
        inferences: fit.inferences.map((inference, inferenceIndex) => ({
          ...inference,
          inferenceId: inferenceId(inference.inferenceId),
          evidenceIds: inference.evidenceIds.map((token, referenceIndex) =>
            evidenceId(
              token,
              `/targetFitAssessment/fitAssessment/inferences/${String(inferenceIndex)}/evidenceIds/${String(referenceIndex)}`,
            ),
          ),
        })),
        materialClaims: fit.materialClaims.map((claim, claimIndex) => ({
          ...claim,
          claimId: claimId(claim.claimId),
          evidenceIds: claim.evidenceIds.map((token, referenceIndex) =>
            evidenceId(
              token,
              `/targetFitAssessment/fitAssessment/materialClaims/${String(claimIndex)}/evidenceIds/${String(referenceIndex)}`,
            ),
          ),
          inferenceIds: claim.inferenceIds.map(inferenceId),
        })),
        assessmentUnknowns: fit.assessmentUnknowns.map(
          (unknown, unknownIndex) => ({
            ...unknown,
            unknownId: mintModelRecordId(
              input.assessmentId,
              'assessment-unknown',
              unknown.unknownId,
            ),
            evidenceIds: unknown.evidenceIds.map((token, referenceIndex) =>
              evidenceId(
                token,
                `/targetFitAssessment/fitAssessment/assessmentUnknowns/${String(unknownIndex)}/evidenceIds/${String(referenceIndex)}`,
              ),
            ),
          }),
        ),
        hardConstraintConflicts: fit.hardConstraintConflicts.map(
          (conflict, conflictIndex) => ({
            ...conflict,
            conflictId: conflictId(conflict.conflictId),
            evidenceIds: conflict.evidenceIds.map((token, referenceIndex) =>
              evidenceId(
                token,
                `/targetFitAssessment/fitAssessment/hardConstraintConflicts/${String(conflictIndex)}/evidenceIds/${String(referenceIndex)}`,
              ),
            ),
          }),
        ),
      },
      inferenceRepositoryFactBindings:
        input.response.targetFitAssessment.inferenceRepositoryFactBindings.map(
          (binding) => ({
            ...binding,
            inferenceId: inferenceId(binding.inferenceId),
          }),
        ),
    },
    evidenceNeededHardConstraintResolutions:
      input.response.evidenceNeededHardConstraintResolutions.map(
        (resolution) => ({
          ...resolution,
          inferenceIds: resolution.inferenceIds.map(inferenceId),
        }),
      ),
  };
  const finalizedIssues = finalizeContractIssues(issues);
  return finalizedIssues.length === 0
    ? { ok: true, value: expanded, issues: [] }
    : { ok: false, issues: finalizedIssues };
}

function expandSuppliedSurrogate(
  tokenToId: ReadonlyMap<string, string>,
  token: string,
  path: string,
  issues: ContractIssue[],
): string {
  const id = tokenToId.get(token);
  if (id !== undefined) return id;
  issues.push(
    domainIssue('recommendation-assessment.surrogate-reference', path),
  );
  return 'invalid-surrogate-reference';
}

function mintModelRecordId(
  assessmentId: string,
  kind: 'assessment-unknown' | 'claim' | 'conflict' | 'inference',
  token: string,
): string {
  const prefixes = {
    'assessment-unknown': 'assessment-unknown-',
    claim: 'claim-',
    conflict: 'conflict-',
    inference: 'inference-',
  } as const;
  const prefix = prefixes[kind];
  const digest = contractCanonicalDigest({ assessmentId, kind, token });
  return `${prefix}${digest.slice(0, 64 - prefix.length)}`;
}

function compactCatalogCollisionIssues(
  request: FitAssessmentRequestV1,
  response: RecommendationAssessmentModelResponseV1,
): readonly ContractIssue[] {
  const suppliedIds = new Set<string>();
  for (const candidate of request.candidates) {
    candidate.observations.forEach(({ evidenceId }) =>
      suppliedIds.add(evidenceId),
    );
    candidate.limitations.forEach(({ limitationId }) =>
      suppliedIds.add(limitationId),
    );
    candidate.unknowns.forEach(({ unknownId }) => suppliedIds.add(unknownId));
  }

  const fit = response.targetFitAssessment.fitAssessment;
  const declared: readonly (readonly [string, string])[] = [
    ...fit.inferences.map(
      ({ inferenceId }, index) =>
        [
          inferenceId,
          `/targetFitAssessment/fitAssessment/inferences/${String(index)}/inferenceId`,
        ] as const,
    ),
    ...fit.materialClaims.map(
      ({ claimId }, index) =>
        [
          claimId,
          `/targetFitAssessment/fitAssessment/materialClaims/${String(index)}/claimId`,
        ] as const,
    ),
    ...fit.assessmentUnknowns.map(
      ({ unknownId }, index) =>
        [
          unknownId,
          `/targetFitAssessment/fitAssessment/assessmentUnknowns/${String(index)}/unknownId`,
        ] as const,
    ),
    ...fit.hardConstraintConflicts.map(
      ({ conflictId }, index) =>
        [
          conflictId,
          `/targetFitAssessment/fitAssessment/hardConstraintConflicts/${String(index)}/conflictId`,
        ] as const,
    ),
  ];
  return declared.flatMap(([id, path]) =>
    suppliedIds.has(id)
      ? [domainIssue('recommendation-assessment.catalog-id-collision', path)]
      : [],
  );
}

function hydrateRecommendationAssessmentResponseV1(input: {
  readonly request: FitAssessmentRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
  readonly response: RecommendationAssessmentModelResponseV1;
  readonly assessmentId: string;
  readonly producedAt: string;
}): RecommendationAssessmentResponseV1 {
  const fit = input.response.targetFitAssessment.fitAssessment;
  const ranking = constructModelRanking(input.request, fit);
  const response = {
    contractVersion: '1.0.0',
    targetFitAssessment: {
      contractVersion: '1.0.0',
      fitAssessment: {
        contractVersion: '1.0.0',
        assessmentId: input.assessmentId,
        assessmentRequestId: input.request.assessmentRequestId,
        correlationId: input.request.correlationId,
        outcome: fit.outcome,
        suppliedCandidateIds: input.request.candidates.map(
          ({ identity }) => identity.candidateId,
        ),
        candidateAssessments: fit.candidateAssessments,
        evidence: input.request.candidates.flatMap(
          ({ observations }) => observations,
        ),
        inferences: fit.inferences,
        candidateLimitations: input.request.candidates.flatMap(
          ({ limitations }) => limitations,
        ),
        materialClaims: fit.materialClaims,
        materialUnknowns: [
          ...input.request.candidates.flatMap(({ unknowns }) => unknowns),
          ...fit.assessmentUnknowns,
        ],
        hardConstraintConflicts: fit.hardConstraintConflicts,
        ...ranking,
        evidenceCutoff: input.request.evidenceCutoff,
        producedAt: input.producedAt,
        assessmentProcessing: fit.assessmentProcessing,
      },
      inferenceRepositoryFactBindings:
        input.response.targetFitAssessment.inferenceRepositoryFactBindings,
    },
    evidenceNeededHardConstraintResolutions:
      input.response.evidenceNeededHardConstraintResolutions,
  } satisfies Omit<RecommendationAssessmentResponseV1, 'responsibleOptions'>;
  return {
    ...response,
    responsibleOptions: responsibleOptionProjection({
      request: input.request,
      normalization: input.normalization,
      retrievalFinalists: input.retrievalFinalists,
      response,
    }).options,
  };
}

function constructModelRanking(
  request: FitAssessmentRequestV1,
  fit: RecommendationAssessmentModelResponseV1['targetFitAssessment']['fitAssessment'],
): Pick<
  TargetFitAssessmentResponseV1['fitAssessment'],
  'rankGroups' | 'rankRelations' | 'incomparablePairs'
> {
  const suppliedCandidateIds = new Set(
    request.candidates.map(({ identity }) => identity.candidateId),
  );
  const positiveCandidateIds = new Set(
    fit.candidateAssessments
      .filter(
        ({ candidateId, disposition }) =>
          suppliedCandidateIds.has(candidateId) &&
          (disposition === 'recommended' || disposition === 'viable'),
      )
      .map(({ candidateId }) => candidateId),
  );
  const orderedCandidateIds: string[] = [];
  const included = new Set<string>();
  const includeIfPositive = (candidateId: string): void => {
    if (positiveCandidateIds.has(candidateId) && !included.has(candidateId)) {
      included.add(candidateId);
      orderedCandidateIds.push(candidateId);
    }
  };
  fit.orderedViableCandidateIds.forEach(includeIfPositive);
  request.candidates.forEach(({ identity }) => {
    includeIfPositive(identity.candidateId);
  });
  const boundedCandidateIds = orderedCandidateIds.slice(
    0,
    request.requestedMaximumResults,
  );
  return {
    rankGroups: boundedCandidateIds.map((candidateId) => ({
      candidateIds: [candidateId],
    })),
    rankRelations: [],
    incomparablePairs: [],
  };
}

type ResponsibleOptionProjectionResponseV1 = Pick<
  RecommendationAssessmentResponseV1,
  'evidenceNeededHardConstraintResolutions' | 'targetFitAssessment'
>;

interface ResponsibleOptionProjectionResultV1 {
  readonly options: ResponsibleOptionV1[];
  readonly issues: readonly ContractIssue[];
}

export function projectResponsibleOptionsV1(input: {
  readonly request: FitAssessmentRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
  readonly response: ResponsibleOptionProjectionResponseV1;
}): ResponsibleOptionV1[] {
  const projected = responsibleOptionProjection(input);
  if (projected.issues.length > 0) {
    throw new TypeError('Responsible option projection failed.');
  }
  return projected.options;
}

function responsibleOptionProjection(input: {
  readonly request: FitAssessmentRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
  readonly response: ResponsibleOptionProjectionResponseV1;
}): ResponsibleOptionProjectionResultV1 {
  const issues: ContractIssue[] = [];
  const finalistById = new Map(
    input.retrievalFinalists.map((finalist) => [
      finalist.candidateId,
      finalist,
    ]),
  );
  const dossierById = new Map(
    input.request.candidates.map((dossier) => [
      dossier.identity.candidateId,
      dossier,
    ]),
  );
  const declarationById = new Map(
    input.normalization.preservedDeclarations.map((declaration) => [
      declaration.constraintId,
      declaration,
    ]),
  );
  const resolutionByKey = new Map(
    input.response.evidenceNeededHardConstraintResolutions.map((resolution) => [
      `${resolution.candidateId}\0${resolution.evaluationId}`,
      resolution,
    ]),
  );
  const options: ResponsibleOptionV1[] = [];

  for (const candidateId of rankedCandidateIds(
    input.response.targetFitAssessment.fitAssessment,
  )) {
    const finalist = finalistById.get(candidateId);
    const dossier = dossierById.get(candidateId);
    if (finalist === undefined || dossier === undefined) {
      issues.push(
        domainIssue(
          'responsible-option.candidate-binding',
          `/responsibleOptions/${candidateId}`,
        ),
      );
      continue;
    }

    const constraintStatuses: ResponsibleOptionV1['constraintStatuses'][number][] =
      [];
    for (const constraint of input.request.capabilityRequest.hardConstraints) {
      const declaration = declarationById.get(constraint.constraintId);
      if (
        declaration === undefined ||
        declaration.modality === 'preferred' ||
        declaration.statement !== constraint.statement
      ) {
        issues.push(
          domainIssue(
            'responsible-option.constraint-binding',
            `/responsibleOptions/${candidateId}/constraintStatuses/${constraint.constraintId}`,
          ),
        );
      }
      const modality =
        declaration?.modality === 'prohibited' ? 'prohibited' : 'required';
      const normalizedEvaluationIds = input.normalization.normalizedConstraints
        .filter(
          (normalized) =>
            normalized.resolutionBasis === 'controlled-taxonomy' &&
            normalized.conceptId !== null &&
            normalized.sourceConstraintIds.includes(constraint.constraintId),
        )
        .map(({ normalizedConstraintId }) => normalizedConstraintId);
      const evaluationIds =
        normalizedEvaluationIds.length > 0
          ? normalizedEvaluationIds
          : [constraint.constraintId];
      const targetFitContext = input.normalization.normalizedConstraints.some(
        (normalized) =>
          normalized.sourceConstraintIds.includes(constraint.constraintId) &&
          isCapabilityQueryTargetFitContext(normalized),
      );
      const evaluationResults = evaluationIds.map((evaluationId) => {
        const resolution = resolutionByKey.get(
          `${candidateId}\0${evaluationId}`,
        );
        return {
          evaluationId,
          state:
            resolution?.state ??
            (targetFitContext
              ? ('unresolved' as const)
              : ('satisfied' as const)),
          basis:
            resolution === undefined
              ? ('deterministic' as const)
              : ('model' as const),
          inferenceIds: resolution?.inferenceIds ?? [],
        };
      });
      const status = evaluationResults.some(({ state }) => state === 'conflict')
        ? ('conflicting' as const)
        : evaluationResults.some(({ state }) => state === 'unresolved')
          ? ('unverified' as const)
          : ('verified' as const);
      constraintStatuses.push({
        constraintId: constraint.constraintId,
        statement: constraint.statement,
        modality,
        status,
        grounding:
          status === 'verified'
            ? evaluationResults.map(
                ({ evaluationId, basis, inferenceIds }) => ({
                  evaluationId,
                  basis,
                  inferenceIds,
                }),
              )
            : [],
      });
    }

    const hasUnverifiedProhibited = constraintStatuses.some(
      ({ modality, status }) =>
        modality === 'prohibited' && status === 'unverified',
    );
    const hasNonVerified = constraintStatuses.some(
      ({ status }) => status !== 'verified',
    );
    options.push({
      candidateId,
      identity: dossier.identity,
      verificationStatus: hasUnverifiedProhibited
        ? 'unverified-prohibited-constraint'
        : hasNonVerified
          ? 'partially-verified'
          : 'fully-verified',
      constraintStatuses,
    });
  }

  return { options, issues };
}

function deriveRecommendationConstraintFacet(
  originalTerm: string,
  taxonomy: CapabilityTaxonomyV1,
  fingerprint: RepositoryFingerprintV1,
): ReturnType<typeof deriveCapabilityQueryConstraintFacet> {
  const taxonomyFacet = deriveCapabilityQueryConstraintFacet(
    originalTerm,
    taxonomy,
  );
  if (taxonomyFacet !== 'other') return taxonomyFacet;

  const termKeys = contextComponentTermKeys(originalTerm);
  if (termKeys.length === 0) return 'other';
  const matchingFacets = new Set<'framework' | 'runtime'>();
  for (const fact of fingerprint.facts) {
    if (
      fact.kind !== 'component' ||
      (fact.component !== 'framework' && fact.component !== 'runtime')
    ) {
      continue;
    }
    const factKeys = contextComponentTermKeys(fact.name);
    if (termKeys.some((key) => factKeys.includes(key))) {
      matchingFacets.add(fact.component);
    }
  }
  return matchingFacets.size === 1
    ? (matchingFacets.values().next().value ?? 'other')
    : 'other';
}

function contextComponentTermKeys(value: string): readonly string[] {
  const trimmed = value.trim().toLowerCase();
  if (!/^[a-z0-9 ._-]+$/u.test(trimmed)) return [];
  const compact = trimmed.replace(/[^a-z0-9]/gu, '');
  if (compact.length === 0) return [];
  const keys = [compact];
  if (trimmed.endsWith('.js') && compact.length > 2) {
    keys.push(compact.slice(0, -2));
  }
  return [...new Set(keys)];
}

function responsibleOptionIssues(input: {
  readonly request: FitAssessmentRequestV1;
  readonly normalization: CapabilityQueryNormalizationResultV1;
  readonly retrievalFinalists: readonly RecommendationRetrievalFinalistV1[];
  readonly response: RecommendationAssessmentResponseV1;
}): readonly ContractIssue[] {
  const projected = responsibleOptionProjection(input);
  const issues = [...projected.issues];
  if (
    contractCanonicalDigest(input.response.responsibleOptions) !==
    contractCanonicalDigest(projected.options)
  ) {
    issues.push(
      domainIssue('responsible-option.projection', '/responsibleOptions'),
    );
  }
  if (
    input.response.responsibleOptions.some(({ constraintStatuses }) =>
      constraintStatuses.some(({ status }) => status === 'conflicting'),
    )
  ) {
    issues.push(
      domainIssue('responsible-option.conflict', '/responsibleOptions'),
    );
  }
  return issues;
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
    input.request.candidates.flatMap(({ observations }) =>
      observations.map((evidence) => [evidence.evidenceId, evidence] as const),
    ),
  );
  for (const evidence of input.response.targetFitAssessment.fitAssessment
    .evidence) {
    if (!evidenceById.has(evidence.evidenceId)) {
      evidenceById.set(evidence.evidenceId, evidence);
    }
  }
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
    const hasConflict = finalist.unresolvedHardEvaluations.some((evaluation) =>
      input.response.evidenceNeededHardConstraintResolutions.some(
        (resolution) =>
          resolution.candidateId === finalist.candidateId &&
          resolution.evaluationId === evaluation.evaluationId &&
          resolution.state === 'conflict',
      ),
    );
    if (hasConflict) {
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

function recommendationV2SemanticIssues(
  value: OssRecommendationRequestV2,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (
    value.transmissionApproval.fingerprintDigest !==
    repositoryFingerprintDigestV1(value.repositoryFingerprint)
  ) {
    issues.push(
      domainIssue(
        'recommendation.fingerprint-binding',
        '/transmissionApproval/fingerprintDigest',
      ),
    );
  }

  const hardCount = value.constraints.filter(
    ({ modality }) => modality !== 'preferred',
  ).length;
  const preferenceCount = value.constraints.length - hardCount;
  if (hardCount > MAXIMUM_FIT_HARD_CONSTRAINTS) {
    issues.push(
      domainIssue('recommendation.fit-request-bounds', '/constraints'),
    );
  }
  if (preferenceCount > MAXIMUM_FIT_PREFERENCES) {
    issues.push(
      domainIssue('recommendation.fit-request-bounds', '/constraints'),
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

function generatedRootId(
  prefix: 'approval' | 'query' | 'recommendation',
  digest: string,
): string {
  return `${prefix}-${digest.slice(0, 48)}`;
}

function generatedSequenceId(
  prefix: 'condition' | 'constraint' | 'reference' | 'term',
  index: number,
): string {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function isRecordWithContractVersion(
  value: unknown,
  contractVersion: '1.0.0' | '2.0.0',
): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Reflect.get(value, 'contractVersion') === contractVersion
  );
}
