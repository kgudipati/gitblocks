import { beforeAll, describe, expect, it } from 'vitest';

import {
  createRepositoryArtifactSetV1,
  type ModelExecutionAttemptV1,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import {
  loadRepositoryInterviewSpecification,
  renderRepositoryInterviewPromptV1,
  REPOSITORY_INTERVIEW_TOPICS,
  type LoadedRepositoryInterviewSpecification,
  type RepositoryInterviewPublicationCommandV1,
} from '@gitblocks/interviews';

import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewOperatorSelectionV1,
  runRepositoryInterviewOperatorV1,
  type RepositoryInterviewOperatorPersistencePortV1,
} from '../src/index.ts';

const DIGEST = 'a'.repeat(64);
let specification: LoadedRepositoryInterviewSpecification;

beforeAll(async () => {
  specification = await loadRepositoryInterviewSpecification(
    'interviews/repository/specifications/1.0.0',
  );
});

describe('repository interview operator composition', () => {
  it('creates one exchange and proves immediate zero-call reuse', async () => {
    const artifactSet = createRepositoryArtifactSetV1({
      contractVersion: '1.0.0',
      candidateId: 'synthetic-operator-candidate',
      catalogVersion: 'public-v1',
      catalogDigest: DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: DIGEST,
      collectorVersion: 'repository-artifacts-v1',
      chunkerVersion: 'exact-lines-v1',
      provider: 'github',
      providerRepositoryId: '123',
      providerCanonicalOwner: 'synthetic-owner',
      providerCanonicalRepository: 'synthetic-repository',
      gitObjectAlgorithm: 'sha1',
      commitObjectId: '1'.repeat(40),
      entries: [
        {
          selectionId: `selection-${'3'.repeat(48)}`,
          ordinal: 0,
          selector: 'root-readme',
          artifactKind: 'readme',
          requirement: 'optional',
          rationale: null,
          requestedPath: null,
          resolvedPath: null,
          outcome: 'not-found',
          artifactId: null,
        },
      ],
      publishedAt: '2026-07-31T12:00:00.000Z',
    });
    const selection = createRepositoryInterviewOperatorSelectionV1({
      schemaVersion: '1.0.0',
      selectionId: 'synthetic-operator-selection',
      catalogVersion: 'public-v1',
      catalogDigest: DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: DIGEST,
      members: [
        {
          ordinal: 0,
          candidateId: artifactSet.candidateId,
          artifactSetId: artifactSet.artifactSetId,
          artifactSetIdentityDigest: artifactSet.identityDigest,
        },
      ],
    });
    const rendered = renderRepositoryInterviewPromptV1({
      artifactSet,
      artifacts: [],
      specification,
    });
    expect(rendered.ok ? [] : rendered.issues).toEqual([]);
    const profile = modelProfile();
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile),
      profile,
    );
    let stored: RepositoryInterviewPublicationCommandV1 | null = null;
    let providerCalls = 0;
    const persistence: RepositoryInterviewOperatorPersistencePortV1 = {
      verifyMigrations: () => Promise.resolve(migrationAuthority()),
      loadArtifactContext: () =>
        Promise.resolve({ artifactSet, artifacts: [] }),
      record: {
        findReusable: () =>
          Promise.resolve(
            stored?.interview === null || stored === null
              ? null
              : {
                  request: stored.request,
                  execution: stored.execution,
                  interview: stored.interview,
                },
          ),
        publish: (command) => {
          stored = command;
          return Promise.resolve({ status: 'created' as const });
        },
      },
    };
    let monotonic = 0;
    const telemetryEvents: unknown[] = [];
    const result = await runRepositoryInterviewOperatorV1(
      {
        selection,
        specification,
        modelProfile: profile,
        policy,
        executionMode: 'normal',
        forceReason: null,
        verifyImmediateReuse: true,
      },
      {
        persistence,
        provider: {
          execute: () => {
            providerCalls += 1;
            return Promise.resolve({
              status: 'response' as const,
              attempts: [attempt()],
              usage: {
                inputTokens: 100,
                cachedInputTokens: 20,
                outputTokens: 30,
                reasoningTokens: 10,
                totalTokens: 130,
              },
              providerOutput: providerOutput(),
            });
          },
        },
        clock: { now: () => '2026-07-31T12:00:02.000Z' },
        monotonicClock: { nowMilliseconds: () => monotonic++ },
        nonce: { nextExecutionNonce: () => '1'.repeat(32) },
        runId: { nextRunId: () => `interview-run-${'2'.repeat(48)}` },
        observer: {
          observe(event) {
            telemetryEvents.push(event);
            Reflect.set(event, 'failureCode', 'provider sentinel');
            throw new Error('observer sentinel');
          },
        },
      },
    );
    expect(result.receipt?.stopCode).toBe(null);
    expect(result).toMatchObject({ ok: true });
    expect(providerCalls).toBe(1);
    expect(result.receipt?.counts).toMatchObject({
      requestedCandidates: 1,
      completedCandidates: 1,
      createdCandidates: 1,
      providerCalls: 1,
    });
    expect(result.receipt?.immediateReuse).toEqual({
      requested: true,
      passed: true,
      candidateCount: 1,
      reusedCount: 1,
      providerCalls: 0,
      providerAttempts: 0,
      tokenUsage: 0,
      costMicroUsd: 0,
    });
    expect(result.receipt?.candidateResults[0]?.unknowns).toBe(8);
    expect(result.receipt?.providerSummary).toMatchObject({
      responses: 1,
      networkErrors: 0,
      rateLimited: 0,
    });
    expect(result.receipt?.telemetry).toEqual({
      eventCount: telemetryEvents.length,
      telemetryFailureCount: telemetryEvents.length,
    });
    expect(telemetryEvents.every((event) => Object.isFrozen(event))).toBe(true);
    expect(
      telemetryEvents.map((value) =>
        typeof value === 'object' && value !== null
          ? (value as Readonly<Record<string, unknown>>)['event']
          : null,
      ),
    ).toEqual([
      'operator-started',
      'candidate-started',
      'provider-completed',
      'publication-completed',
      'candidate-completed',
      'operator-completed',
    ]);
    expect(JSON.stringify(telemetryEvents)).not.toContain('provider sentinel');
    expect(JSON.stringify(result)).not.toContain('not established for topic');

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
        persistence,
        provider: {
          execute: () =>
            Promise.resolve({
              status: 'failed' as const,
              failureCode: 'rate-limited' as const,
              attempts: [{ ...attempt(), httpStatus: 429 }],
              usage: null,
            }),
        },
        clock: { now: () => '2026-07-31T12:00:02.000Z' },
        monotonicClock: { nowMilliseconds: () => monotonic++ },
        nonce: { nextExecutionNonce: () => '2'.repeat(32) },
        runId: { nextRunId: () => `interview-run-${'3'.repeat(48)}` },
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
    expect(JSON.stringify(failed)).not.toContain('observer sentinel');
  });
});

