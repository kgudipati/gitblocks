import { preflightContractValue } from './preflight.ts';
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
  compareRepositoryInterviewCitations,
  compareRepositoryInterviewClaims,
  compareRepositoryInterviewContradictionPositions,
  compareRepositoryInterviewContradictions,
  compareRepositoryInterviewLimitations,
  compareRepositoryInterviewUnknowns,
  deriveRepositoryInterviewProcessingState,
  parseModelExecutionV1,
  parseRepositoryInterviewRequestV1,
  parseRepositoryInterviewV1,
} from './repository-interview-parsers.ts';
import type {
  ModelExecutionModelProfileV1,
  ModelExecutionOutcomeV1,
  ModelExecutionV1,
  RepositoryInterviewCitationV1,
  RepositoryInterviewClaimV1,
  RepositoryInterviewContradictionPositionV1,
  RepositoryInterviewContradictionV1,
  RepositoryInterviewLimitationV1,
  RepositoryInterviewRequestV1,
  RepositoryInterviewTopic,
  RepositoryInterviewUnknownV1,
  RepositoryInterviewV1,
} from './repository-interview-schemas.ts';

export type RepositoryInterviewRequestInputV1 = Omit<
  RepositoryInterviewRequestV1,
  'requestId' | 'identityDigest' | 'recordDigest'
>;

export interface ModelExecutionInputV1 {
  readonly contractVersion: ModelExecutionV1['contractVersion'];
  readonly requestId: ModelExecutionV1['requestId'];
  readonly requestIdentityDigest: ModelExecutionV1['requestIdentityDigest'];
  readonly executionNonce: ModelExecutionV1['executionNonce'];
  readonly executionMode: ModelExecutionV1['executionMode'];
  readonly forceReason: ModelExecutionV1['forceReason'];
  readonly modelProfile: ModelExecutionModelProfileV1;
  readonly startedAt: ModelExecutionV1['startedAt'];
  readonly completedAt: ModelExecutionV1['completedAt'];
  readonly attempts: ModelExecutionV1['attempts'];
  readonly outcome: ModelExecutionOutcomeV1;
}

export type RepositoryInterviewCitationInputV1 = Pick<
  RepositoryInterviewCitationV1,
  'artifactId' | 'startLine' | 'endLine'
>;

export type RepositoryInterviewClaimInputV1 =
  | {
      readonly kind: 'documented-position';
      readonly topic: RepositoryInterviewTopic;
      readonly statement: string;
      readonly rationale: null;
      readonly confidence: 'high' | 'medium';
      readonly citations: readonly RepositoryInterviewCitationInputV1[];
    }
  | {
      readonly kind: 'inference';
      readonly topic: RepositoryInterviewTopic;
      readonly statement: string;
      readonly rationale: string;
      readonly confidence: 'medium' | 'low';
      readonly citations: readonly RepositoryInterviewCitationInputV1[];
    };

export type RepositoryInterviewLimitationInputV1 =
  | {
      readonly topic: RepositoryInterviewTopic;
      readonly basis: 'documented-position';
      readonly statement: string;
      readonly rationale: null;
      readonly confidence: 'high' | 'medium';
      readonly citations: readonly RepositoryInterviewCitationInputV1[];
    }
  | {
      readonly topic: RepositoryInterviewTopic;
      readonly basis: 'inference';
      readonly statement: string;
      readonly rationale: string;
      readonly confidence: 'medium' | 'low';
      readonly citations: readonly RepositoryInterviewCitationInputV1[];
    };

export interface RepositoryInterviewContradictionPositionInputV1 {
  readonly statement: string;
  readonly citations: readonly RepositoryInterviewCitationInputV1[];
}

export interface RepositoryInterviewContradictionInputV1 {
  readonly topic: RepositoryInterviewTopic;
  readonly kind: RepositoryInterviewContradictionV1['kind'];
  readonly explanation: string;
  readonly positions: readonly [
    RepositoryInterviewContradictionPositionInputV1,
    RepositoryInterviewContradictionPositionInputV1,
  ];
}

export interface RepositoryInterviewUnknownInputV1 {
  readonly topic: RepositoryInterviewTopic;
  readonly reason: RepositoryInterviewUnknownV1['reason'];
  readonly statement: string;
  readonly partialCitations: readonly RepositoryInterviewCitationInputV1[];
}

