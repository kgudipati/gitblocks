import {
  createRepositoryArtifactChunkV1,
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  repositoryArtifactContentSha256,
  repositoryArtifactDisplayUrl,
  repositoryArtifactGitBlobObjectId,
  repositoryArtifactUtf8ByteLength,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import {
  createOpenAiResponsesRepositoryInterviewProviderV1,
  loadRepositoryInterviewSpecification,
  REPOSITORY_INTERVIEW_TOPICS,
} from '@gitblocks/interviews';
import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  loadRepositoryInterviewExchange,
  putCatalogCandidate,
  publishRepositoryArtifactSet,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { describe, expect, it } from 'vitest';

import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewOperatorSelectionV1,
  createRepositoryInterviewPersistenceAdapterV1,
  runRepositoryInterviewOperatorV1,
} from '../../src/index.ts';

const DIGEST = 'd'.repeat(64);
const OWNER_CONFIG = readOwnerConfig();
const RUNTIME_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_persistence_test',
  password: 'persistence-test-only',
  maximumConnections: 2,
};

describe('operator PostgreSQL composition', { concurrent: false }, () => {
  it('publishes a normal exchange, proves zero-call reuse, and appends forced history', async () => {
    const owner = createPersistenceClient(OWNER_CONFIG);
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    try {
      await applyMigrations(owner);
      const publication = artifactPublication();
      try {
        await putCatalogCandidate(owner, {
          identity: {
            candidateId: publication.artifactSet.candidateId,
            displayName: 'Synthetic Operator Integration',
            repository: {
              host: 'github',
              owner: 'operator-fixture',
              name: 'repository',
            },
            package: null,
          },
          createdAt: '2026-07-31T12:00:00.000Z',
        });
      } catch {
        throw new Error('Synthetic candidate seed failed.');
      }
      try {
        await publishRepositoryArtifactSet(owner, publication);
      } catch {
        throw new Error('Synthetic artifact publication failed.');
      }
      const specification = await loadRepositoryInterviewSpecification(
        'interviews/repository/specifications/1.0.0',
      );
      const profile = modelProfile(specification);
      const policy = createRepositoryInterviewOperatorPolicyV1(
        policyDraft(profile),
        profile,
      );
      const selection = createRepositoryInterviewOperatorSelectionV1({
        schemaVersion: '1.0.0',
        selectionId: 'operator-integration-selection',
        catalogVersion: 'public-v1',
        catalogDigest: DIGEST,
        artifactManifestVersion: 'public-artifacts-v1',
        artifactManifestDigest: DIGEST,
        members: [
          {
            ordinal: 0,
            candidateId: publication.artifactSet.candidateId,
            artifactSetId: publication.artifactSet.artifactSetId,
            artifactSetIdentityDigest: publication.artifactSet.identityDigest,
          },
        ],
      });
      let providerCalls = 0;
      let nonce = 0;
      let providerClockTick = 0;
      const provider = createOpenAiResponsesRepositoryInterviewProviderV1({
        credential: {
          getBearerToken: () => Promise.resolve('synthetic-test-token'),
        },
        fetch: () => {
          providerCalls += 1;
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: `resp_operator-${String(providerCalls)}`,
                object: 'response',
                model: profile.modelSnapshot,
                status: 'completed',
                output: [
                  {
                    type: 'message',
                    role: 'assistant',
                    content: [
                      {
                        type: 'output_text',
                        text: JSON.stringify(providerOutput()),
                        annotations: [],
                      },
                    ],
                  },
                ],
                usage: {
                  input_tokens: 20,
                  input_tokens_details: { cached_tokens: 0 },
                  output_tokens: 10,
                  output_tokens_details: { reasoning_tokens: 5 },
                  total_tokens: 30,
                },
              }),
              {
                status: 200,
                headers: { 'content-type': 'application/json' },
              },
            ),
          );
        },
        clock: {
          now: () => {
            const milliseconds = providerClockTick++;
            return {
              timestamp: new Date(
                Date.parse('2026-07-31T12:00:00.000Z') + milliseconds,
              ).toISOString(),
              monotonicMilliseconds: milliseconds,
            };
          },
        },
        sleeper: { sleep: () => Promise.resolve() },
        attemptControl: {
          beginAttempt: () => {
            const controller = new AbortController();
            return {
              signal: controller.signal,
              outcome: () => 'completed' as const,
              dispose: () => undefined,
            };
          },
        },
      });
      const ports = {
        persistence: createRepositoryInterviewPersistenceAdapterV1(runtime, {
          statementTimeoutMilliseconds: 10_000,
          lockTimeoutMilliseconds: 5_000,
        }),
        provider,
        clock: { now: () => '2026-07-31T12:10:00.000Z' },
        monotonicClock: (() => {
          let value = 0;
          return { nowMilliseconds: () => value++ };
        })(),
        nonce: {
          nextExecutionNonce: () => (++nonce).toString(16).padStart(32, '0'),
        },
        runId: {
          nextRunId: () =>
            `interview-run-${String(nonce + 10).padStart(48, '0')}`,
        },
      };
      const first = await runRepositoryInterviewOperatorV1(
        {
          selection,
          specification,
          modelProfile: profile,
          policy,
          executionMode: 'normal',
          forceReason: null,
          verifyImmediateReuse: true,
        },
        ports,
      );
      if (!first.ok) {
        throw new Error(
          `Synthetic operator failed: ${first.issues.map((issue) => issue.code).join(',')}:${first.receipt?.stopCode ?? 'no-receipt'}`,
        );
      }
      expect(first.ok).toBe(true);
      expect(first.receipt.immediateReuse).toMatchObject({
        requested: true,
        passed: true,
        providerCalls: 0,
      });
      expect(providerCalls).toBe(1);
      const firstCandidate = first.receipt.candidateResults[0];
      if (firstCandidate?.executionId == null) {
        throw new Error('Synthetic execution authority is absent.');
      }
      const historical = await loadRepositoryInterviewExchange(runtime, {
        by: 'execution-id',
        executionId: firstCandidate.executionId,
      });
      expect(historical.execution.recordDigest).toBe(
        firstCandidate.executionRecordDigest,
      );
      expect(historical.interview?.recordDigest).toBe(
        firstCandidate.interviewRecordDigest,
      );

      const second = await runRepositoryInterviewOperatorV1(
        {
          selection,
          specification,
          modelProfile: profile,
          policy,
          executionMode: 'normal',
          forceReason: null,
          verifyImmediateReuse: false,
        },
        ports,
      );
      expect(second.ok).toBe(true);
      expect(second.receipt?.candidateResults[0]?.disposition).toBe('reused');
      expect(second.receipt?.counts.providerCalls).toBe(0);
      expect(providerCalls).toBe(1);

      const forced = await runRepositoryInterviewOperatorV1(
        {
          selection,
          specification,
          modelProfile: profile,
          policy,
          executionMode: 'forced',
          forceReason: 'operator-recovery',
          verifyImmediateReuse: false,
        },
        ports,
      );
      expect(forced.ok).toBe(true);
      if (!forced.ok) throw new Error('Synthetic forced execution failed.');
      expect(forced.receipt.candidateResults[0]?.disposition).toBe('created');
      expect(forced.receipt.candidateResults[0]?.executionId).not.toBe(
        first.receipt.candidateResults[0]?.executionId,
      );
      expect(providerCalls).toBe(2);

      const afterForced = await runRepositoryInterviewOperatorV1(
        {
          selection,
          specification,
          modelProfile: profile,
          policy,
          executionMode: 'normal',
          forceReason: null,
          verifyImmediateReuse: false,
        },
        ports,
      );
      expect(afterForced.receipt?.candidateResults[0]?.executionId).toBe(
        firstCandidate.executionId,
      );
      expect(providerCalls).toBe(2);

      const failed = await runRepositoryInterviewOperatorV1(
        {
          selection,
          specification,
          modelProfile: profile,
          policy,
          executionMode: 'forced',
          forceReason: 'operator-recovery',
          verifyImmediateReuse: false,
        },
        {
          ...ports,
          provider: {
            execute: () => {
              providerCalls += 1;
              return Promise.resolve({
                status: 'failed' as const,
                failureCode: 'rate-limited' as const,
                attempts: [{ ...responseAttempt(), httpStatus: 429 }],
                usage: null,
              });
            },
          },
        },
      );
      expect(failed.ok).toBe(false);
      expect(failed.receipt?.candidateResults[0]).toMatchObject({
        status: 'provider-failed',
        failureCode: 'rate-limited',
        interviewId: null,
        claims: 0,
        citations: 0,
        limitations: 0,
        contradictions: 0,
        unknowns: 0,
      });
      expect(providerCalls).toBe(3);
    } finally {
      await Promise.all([
        closePersistenceClient(runtime),
        closePersistenceClient(owner),
      ]);
    }
  });
});

