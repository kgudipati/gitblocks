import { beforeAll, describe, expect, it } from 'vitest';

import {
  createRepositoryArtifactSetV1,
  type ModelExecutionAttemptV1,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import {
  loadRepositoryInterviewSpecification,
  REPOSITORY_INTERVIEW_TOPICS,
  type LoadedRepositoryInterviewSpecification,
  type RepositoryInterviewProviderEffectResultV1,
  type RepositoryInterviewPublicationCommandV1,
} from '@gitblocks/interviews';

import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewOperatorReceiptV1,
  createRepositoryInterviewOperatorSelectionV1,
  runRepositoryInterviewOperatorV1,
  type RepositoryInterviewOperatorCandidateControlFactoryV1,
  type RepositoryInterviewOperatorCandidateControlV1,
  type RepositoryInterviewOperatorCandidateOutcomeV1,
  type RepositoryInterviewOperatorPersistencePortV1,
  type RepositoryInterviewOperatorProviderFactoryV1,
} from '../src/index.ts';

const DIGEST = 'a'.repeat(64);
let specification: LoadedRepositoryInterviewSpecification;

beforeAll(async () => {
  specification = await loadRepositoryInterviewSpecification(
    'interviews/repository/specifications/1.0.0',
  );
});

describe('active operator deadline authority', () => {
  it('stops an already-expired candidate before every candidate effect', async () => {
    const harness = createHarness({
      control: controlFactory('candidate-deadline'),
    });
    const result = await harness.run();

    expect(result.receipt).toMatchObject({
      status: 'stopped',
      stopCode: 'candidate-deadline',
      counts: {
        startedCandidates: 1,
        notStartedCandidates: 0,
        providerCalls: 0,
        providerAttempts: 0,
      },
    });
    expect(harness.calls).toEqual({
      artifactLoads: 0,
      reuseLookups: 0,
      providerCalls: 0,
      nonceCalls: 0,
      publications: 0,
    });
    expect(result.receipt?.candidateResults[0]).toMatchObject({
      failureCode: 'candidate-deadline',
      requestId: null,
      executionId: null,
      interviewId: null,
      attemptCount: 0,
      costMicroUsd: 0,
    });
  });

  it('rechecks candidate authority after a late artifact load', async () => {
    const control = controlFactory('active');
    const harness = createHarness({
      control,
      afterArtifactLoad: () => {
        control.setOutcome('candidate-deadline');
      },
    });
    const result = await harness.run();

    expect(control.signal.aborted).toBe(true);
    expect(harness.calls.artifactLoads).toBe(1);
    expect(harness.calls.providerCalls).toBe(0);
    expect(harness.calls.nonceCalls).toBe(0);
    expect(harness.calls.publications).toBe(0);
    expect(result.receipt).toMatchObject({
      status: 'stopped',
      stopCode: 'candidate-deadline',
    });
  });

  it('propagates a run deadline through artifact loading and starts no later candidate', async () => {
    const control = controlFactory('active');
    const harness = createHarness({
      candidateCount: 2,
      control,
      afterArtifactLoad: () => {
        control.setOutcome('run-deadline');
      },
    });
    const result = await harness.run();

    expect(harness.calls.artifactLoads).toBe(1);
    expect(harness.calls.providerCalls).toBe(0);
    expect(result.receipt).toMatchObject({
      status: 'stopped',
      stopCode: 'run-deadline',
      counts: { startedCandidates: 1, notStartedCandidates: 1 },
    });
  });

  it('prevents nonce, provider, and publication after a late null reuse lookup', async () => {
    const control = controlFactory('active');
    const harness = createHarness({
      control,
      afterReuseLookup: () => {
        control.setOutcome('candidate-deadline');
      },
    });
    const result = await harness.run();

    expect(harness.calls.reuseLookups).toBe(1);
    expect(harness.calls.nonceCalls).toBe(0);
    expect(harness.calls.providerCalls).toBe(0);
    expect(harness.calls.publications).toBe(0);
    expect(result.receipt?.stopCode).toBe('candidate-deadline');
  });

  it('preserves a durable failed execution when deadline authority changes after publication', async () => {
    const control = controlFactory('active');
    const harness = createHarness({
      control,
      providerEffect: {
        status: 'failed',
        failureCode: 'cancelled',
        attempts: [
          {
            ...attempt(),
            transportOutcome: 'cancelled',
            httpStatus: null,
            providerRequestId: null,
            responseId: null,
            responseBytes: 0,
          },
        ],
        usage: null,
      },
      afterPublication: () => {
        control.setOutcome('candidate-deadline');
      },
    });
    const result = await harness.run();

    expect(harness.calls.publications).toBe(1);
    expect(result.receipt).toMatchObject({
      status: 'stopped',
      stopCode: 'candidate-deadline',
    });
    expect(result.receipt?.candidateResults[0]).toMatchObject({
      status: 'provider-failed',
      failureCode: 'cancelled',
      publicationStatus: 'created',
      interviewId: null,
    });
    expect(result.receipt?.candidateResults[0]?.executionId).toMatch(
      /^modelexec-/u,
    );

    const cancelledControl = controlFactory('active');
    const cancelledHarness = createHarness({
      control: cancelledControl,
      publicationFailure: () => {
        cancelledControl.setOutcome('candidate-deadline');
      },
    });
    const cancelled = await cancelledHarness.run();

    expect(cancelledHarness.calls.publications).toBe(1);
    expect(cancelled.receipt).toMatchObject({
      status: 'stopped',
      stopCode: 'candidate-deadline',
    });
    expect(cancelled.receipt?.candidateResults[0]).toMatchObject({
      failureCode: 'candidate-deadline',
      requestId: null,
      executionId: null,
      interviewId: null,
      publicationStatus: null,
    });
  });

  it('stops after a provider effect returned under newly expired authority', async () => {
    const control = controlFactory('active');
    const harness = createHarness({
      control,
      afterProviderEffect: () => {
        control.setOutcome('candidate-deadline');
      },
    });
    const result = await harness.run();

    expect(harness.calls.providerCalls).toBe(1);
    expect(harness.calls.publications).toBe(0);
    expect(result.receipt).toMatchObject({
      status: 'stopped',
      stopCode: 'candidate-deadline',
      counts: { providerCalls: 1, providerAttempts: 1 },
    });
    expect(result.receipt?.candidateResults[0]).toMatchObject({
      failureCode: 'candidate-deadline',
      executionId: null,
      interviewId: null,
      attemptCount: 0,
    });
  });

  it('does not replace an active peer after one of two concurrent candidates expires', async () => {
    const controls = new Map<number, ReturnType<typeof controlFactory>>();
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const harness = createHarness({
      candidateCount: 3,
      concurrency: 2,
      control: {
        beginCandidate({ ordinal }) {
          const control = controlFactory('active');
          controls.set(ordinal, control);
          return control;
        },
      },
      async artifactLoadHook(ordinal) {
        if (ordinal === 0) await firstBlocked;
        if (ordinal === 1) {
          controls.get(1)?.setOutcome('candidate-deadline');
          releaseFirst?.();
        }
      },
    });
    const result = await harness.run();

    expect([...controls.keys()].sort()).toEqual([0, 1]);
    expect(result.receipt?.stopCode).toBe('candidate-deadline');
    expect(
      result.receipt?.candidateResults.map((item) => item.ordinal),
    ).toEqual([0, 1]);
    expect(result.receipt?.counts.notStartedCandidates).toBe(1);
  });
});