export interface RepositoryInterviewInputV1 {
  readonly contractVersion: RepositoryInterviewV1['contractVersion'];
  readonly candidateId: RepositoryInterviewV1['candidateId'];
  readonly artifactSetId: RepositoryInterviewV1['artifactSetId'];
  readonly artifactSetIdentityDigest: RepositoryInterviewV1['artifactSetIdentityDigest'];
  readonly requestId: RepositoryInterviewV1['requestId'];
  readonly requestIdentityDigest: RepositoryInterviewV1['requestIdentityDigest'];
  readonly executionId: RepositoryInterviewV1['executionId'];
  readonly executionIdentityDigest: RepositoryInterviewV1['executionIdentityDigest'];
  readonly providerOutputDigest: RepositoryInterviewV1['providerOutputDigest'];
  readonly specificationVersion: RepositoryInterviewV1['specificationVersion'];
  readonly specificationDigest: RepositoryInterviewV1['specificationDigest'];
  readonly rendererVersion: RepositoryInterviewV1['rendererVersion'];
  readonly providerOutputSchemaVersion: RepositoryInterviewV1['providerOutputSchemaVersion'];
  readonly providerOutputSchemaDigest: RepositoryInterviewV1['providerOutputSchemaDigest'];
  readonly providerProjectionVersion: RepositoryInterviewV1['providerProjectionVersion'];
  readonly providerProjectionDigest: RepositoryInterviewV1['providerProjectionDigest'];
  readonly promptDigest: RepositoryInterviewV1['promptDigest'];
  readonly modelProfileDigest: RepositoryInterviewV1['modelProfileDigest'];
  readonly citations: readonly RepositoryInterviewCitationInputV1[];
  readonly claims: readonly RepositoryInterviewClaimInputV1[];
  readonly limitations: readonly RepositoryInterviewLimitationInputV1[];
  readonly contradictions: readonly RepositoryInterviewContradictionInputV1[];
  readonly unknowns: readonly RepositoryInterviewUnknownInputV1[];
  readonly publishedAt: RepositoryInterviewV1['publishedAt'];
}

export function createRepositoryInterviewRequestV1(
  input: RepositoryInterviewRequestInputV1,
): RepositoryInterviewRequestV1 {
  const owned = copyCreationInput(input, [
    'contractVersion',
    'candidateId',
    'artifactSetId',
    'artifactSetIdentityDigest',
    'specificationVersion',
    'specificationDigest',
    'rendererVersion',
    'providerOutputSchemaVersion',
    'providerOutputSchemaDigest',
    'promptDigest',
  ]);
  const identityDigest = repositoryInterviewRequestIdentityDigest(owned);
  const value: Omit<RepositoryInterviewRequestV1, 'recordDigest'> = {
    ...owned,
    requestId: `intreq-${identityDigest.slice(0, 48)}`,
    identityDigest,
  };
  const complete: RepositoryInterviewRequestV1 = {
    ...value,
    recordDigest: repositoryInterviewRequestRecordDigest(value),
  };
  const parsed = parseRepositoryInterviewRequestV1(complete);
  if (!parsed.ok) {
    throw invalidInput();
  }
  return parsed.value;
}

