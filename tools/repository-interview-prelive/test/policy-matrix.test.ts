import type { ModelExecutionModelProfileV1 } from '@gitblocks/contracts';
import {
  createRepositoryInterviewOperatorPolicyV1,
  type RepositoryInterviewOperatorPolicyV1,
} from '@gitblocks/repository-interview-operator';
import { describe, expect, it } from 'vitest';

import {
  buildRepositoryInterviewPreliveExpectedV1,
  validateRepositoryInterviewPrelivePolicyMatrixV1,
} from '../src/index.ts';

const PRICING_DIGEST = '9'.repeat(64);

describe('synthetic repository interview policy matrix', () => {
  it('closes 6/30/150 plans for both profiles at concurrency one and two', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const rows = [
      [expected.plans.calibration, 6, 10_000_000],
      [expected.plans.gateA, 30, 40_000_000],
      [expected.plans.gateB, 150, 120_000_000],
    ] as const;
    for (const [plan, count, ceiling] of rows) {
      for (const profile of expected.profiles) {
        for (const concurrency of [1, 2] as const) {
          const policy = createRepositoryInterviewOperatorPolicyV1(
            policyDraft(profile, count, concurrency, ceiling),
            profile,
          );
          const worstCase = validateRepositoryInterviewPrelivePolicyMatrixV1(
            plan,
            policy,
            profile,
          );
          expect(worstCase).toMatchObject({
            candidateCount: count,
            outputTokens: count * 8_192,
            reasoningTokens: count * 8_192,
          });
          expect(worstCase.inputTokens).toBe(count * 1_000);
          expect(worstCase.cachedInputTokens).toBe(count * 1_000);
          expect(worstCase.totalTokens).toBe(count * 9_192);
          expect(worstCase.costMicroUsd).toBeLessThanOrEqual(ceiling);
        }
      }
    }
  });

  it('rejects one micro-dollar over the applicable ceiling and one token under every run budget', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const profile = expected.profiles[0];
    const base = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile, 6, 1, 10_000_000),
      profile,
    );
    const overCost = recreate(base, profile, {
      maximumRunCostMicroUsd: 10_000_001,
    });
    expect(() =>
      validateRepositoryInterviewPrelivePolicyMatrixV1(
        expected.plans.calibration,
        overCost,
        profile,
      ),
    ).toThrow('synthetic policy is invalid');

    const boundaries: (keyof Pick<
      RepositoryInterviewOperatorPolicyV1,
      | 'maximumRunInputTokens'
      | 'maximumRunCachedInputTokens'
      | 'maximumRunOutputTokens'
      | 'maximumRunReasoningTokens'
      | 'maximumRunTotalTokens'
    >)[] = [
      'maximumRunInputTokens',
      'maximumRunCachedInputTokens',
      'maximumRunOutputTokens',
      'maximumRunReasoningTokens',
      'maximumRunTotalTokens',
    ];
    for (const field of boundaries) {
      const dependentChanges =
        field === 'maximumRunInputTokens'
          ? {
              maximumRunCachedInputTokens: base.maximumRunCachedInputTokens - 1,
            }
          : field === 'maximumRunOutputTokens'
            ? {
                maximumRunReasoningTokens: base.maximumRunReasoningTokens - 1,
              }
            : {};
      const policy = recreate(base, profile, {
        ...dependentChanges,
        [field]: base[field] - 1,
      });
      expect(() =>
        validateRepositoryInterviewPrelivePolicyMatrixV1(
          expected.plans.calibration,
          policy,
          profile,
        ),
      ).toThrow('synthetic policy is invalid');
    }
  });

  it('does not let one model profile authorize the other', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(expected.profiles[0], 6, 1, 10_000_000),
      expected.profiles[0],
    );
    expect(() =>
      validateRepositoryInterviewPrelivePolicyMatrixV1(
        expected.plans.calibration,
        policy,
        expected.profiles[1],
      ),
    ).toThrow('synthetic policy is invalid');
  });
});

function policyDraft(
  profile: ModelExecutionModelProfileV1,
  count: number,
  concurrency: 1 | 2,
  maximumRunCostMicroUsd: number,
) {
  return {
    schemaVersion: '1.0.0' as const,
    policyId: `synthetic-${String(count)}-${String(concurrency)}-policy`,
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
    maximumRunCostMicroUsd,
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

function recreate(
  policy: RepositoryInterviewOperatorPolicyV1,
  profile: ModelExecutionModelProfileV1,
  changed: Partial<RepositoryInterviewOperatorPolicyV1>,
): RepositoryInterviewOperatorPolicyV1 {
  const { policyDigest: _discarded, ...draft } = policy;
  void _discarded;
  return createRepositoryInterviewOperatorPolicyV1(
    { ...draft, ...changed },
    profile,
  );
}
