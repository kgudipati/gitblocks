import {
  contractCanonicalDigest,
  repositoryArtifactUtf8ByteLength,
} from './artifact-identity.ts';
import {
  contractIssue,
  finalizeContractIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { cloneOwnedJson } from './owned-json.ts';
import {
  modelExecutionIdentityDigest,
  modelExecutionModelProfileDigest,
  modelExecutionRecordDigest,
  modelExecutionReuseKeyDigest,
  repositoryInterviewCitationIdentityDigest,
  repositoryInterviewClaimIdentityDigest,
  repositoryInterviewContradictionIdentityDigest,
  repositoryInterviewIdentityDigest,
  repositoryInterviewLimitationIdentityDigest,
  repositoryInterviewNestedRecordDigest,
  repositoryInterviewRecordDigest,
  repositoryInterviewRequestIdentityDigest,
  repositoryInterviewRequestRecordDigest,
  repositoryInterviewUnknownIdentityDigest,
} from './repository-interview-digests.ts';
import {
  REPOSITORY_INTERVIEW_BOUNDS,
  REPOSITORY_INTERVIEW_TOPICS,
  type ModelExecutionModelProfileV1,
  type ModelExecutionUsageV1,
  type ModelExecutionV1,
  type RepositoryInterviewCitationV1,
  type RepositoryInterviewClaimV1,
  type RepositoryInterviewContradictionPositionV1,
  type RepositoryInterviewContradictionV1,
  type RepositoryInterviewLimitationV1,
  type RepositoryInterviewRequestV1,
  type RepositoryInterviewTopic,
  type RepositoryInterviewUnknownV1,
  type RepositoryInterviewV1,
} from './repository-interview-schemas.ts';
import {
  modelExecutionModelProfileV1Validator,
  modelExecutionV1Validator,
  repositoryInterviewRequestV1Validator,
  repositoryInterviewV1Validator,
  structurallyValidate,
} from './structural-validation.ts';

const UNKNOWN_SCOPE_PATTERN =
  /\b(?:supplied|provided|reviewed|this)\s+(?:artifact\s+set|artifacts?)\b|\bthese\s+artifacts\b/iu;
const UNIVERSAL_ABSENCE_PATTERN =
  /\b(?:universally|anywhere|in\s+all\s+versions|never\s+exists?|does\s+not\s+exist)\b/iu;
const MARKDOWN_LINK_PATTERN = /!?\[[^\]\r\n]*\]\([^)\r\n]*\)/u;
const URL_PATTERN = /https?:\/\//iu;
const HTML_PATTERN = /<\/?[A-Za-z][^>]*>/u;
const CONTROL_OR_FORMAT_PATTERN = /[\p{Cc}\p{Cf}]/u;
const MODEL_SNAPSHOT_DATE_SUFFIX_PATTERN = /-(\d{4})-(\d{2})-(\d{2})$/u;

export function parseRepositoryInterviewRequestV1(
  value: unknown,
): ContractParseResult<
  RepositoryInterviewRequestV1,
  RepositoryInterviewRequestV1
> {
  return parseRepositoryInterviewContract(
    structurallyValidate(value, repositoryInterviewRequestV1Validator),
    validateRequest,
  );
}

export function parseModelExecutionModelProfileV1(
  value: unknown,
): ContractParseResult<
  ModelExecutionModelProfileV1,
  ModelExecutionModelProfileV1
> {
  return parseRepositoryInterviewContract(
    structurallyValidate(value, modelExecutionModelProfileV1Validator),
    validateModelProfile,
  );
}

export function parseModelExecutionV1(
  value: unknown,
): ContractParseResult<ModelExecutionV1, ModelExecutionV1> {
  return parseRepositoryInterviewContract(
    structurallyValidate(value, modelExecutionV1Validator),
    validateExecution,
  );
}

export function parseRepositoryInterviewV1(
  value: unknown,
): ContractParseResult<RepositoryInterviewV1, RepositoryInterviewV1> {
  return parseRepositoryInterviewContract(
    structurallyValidate(value, repositoryInterviewV1Validator),
    validateInterview,
  );
}

export type RepositoryInterviewExecutionValidationResult =
  | {
      readonly ok: true;
      readonly request: RepositoryInterviewRequestV1;
      readonly execution: ModelExecutionV1;
      readonly interview: RepositoryInterviewV1;
      readonly issues: readonly [];
    }
  | {
      readonly ok: false;
      readonly issues: readonly ContractIssue[];
    };