export function createModelExecutionV1(
  input: ModelExecutionInputV1,
): ModelExecutionV1 {
  assertCreationInput(input);
  assertExactKeys(input, [
    'contractVersion',
    'requestId',
    'requestIdentityDigest',
    'executionNonce',
    'executionMode',
    'forceReason',
    'modelProfile',
    'startedAt',
    'completedAt',
    'attempts',
    'outcome',
  ]);
  assertExactKeys(input.modelProfile, [
    'provider',
    'endpointProfile',
    'modelSnapshot',
    'providerProjectionVersion',
    'providerProjectionDigest',
    'reasoningEffort',
    'maximumOutputTokens',
    'maximumResponseBytes',
    'store',
    'toolsEnabled',
    'background',
    'conversationState',
    'previousResponseState',
    'truncation',
    'promptCacheRetention',
    'serviceTier',
    'retryPolicyVersion',
  ]);
  for (const attempt of input.attempts) {
    assertExactKeys(attempt, [
      'ordinal',
      'startedAt',
      'completedAt',
      'transportOutcome',
      'httpStatus',
      'providerRequestId',
      'responseId',
      'responseBytes',
      'providerProcessingMilliseconds',
      'retryAfterMilliseconds',
      'remainingRequests',
      'remainingTokens',
      'resetRequestsMilliseconds',
      'resetTokensMilliseconds',
    ]);
  }
  assertExactKeys(input.outcome, [
    'status',
    'failureCode',
    'providerOutputDigest',
    'usage',
  ]);
  if (input.outcome.usage !== null) {
    assertExactKeys(input.outcome.usage, [
      'inputTokens',
      'cachedInputTokens',
      'outputTokens',
      'reasoningTokens',
      'totalTokens',
    ]);
  }
  const owned = cloneOwnedJson(input);
  const modelProfileDigest = modelExecutionModelProfileDigest(
    owned.modelProfile,
  );
  const reuseKeyDigest = modelExecutionReuseKeyDigest({
    contractVersion: owned.contractVersion,
    requestIdentityDigest: owned.requestIdentityDigest,
    modelProfileDigest,
  });
  const identityDigest = modelExecutionIdentityDigest({
    contractVersion: owned.contractVersion,
    reuseKeyDigest,
    executionNonce: owned.executionNonce,
    executionMode: owned.executionMode,
    forceReason: owned.forceReason,
  });
  const value: Omit<ModelExecutionV1, 'recordDigest'> = {
    ...owned,
    executionId: `modelexec-${identityDigest.slice(0, 48)}`,
    modelProfileDigest,
    reuseKeyDigest,
    identityDigest,
  };
  const complete: ModelExecutionV1 = {
    ...value,
    recordDigest: modelExecutionRecordDigest(value),
  };
  const parsed = parseModelExecutionV1(complete);
  if (!parsed.ok) {
    throw invalidInput();
  }
  return parsed.value;
}

export function createRepositoryInterviewV1(
  input: RepositoryInterviewInputV1,
): RepositoryInterviewV1 {
  validateInterviewCreationShape(input);
  const owned = cloneOwnedJson(input);
  const citations = owned.citations.map((citation) =>
    createCitation(owned.contractVersion, owned.executionId, citation),
  );
  const citationMap = new Map<string, RepositoryInterviewCitationV1>();
  for (const citation of citations) {
    const key = citationCoordinateKey(citation);
    if (citationMap.has(key)) {
      throw invalidInput();
    }
    citationMap.set(key, citation);
  }
  citations.sort(compareRepositoryInterviewCitations);

  const claims = owned.claims.map((claim) =>
    createClaim(owned.contractVersion, owned.executionId, claim, citationMap),
  );
  claims.sort(compareRepositoryInterviewClaims);
  const limitations = owned.limitations.map((limitation) =>
    createLimitation(
      owned.contractVersion,
      owned.executionId,
      limitation,
      citationMap,
    ),
  );
  limitations.sort(compareRepositoryInterviewLimitations);
  const contradictions = owned.contradictions.map((contradiction) =>
    createContradiction(
      owned.contractVersion,
      owned.executionId,
      contradiction,
      citationMap,
    ),
  );
  contradictions.sort(compareRepositoryInterviewContradictions);
  const unknowns = owned.unknowns.map((unknown) =>
    createUnknown(
      owned.contractVersion,
      owned.executionId,
      unknown,
      citationMap,
    ),
  );
  unknowns.sort(compareRepositoryInterviewUnknowns);

  const processingState = deriveRepositoryInterviewProcessingState({
    claims,
    limitations,
    contradictions,
    unknowns,
  });
  const rootWithoutDerived = {
    contractVersion: owned.contractVersion,
    candidateId: owned.candidateId,
    artifactSetId: owned.artifactSetId,
    artifactSetIdentityDigest: owned.artifactSetIdentityDigest,
    requestId: owned.requestId,
    requestIdentityDigest: owned.requestIdentityDigest,
    executionId: owned.executionId,
    executionIdentityDigest: owned.executionIdentityDigest,
    providerOutputDigest: owned.providerOutputDigest,
    specificationVersion: owned.specificationVersion,
    specificationDigest: owned.specificationDigest,
    rendererVersion: owned.rendererVersion,
    providerOutputSchemaVersion: owned.providerOutputSchemaVersion,
    providerOutputSchemaDigest: owned.providerOutputSchemaDigest,
    providerProjectionVersion: owned.providerProjectionVersion,
    providerProjectionDigest: owned.providerProjectionDigest,
    promptDigest: owned.promptDigest,
    modelProfileDigest: owned.modelProfileDigest,
    processingState,
    citations,
    claims,
    limitations,
    contradictions,
    unknowns,
  };
  const identityDigest = repositoryInterviewIdentityDigest(rootWithoutDerived);
  const value: Omit<RepositoryInterviewV1, 'recordDigest'> = {
    ...rootWithoutDerived,
    interviewId: `interview-${identityDigest.slice(0, 48)}`,
    publishedAt: owned.publishedAt,
    identityDigest,
  };
  const complete: RepositoryInterviewV1 = {
    ...value,
    recordDigest: repositoryInterviewRecordDigest(value),
  };
  const parsed = parseRepositoryInterviewV1(complete);
  if (!parsed.ok) {
    throw invalidInput();
  }
  return parsed.value;
}

