import { contractCanonicalDigest } from './artifact-identity.ts';
import { parseCapabilityQueryNormalizationResultV1 } from './capability-query-contracts.ts';
import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { cloneOwnedJson } from './owned-json.ts';
import { CONTRACT_VERSION } from './schema-builders.ts';
import {
  candidateRetrievalRequestV1Validator,
  candidateRetrievalResultV1Validator,
  structurallyValidate,
} from './structural-validation.ts';
import {
  CANDIDATE_RETRIEVAL_ALGORITHM_VERSION,
  CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS,
  CANDIDATE_RETRIEVAL_REQUEST_VERSION,
  CANDIDATE_RETRIEVAL_RESULT_VERSION,
  type CandidateRetrievalAuthorityBindingsV1,
  type CandidateRetrievalCandidateV1,
  type CandidateRetrievalRequestV1,
  type CandidateRetrievalResultV1,
} from './candidate-retrieval-schemas.ts';

export type CandidateRetrievalRequestInputV1 = Omit<
  CandidateRetrievalRequestV1,
  'contractVersion' | 'retrievalRequestId' | 'retrievalRequestVersion'
>;

export type CandidateRetrievalResultInputV1 = Omit<
  CandidateRetrievalResultV1,
  | 'contractVersion'
  | 'retrievalAlgorithmVersion'
  | 'retrievalResultId'
  | 'retrievalResultVersion'
  | 'semanticDigest'
>;

export type CandidateRetrievalExchangeValidationResult =
  | {
      readonly ok: true;
      readonly request: CandidateRetrievalRequestV1;
      readonly result: CandidateRetrievalResultV1;
      readonly issues: readonly [];
    }
  | { readonly ok: false; readonly issues: readonly ContractIssue[] };

export function createCandidateRetrievalRequestV1(
  input: CandidateRetrievalRequestInputV1,
): CandidateRetrievalRequestV1 {
  const owned = cloneOwnedJson(input);
  const requestWithoutId = {
    contractVersion: CONTRACT_VERSION,
    retrievalRequestVersion: CANDIDATE_RETRIEVAL_REQUEST_VERSION,
    ...owned,
  } as const;
  const candidate = {
    ...requestWithoutId,
    retrievalRequestId: retrievalRequestId(
      candidateRetrievalRequestSemanticDigest(requestWithoutId),
    ),
  } satisfies CandidateRetrievalRequestV1;
  const parsed = parseCandidateRetrievalRequestV1(candidate);
  if (!parsed.ok) throw new Error('Candidate retrieval request is invalid.');
  return parsed.value;
}

export function parseCandidateRetrievalRequestV1(
  value: unknown,
): ContractParseResult<
  CandidateRetrievalRequestV1,
  CandidateRetrievalRequestV1
> {
  const structural = structurallyValidate(
    value,
    candidateRetrievalRequestV1Validator,
  );
  if (!structural.ok) return structural;
  try {
    const issues = validateRequestSemantics(structural.value);
    if (issues.length > 0) return { ok: false, issues };
    return {
      ok: true,
      value: cloneOwnedJson(structural.value),
      domain: cloneOwnedJson(structural.value),
      issues: [],
    };
  } catch {
    return unsafeInput();
  }
}

export function createCandidateRetrievalResultV1(
  input: CandidateRetrievalResultInputV1,
): CandidateRetrievalResultV1 {
  const owned = cloneOwnedJson(input);
  const withoutIdentity = {
    contractVersion: CONTRACT_VERSION,
    retrievalResultVersion: CANDIDATE_RETRIEVAL_RESULT_VERSION,
    retrievalAlgorithmVersion: CANDIDATE_RETRIEVAL_ALGORITHM_VERSION,
    ...owned,
  } as const;
  const semanticDigest =
    candidateRetrievalResultSemanticDigest(withoutIdentity);
  const candidate = {
    ...withoutIdentity,
    retrievalResultId: retrievalResultId(semanticDigest),
    semanticDigest,
  } satisfies CandidateRetrievalResultV1;
  const parsed = parseCandidateRetrievalResultV1(candidate);
  if (!parsed.ok) throw new Error('Candidate retrieval result is invalid.');
  return parsed.value;
}