export function validateRepositoryInterviewExecutionV1(
  request: RepositoryInterviewRequestV1,
  execution: ModelExecutionV1,
  interview: RepositoryInterviewV1,
): RepositoryInterviewExecutionValidationResult {
  const parsedRequest = parseRepositoryInterviewRequestV1(request);
  const parsedExecution = parseModelExecutionV1(execution);
  const parsedInterview = parseRepositoryInterviewV1(interview);
  if (!parsedRequest.ok || !parsedExecution.ok || !parsedInterview.ok) {
    return {
      ok: false,
      issues: finalizeContractIssues([
        ...prefixIssues(
          parsedRequest.ok ? [] : parsedRequest.issues,
          '/request',
        ),
        ...prefixIssues(
          parsedExecution.ok ? [] : parsedExecution.issues,
          '/execution',
        ),
        ...prefixIssues(
          parsedInterview.ok ? [] : parsedInterview.issues,
          '/interview',
        ),
      ]),
    };
  }

  const issues: ContractIssue[] = [];
  const ownedRequest = parsedRequest.value;
  const ownedExecution = parsedExecution.value;
  const ownedInterview = parsedInterview.value;
  requireEqual(
    ownedExecution.requestId,
    ownedRequest.requestId,
    '/execution/requestId',
    issues,
  );
  requireEqual(
    ownedExecution.requestIdentityDigest,
    ownedRequest.identityDigest,
    '/execution/requestIdentityDigest',
    issues,
  );
  requireEqual(
    ownedInterview.requestId,
    ownedRequest.requestId,
    '/interview/requestId',
    issues,
  );
  requireEqual(
    ownedInterview.requestIdentityDigest,
    ownedRequest.identityDigest,
    '/interview/requestIdentityDigest',
    issues,
  );
  requireEqual(
    ownedInterview.executionId,
    ownedExecution.executionId,
    '/interview/executionId',
    issues,
  );
  requireEqual(
    ownedInterview.executionIdentityDigest,
    ownedExecution.identityDigest,
    '/interview/executionIdentityDigest',
    issues,
  );
  requireEqual(
    ownedInterview.candidateId,
    ownedRequest.candidateId,
    '/interview/candidateId',
    issues,
  );
  requireEqual(
    ownedInterview.artifactSetId,
    ownedRequest.artifactSetId,
    '/interview/artifactSetId',
    issues,
  );
  requireEqual(
    ownedInterview.artifactSetIdentityDigest,
    ownedRequest.artifactSetIdentityDigest,
    '/interview/artifactSetIdentityDigest',
    issues,
  );
  for (const field of [
    'specificationVersion',
    'specificationDigest',
    'rendererVersion',
    'providerOutputSchemaVersion',
    'providerOutputSchemaDigest',
    'promptDigest',
  ] as const) {
    requireEqual(
      ownedInterview[field],
      ownedRequest[field],
      `/interview/${field}`,
      issues,
    );
  }
  requireEqual(
    ownedInterview.providerProjectionVersion,
    ownedExecution.modelProfile.providerProjectionVersion,
    '/interview/providerProjectionVersion',
    issues,
  );
  requireEqual(
    ownedInterview.providerProjectionDigest,
    ownedExecution.modelProfile.providerProjectionDigest,
    '/interview/providerProjectionDigest',
    issues,
  );
  requireEqual(
    ownedInterview.modelProfileDigest,
    ownedExecution.modelProfileDigest,
    '/interview/modelProfileDigest',
    issues,
  );
  const publishedAt = timestampValue(ownedInterview.publishedAt);
  const executionCompletedAt = timestampValue(ownedExecution.completedAt);
  if (
    publishedAt === null ||
    executionCompletedAt === null ||
    publishedAt < executionCompletedAt
  ) {
    issues.push(boundsIssue('/interview/publishedAt'));
  }
  if (ownedExecution.outcome.status !== 'succeeded') {
    issues.push(patternIssue('/execution/outcome/status'));
  } else {
    requireEqual(
      ownedInterview.providerOutputDigest,
      ownedExecution.outcome.providerOutputDigest,
      '/interview/providerOutputDigest',
      issues,
    );
  }

  const finalized = finalizeContractIssues(issues);
  if (finalized.length > 0) {
    return { ok: false, issues: finalized };
  }
  return {
    ok: true,
    request: ownedRequest,
    execution: ownedExecution,
    interview: ownedInterview,
    issues: [],
  };
}