function createCitation(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  input: RepositoryInterviewCitationInputV1,
): RepositoryInterviewCitationV1 {
  const identityDigest = repositoryInterviewCitationIdentityDigest(
    contractVersion,
    executionId,
    input,
  );
  const value: Omit<RepositoryInterviewCitationV1, 'recordDigest'> = {
    ...input,
    citationId: `intcite-${identityDigest.slice(0, 48)}`,
    identityDigest,
  };
  return {
    ...value,
    recordDigest: repositoryInterviewNestedRecordDigest(value),
  };
}

function createClaim(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  input: RepositoryInterviewClaimInputV1,
  citationMap: ReadonlyMap<string, RepositoryInterviewCitationV1>,
): RepositoryInterviewClaimV1 {
  const citationIds = resolveCitationIds(input.citations, citationMap);
  const semantic = {
    kind: input.kind,
    topic: input.topic,
    statement: input.statement,
    rationale: input.rationale,
    confidence: input.confidence,
    citationIds,
  } as const;
  const identityDigest = repositoryInterviewClaimIdentityDigest(
    contractVersion,
    executionId,
    semantic,
  );
  const value = {
    ...semantic,
    claimId: `intclaim-${identityDigest.slice(0, 48)}`,
    identityDigest,
  } as Omit<RepositoryInterviewClaimV1, 'recordDigest'>;
  return {
    ...value,
    recordDigest: repositoryInterviewNestedRecordDigest(value),
  } as RepositoryInterviewClaimV1;
}

function createLimitation(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  input: RepositoryInterviewLimitationInputV1,
  citationMap: ReadonlyMap<string, RepositoryInterviewCitationV1>,
): RepositoryInterviewLimitationV1 {
  const citationIds = resolveCitationIds(input.citations, citationMap);
  const semantic = {
    topic: input.topic,
    basis: input.basis,
    statement: input.statement,
    rationale: input.rationale,
    confidence: input.confidence,
    citationIds,
  } as const;
  const identityDigest = repositoryInterviewLimitationIdentityDigest(
    contractVersion,
    executionId,
    semantic,
  );
  const value = {
    ...semantic,
    limitationId: `intlimit-${identityDigest.slice(0, 48)}`,
    identityDigest,
  } as Omit<RepositoryInterviewLimitationV1, 'recordDigest'>;
  return {
    ...value,
    recordDigest: repositoryInterviewNestedRecordDigest(value),
  } as RepositoryInterviewLimitationV1;
}

function createContradiction(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  input: RepositoryInterviewContradictionInputV1,
  citationMap: ReadonlyMap<string, RepositoryInterviewCitationV1>,
): RepositoryInterviewContradictionV1 {
  const positions = input.positions
    .map((position) => ({
      statement: position.statement,
      citationIds: resolveCitationIds(position.citations, citationMap),
    }))
    .sort(compareRepositoryInterviewContradictionPositions) as [
    RepositoryInterviewContradictionPositionV1,
    RepositoryInterviewContradictionPositionV1,
  ];
  const semantic = {
    topic: input.topic,
    kind: input.kind,
    explanation: input.explanation,
    positions,
  } as const;
  const identityDigest = repositoryInterviewContradictionIdentityDigest(
    contractVersion,
    executionId,
    semantic,
  );
  const value: Omit<RepositoryInterviewContradictionV1, 'recordDigest'> = {
    ...semantic,
    contradictionId: `intcontra-${identityDigest.slice(0, 48)}`,
    identityDigest,
  };
  return {
    ...value,
    recordDigest: repositoryInterviewNestedRecordDigest(value),
  };
}