describe('immediate reuse evidence', () => {
  it('counts a forbidden second-pass provider guard invocation truthfully', async () => {
    const harness = createHarness({ alwaysMissReuse: true });
    const result = await harness.run(true);

    expect(result.ok).toBe(false);
    expect(result.receipt?.stopCode).toBe('immediate-reuse-failed');
    expect(result.receipt?.immediateReuse).toEqual({
      requested: true,
      passed: false,
      candidateCount: 1,
      reusedCount: 0,
      providerCalls: 1,
      providerAttempts: 0,
      tokenUsage: 0,
      costMicroUsd: 0,
    });
  });

  it('reports zero guard calls when the proof fails before provider lookup', async () => {
    const harness = createHarness({ failArtifactLoadAt: 2 });
    const result = await harness.run(true);

    expect(result.ok).toBe(false);
    expect(result.receipt?.immediateReuse).toMatchObject({
      requested: true,
      passed: false,
      providerCalls: 0,
      providerAttempts: 0,
      tokenUsage: 0,
      costMicroUsd: 0,
    });
  });

  it('rejects a passed receipt with nonzero reuse provider calls', () => {
    const draft = receiptDraft();
    expect(() =>
      createRepositoryInterviewOperatorReceiptV1({
        ...draft,
        immediateReuse: {
          requested: true,
          passed: true,
          candidateCount: 1,
          reusedCount: 1,
          providerCalls: 1,
          providerAttempts: 0,
          tokenUsage: 0,
          costMicroUsd: 0,
        },
      }),
    ).toThrow('receipt is invalid');
  });

  it('digest-binds the observed failed-proof provider-call count', () => {
    const zero = createRepositoryInterviewOperatorReceiptV1(receiptDraft());
    const one = createRepositoryInterviewOperatorReceiptV1({
      ...receiptDraft(),
      immediateReuse: {
        ...receiptDraft().immediateReuse,
        providerCalls: 1,
      },
    });
    expect(one.immediateReuse).toMatchObject({
      passed: false,
      providerCalls: 1,
    });
    expect(one.receiptDigest).not.toBe(zero.receiptDigest);
  });
});