function parseRepositoryInterviewContract<T>(
  structural:
    | { readonly ok: true; readonly value: T; readonly issues: readonly [] }
    | { readonly ok: false; readonly issues: readonly ContractIssue[] },
  validate: (value: T) => readonly ContractIssue[],
): ContractParseResult<T, T> {
  if (!structural.ok) {
    return structural;
  }
  try {
    const owned = cloneOwnedJson(structural.value);
    const issues = finalizeContractIssues(validate(owned));
    if (issues.length > 0) {
      return { ok: false, issues };
    }
    return { ok: true, value: owned, domain: owned, issues: [] };
  } catch {
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
}

function validateRequest(
  value: RepositoryInterviewRequestV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  const identityDigest = repositoryInterviewRequestIdentityDigest(value);
  validateDerivedIdentity(
    value.requestId,
    `intreq-${identityDigest.slice(0, 48)}`,
    value.identityDigest,
    identityDigest,
    '/requestId',
    '/identityDigest',
    issues,
  );
  if (repositoryInterviewRequestRecordDigest(value) !== value.recordDigest) {
    issues.push(patternIssue('/recordDigest'));
  }
  return issues;
}

function validateExecution(value: ModelExecutionV1): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  if (
    (value.executionMode === 'normal' && value.forceReason !== null) ||
    (value.executionMode === 'forced' && value.forceReason === null)
  ) {
    issues.push(patternIssue('/forceReason'));
  }
  issues.push(
    ...prefixIssues(validateModelProfile(value.modelProfile), '/modelProfile'),
  );
  const modelProfileDigest = modelExecutionModelProfileDigest(
    value.modelProfile,
  );
  if (modelProfileDigest !== value.modelProfileDigest) {
    issues.push(patternIssue('/modelProfileDigest'));
  }
  const reuseKeyDigest = modelExecutionReuseKeyDigest(value);
  if (reuseKeyDigest !== value.reuseKeyDigest) {
    issues.push(patternIssue('/reuseKeyDigest'));
  }
  const identityDigest = modelExecutionIdentityDigest(value);
  validateDerivedIdentity(
    value.executionId,
    `modelexec-${identityDigest.slice(0, 48)}`,
    value.identityDigest,
    identityDigest,
    '/executionId',
    '/identityDigest',
    issues,
  );
  validateExecutionTimeline(value, issues);
  validateTerminalOutcome(value, issues);
  validateUsage(value.outcome.usage, '/outcome/usage', issues);
  if (modelExecutionRecordDigest(value) !== value.recordDigest) {
    issues.push(patternIssue('/recordDigest'));
  }
  return issues;
}

function validateModelProfile(
  value: ModelExecutionModelProfileV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  validateModelSnapshotDate(value.modelSnapshot, '/modelSnapshot', issues);
  return issues;
}

function validateExecutionTimeline(
  value: ModelExecutionV1,
  issues: ContractIssue[],
): void {
  const rootStart = timestampValue(value.startedAt);
  const rootEnd = timestampValue(value.completedAt);
  if (rootStart === null || rootEnd === null || rootEnd < rootStart) {
    issues.push(boundsIssue('/completedAt'));
  }
  let previousAttemptEnd: number | null = null;
  value.attempts.forEach((attempt, index) => {
    const path = `/attempts/${String(index)}`;
    if (attempt.ordinal !== index + 1) {
      issues.push(patternIssue(`${path}/ordinal`));
    }
    const start = timestampValue(attempt.startedAt);
    const end = timestampValue(attempt.completedAt);
    if (
      start === null ||
      end === null ||
      end < start ||
      rootStart === null ||
      rootEnd === null ||
      start < rootStart ||
      end > rootEnd ||
      (previousAttemptEnd !== null && start < previousAttemptEnd)
    ) {
      issues.push(boundsIssue(`${path}/completedAt`));
    }
    previousAttemptEnd = end;
    if (
      (attempt.transportOutcome === 'response' &&
        attempt.httpStatus === null) ||
      (attempt.transportOutcome !== 'response' && attempt.httpStatus !== null)
    ) {
      issues.push(patternIssue(`${path}/httpStatus`));
    }
    if (attempt.responseBytes > value.modelProfile.maximumResponseBytes) {
      issues.push(boundsIssue(`${path}/responseBytes`));
    }
  });
}

function validateTerminalOutcome(
  value: ModelExecutionV1,
  issues: ContractIssue[],
): void {
  const finalAttemptIndex = value.attempts.length - 1;
  const finalAttempt = value.attempts[finalAttemptIndex];
  if (finalAttempt === undefined) {
    issues.push(boundsIssue('/attempts'));
    return;
  }
  const transportPath = `/attempts/${String(
    finalAttemptIndex,
  )}/transportOutcome`;
  if (value.outcome.status === 'succeeded') {
    if (finalAttempt.transportOutcome !== 'response') {
      issues.push(patternIssue(transportPath));
    }
    if (
      finalAttempt.httpStatus === null ||
      finalAttempt.httpStatus < 200 ||
      finalAttempt.httpStatus > 299
    ) {
      issues.push(
        boundsIssue(`/attempts/${String(finalAttemptIndex)}/httpStatus`),
      );
    }
    return;
  }
  const expectedTransportOutcome =
    value.outcome.failureCode === 'transport-error'
      ? 'network-error'
      : value.outcome.failureCode === 'deadline-exceeded'
        ? 'deadline-exceeded'
        : value.outcome.failureCode === 'cancelled'
          ? 'cancelled'
          : null;
  if (
    expectedTransportOutcome !== null &&
    finalAttempt.transportOutcome !== expectedTransportOutcome
  ) {
    issues.push(patternIssue(transportPath));
  }
}

