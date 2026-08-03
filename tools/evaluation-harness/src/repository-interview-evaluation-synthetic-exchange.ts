import {
  REPOSITORY_INTERVIEW_TOPICS,
  createModelExecutionV1,
  createRepositoryInterviewRequestV1,
  createRepositoryInterviewV1,
  type ModelExecutionInputV1,
  type RepositoryInterviewRequestV1,
} from '@gitblocks/contracts';

const DIGEST = {
  artifactSet: '1'.repeat(64),
  specification: '2'.repeat(64),
  providerSchema: '3'.repeat(64),
  prompt: '4'.repeat(64),
  providerProjection: '5'.repeat(64),
  providerOutput: '6'.repeat(64),
} as const;

export function createSyntheticRepositoryInterviewExchangeV1(
  candidateId: string,
  richInventory = false,
) {
  const request = createRepositoryInterviewRequestV1({
    contractVersion: '1.0.0',
    candidateId,
    artifactSetId: `artifact-set-${'a'.repeat(48)}`,
    artifactSetIdentityDigest: DIGEST.artifactSet,
    specificationVersion: '1.0.0',
    specificationDigest: DIGEST.specification,
    rendererVersion: 'repository-interview-renderer-v1',
    providerOutputSchemaVersion: '1.0.0',
    providerOutputSchemaDigest: DIGEST.providerSchema,
    promptDigest: DIGEST.prompt,
  });
  const execution = createModelExecutionV1(executionInput(request));
  const citation = {
    artifactId: `artifact-${'c'.repeat(48)}`,
    startLine: 1,
    endLine: 2,
  } as const;
  const claimCount = richInventory ? 20 : REPOSITORY_INTERVIEW_TOPICS.length;
  const interview = createRepositoryInterviewV1({
    contractVersion: '1.0.0',
    candidateId: request.candidateId,
    artifactSetId: request.artifactSetId,
    artifactSetIdentityDigest: request.artifactSetIdentityDigest,
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionId: execution.executionId,
    executionIdentityDigest: execution.identityDigest,
    providerOutputDigest: DIGEST.providerOutput,
    specificationVersion: request.specificationVersion,
    specificationDigest: request.specificationDigest,
    rendererVersion: request.rendererVersion,
    providerOutputSchemaVersion: request.providerOutputSchemaVersion,
    providerOutputSchemaDigest: request.providerOutputSchemaDigest,
    providerProjectionVersion: execution.modelProfile.providerProjectionVersion,
    providerProjectionDigest: execution.modelProfile.providerProjectionDigest,
    promptDigest: request.promptDigest,
    modelProfileDigest: execution.modelProfileDigest,
    citations: [citation],
    claims: Array.from({ length: claimCount }, (_, index) => ({
      kind: 'documented-position' as const,
      topic: syntheticTopic(index),
      statement: `Synthetic documented position ${String(index + 1)}.`,
      rationale: null,
      confidence: 'high' as const,
      citations: [citation],
    })),
    limitations: richInventory
      ? [
          {
            topic: 'adoption-and-limitations' as const,
            basis: 'documented-position' as const,
            statement: 'Synthetic limitation.',
            rationale: null,
            confidence: 'high' as const,
            citations: [citation],
          },
        ]
      : [],
    contradictions: [],
    unknowns: richInventory
      ? Array.from({ length: 10 }, (_, index) => ({
          topic: syntheticTopic(index),
          reason: 'insufficient-detail' as const,
          statement: `The supplied artifact set does not establish synthetic detail ${String(index + 1)}.`,
          partialCitations: [citation],
        }))
      : [],
    publishedAt: '2026-07-30T12:01:00.000Z',
  });
  return { request, execution, interview };
}

function syntheticTopic(index: number) {
  const topic =
    REPOSITORY_INTERVIEW_TOPICS[index % REPOSITORY_INTERVIEW_TOPICS.length];
  if (topic === undefined)
    throw new Error('Synthetic repository interview topic is unavailable.');
  return topic;
}

function executionInput(
  request: RepositoryInterviewRequestV1,
): ModelExecutionInputV1 {
  return {
    contractVersion: '1.0.0',
    requestId: request.requestId,
    requestIdentityDigest: request.identityDigest,
    executionNonce: 'b'.repeat(32),
    executionMode: 'normal',
    forceReason: null,
    modelProfile: {
      provider: 'openai',
      endpointProfile: 'responses-v1',
      modelSnapshot: 'gpt-5.4-mini-2026-03-17',
      providerProjectionVersion: '1.0.0',
      providerProjectionDigest: DIGEST.providerProjection,
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
    startedAt: '2026-07-30T12:00:00.000Z',
    completedAt: '2026-07-30T12:00:01.000Z',
    attempts: [
      {
        ordinal: 1,
        startedAt: '2026-07-30T12:00:00.000Z',
        completedAt: '2026-07-30T12:00:01.000Z',
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
      providerOutputDigest: DIGEST.providerOutput,
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