function createUnknown(
  contractVersion: RepositoryInterviewV1['contractVersion'],
  executionId: RepositoryInterviewV1['executionId'],
  input: RepositoryInterviewUnknownInputV1,
  citationMap: ReadonlyMap<string, RepositoryInterviewCitationV1>,
): RepositoryInterviewUnknownV1 {
  const semantic = {
    topic: input.topic,
    reason: input.reason,
    statement: input.statement,
    partialCitationIds: resolveCitationIds(input.partialCitations, citationMap),
  } as const;
  const identityDigest = repositoryInterviewUnknownIdentityDigest(
    contractVersion,
    executionId,
    semantic,
  );
  const value: Omit<RepositoryInterviewUnknownV1, 'recordDigest'> = {
    ...semantic,
    unknownId: `intunknown-${identityDigest.slice(0, 48)}`,
    identityDigest,
  };
  return {
    ...value,
    recordDigest: repositoryInterviewNestedRecordDigest(value),
  };
}

function resolveCitationIds(
  inputs: readonly RepositoryInterviewCitationInputV1[],
  citationMap: ReadonlyMap<string, RepositoryInterviewCitationV1>,
): string[] {
  const ids = inputs.map((input) => {
    const citation = citationMap.get(citationCoordinateKey(input));
    if (citation === undefined) {
      throw invalidInput();
    }
    return citation.citationId;
  });
  ids.sort(compareText);
  return ids;
}

function validateInterviewCreationShape(
  input: RepositoryInterviewInputV1,
): void {
  assertCreationInput(input);
  assertExactKeys(input, [
    'contractVersion',
    'candidateId',
    'artifactSetId',
    'artifactSetIdentityDigest',
    'requestId',
    'requestIdentityDigest',
    'executionId',
    'executionIdentityDigest',
    'providerOutputDigest',
    'specificationVersion',
    'specificationDigest',
    'rendererVersion',
    'providerOutputSchemaVersion',
    'providerOutputSchemaDigest',
    'providerProjectionVersion',
    'providerProjectionDigest',
    'promptDigest',
    'modelProfileDigest',
    'citations',
    'claims',
    'limitations',
    'contradictions',
    'unknowns',
    'publishedAt',
  ]);
  for (const citation of input.citations) {
    assertCitationInput(citation);
  }
  for (const claim of input.claims) {
    assertExactKeys(claim, [
      'kind',
      'topic',
      'statement',
      'rationale',
      'confidence',
      'citations',
    ]);
    claim.citations.forEach(assertCitationInput);
  }
  for (const limitation of input.limitations) {
    assertExactKeys(limitation, [
      'topic',
      'basis',
      'statement',
      'rationale',
      'confidence',
      'citations',
    ]);
    limitation.citations.forEach(assertCitationInput);
  }
  for (const contradiction of input.contradictions) {
    assertExactKeys(contradiction, [
      'topic',
      'kind',
      'explanation',
      'positions',
    ]);
    for (const position of contradiction.positions) {
      assertExactKeys(position, ['statement', 'citations']);
      position.citations.forEach(assertCitationInput);
    }
  }
  for (const unknown of input.unknowns) {
    assertExactKeys(unknown, [
      'topic',
      'reason',
      'statement',
      'partialCitations',
    ]);
    unknown.partialCitations.forEach(assertCitationInput);
  }
}

function assertCitationInput(value: RepositoryInterviewCitationInputV1): void {
  assertExactKeys(value, ['artifactId', 'startLine', 'endLine']);
}

function copyCreationInput<T extends Readonly<Record<string, unknown>>>(
  input: T,
  keys: readonly string[],
): T {
  assertCreationInput(input);
  assertExactKeys(input, keys);
  return cloneOwnedJson(input);
}

function assertCreationInput(value: unknown): void {
  if (preflightContractValue(value).length > 0) {
    throw invalidInput();
  }
}

function assertExactKeys(value: object, expectedKeys: readonly string[]): void {
  const actual = Object.keys(value).sort(compareText);
  const expected = [...expectedKeys].sort(compareText);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw invalidInput();
  }
}

function citationCoordinateKey(
  value: RepositoryInterviewCitationInputV1,
): string {
  return `${value.artifactId}\0${String(value.startLine)}\0${String(
    value.endLine,
  )}`;
}

function invalidInput(): Error {
  return new Error('Repository interview contract input is invalid.');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