function artifactPublication() {
  const content = '# Synthetic\r\nexact π bytes\n';
  const artifact = createRepositoryArtifactV1({
    contractVersion: '1.0.0',
    candidateId: 'operator-integration-candidate',
    provider: 'github',
    providerRepositoryId: '123456789012345678',
    gitObjectAlgorithm: 'sha1',
    commitObjectId: '1'.repeat(40),
    path: 'README.md',
    blobObjectId: repositoryArtifactGitBlobObjectId('sha1', content),
    blobApiUrl: `https://api.github.com/repositories/123456789012345678/git/blobs/${repositoryArtifactGitBlobObjectId('sha1', content)}`,
    displayUrl: repositoryArtifactDisplayUrl({
      providerOwner: 'operator-fixture',
      providerRepository: 'repository',
      commitObjectId: '1'.repeat(40),
      path: 'README.md',
    }),
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: repositoryArtifactContentSha256(content),
    byteCount: repositoryArtifactUtf8ByteLength(content),
    lineCount: 3,
    content,
    firstMaterialization: {
      catalogOwner: 'operator-fixture',
      catalogRepository: 'repository',
      providerOwner: 'operator-fixture',
      providerRepository: 'repository',
      collectedAt: '2026-07-31T11:59:00.000Z',
    },
  });
  const chunk = createRepositoryArtifactChunkV1({
    contractVersion: '1.0.0',
    artifactId: artifact.artifactId,
    candidateId: artifact.candidateId,
    chunkerVersion: 'exact-lines-v1',
    ordinal: 0,
    startByte: 0,
    endByteExclusive: artifact.byteCount,
    byteCount: artifact.byteCount,
    startLine: 1,
    endLine: 2,
    contentSha256: artifact.contentSha256,
    content,
  });
  const artifactSet = createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId: artifact.candidateId,
    catalogVersion: 'public-v1',
    catalogDigest: DIGEST,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: DIGEST,
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: artifact.providerRepositoryId,
    providerCanonicalOwner: 'operator-fixture',
    providerCanonicalRepository: 'repository',
    gitObjectAlgorithm: 'sha1',
    commitObjectId: artifact.commitObjectId,
    entries: [
      {
        selectionId: `selection-${'1'.repeat(48)}`,
        ordinal: 0,
        selector: 'root-readme',
        artifactKind: 'readme',
        requirement: 'optional',
        rationale: null,
        requestedPath: null,
        resolvedPath: artifact.path,
        outcome: 'present',
        artifactId: artifact.artifactId,
      },
    ],
    publishedAt: '2026-07-31T12:00:00.000Z',
  });
  return { artifactSet, artifacts: [{ artifact, chunks: [chunk] }] };
}

