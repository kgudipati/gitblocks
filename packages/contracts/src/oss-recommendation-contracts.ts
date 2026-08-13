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
import type {
  OssRecommendationRequestV1,
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