export function parseCandidateRetrievalResultV1(
  value: unknown,
): ContractParseResult<CandidateRetrievalResultV1, CandidateRetrievalResultV1> {
  const structural = structurallyValidate(
    value,
    candidateRetrievalResultV1Validator,
  );
  if (!structural.ok) return structural;
  try {
    const issues = validateResultSemantics(structural.value);
    if (issues.length > 0) return { ok: false, issues };
    return {
      ok: true,
      value: cloneOwnedJson(structural.value),
      domain: cloneOwnedJson(structural.value),
      issues: [],
    };
  } catch {
    return unsafeInput();
  }
}

export function validateCandidateRetrievalExchangeV1(
  suppliedRequest: unknown,
  suppliedResult: unknown,
): CandidateRetrievalExchangeValidationResult {
  const request = parseCandidateRetrievalRequestV1(suppliedRequest);
  const result = parseCandidateRetrievalResultV1(suppliedResult);
  if (!request.ok || !result.ok) {
    return {
      ok: false,
      issues: finalizeContractIssues([
        ...prefixIssues(request.ok ? [] : request.issues, '/request'),
        ...prefixIssues(result.ok ? [] : result.issues, '/result'),
      ]),
    };
  }
  if (
    result.value.retrievalRequestId !== request.value.retrievalRequestId ||
    result.value.normalizationId !==
      request.value.normalization.normalizationId ||
    result.value.normalizationSemanticDigest !==
      request.value.normalization.semanticDigest ||
    contractCanonicalDigest(result.value.authorityBindings) !==
      contractCanonicalDigest(request.value.authorityBindings) ||
    result.value.eligibleResultLimit !== request.value.eligibleResultLimit ||
    result.value.evidenceNeededResultLimit !==
      request.value.evidenceNeededResultLimit
  ) {
    return {
      ok: false,
      issues: [
        contractIssue(
          'contract.literal',
          '',
          'Contract value does not match the required literal.',
        ),
      ],
    };
  }
  return {
    ok: true,
    request: request.value,
    result: result.value,
    issues: [],
  };
}

export function candidateRetrievalRequestSemanticDigest(
  value:
    | Omit<CandidateRetrievalRequestV1, 'retrievalRequestId'>
    | CandidateRetrievalRequestV1,
): string {
  const { retrievalRequestId: ignored, ...semantic } =
    value as CandidateRetrievalRequestV1;
  void ignored;
  return contractCanonicalDigest(semantic);
}

export function candidateRetrievalResultSemanticDigest(
  value:
    | Omit<CandidateRetrievalResultV1, 'retrievalResultId' | 'semanticDigest'>
    | CandidateRetrievalResultV1,
): string {
  const {
    retrievalResultId: ignoredId,
    semanticDigest: ignoredDigest,
    ...semantic
  } = value as CandidateRetrievalResultV1;
  void ignoredId;
  void ignoredDigest;
  return contractCanonicalDigest(semantic);
}