function modelProfile(
  specification: Awaited<
    ReturnType<typeof loadRepositoryInterviewSpecification>
  >,
): ModelExecutionModelProfileV1 {
  return {
    provider: 'openai',
    endpointProfile: 'responses-v1',
    modelSnapshot: 'gpt-5.4-mini-2026-03-17',
    providerProjectionVersion: specification.manifest.openAiProjection.version,
    providerProjectionDigest: specification.manifest.openAiProjection.digest,
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
  };
}

function policyDraft(profile: ModelExecutionModelProfileV1) {
  return {
    schemaVersion: '1.0.0' as const,
    policyId: 'operator-integration-policy',
    maximumCandidates: 1,
    concurrency: 1 as const,
    candidateDeadlineMilliseconds: 300_000,
    runDeadlineMilliseconds: 600_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
    maximumInputTokensPerProviderCall: 1_000,
    maximumOutputTokensPerProviderCall: profile.maximumOutputTokens,
    maximumRunInputTokens: 1_000,
    maximumRunCachedInputTokens: 1_000,
    maximumRunOutputTokens: 8_192,
    maximumRunReasoningTokens: 8_192,
    maximumRunTotalTokens: 9_192,
    maximumRunCostMicroUsd: 120_000_000,
    pricing: {
      provider: 'openai' as const,
      modelSnapshot: profile.modelSnapshot,
      inputMicroUsdPerMillionTokens: 1,
      cachedInputMicroUsdPerMillionTokens: 1,
      outputMicroUsdPerMillionTokens: 1,
      pricingAuthorityDate: '2026-07-31',
      pricingAuthorityDigest: DIGEST,
    },
  };
}

function responseAttempt() {
  return {
    ordinal: 1 as const,
    startedAt: '2026-07-31T12:00:00.000Z',
    completedAt: '2026-07-31T12:00:01.000Z',
    transportOutcome: 'response' as const,
    httpStatus: 200,
    providerRequestId: null,
    responseId: null,
    responseBytes: 100,
    providerProcessingMilliseconds: null,
    retryAfterMilliseconds: null,
    remainingRequests: null,
    remainingTokens: null,
    resetRequestsMilliseconds: null,
    resetTokensMilliseconds: null,
  };
}

function providerOutput() {
  return {
    documentedPositions: [],
    inferences: [],
    limitations: [],
    contradictions: [],
    unknowns: REPOSITORY_INTERVIEW_TOPICS.map((topic) => ({
      topic,
      reason: 'not-documented',
      statement: `The supplied artifact set does not establish ${topic}.`,
      partialCitations: [],
    })),
  };
}

function readOwnerConfig(): PersistenceClientConfig {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  return {
    host: required('GITBLOCKS_TEST_DB_HOST'),
    port: Number(required('GITBLOCKS_TEST_DB_PORT')),
    database: required('GITBLOCKS_TEST_DB_DATABASE'),
    username: required('GITBLOCKS_TEST_DB_OWNER'),
    password: required('GITBLOCKS_TEST_DB_PASSWORD'),
    ssl: false,
    maximumConnections: 2,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('PostgreSQL integration configuration is required.');
  }
  return value;
}