function modelProfile(): ModelExecutionModelProfileV1 {
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
    policyId: 'synthetic-policy',
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
      inputMicroUsdPerMillionTokens: 1_000_000,
      cachedInputMicroUsdPerMillionTokens: 100_000,
      outputMicroUsdPerMillionTokens: 2_000_000,
      pricingAuthorityDate: '2026-07-31',
      pricingAuthorityDigest: DIGEST,
    },
  };
}

function attempt(): ModelExecutionAttemptV1 {
  return {
    ordinal: 1,
    startedAt: '2026-07-31T12:00:00.000Z',
    completedAt: '2026-07-31T12:00:01.000Z',
    transportOutcome: 'response',
    httpStatus: 200,
    providerRequestId: 'req_synthetic',
    responseId: 'resp_synthetic',
    responseBytes: 1_024,
    providerProcessingMilliseconds: 500,
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

function migrationAuthority() {
  return {
    postgresqlVersion: '18.4',
    migrations: [
      {
        version: 1,
        name: 'evidence-persistence',
        checksum:
          '569d7a6d6db70b1b04cadfa8798516ce4239b1179bb2f7cdd84b27641e33755f',
      },
      {
        version: 2,
        name: 'runtime-migration-verification',
        checksum:
          'b61cf8ad8673663c646b77e8f0ebed452898aab795aa64f52217e1271e1dc2ae',
      },
      {
        version: 3,
        name: 'immutable-repository-artifacts',
        checksum:
          '0ea1e4698e8eec6d33320df7af4758ae6b3b4fcbe3da387bb042d074b86228dc',
      },
      {
        version: 4,
        name: 'repository-interviews',
        checksum:
          '2cd18e7d92373215b2a540cdf12e32a7e949bfb01866616e8a44ad326e45bca0',
      },
    ],
  };
}