function validateUsage(
  usage: ModelExecutionUsageV1 | null,
  path: string,
  issues: ContractIssue[],
): void {
  if (usage === null) {
    return;
  }
  if (
    usage.cachedInputTokens > usage.inputTokens ||
    usage.reasoningTokens > usage.outputTokens ||
    usage.totalTokens !== usage.inputTokens + usage.outputTokens
  ) {
    issues.push(boundsIssue(path));
  }
}

function validateModelSnapshotDate(
  value: string,
  path: string,
  issues: ContractIssue[],
): void {
  const match = MODEL_SNAPSHOT_DATE_SUFFIX_PATTERN.exec(value);
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];
  if (
    yearText === undefined ||
    monthText === undefined ||
    dayText === undefined
  ) {
    issues.push(patternIssue(path));
    return;
  }
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const roundTrip = `${String(year).padStart(4, '0')}-${String(month).padStart(
    2,
    '0',
  )}-${String(day).padStart(2, '0')}`;
  const dateSuffix = `${yearText}-${monthText}-${dayText}`;
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maximumDay =
    month === 2
      ? leapYear
        ? 29
        : 28
      : [4, 6, 9, 11].includes(month)
        ? 30
        : month >= 1 && month <= 12
          ? 31
          : 0;
  if (
    roundTrip !== dateSuffix ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > maximumDay
  ) {
    issues.push(patternIssue(path));
  }
}

function validateInterview(
  value: RepositoryInterviewV1,
): readonly ContractIssue[] {
  const issues: ContractIssue[] = [];
  validateTimestamp(value.publishedAt, '/publishedAt', issues);
  const citationIds = new Set<string>();
  const citationDigests = new Set<string>();
  const citationCoordinates = new Set<string>();
  value.citations.forEach((citation, index) => {
    const path = `/citations/${String(index)}`;
    validateCitation(value, citation, path, issues);
    addUnique(citationIds, citation.citationId, `${path}/citationId`, issues);
    addUnique(
      citationDigests,
      citation.identityDigest,
      `${path}/identityDigest`,
      issues,
    );
    addUnique(
      citationCoordinates,
      citationCoordinateKey(citation),
      path,
      issues,
    );
  });
  validateCanonicalOrder(
    value.citations,
    compareCitations,
    '/citations',
    issues,
  );

  const usedCitationIds = new Set<string>();
  validateClaims(value, citationIds, usedCitationIds, issues);
  validateLimitations(value, citationIds, usedCitationIds, issues);
  validateContradictions(value, citationIds, usedCitationIds, issues);
  validateUnknowns(value, citationIds, usedCitationIds, issues);

  if (
    value.citations.some(
      (citation) => !usedCitationIds.has(citation.citationId),
    )
  ) {
    issues.push(patternIssue('/citations'));
  }
  validateTopicCoverage(value, issues);
  if (
    deriveRepositoryInterviewProcessingState(value) !== value.processingState
  ) {
    issues.push(patternIssue('/processingState'));
  }
  const identityValue = {
    contractVersion: value.contractVersion,
    candidateId: value.candidateId,
    artifactSetId: value.artifactSetId,
    artifactSetIdentityDigest: value.artifactSetIdentityDigest,
    requestId: value.requestId,
    requestIdentityDigest: value.requestIdentityDigest,
    executionId: value.executionId,
    executionIdentityDigest: value.executionIdentityDigest,
    providerOutputDigest: value.providerOutputDigest,
    specificationVersion: value.specificationVersion,
    specificationDigest: value.specificationDigest,
    rendererVersion: value.rendererVersion,
    providerOutputSchemaVersion: value.providerOutputSchemaVersion,
    providerOutputSchemaDigest: value.providerOutputSchemaDigest,
    providerProjectionVersion: value.providerProjectionVersion,
    providerProjectionDigest: value.providerProjectionDigest,
    promptDigest: value.promptDigest,
    modelProfileDigest: value.modelProfileDigest,
    processingState: value.processingState,
    citations: value.citations,
    claims: value.claims,
    limitations: value.limitations,
    contradictions: value.contradictions,
    unknowns: value.unknowns,
  };
  const identityDigest = repositoryInterviewIdentityDigest(identityValue);
  validateDerivedIdentity(
    value.interviewId,
    `interview-${identityDigest.slice(0, 48)}`,
    value.identityDigest,
    identityDigest,
    '/interviewId',
    '/identityDigest',
    issues,
  );
  if (repositoryInterviewRecordDigest(value) !== value.recordDigest) {
    issues.push(patternIssue('/recordDigest'));
  }
  return issues;
}