export function serializeCandidateRetrievalRequestV1(
  value: CandidateRetrievalRequestV1,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeCandidateRetrievalResultV1(
  value: CandidateRetrievalResultV1,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateRequestSemantics(
  request: CandidateRetrievalRequestV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const normalization = parseCapabilityQueryNormalizationResultV1(
    request.normalization,
  );
  if (!normalization.ok) {
    issues.push(
      contractIssue(
        'contract.literal',
        '/normalization',
        'Contract value does not match the required literal.',
      ),
    );
  }
  if (
    request.normalization.outcome !== 'normalized' ||
    request.normalization.primaryFamilyId === null
  ) {
    issues.push(
      contractIssue(
        'contract.variant',
        '/normalization/outcome',
        'Contract value does not match an allowed variant.',
      ),
    );
  }
  if (request.normalization.repositoryFingerprintReference !== null) {
    issues.push(
      contractIssue(
        'contract.variant',
        '/normalization/repositoryFingerprintReference',
        'Contract value does not match an allowed variant.',
      ),
    );
  }
  if (
    request.normalization.taxonomyVersion !==
      request.authorityBindings.taxonomy.taxonomyVersion ||
    request.normalization.taxonomySemanticDigest !==
      request.authorityBindings.taxonomy.taxonomySemanticDigest
  ) {
    issues.push(bindingIssue('/authorityBindings/taxonomy'));
  }
  const catalogBinding = request.normalization.candidateCatalogBinding;
  if (
    catalogBinding !== null &&
    (catalogBinding.catalogVersion !==
      request.authorityBindings.catalog.catalogVersion ||
      catalogBinding.catalogDigest !==
        request.authorityBindings.catalog.catalogDigest)
  ) {
    issues.push(bindingIssue('/authorityBindings/catalog'));
  }
  const expectedId = retrievalRequestId(
    candidateRetrievalRequestSemanticDigest(request),
  );
  if (request.retrievalRequestId !== expectedId) {
    issues.push(bindingIssue('/retrievalRequestId'));
  }
  return finalizeContractIssues(issues);
}

function validateResultSemantics(
  result: CandidateRetrievalResultV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (
    result.channelBindings.length !==
      CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.length ||
    result.channelBindings.some((binding, index) => {
      const expected = CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS[index];
      if (expected === undefined) return true;
      return (
        binding.channelId !== expected.channelId ||
        binding.channelVersion !== expected.channelVersion
      );
    })
  ) {
    issues.push(bindingIssue('/channelBindings'));
  }
  if (
    result.eligibleCandidates.length > result.eligibleResultLimit ||
    result.evidenceNeededCandidates.length > result.evidenceNeededResultLimit ||
    result.eligibleCandidates.length + result.evidenceNeededCandidates.length >
      20
  ) {
    issues.push(boundsIssue('/eligibleCandidates'));
  }
  const laneCountTotal =
    result.preRetrievalLaneCounts.eligible +
    result.preRetrievalLaneCounts['evidence-needed'] +
    result.preRetrievalLaneCounts.excluded;
  if (
    laneCountTotal !== result.diagnostics.candidatesExamined ||
    result.diagnostics.candidatesConstraintEvaluated !==
      result.diagnostics.candidatesExamined ||
    result.eligibleCandidates.length > result.preRetrievalLaneCounts.eligible ||
    result.evidenceNeededCandidates.length >
      result.preRetrievalLaneCounts['evidence-needed'] ||
    result.diagnostics.negativeControlsExcluded >
      result.preRetrievalLaneCounts.excluded
  ) {
    issues.push(boundsIssue('/preRetrievalLaneCounts'));
  }
  const candidates = [
    ...result.eligibleCandidates,
    ...result.evidenceNeededCandidates,
  ];
  const candidateIds = candidates.map(({ candidateId }) => candidateId);
  if (new Set(candidateIds).size !== candidateIds.length) {
    issues.push(duplicateIssue('/eligibleCandidates'));
  }
  candidates.forEach((candidate, index) => {
    validateCandidate(candidate, issues, `/candidates/${String(index)}`);
  });
  const expectedDigest = candidateRetrievalResultSemanticDigest(result);
  if (
    result.semanticDigest !== expectedDigest ||
    result.retrievalResultId !== retrievalResultId(expectedDigest)
  ) {
    issues.push(bindingIssue('/semanticDigest'));
  }
  return finalizeContractIssues(issues);
}

function validateCandidate(
  candidate: CandidateRetrievalCandidateV1,
  issues: ContractIssue[],
  path: string,
): void {
  const channelIds = candidate.channelMatches.map(({ channelId }) => channelId);
  if (new Set(channelIds).size !== channelIds.length) {
    issues.push(duplicateIssue(`${path}/channelMatches`));
  }
  let score = 0;
  const conceptIds = new Set<string>();
  const fieldIds = new Set<string>();
  for (const match of candidate.channelMatches) {
    score += match.componentScore;
    match.matchedCapabilityConceptIds.forEach((value) => conceptIds.add(value));
    match.matchedProfileFieldIds.forEach((value) => fieldIds.add(value));
    const binding = CANDIDATE_RETRIEVAL_CHANNEL_BINDINGS.find(
      ({ channelId }) => channelId === match.channelId,
    );
    if (binding?.channelVersion !== match.channelVersion) {
      issues.push(bindingIssue(`${path}/channelMatches`));
    }
    if (
      match.matchedExpansionEdgeIds.length > 0 &&
      match.channelId !== 'candidate-identity' &&
      match.channelId !== 'package-identity'
    ) {
      issues.push(bindingIssue(`${path}/channelMatches`));
    }
    const metadataTerms = match.matchedMetadataTerms;
    if (match.channelId === 'approved-metadata-lexical') {
      const normalizedTerms = metadataTerms.map(
        ({ normalizedTerm }) => normalizedTerm,
      );
      const metadataScore = metadataTerms.reduce(
        (sum, { points }) => sum + points,
        0,
      );
      if (
        metadataTerms.length === 0 ||
        new Set(normalizedTerms).size !== normalizedTerms.length ||
        metadataScore !== match.componentScore ||
        match.componentScore > 900 ||
        match.matchedCapabilityConceptIds.length > 0 ||
        match.matchedProfileFieldIds.length > 0 ||
        match.matchedExpansionEdgeIds.length > 0 ||
        metadataTerms.some(
          ({ source, points }) =>
            (source === 'topic' && points !== 300) ||
            (source !== 'topic' && points !== 100),
        )
      ) {
        issues.push(bindingIssue(`${path}/channelMatches`));
      }
    } else if (metadataTerms.length > 0) {
      issues.push(bindingIssue(`${path}/channelMatches`));
    }
  }
  if (
    score !== candidate.retrievalScore ||
    !sameSortedValues(candidate.matchedCapabilityConceptIds, [...conceptIds]) ||
    !sameSortedValues(candidate.matchedProfileFieldIds, [...fieldIds])
  ) {
    issues.push(bindingIssue(path));
  }
}

function sameSortedValues(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    [...left].sort(compareText).join('\0') ===
    [...right].sort(compareText).join('\0')
  );
}

function retrievalRequestId(digest: string): string {
  return `retrieval-request-${digest.slice(0, 48)}`;
}

function retrievalResultId(digest: string): string {
  return `retrieval-result-${digest.slice(0, 48)}`;
}

function bindingIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.literal',
    path,
    'Contract value does not match the required literal.',
  );
}

function boundsIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.bounds',
    path,
    'Contract value is outside the allowed bounds.',
  );
}

function duplicateIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.duplicate',
    path,
    'Contract value contains a duplicate item.',
  );
}

function prefixIssues(
  issues: readonly ContractIssue[],
  prefix: string,
): readonly ContractIssue[] {
  return issues.map((issue) => ({
    ...issue,
    path: `${prefix}${issue.path}`,
  }));
}

function unsafeInput(): ContractParseResult<never, never> {
  return {
    ok: false,
    issues: [
      contractIssue(
        'contract.input-shape',
        '',
        'Contract input has an unsupported object shape.',
      ),
    ],
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function candidateRetrievalAuthorityBindingsDigest(
  bindings: CandidateRetrievalAuthorityBindingsV1,
): string {
  return contractCanonicalDigest(bindings);
}
