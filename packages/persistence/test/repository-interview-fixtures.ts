import {
  REPOSITORY_INTERVIEW_TOPICS,
  createModelExecutionV1,
  createRepositoryInterviewRequestV1,
  createRepositoryInterviewV1,
  type ModelExecutionInputV1,
  type ModelExecutionV1,
  type RepositoryInterviewInputV1,
  type RepositoryInterviewRequestV1,
  type RepositoryInterviewV1,
} from '@gitblocks/contracts';

import { createArtifactPublication } from './fixtures.ts';

const SPECIFICATION_DIGEST =
  'da2c8560e0b6a2fc7bc8d79fd89f65984815236a54cbf49491911274db8168f9';
const PROVIDER_OUTPUT_SCHEMA_DIGEST =
  '5fa5d1c44a8924d8be3acc2ac74e58ec45ea134264c2245b7e158873b2e26b19';
const PROVIDER_PROJECTION_DIGEST =
  '5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7';
const PROMPT_DIGEST =
  'bdfa0ac1bd39782028a3e3f5598cf980ae5066aaef24068eee0c1a45059ff584';
const PROVIDER_OUTPUT_DIGEST =
  'e245c7db27f96709263f120760ff4394602ae70053bd4f0162a59dcf82b2789c';

export type RepositoryInterviewFailureCode = Extract<
  ModelExecutionV1['outcome'],
  { readonly status: 'failed' }
>['failureCode'];

export interface RepositoryInterviewPersistenceFixture {
  readonly publication: ReturnType<typeof createArtifactPublication>;
  readonly request: RepositoryInterviewRequestV1;
  readonly execution: ModelExecutionV1;
  readonly interview: RepositoryInterviewV1;
}

export function createRepositoryInterviewPersistenceFixture(options?: {
  readonly executionNonce?: string;
  readonly executionMode?: 'normal' | 'forced';
  readonly forceReason?:
    'calibration' | 'review-rejected' | 'operator-recovery' | null;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly publishedAt?: string;
  readonly citationArtifactId?: string;
  readonly citationStartLine?: number;
  readonly citationEndLine?: number;
  readonly requestCandidateId?: string;
  readonly artifactSetIdentityDigest?: string;
}): RepositoryInterviewPersistenceFixture {
  const publication = createArtifactPublication({
    content: '# Synthetic\nruntime\nsecurity\n',
  });
  const artifact = publication.artifacts[0]?.artifact;
  if (artifact === undefined) {
    throw new Error('Synthetic interview fixture requires one artifact.');
  }
  const request = createRepositoryInterviewRequestV1({
    contractVersion: '1.0.0',
    candidateId:
      options?.requestCandidateId ?? publication.artifactSet.candidateId,
    artifactSetId: publication.artifactSet.artifactSetId,
    artifactSetIdentityDigest:
      options?.artifactSetIdentityDigest ??
      publication.artifactSet.identityDigest,
    specificationVersion: '1.0.0',
    specificationDigest: SPECIFICATION_DIGEST,
    rendererVersion: 'repository-interview-renderer-v1',
    providerOutputSchemaVersion: '1.0.0',
    providerOutputSchemaDigest: PROVIDER_OUTPUT_SCHEMA_DIGEST,
    promptDigest: PROMPT_DIGEST,
  });
  const execution = createModelExecutionV1(
    successfulExecutionInput(request, options),
  );
  const sharedCitation = {
    artifactId: options?.citationArtifactId ?? artifact.artifactId,
    startLine: options?.citationStartLine ?? 1,
    endLine: options?.citationEndLine ?? 1,
  } as const;
  const terminalCitation = {
    artifactId: artifact.artifactId,
    startLine: artifact.lineCount,
    endLine: artifact.lineCount,
  } as const;
  const interview = createRepositoryInterviewV1({
    ...interviewProvenance(request, execution),
    citations: [sharedCitation, terminalCitation],
    claims: REPOSITORY_INTERVIEW_TOPICS.map((topic, index) =>
      index === 1
        ? {
            kind: 'inference' as const,
            topic,
            statement: 'A bounded synthetic runtime inference is preserved.',
            rationale:
              'The supplied artifact set supports this bounded synthetic bridge.',
            confidence: 'medium' as const,
            citations: [sharedCitation],
          }
        : {
            kind: 'documented-position' as const,
            topic,
            statement: `Synthetic documented position ${String(index + 1)}.`,
            rationale: null,
            confidence: 'high' as const,
            citations: [sharedCitation],
          },
    ),
    limitations: [
      {
        topic: 'adoption-and-limitations',
        basis: 'documented-position',
        statement: 'The supplied artifacts state one synthetic limitation.',
        rationale: null,
        confidence: 'medium',
        citations: [sharedCitation],
      },
    ],
    contradictions: [
      {
        topic: 'maintenance-and-support',
        kind: 'scope-dependent',
        explanation: 'Two synthetic scoped positions differ.',
        positions: [
          {
            statement: 'Synthetic position A applies to one scope.',
            citations: [sharedCitation],
          },
          {
            statement: 'Synthetic position B applies to another scope.',
            citations: [terminalCitation],
          },
        ],
      },
    ],
    unknowns: [
      {
        topic: 'security-and-trust',
        reason: 'insufficient-detail',
        statement:
          'The supplied artifact set does not establish one synthetic trust detail.',
        partialCitations: [sharedCitation],
      },
    ],
    publishedAt:
      options?.publishedAt ??
      options?.completedAt ??
      '2026-07-31T12:00:01.000Z',
  });
  return { publication, request, execution, interview };
}