function validateCitation(
  root: RepositoryInterviewV1,
  value: RepositoryInterviewCitationV1,
  path: string,
  issues: ContractIssue[],
): void {
  if (
    value.startLine > value.endLine ||
    value.endLine - value.startLine + 1 >
      REPOSITORY_INTERVIEW_BOUNDS.maximumCitationLines
  ) {
    issues.push(boundsIssue(path));
  }
  const identityDigest = repositoryInterviewCitationIdentityDigest(
    root.contractVersion,
    root.executionId,
    value,
  );
  validateDerivedIdentity(
    value.citationId,
    `intcite-${identityDigest.slice(0, 48)}`,
    value.identityDigest,
    identityDigest,
    `${path}/citationId`,
    `${path}/identityDigest`,
    issues,
  );
  if (repositoryInterviewNestedRecordDigest(value) !== value.recordDigest) {
    issues.push(patternIssue(`${path}/recordDigest`));
  }
}

function validateClaims(
  root: RepositoryInterviewV1,
  citationIds: ReadonlySet<string>,
  usedCitationIds: Set<string>,
  issues: ContractIssue[],
): void {
  const ids = new Set<string>();
  const digests = new Set<string>();
  root.claims.forEach((claim, index) => {
    const path = `/claims/${String(index)}`;
    validateSemanticString(
      claim.statement,
      REPOSITORY_INTERVIEW_BOUNDS.maximumStatementScalars,
      REPOSITORY_INTERVIEW_BOUNDS.maximumStatementUtf8Bytes,
      `${path}/statement`,
      issues,
    );
    if (claim.rationale !== null) {
      validateSemanticString(
        claim.rationale,
        REPOSITORY_INTERVIEW_BOUNDS.maximumRationaleScalars,
        REPOSITORY_INTERVIEW_BOUNDS.maximumRationaleUtf8Bytes,
        `${path}/rationale`,
        issues,
      );
      if (canonicalText(claim.statement) === canonicalText(claim.rationale)) {
        issues.push(patternIssue(`${path}/rationale`));
      }
    }
    validateCitationReferences(
      claim.citationIds,
      citationIds,
      usedCitationIds,
      `${path}/citationIds`,
      issues,
    );
    const identityDigest = repositoryInterviewClaimIdentityDigest(
      root.contractVersion,
      root.executionId,
      claim,
    );
    validateDerivedIdentity(
      claim.claimId,
      `intclaim-${identityDigest.slice(0, 48)}`,
      claim.identityDigest,
      identityDigest,
      `${path}/claimId`,
      `${path}/identityDigest`,
      issues,
    );
    if (repositoryInterviewNestedRecordDigest(claim) !== claim.recordDigest) {
      issues.push(patternIssue(`${path}/recordDigest`));
    }
    addUnique(ids, claim.claimId, `${path}/claimId`, issues);
    addUnique(digests, claim.identityDigest, `${path}/identityDigest`, issues);
  });
  validateCanonicalOrder(root.claims, compareClaims, '/claims', issues);
}

function validateLimitations(
  root: RepositoryInterviewV1,
  citationIds: ReadonlySet<string>,
  usedCitationIds: Set<string>,
  issues: ContractIssue[],
): void {
  const ids = new Set<string>();
  const digests = new Set<string>();
  root.limitations.forEach((limitation, index) => {
    const path = `/limitations/${String(index)}`;
    validateSemanticString(
      limitation.statement,
      REPOSITORY_INTERVIEW_BOUNDS.maximumStatementScalars,
      REPOSITORY_INTERVIEW_BOUNDS.maximumStatementUtf8Bytes,
      `${path}/statement`,
      issues,
    );
    if (limitation.rationale !== null) {
      validateSemanticString(
        limitation.rationale,
        REPOSITORY_INTERVIEW_BOUNDS.maximumRationaleScalars,
        REPOSITORY_INTERVIEW_BOUNDS.maximumRationaleUtf8Bytes,
        `${path}/rationale`,
        issues,
      );
    }
    validateCitationReferences(
      limitation.citationIds,
      citationIds,
      usedCitationIds,
      `${path}/citationIds`,
      issues,
    );
    const identityDigest = repositoryInterviewLimitationIdentityDigest(
      root.contractVersion,
      root.executionId,
      limitation,
    );
    validateDerivedIdentity(
      limitation.limitationId,
      `intlimit-${identityDigest.slice(0, 48)}`,
      limitation.identityDigest,
      identityDigest,
      `${path}/limitationId`,
      `${path}/identityDigest`,
      issues,
    );
    if (
      repositoryInterviewNestedRecordDigest(limitation) !==
      limitation.recordDigest
    ) {
      issues.push(patternIssue(`${path}/recordDigest`));
    }
    addUnique(ids, limitation.limitationId, `${path}/limitationId`, issues);
    addUnique(
      digests,
      limitation.identityDigest,
      `${path}/identityDigest`,
      issues,
    );
  });
  validateCanonicalOrder(
    root.limitations,
    compareLimitations,
    '/limitations',
    issues,
  );
}