function createHarness(
  options: {
    candidateCount?: number;
    concurrency?: 1 | 2;
    control?: RepositoryInterviewOperatorCandidateControlFactoryV1 & {
      setOutcome?: (
        outcome: RepositoryInterviewOperatorCandidateOutcomeV1,
      ) => void;
    };
    afterArtifactLoad?: () => void;
    afterReuseLookup?: () => void;
    afterPublication?: () => void;
    publicationFailure?: () => void;
    afterProviderEffect?: () => void;
    artifactLoadHook?: (ordinal: number) => void | Promise<void>;
    providerEffect?: RepositoryInterviewProviderEffectResultV1;
    alwaysMissReuse?: boolean;
    failArtifactLoadAt?: number;
  } = {},
) {
  const candidateCount = options.candidateCount ?? 1;
  const artifactSets = Array.from({ length: candidateCount }, (_, ordinal) =>
    artifactSet(`synthetic-deadline-${String(ordinal)}`, ordinal),
  );
  const selection = createRepositoryInterviewOperatorSelectionV1({
    schemaVersion: '1.0.0',
    selectionId: 'deadline-selection',
    catalogVersion: 'public-v1',
    catalogDigest: DIGEST,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: DIGEST,
    members: artifactSets.map((set, ordinal) => ({
      ordinal,
      candidateId: set.candidateId,
      artifactSetId: set.artifactSetId,
      artifactSetIdentityDigest: set.identityDigest,
    })),
  });
  const profile = modelProfile();
  const policy = createRepositoryInterviewOperatorPolicyV1(
    {
      ...policyDraft(profile),
      maximumCandidates: candidateCount,
      concurrency: options.concurrency ?? 1,
      maximumRunInputTokens: candidateCount * 1_000,
      maximumRunCachedInputTokens: candidateCount * 1_000,
      maximumRunOutputTokens: candidateCount * 8_192,
      maximumRunReasoningTokens: candidateCount * 8_192,
      maximumRunTotalTokens: candidateCount * 9_192,
    },
    profile,
  );
  const calls = {
    artifactLoads: 0,
    reuseLookups: 0,
    providerCalls: 0,
    nonceCalls: 0,
    publications: 0,
  };
  let stored: RepositoryInterviewPublicationCommandV1 | null = null;
  const persistence: RepositoryInterviewOperatorPersistencePortV1 = {
    verifyMigrations: () => Promise.resolve(migrationAuthority()),
    forCandidate(signal) {
      return {
        async loadArtifactContext(member) {
          expect(signal).toBeInstanceOf(AbortSignal);
          calls.artifactLoads += 1;
          if (calls.artifactLoads === options.failArtifactLoadAt) {
            throw new Error('Synthetic artifact load failure.');
          }
          await options.artifactLoadHook?.(member.ordinal);
          options.afterArtifactLoad?.();
          return { artifactSet: artifactSets[member.ordinal]!, artifacts: [] };
        },
        record: {
          findReusable: () => {
            calls.reuseLookups += 1;
            options.afterReuseLookup?.();
            if (options.alwaysMissReuse || stored?.interview == null) {
              return Promise.resolve(null);
            }
            return Promise.resolve({
              request: stored.request,
              execution: stored.execution,
              interview: stored.interview,
            });
          },
          publish: (command) => {
            calls.publications += 1;
            if (options.publicationFailure !== undefined) {
              options.publicationFailure();
              return Promise.reject(
                new Error('Synthetic publication cancellation.'),
              );
            }
            stored = command;
            options.afterPublication?.();
            return Promise.resolve({ status: 'created' as const });
          },
        },
      };
    },
  };
  const provider: RepositoryInterviewOperatorProviderFactoryV1 = {
    forCandidate(signal) {
      return {
        execute: () => {
          expect(signal).toBeInstanceOf(AbortSignal);
          calls.providerCalls += 1;
          const effect = options.providerEffect ?? {
            status: 'response' as const,
            providerOutputDiagnosticCode: null,
            attempts: [attempt()],
            usage: {
              inputTokens: 10,
              cachedInputTokens: 0,
              outputTokens: 10,
              reasoningTokens: 5,
              totalTokens: 20,
            },
            providerOutput: providerOutput(),
          };
          options.afterProviderEffect?.();
          return Promise.resolve(effect);
        },
      };
    },
  };
  let monotonic = 0;
  return {
    calls,
    run: (verifyImmediateReuse = false) =>
      runRepositoryInterviewOperatorV1(
        {
          selection,
          specification,
          modelProfile: profile,
          policy,
          executionMode: 'normal',
          forceReason: null,
          verifyImmediateReuse,
        },
        {
          persistence,
          provider,
          candidateControl: options.control ?? controlFactory('active'),
          clock: { now: () => '2026-07-31T12:00:02.000Z' },
          monotonicClock: { nowMilliseconds: () => monotonic++ },
          nonce: {
            nextExecutionNonce() {
              calls.nonceCalls += 1;
              return calls.nonceCalls.toString(16).padStart(32, '0');
            },
          },
          runId: { nextRunId: () => `interview-run-${'2'.repeat(48)}` },
        },
      ),
  };
}

