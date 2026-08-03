import type {
  ModelExecutionAttemptV1,
  ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import {
  loadRepositoryInterviewSpecification,
  REPOSITORY_INTERVIEW_TOPICS,
  type RepositoryInterviewPublicationCommandV1,
  type RepositoryInterviewReuseLookupV1,
} from '@gitblocks/interviews';
import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewOperatorSelectionV1,
  runRepositoryInterviewOperatorV1,
  type RepositoryInterviewOperatorPersistencePortV1,
} from '@gitblocks/repository-interview-operator';
import { describe, expect, it } from 'vitest';

import { buildRepositoryInterviewPreliveExpectedV1 } from '../src/index.ts';
import { syntheticArtifactAuthorityV1 } from './prelive-fixtures.ts';

const PRICING_DIGEST = '8'.repeat(64);

describe('synthetic repository interview execution scale', () => {
  it('runs six candidates for both profiles at concurrency one and two with exact zero-call reuse', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    for (const profile of expected.profiles) {
      for (const concurrency of [1, 2] as const) {
        const result = await executePlan(
          expected.plans.calibration.candidateIds,
          profile,
          concurrency,
          {},
        );
        expect(result.providerCalls).toBe(6);
        expect(result.maximumActive).toBeLessThanOrEqual(concurrency);
        expect(result.receipt?.counts).toMatchObject({
          requestedCandidates: 6,
          completedCandidates: 6,
          providerCalls: 6,
          providerAttempts: 6,
        });
        expect(result.receipt?.immediateReuse).toMatchObject({
          requested: true,
          passed: true,
          candidateCount: 6,
          reusedCount: 6,
          providerCalls: 0,
          providerAttempts: 0,
          tokenUsage: 0,
          costMicroUsd: 0,
        });
      }
    }
  });

  it('runs thirty candidates with bounded concurrency and canonical results', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    for (const concurrency of [1, 2] as const) {
      const result = await executePlan(
        expected.plans.gateA.candidateIds,
        expected.profiles[1],
        concurrency,
        { reverseDelay: concurrency === 2 },
      );
      expect(result.providerCalls).toBe(30);
      expect(result.maximumActive).toBeLessThanOrEqual(concurrency);
      expect(
        result.receipt?.candidateResults.map(({ candidateId }) => candidateId),
      ).toEqual(expected.plans.gateA.candidateIds);
      expect(result.receipt?.immediateReuse).toMatchObject({
        passed: true,
        reusedCount: 30,
        providerCalls: 0,
      });
    }
  });

  it('runs 150 with no third active candidate and a deterministic receipt across equivalent interleavings', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const first = await executePlan(
      expected.plans.gateB.candidateIds,
      expected.profiles[1],
      2,
      {},
    );
    const second = await executePlan(
      expected.plans.gateB.candidateIds,
      expected.profiles[1],
      2,
      { reverseDelay: true },
    );
    expect(first.maximumActive).toBe(2);
    expect(second.maximumActive).toBe(2);
    expect(first.providerCalls).toBe(150);
    expect(first.receipt?.counts).toMatchObject({
      requestedCandidates: 150,
      completedCandidates: 150,
      providerCalls: 150,
      providerAttempts: 150,
      providerRetries: 0,
    });
    expect(first.receipt?.immediateReuse).toMatchObject({
      passed: true,
      candidateCount: 150,
      reusedCount: 150,
      providerCalls: 0,
      providerAttempts: 0,
    });
    expect(first.receipt?.receiptDigest).toBe(second.receipt?.receiptDigest);
  });

  it('stops a thirty-candidate fixture before later assignment after failure, deadline, or budget exhaustion', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    for (const scenario of [
      {
        failAt: 9,
        stopAt: 9,
        stopCode: 'rate-limited',
        verifyImmediateReuse: false,
      },
      {
        deadlineAt: 9,
        stopAt: 9,
        stopCode: 'candidate-deadline',
        receiptExpected: false,
        verifyImmediateReuse: false,
      },
      {
        overBudgetAt: 9,
        stopAt: 9,
        stopCode: 'budget-exhausted',
        verifyImmediateReuse: false,
      },
    ] as const) {
      const result = await executePlan(
        expected.plans.gateA.candidateIds,
        expected.profiles[1],
        1,
        scenario,
      );
      expect(result.providerCalls).toBe(10);
      expect(result.candidateStarts).toBe(10);
      if ('receiptExpected' in scenario) {
        expect(result.receipt).toBeNull();
        expect(result.issues[0]?.code).toBe('operator.application-failed');
        continue;
      }
      expect(
        result.receipt,
        JSON.stringify({ scenario, issues: result.issues }),
      ).not.toBeNull();
      expect(result.receipt?.candidateResults).toHaveLength(10);
      expect(result.receipt?.stopCode).toBe(scenario.stopCode);
      expect(
        result.receipt?.candidateResults.some(
          ({ ordinal }) => ordinal > scenario.stopAt,
        ),
      ).toBe(false);
    }
  });
});