function validateContradictions(
  root: RepositoryInterviewV1,
  citationIds: ReadonlySet<string>,
  usedCitationIds: Set<string>,
  issues: ContractIssue[],
): void {
  const ids = new Set<string>();
  const digests = new Set<string>();
  root.contradictions.forEach((contradiction, index) => {
    const path = `/contradictions/${String(index)}`;
    validateSemanticString(
      contradiction.explanation,
      REPOSITORY_INTERVIEW_BOUNDS.maximumRationaleScalars,
      REPOSITORY_INTERVIEW_BOUNDS.maximumRationaleUtf8Bytes,
      `${path}/explanation`,
      issues,
    );
    contradiction.positions.forEach((position, positionIndex) => {
      const positionPath = `${path}/positions/${String(positionIndex)}`;
      validateSemanticString(
        position.statement,
        REPOSITORY_INTERVIEW_BOUNDS.maximumStatementScalars,
        REPOSITORY_INTERVIEW_BOUNDS.maximumStatementUtf8Bytes,
        `${positionPath}/statement`,
        issues,
      );
      validateCitationReferences(
        position.citationIds,
        citationIds,
        usedCitationIds,
        `${positionPath}/citationIds`,
        issues,
      );
    });
    const firstPosition = contradiction.positions[0];
    const secondPosition = contradiction.positions[1];
    if (
      firstPosition === undefined ||
      secondPosition === undefined ||
      compareContradictionPositions(firstPosition, secondPosition) >= 0
    ) {
      issues.push(patternIssue(`${path}/positions`));
    }
    const identityDigest = repositoryInterviewContradictionIdentityDigest(
      root.contractVersion,
      root.executionId,
      contradiction,
    );
    validateDerivedIdentity(
      contradiction.contradictionId,
      `intcontra-${identityDigest.slice(0, 48)}`,
      contradiction.identityDigest,
      identityDigest,
      `${path}/contradictionId`,
      `${path}/identityDigest`,
      issues,
    );
    if (
      repositoryInterviewNestedRecordDigest(contradiction) !==
      contradiction.recordDigest
    ) {
      issues.push(patternIssue(`${path}/recordDigest`));
    }
    addUnique(
      ids,
      contradiction.contradictionId,
      `${path}/contradictionId`,
      issues,
    );
    addUnique(
      digests,
      contradiction.identityDigest,
      `${path}/identityDigest`,
      issues,
    );
  });
  validateCanonicalOrder(
    root.contradictions,
    compareContradictions,
    '/contradictions',
    issues,
  );
}

function validateUnknowns(
  root: RepositoryInterviewV1,
  citationIds: ReadonlySet<string>,
  usedCitationIds: Set<string>,
  issues: ContractIssue[],
): void {
  const ids = new Set<string>();
  const digests = new Set<string>();
  root.unknowns.forEach((unknown, index) => {
    const path = `/unknowns/${String(index)}`;
    validateSemanticString(
      unknown.statement,
      REPOSITORY_INTERVIEW_BOUNDS.maximumStatementScalars,
      REPOSITORY_INTERVIEW_BOUNDS.maximumStatementUtf8Bytes,
      `${path}/statement`,
      issues,
    );
    if (
      !UNKNOWN_SCOPE_PATTERN.test(unknown.statement) ||
      UNIVERSAL_ABSENCE_PATTERN.test(unknown.statement)
    ) {
      issues.push(patternIssue(`${path}/statement`));
    }
    validateCitationReferences(
      unknown.partialCitationIds,
      citationIds,
      usedCitationIds,
      `${path}/partialCitationIds`,
      issues,
    );
    const identityDigest = repositoryInterviewUnknownIdentityDigest(
      root.contractVersion,
      root.executionId,
      unknown,
    );
    validateDerivedIdentity(
      unknown.unknownId,
      `intunknown-${identityDigest.slice(0, 48)}`,
      unknown.identityDigest,
      identityDigest,
      `${path}/unknownId`,
      `${path}/identityDigest`,
      issues,
    );
    if (
      repositoryInterviewNestedRecordDigest(unknown) !== unknown.recordDigest
    ) {
      issues.push(patternIssue(`${path}/recordDigest`));
    }
    addUnique(ids, unknown.unknownId, `${path}/unknownId`, issues);
    addUnique(
      digests,
      unknown.identityDigest,
      `${path}/identityDigest`,
      issues,
    );
  });
  validateCanonicalOrder(root.unknowns, compareUnknowns, '/unknowns', issues);
}