function controlFactory(
  initial: RepositoryInterviewOperatorCandidateOutcomeV1,
): RepositoryInterviewOperatorCandidateControlFactoryV1 &
  RepositoryInterviewOperatorCandidateControlV1 & {
    setOutcome(outcome: RepositoryInterviewOperatorCandidateOutcomeV1): void;
  } {
  const controller = new AbortController();
  let outcome = initial;
  if (initial !== 'active') controller.abort();
  const control = {
    signal: controller.signal,
    outcome: () => outcome,
    dispose: () => undefined,
    setOutcome(value: RepositoryInterviewOperatorCandidateOutcomeV1) {
      outcome = value;
      if (value !== 'active') controller.abort();
    },
    beginCandidate: () => control,
  };
  return control;
}

function artifactSet(candidateId: string, ordinal: number) {
  return createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId,
    catalogVersion: 'public-v1',
    catalogDigest: DIGEST,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: DIGEST,
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: String(ordinal + 1),
    providerCanonicalOwner: 'synthetic-owner',
    providerCanonicalRepository: `synthetic-${String(ordinal)}`,
    gitObjectAlgorithm: 'sha1',
    commitObjectId: (ordinal + 1).toString(16).repeat(40).slice(0, 40),
    entries: [
      {
        selectionId: `selection-${(ordinal + 1).toString(16).repeat(48).slice(0, 48)}`,
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
}

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
    policyId: 'deadline-policy',
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

function attempt(): ModelExecutionAttemptV1 {
  return {
    ordinal: 1,
    startedAt: '2026-07-31T12:00:00.000Z',
    completedAt: '2026-07-31T12:00:01.000Z',
    transportOutcome: 'response',
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

function receiptDraft() {
  return {
    schemaVersion: '1.0.0' as const,
    kind: 'repository-interview-operator-receipt' as const,
    runId: `interview-run-${'1'.repeat(48)}`,
    startedAt: '2026-07-31T12:00:00.000Z',
    completedAt: '2026-07-31T12:00:01.000Z',
    durationMilliseconds: 1,
    status: 'stopped' as const,
    stopCode: 'immediate-reuse-failed',
    selection: {
      selectionId: 'selection',
      selectionDigest: DIGEST,
      candidateCount: 1,
    },
    authorities: {
      catalogVersion: 'public-v1',
      catalogDigest: DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: DIGEST,
      specificationVersion: '1.0.0',
      specificationDigest: DIGEST,
      rendererVersion: 'repository-interview-renderer-v1',
      providerOutputSchemaVersion: '1.0.0',
      providerOutputSchemaDigest: DIGEST,
      providerProjectionVersion: 'openai-responses-strict-v1',
      providerProjectionDigest: DIGEST,
      modelProfileDigest: DIGEST,
      operatorPolicyDigest: DIGEST,
      pricingAuthorityDate: '2026-07-31',
      pricingAuthorityDigest: DIGEST,
    },
    database: {
      postgresqlVersion: '18.4',
      latestMigrationVersion: 4,
      migrationInventoryDigest: DIGEST,
      migrationCount: 4,
    },
    executionPolicy: {
      executionMode: 'normal' as const,
      forceReasonCode: null,
      concurrency: 1 as const,
      candidateDeadlineMilliseconds: 300_000,
      runDeadlineMilliseconds: 600_000,
      maximumRunInputTokens: 1,
      maximumRunCachedInputTokens: 1,
      maximumRunOutputTokens: 1,
      maximumRunReasoningTokens: 1,
      maximumRunTotalTokens: 2,
      maximumRunCostMicroUsd: 1,
      immediateReuseRequested: true,
    },
    counts: {
      requestedCandidates: 1,
      startedCandidates: 0,
      completedCandidates: 0,
      reusedCandidates: 0,
      createdCandidates: 0,
      idempotentCandidates: 0,
      providerFailedCandidates: 0,
      applicationFailedCandidates: 0,
      persistenceFailedCandidates: 0,
      notStartedCandidates: 1,
      providerCalls: 0,
      providerAttempts: 0,
      providerRetries: 0,
    },
    semanticCounts: {
      interviews: 0,
      claims: 0,
      citations: 0,
      limitations: 0,
      contradictions: 0,
      unknowns: 0,
    },
    usage: {
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
    },
    cost: {
      currency: 'USD' as const,
      unit: 'micro-usd' as const,
      totalMicroUsd: 0,
      maximumMicroUsd: 1,
    },
    providerSummary: {
      responses: 0,
      networkErrors: 0,
      deadlines: 0,
      cancellations: 0,
      refusals: 0,
      incomplete: 0,
      safetyInterruptions: 0,
      rateLimited: 0,
      quotaExceeded: 0,
      providerErrors: 0,
      invalidResponses: 0,
      invalidUsage: 0,
      responseTooLarge: 0,
      minimumRemainingRequests: null,
      minimumRemainingTokens: null,
      maximumResetRequestsMilliseconds: null,
      maximumResetTokensMilliseconds: null,
    },
    candidateResults: [],
    immediateReuse: {
      requested: true as const,
      passed: false,
      candidateCount: 1,
      reusedCount: 0,
      providerCalls: 0,
      providerAttempts: 0,
      tokenUsage: 0,
      costMicroUsd: 0,
    },
    telemetry: { eventCount: 0, telemetryFailureCount: 0 },
  };
}