interface ExecutePlanOptions {
  readonly reverseDelay?: boolean;
  readonly failAt?: number;
  readonly deadlineAt?: number;
  readonly overBudgetAt?: number;
  readonly verifyImmediateReuse?: boolean;
}

async function executePlan(
  candidateIds: readonly string[],
  profile: ModelExecutionModelProfileV1,
  concurrency: 1 | 2,
  options: ExecutePlanOptions,
) {
  const fixture = await syntheticArtifactAuthorityV1();
  const specification = await loadRepositoryInterviewSpecification(
    'interviews/repository/specifications/1.0.0',
  );
  const byCandidate = new Map(
    [...fixture.sets.values()].map((set) => [set.candidateId, set]),
  );
  const selection = createRepositoryInterviewOperatorSelectionV1({
    schemaVersion: '1.0.0',
    selectionId: `synthetic-scale-${String(candidateIds.length)}-selection`,
    catalogVersion: 'public-v1',
    catalogDigest: fixture.catalog.manifestDigest,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: fixture.artifactManifest.manifestDigest,
    members: candidateIds.map((candidateId, ordinal) => {
      const set = byCandidate.get(candidateId)!;
      return {
        ordinal,
        candidateId,
        artifactSetId: set.artifactSetId,
        artifactSetIdentityDigest: set.identityDigest,
      };
    }),
  });
  const policy = createRepositoryInterviewOperatorPolicyV1(
    policyDraft(profile, candidateIds.length, concurrency),
    profile,
  );
  const stored = new Map<string, RepositoryInterviewPublicationCommandV1>();
  const persistence: RepositoryInterviewOperatorPersistencePortV1 = {
    verifyMigrations: () => Promise.resolve(migrationAuthority()),
    forCandidate: () => ({
      loadArtifactContext(member) {
        return Promise.resolve({
          artifactSet: byCandidate.get(member.candidateId)!,
          artifacts: [],
        });
      },
      record: {
        findReusable(lookup: RepositoryInterviewReuseLookupV1) {
          const record = stored.get(lookup.reuseKeyDigest);
          return Promise.resolve(
            record?.interview === null || record === undefined
              ? null
              : {
                  request: record.request,
                  execution: record.execution,
                  interview: record.interview,
                },
          );
        },
        publish(command) {
          stored.set(command.execution.reuseKeyDigest, command);
          return Promise.resolve({ status: 'created' as const });
        },
      },
    }),
  };
  let active = 0;
  let maximumActive = 0;
  let providerCalls = 0;
  let candidateStarts = 0;
  const controlOrdinals = new WeakMap<AbortSignal, number>();
  const controlOutcomes = new Map<number, 'active' | 'candidate-deadline'>();
  const result = await runRepositoryInterviewOperatorV1(
    {
      selection,
      specification,
      modelProfile: profile,
      policy,
      executionMode: 'normal',
      forceReason: null,
      verifyImmediateReuse: options.verifyImmediateReuse ?? true,
    },
    {
      persistence,
      provider: {
        forCandidate: (signal) => ({
          async execute() {
            providerCalls += 1;
            const ordinal = controlOrdinals.get(signal);
            if (ordinal === undefined) {
              throw new Error('Synthetic candidate control is missing.');
            }
            active += 1;
            maximumActive = Math.max(maximumActive, active);
            const shouldDelay = options.reverseDelay
              ? ordinal % 2 === 0
              : ordinal % 2 === 1;
            if (shouldDelay)
              await new Promise<void>((resolve) => {
                queueMicrotask(resolve);
              });
            active -= 1;
            if (options.deadlineAt === ordinal) {
              controlOutcomes.set(ordinal, 'candidate-deadline');
            }
            if (options.failAt === ordinal) {
              return {
                status: 'failed' as const,
                failureCode: 'rate-limited' as const,
                attempts: [{ ...attempt(), httpStatus: 429 }],
                usage: null,
              };
            }
            const inputTokens = options.overBudgetAt === ordinal ? 1_001 : 100;
            return {
              status: 'response' as const,
              providerOutputDiagnosticCode: null,
              attempts: [attempt()],
              usage: {
                inputTokens,
                cachedInputTokens: 20,
                outputTokens: 30,
                reasoningTokens: 10,
                totalTokens: inputTokens + 30,
              },
              providerOutput: providerOutput(),
            };
          },
        }),
      },
      candidateControl: {
        beginCandidate({ ordinal }) {
          candidateStarts += 1;
          const controller = new AbortController();
          controlOrdinals.set(controller.signal, ordinal);
          controlOutcomes.set(ordinal, 'active');
          return {
            signal: controller.signal,
            outcome: () => controlOutcomes.get(ordinal) ?? 'active',
            dispose: () => undefined,
          };
        },
      },
      clock: { now: () => '2026-08-01T20:00:00.000Z' },
      monotonicClock: { nowMilliseconds: () => 0 },
      nonce: { nextExecutionNonce: () => '1'.repeat(32) },
      runId: { nextRunId: () => `interview-run-${'2'.repeat(48)}` },
    },
  );
  if (
    options.failAt === undefined &&
    options.deadlineAt === undefined &&
    options.overBudgetAt === undefined
  ) {
    expect(result.ok).toBe(true);
  } else {
    expect(result.ok).toBe(false);
  }
  return {
    receipt: result.receipt,
    providerCalls,
    maximumActive,
    candidateStarts,
    issues: result.issues,
  };
}