function validateCitationReferences(
  references: readonly string[],
  available: ReadonlySet<string>,
  used: Set<string>,
  path: string,
  issues: ContractIssue[],
): void {
  const local = new Set<string>();
  references.forEach((reference, index) => {
    if (local.has(reference)) {
      issues.push(duplicateIssue(`${path}/${String(index)}`));
    }
    local.add(reference);
    if (!available.has(reference)) {
      issues.push(patternIssue(`${path}/${String(index)}`));
    } else {
      used.add(reference);
    }
  });
  validateCanonicalOrder(references, compareText, path, issues);
}

function validateTopicCoverage(
  value: RepositoryInterviewV1,
  issues: ContractIssue[],
): void {
  const topics = new Set<RepositoryInterviewTopic>();
  for (const item of [
    ...value.claims,
    ...value.limitations,
    ...value.contradictions,
    ...value.unknowns,
  ]) {
    topics.add(item.topic);
  }
  if (REPOSITORY_INTERVIEW_TOPICS.some((topic) => !topics.has(topic))) {
    issues.push(patternIssue('/processingState'));
  }
}

export function deriveRepositoryInterviewProcessingState(
  value: Pick<
    RepositoryInterviewV1,
    'claims' | 'limitations' | 'contradictions' | 'unknowns'
  >,
): RepositoryInterviewV1['processingState'] {
  const directlyGrounded = new Set<RepositoryInterviewTopic>();
  for (const claim of value.claims) {
    if (claim.kind === 'documented-position') {
      directlyGrounded.add(claim.topic);
    }
  }
  for (const limitation of value.limitations) {
    if (limitation.basis === 'documented-position') {
      directlyGrounded.add(limitation.topic);
    }
  }
  if (directlyGrounded.size === 0) {
    return 'insufficient-evidence';
  }
  if (
    directlyGrounded.size === REPOSITORY_INTERVIEW_TOPICS.length &&
    value.contradictions.length === 0 &&
    value.unknowns.length === 0
  ) {
    return 'complete';
  }
  return 'partial-evidence';
}

function validateSemanticString(
  value: string,
  maximumScalars: number,
  maximumBytes: number,
  path: string,
  issues: ContractIssue[],
): void {
  if (
    value.trim() !== value ||
    countUnicodeScalars(value) > maximumScalars ||
    utf8ByteLength(value) > maximumBytes ||
    CONTROL_OR_FORMAT_PATTERN.test(value) ||
    URL_PATTERN.test(value) ||
    MARKDOWN_LINK_PATTERN.test(value) ||
    HTML_PATTERN.test(value) ||
    !hasExactUtf8RoundTrip(value)
  ) {
    issues.push(patternIssue(path));
  }
}

function validateDerivedIdentity(
  id: string,
  expectedId: string,
  identityDigest: string,
  expectedIdentityDigest: string,
  idPath: string,
  digestPath: string,
  issues: ContractIssue[],
): void {
  if (identityDigest !== expectedIdentityDigest) {
    issues.push(patternIssue(digestPath));
  }
  if (id !== expectedId) {
    issues.push(patternIssue(idPath));
  }
}

function addUnique(
  values: Set<string>,
  value: string,
  path: string,
  issues: ContractIssue[],
): void {
  if (values.has(value)) {
    issues.push(duplicateIssue(path));
  }
  values.add(value);
}

function validateCanonicalOrder<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number,
  path: string,
  issues: ContractIssue[],
): void {
  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (
      previous !== undefined &&
      current !== undefined &&
      compare(previous, current) > 0
    ) {
      issues.push(patternIssue(path));
      return;
    }
  }
}

export function compareRepositoryInterviewCitations(
  left: RepositoryInterviewCitationV1,
  right: RepositoryInterviewCitationV1,
): number {
  return compareCitations(left, right);
}

export function compareRepositoryInterviewClaims(
  left: RepositoryInterviewClaimV1,
  right: RepositoryInterviewClaimV1,
): number {
  return compareClaims(left, right);
}

export function compareRepositoryInterviewLimitations(
  left: RepositoryInterviewLimitationV1,
  right: RepositoryInterviewLimitationV1,
): number {
  return compareLimitations(left, right);
}

export function compareRepositoryInterviewContradictions(
  left: RepositoryInterviewContradictionV1,
  right: RepositoryInterviewContradictionV1,
): number {
  return compareContradictions(left, right);
}

export function compareRepositoryInterviewUnknowns(
  left: RepositoryInterviewUnknownV1,
  right: RepositoryInterviewUnknownV1,
): number {
  return compareUnknowns(left, right);
}

