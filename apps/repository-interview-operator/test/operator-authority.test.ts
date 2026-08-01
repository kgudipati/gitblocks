import { describe, expect, it } from 'vitest';

import {
  calculateRepositoryInterviewUsageCostMicroUsdV1,
  calculateRepositoryInterviewWorstCaseV1,
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewOperatorSelectionV1,
  parseRepositoryInterviewOperatorPolicyV1,
  parseRepositoryInterviewOperatorSelectionV1,
  validateRepositoryInterviewOperatorPreflightV1,
} from '../src/index.ts';

const DIGEST = 'a'.repeat(64);

function selection() {
  return {
    schemaVersion: '1.0.0' as const,
    selectionId: 'phase-7-test',
    catalogVersion: 'public-v1',
    catalogDigest: DIGEST,
    artifactManifestVersion: 'public-v1',
    artifactManifestDigest: DIGEST,
    members: [
      {
        ordinal: 0,
        candidateId: 'candidate-one',
        artifactSetId: `artifact-set-${'b'.repeat(48)}`,
        artifactSetIdentityDigest: DIGEST,
      },
    ],
    selectionDigest: '',
  };
}

describe('operator authority red-first boundary', () => {
  it('derives and then verifies a closed selection digest', () => {
    const draft = selection();
    const created = createRepositoryInterviewOperatorSelectionV1({
      ...draft,
      selectionDigest: undefined,
    });
    const parsed = parseRepositoryInterviewOperatorSelectionV1(created);
    expect(parsed.ok).toBe(true);
    expect(Object.isFrozen(parsed.ok ? parsed.value.members : null)).toBe(true);
    expect(
      parseRepositoryInterviewOperatorSelectionV1({
        ...created,
        extra: true,
      }).ok,
    ).toBe(false);
  });

  it('rejects an accessor without invoking it', () => {
    let invoked = false;
    const value = selection();
    Object.defineProperty(value, 'members', {
      enumerable: true,
      get() {
        invoked = true;
        return [];
      },
    });
    expect(parseRepositoryInterviewOperatorSelectionV1(value).ok).toBe(false);
    expect(invoked).toBe(false);
  });

  it('uses exact ceiling arithmetic and does not double-charge reasoning', () => {
    expect(
      calculateRepositoryInterviewUsageCostMicroUsdV1(
        {
          inputTokens: 11,
          cachedInputTokens: 10,
          outputTokens: 3,
          reasoningTokens: 2,
          totalTokens: 14,
        },
        {
          inputMicroUsdPerMillionTokens: 1_000_000,
          cachedInputMicroUsdPerMillionTokens: 100_000,
          outputMicroUsdPerMillionTokens: 2_000_000,
        },
      ),
    ).toBe(8);
  });

  it('budgets the more expensive of cached and uncached input pricing', () => {
    const profile = modelProfile();
    const draft = policyDraft(profile);
    const policy = createRepositoryInterviewOperatorPolicyV1(
      {
        ...draft,
        maximumRunCostMicroUsd: 17_192,
        pricing: {
          ...draft.pricing,
          inputMicroUsdPerMillionTokens: 1_000_000,
          cachedInputMicroUsdPerMillionTokens: 9_000_000,
          outputMicroUsdPerMillionTokens: 1_000_000,
        },
      },
      profile,
    );
    expect(
      calculateRepositoryInterviewWorstCaseV1(1, policy).costMicroUsd,
    ).toBe(17_192);
  });

  it('fails closed on an unauthenticated policy', () => {
    expect(parseRepositoryInterviewOperatorPolicyV1({}).ok).toBe(false);
  });

  it.each([1, 30, 150])(
    'accepts an exact sorted %i-member selection',
    (count) => {
      const members = Array.from({ length: count }, (_, ordinal) => ({
        ordinal,
        candidateId: `candidate-${String(ordinal).padStart(3, '0')}`,
        artifactSetId: `artifact-set-${ordinal.toString(16).padStart(48, '0')}`,
        artifactSetIdentityDigest: ordinal.toString(16).padStart(64, '0'),
      }));
      expect(
        createRepositoryInterviewOperatorSelectionV1({
          schemaVersion: '1.0.0',
          selectionId: `selection-${String(count)}`,
          catalogVersion: 'public-v1',
          catalogDigest: DIGEST,
          artifactManifestVersion: 'public-artifacts-v1',
          artifactManifestDigest: DIGEST,
          members,
        }).members,
      ).toHaveLength(count);
    },
  );

  it('rejects duplicate, unsorted, ordinal-gap, sparse, and digest-drift selection authority', () => {
    const valid = createRepositoryInterviewOperatorSelectionV1({
      ...selection(),
      members: [selection().members[0]!],
      selectionDigest: undefined,
    });
    const second = {
      ordinal: 1,
      candidateId: 'candidate-two',
      artifactSetId: `artifact-set-${'c'.repeat(48)}`,
      artifactSetIdentityDigest: 'c'.repeat(64),
    };
    const mutations = [
      {
        ...valid,
        members: [
          valid.members[0],
          { ...second, candidateId: valid.members[0]!.candidateId },
        ],
      },
      {
        ...valid,
        members: [
          { ...second, ordinal: 0 },
          { ...valid.members[0], ordinal: 1 },
        ],
      },
      { ...valid, members: [{ ...valid.members[0], ordinal: 1 }] },
      { ...valid, selectionDigest: 'f'.repeat(64) },
    ];
    for (const mutation of mutations) {
      expect(parseRepositoryInterviewOperatorSelectionV1(mutation).ok).toBe(
        false,
      );
    }
    const sparse = new Array(1);
    expect(
      parseRepositoryInterviewOperatorSelectionV1({ ...valid, members: sparse })
        .ok,
    ).toBe(false);
  });

  it('binds model/profile policy authority and all conservative token dimensions', () => {
    const profile = modelProfile();
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile),
      profile,
    );
    const worstCase = calculateRepositoryInterviewWorstCaseV1(1, policy);
    expect(worstCase).toMatchObject({
      inputTokens: 1_000,
      cachedInputTokens: 1_000,
      outputTokens: 8_192,
      reasoningTokens: 8_192,
      totalTokens: 9_192,
    });
    expect(
      parseRepositoryInterviewOperatorPolicyV1(
        { ...policy, policyDigest: 'f'.repeat(64) },
        profile,
      ).ok,
    ).toBe(false);
    expect(
      validateRepositoryInterviewOperatorPreflightV1(
        createRepositoryInterviewOperatorSelectionV1({
          ...selection(),
          selectionDigest: undefined,
        }),
        policy,
        { ...profile, modelSnapshot: 'gpt-5.4-mini' },
      ).ok,
    ).toBe(false);
    expect(
      validateRepositoryInterviewOperatorPreflightV1(
        createRepositoryInterviewOperatorSelectionV1({
          ...selection(),
          selectionDigest: undefined,
        }),
        policy,
        { ...profile, modelSnapshot: 'synthetic-model-2026-03-17' },
      ).ok,
    ).toBe(false);
  });

  it('rejects concurrency, output-profile, cached/reasoning, candidate, and cost-ceiling drift', () => {
    const profile = modelProfile();
    const valid = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(profile),
      profile,
    );
    const drafts = [
      { ...policyDraft(profile), concurrency: 3 },
      { ...policyDraft(profile), maximumOutputTokensPerProviderCall: 8_191 },
      { ...policyDraft(profile), maximumCandidates: 151 },
      { ...policyDraft(profile), maximumRunCostMicroUsd: 120_000_001 },
    ];
    for (const draft of drafts) {
      expect(() =>
        createRepositoryInterviewOperatorPolicyV1(
          draft as Parameters<
            typeof createRepositoryInterviewOperatorPolicyV1
          >[0],
          profile,
        ),
      ).toThrow('policy is invalid');
    }
    for (const draft of [
      { ...policyDraft(profile), maximumRunCachedInputTokens: 999 },
      { ...policyDraft(profile), maximumRunReasoningTokens: 8_191 },
    ]) {
      const constrained = createRepositoryInterviewOperatorPolicyV1(
        draft,
        profile,
      );
      expect(() =>
        calculateRepositoryInterviewWorstCaseV1(1, constrained),
      ).toThrow('Worst-case run exceeds policy');
    }
    expect(Object.isFrozen(valid.pricing)).toBe(true);
  });
});

function modelProfile() {
  return {
    provider: 'openai' as const,
    endpointProfile: 'responses-v1' as const,
    modelSnapshot: 'gpt-5.4-mini-2026-03-17',
    providerProjectionVersion: '1.0.0',
    providerProjectionDigest:
      '5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7',
    reasoningEffort: 'low' as const,
    maximumOutputTokens: 8_192,
    maximumResponseBytes: 2_097_152,
    store: false as const,
    toolsEnabled: false as const,
    background: false as const,
    conversationState: false as const,
    previousResponseState: false as const,
    truncation: 'disabled' as const,
    promptCacheRetention: 'in-memory' as const,
    serviceTier: 'default' as const,
    retryPolicyVersion: 'repository-interview-retry-v1' as const,
  };
}

function policyDraft(profile: ReturnType<typeof modelProfile>) {
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
      inputMicroUsdPerMillionTokens: 1,
      cachedInputMicroUsdPerMillionTokens: 1,
      outputMicroUsdPerMillionTokens: 1,
      pricingAuthorityDate: '2026-07-31',
      pricingAuthorityDigest: DIGEST,
    },
  };
}