export function createFailedRepositoryInterviewExecution(
  request: RepositoryInterviewRequestV1,
  failureCode: RepositoryInterviewFailureCode,
  nonceCharacter = 'f',
): ModelExecutionV1 {
  const responseFailure =
    failureCode !== 'transport-error' &&
    failureCode !== 'deadline-exceeded' &&
    failureCode !== 'cancelled';
  const httpStatus =
    failureCode === 'rate-limited'
      ? 429
      : failureCode === 'provider-error'
        ? 500
        : responseFailure
          ? 200
          : null;
  const transportOutcome =
    failureCode === 'transport-error'
      ? 'network-error'
      : failureCode === 'deadline-exceeded'
        ? 'deadline-exceeded'
        : failureCode === 'cancelled'
          ? 'cancelled'
          : 'response';
  return createModelExecutionV1({
    ...successfulExecutionInput(request, {
      executionNonce: nonceCharacter.repeat(32),
    }),
    attempts: [
      {
        ordinal: 1,
        startedAt: '2026-07-31T12:00:00.000Z',
        completedAt: '2026-07-31T12:00:01.000Z',
        transportOutcome,
        httpStatus,
        providerRequestId: responseFailure ? 'req_synthetic' : null,
        responseId: responseFailure ? 'resp_synthetic' : null,
        responseBytes: responseFailure ? 512 : 0,
        providerProcessingMilliseconds: responseFailure ? 400 : null,
        retryAfterMilliseconds: failureCode === 'rate-limited' ? 1_000 : null,
        remainingRequests: null,
        remainingTokens: null,
        resetRequestsMilliseconds: null,
        resetTokensMilliseconds: null,
      },
    ],
    outcome: {
      status: 'failed',
      failureCode,
      providerOutputDigest: null,
      usage:
        failureCode === 'invalid-usage'
          ? null
          : {
              inputTokens: 100,
              cachedInputTokens: 0,
              outputTokens: 20,
              reasoningTokens: 5,
              totalTokens: 120,
            },
    },
  });
}

function successfulExecutionInput(
  request: RepositoryInterviewRequestV1,
  options?: {
    readonly executionNonce?: string;
    readonly executionMode?: 'normal' | 'forced';
    readonly forceReason?:
      'calibration' | 'review-rejected' | 'operator-recovery' | null;
    readonly startedAt?: string;
    readonly completedAt?: string;
  },
): ModelExecutionInputV1 {
  const executionMode = options?.executionMode ?? 'normal';
  return {
    contractVersion: '1.0.0',
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionNonce: options?.executionNonce ?? 'a'.repeat(32),
    executionMode,
    forceReason:
      executionMode === 'forced'
        ? (options?.forceReason ?? 'operator-recovery')
        : null,
    modelProfile: {
      provider: 'openai',
      endpointProfile: 'responses-v1',
      modelSnapshot: 'gpt-5.4-mini-2026-03-17',
      providerProjectionVersion: '1.0.0',
      providerProjectionDigest: PROVIDER_PROJECTION_DIGEST,
      reasoningEffort: 'low',
      maximumOutputTokens: 8_192,
      maximumResponseBytes: 2_097_152,
      store: false,
      toolsEnabled: false,
      background: false,
      conversationState: false,
      previousResponseState: false,
      truncation: 'disabled',
      promptCacheRetention: 'in-memory',
      serviceTier: 'default',
      retryPolicyVersion: 'repository-interview-retry-v1',
    },
    startedAt: options?.startedAt ?? '2026-07-31T12:00:00.000Z',
    completedAt: options?.completedAt ?? '2026-07-31T12:00:01.000Z',
    attempts: [
      {
        ordinal: 1,
        startedAt: options?.startedAt ?? '2026-07-31T12:00:00.000Z',
        completedAt: options?.completedAt ?? '2026-07-31T12:00:01.000Z',
        transportOutcome: 'response',
        httpStatus: 200,
        providerRequestId: 'req_synthetic',
        responseId: 'resp_synthetic',
        responseBytes: 1_024,
        providerProcessingMilliseconds: 800,
        retryAfterMilliseconds: null,
        remainingRequests: 99,
        remainingTokens: 999_999,
        resetRequestsMilliseconds: 1_000,
        resetTokensMilliseconds: 1_000,
      },
    ],
    outcome: {
      status: 'succeeded',
      failureCode: null,
      providerOutputDigest: PROVIDER_OUTPUT_DIGEST,
      usage: {
        inputTokens: 1_000,
        cachedInputTokens: 100,
        outputTokens: 200,
        reasoningTokens: 50,
        totalTokens: 1_200,
      },
    },
  };
}

function interviewProvenance(
  request: RepositoryInterviewRequestV1,
  execution: ModelExecutionV1,
): Omit<
  RepositoryInterviewInputV1,
  | 'citations'
  | 'claims'
  | 'limitations'
  | 'contradictions'
  | 'unknowns'
  | 'publishedAt'
> {
  return {
    contractVersion: '1.0.0',
    candidateId: request.candidateId,
    artifactSetId: request.artifactSetId,
    artifactSetIdentityDigest: request.artifactSetIdentityDigest,
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionId: execution.executionId,
    executionIdentityDigest: execution.identityDigest,
    providerOutputDigest: PROVIDER_OUTPUT_DIGEST,
    specificationVersion: request.specificationVersion,
    specificationDigest: request.specificationDigest,
    rendererVersion: request.rendererVersion,
    providerOutputSchemaVersion: request.providerOutputSchemaVersion,
    providerOutputSchemaDigest: request.providerOutputSchemaDigest,
    providerProjectionVersion: execution.modelProfile.providerProjectionVersion,
    providerProjectionDigest: execution.modelProfile.providerProjectionDigest,
    promptDigest: request.promptDigest,
    modelProfileDigest: execution.modelProfileDigest,
  };
}