function policyDraft(
  profile: ModelExecutionModelProfileV1,
  count: number,
  concurrency: 1 | 2,
) {
  return {
    schemaVersion: '1.0.0' as const,
    policyId: `synthetic-scale-${String(count)}-${String(concurrency)}`,
    maximumCandidates: count,
    concurrency,
    candidateDeadlineMilliseconds: 300_000,
    runDeadlineMilliseconds: 86_400_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
    maximumInputTokensPerProviderCall: 1_000,
    maximumOutputTokensPerProviderCall: 8_192,
    maximumRunInputTokens: count * 1_000,
    maximumRunCachedInputTokens: count * 1_000,
    maximumRunOutputTokens: count * 8_192,
    maximumRunReasoningTokens: count * 8_192,
    maximumRunTotalTokens: count * 9_192,
    maximumRunCostMicroUsd: 120_000_000,
    pricing: {
      provider: 'openai' as const,
      modelSnapshot: profile.modelSnapshot,
      inputMicroUsdPerMillionTokens: 100,
      cachedInputMicroUsdPerMillionTokens: 50,
      outputMicroUsdPerMillionTokens: 200,
      pricingAuthorityDate: '2026-08-01',
      pricingAuthorityDigest: PRICING_DIGEST,
    },
  };
}

function attempt(): ModelExecutionAttemptV1 {
  return {
    ordinal: 1,
    startedAt: '2026-08-01T20:00:00.000Z',
    completedAt: '2026-08-01T20:00:00.000Z',
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
      reason: 'not-documented' as const,
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