export function compareRepositoryInterviewContradictionPositions(
  left: RepositoryInterviewContradictionPositionV1,
  right: RepositoryInterviewContradictionPositionV1,
): number {
  return compareContradictionPositions(left, right);
}

function compareCitations(
  left: Pick<
    RepositoryInterviewCitationV1,
    'artifactId' | 'startLine' | 'endLine' | 'identityDigest'
  >,
  right: Pick<
    RepositoryInterviewCitationV1,
    'artifactId' | 'startLine' | 'endLine' | 'identityDigest'
  >,
): number {
  return (
    compareText(left.artifactId, right.artifactId) ||
    left.startLine - right.startLine ||
    left.endLine - right.endLine ||
    compareText(left.identityDigest, right.identityDigest)
  );
}

function compareClaims(
  left: RepositoryInterviewClaimV1,
  right: RepositoryInterviewClaimV1,
): number {
  return (
    topicIndex(left.topic) - topicIndex(right.topic) ||
    claimKindIndex(left.kind) - claimKindIndex(right.kind) ||
    compareText(left.statement, right.statement) ||
    compareText(left.identityDigest, right.identityDigest)
  );
}

function compareLimitations(
  left: RepositoryInterviewLimitationV1,
  right: RepositoryInterviewLimitationV1,
): number {
  return (
    topicIndex(left.topic) - topicIndex(right.topic) ||
    claimKindIndex(left.basis) - claimKindIndex(right.basis) ||
    compareText(left.statement, right.statement) ||
    compareText(left.identityDigest, right.identityDigest)
  );
}

function compareContradictions(
  left: RepositoryInterviewContradictionV1,
  right: RepositoryInterviewContradictionV1,
): number {
  return (
    topicIndex(left.topic) - topicIndex(right.topic) ||
    compareText(left.kind, right.kind) ||
    compareText(left.identityDigest, right.identityDigest)
  );
}

function compareUnknowns(
  left: RepositoryInterviewUnknownV1,
  right: RepositoryInterviewUnknownV1,
): number {
  return (
    topicIndex(left.topic) - topicIndex(right.topic) ||
    compareText(left.reason, right.reason) ||
    compareText(left.statement, right.statement) ||
    compareText(left.identityDigest, right.identityDigest)
  );
}

function compareContradictionPositions(
  left: RepositoryInterviewContradictionPositionV1,
  right: RepositoryInterviewContradictionPositionV1,
): number {
  return compareText(
    contractCanonicalDigest(left),
    contractCanonicalDigest(right),
  );
}

function topicIndex(topic: RepositoryInterviewTopic): number {
  return REPOSITORY_INTERVIEW_TOPICS.indexOf(topic);
}

function claimKindIndex(kind: 'documented-position' | 'inference'): number {
  return kind === 'documented-position' ? 0 : 1;
}

function citationCoordinateKey(
  value: Pick<
    RepositoryInterviewCitationV1,
    'artifactId' | 'startLine' | 'endLine'
  >,
): string {
  return `${value.artifactId}\0${String(value.startLine)}\0${String(
    value.endLine,
  )}`;
}

function canonicalText(value: string): string {
  return value.replace(/\s+/gu, ' ').toLowerCase();
}

function countUnicodeScalars(value: string): number {
  let scalars = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      index += 1;
    }
    scalars += 1;
  }
  return scalars;
}

function utf8ByteLength(value: string): number {
  try {
    return repositoryArtifactUtf8ByteLength(value);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function hasExactUtf8RoundTrip(value: string): boolean {
  try {
    repositoryArtifactUtf8ByteLength(value);
    return true;
  } catch {
    return false;
  }
}

function timestampValue(value: string): number | null {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  const match =
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/u.exec(value);
  if (match === null) {
    return null;
  }
  const timestampWithoutFraction = match[1];
  if (timestampWithoutFraction === undefined) {
    return null;
  }
  const normalized = `${timestampWithoutFraction}.${(match[2] ?? '').padEnd(
    3,
    '0',
  )}Z`;
  return new Date(parsed).toISOString() === normalized ? parsed : null;
}

function validateTimestamp(
  value: string,
  path: string,
  issues: ContractIssue[],
): void {
  if (timestampValue(value) === null) {
    issues.push(boundsIssue(path));
  }
}

function requireEqual(
  actual: string,
  expected: string,
  path: string,
  issues: ContractIssue[],
): void {
  if (actual !== expected) {
    issues.push(patternIssue(path));
  }
}

function prefixIssues(
  issues: readonly ContractIssue[],
  prefix: string,
): readonly ContractIssue[] {
  return issues.map((issue) =>
    contractIssue(issue.code, `${prefix}${issue.path}`, issue.message),
  );
}

function patternIssue(path: string): ContractIssue {
  return contractIssue(
    'contract.pattern',
    path,
    'Contract value does not match the required pattern.',
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
