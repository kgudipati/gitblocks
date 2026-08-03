import {
  modelExecutionModelProfileDigest,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  createRepositoryInterviewOperatorPolicyV1,
  createRepositoryInterviewPreliveAuthorizationV1,
} from '@gitblocks/repository-interview-operator';

import {
  buildRepositoryInterviewPreliveExpectedV1,
  materializeRepositoryInterviewOperatorSelectionV1,
  validateRepositoryInterviewPreliveAuthorizationClosureV1,
} from '../src/index.ts';
import { syntheticArtifactAuthorityV1 } from './prelive-fixtures.ts';

const PRICING_DIGEST = 'b'.repeat(64);
const RETENTION_DIGEST = 'c'.repeat(64);

describe('repository interview pre-live authorization closure', () => {
  it('accepts exact synthetic calibration authority and rejects every changed authority before effects', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const fixture = await syntheticArtifactAuthorityV1();
    const materialized =
      await materializeRepositoryInterviewOperatorSelectionV1(
        {
          candidatePlan: expected.plans.calibration,
          artifactReceipt: fixture.receipt,
          fullCatalogCandidateIds: fixture.candidateIds,
          selectionId: 'synthetic-calibration-selection',
        },
        {
          loadRepositoryArtifactSet(artifactSetId) {
            return Promise.resolve(fixture.sets.get(artifactSetId)!);
          },
        },
      );
    const modelProfile = expected.profiles[0];
    const policy = createRepositoryInterviewOperatorPolicyV1(
      policyDraft(modelProfile),
      modelProfile,
    );
    const allowed = expected.profiles
      .map(modelExecutionModelProfileDigest)
      .sort() as [string, string];
    const authorization = createRepositoryInterviewPreliveAuthorizationV1({
      schemaVersion: '1.0.0',
      authorizationId: 'synthetic-calibration-authorization',
      scope: 'calibration-six',
      status: 'approved',
      candidatePlanId: expected.plans.calibration.planId,
      candidatePlanDigest: expected.plans.calibration.planDigest,
      artifactCollectionReceiptVersion: fixture.receipt.receiptVersion,
      artifactCollectionReceiptDigest: fixture.receipt.receiptDigest,
      selectionMaterializationDigest:
        materialized.materialization.materializationDigest,
      selectionId: materialized.selection.selectionId,
      selectionDigest: materialized.selection.selectionDigest,
      allowedModelProfileDigests: allowed,
      specificationDigest: expected.manifest.specificationDigest,
      catalogDigest: expected.manifest.catalogDigest,
      artifactManifestDigest: expected.manifest.artifactManifestDigest,
      operatorPolicyDigest: policy.policyDigest,
      pricingAuthorityDigest: PRICING_DIGEST,
      retentionAuthorityDigest: RETENTION_DIGEST,
      databaseScope: 'ephemeral-non-production',
      maximumProviderCalls: 12,
      maximumCostMicroUsd: 10_000_000,
      authorizedAt: '2026-08-02T00:00:00.000Z',
      expiresAt: '2026-08-03T00:00:00.000Z',
    });
    const input = {
      candidatePlan: expected.plans.calibration,
      calibrationCandidatePlan: expected.plans.calibration,
      artifactReceipt: fixture.receipt,
      fullCatalogCandidateIds: fixture.candidateIds,
      selection: materialized.selection,
      materialization: materialized.materialization,
      authorization,
      modelProfile,
      operatorPolicy: policy,
      allowedModelProfileDigests: allowed,
      specificationDigest: expected.manifest.specificationDigest,
      now: '2026-08-02T12:00:00.000Z',
    };
    expect(
      validateRepositoryInterviewPreliveAuthorizationClosureV1(input)
        .authorization.authorizationDigest,
    ).toBe(authorization.authorizationDigest);

    for (const changed of [
      {
        authorization: {
          ...authorization,
          candidatePlanDigest: 'd'.repeat(64),
        },
      },
      {
        authorization: {
          ...authorization,
          artifactCollectionReceiptDigest: 'd'.repeat(64),
        },
      },
      {
        authorization: {
          ...authorization,
          selectionMaterializationDigest: 'd'.repeat(64),
        },
      },
      { authorization: { ...authorization, selectionDigest: 'd'.repeat(64) } },
      {
        authorization: {
          ...authorization,
          allowedModelProfileDigests: ['d'.repeat(64), 'e'.repeat(64)],
        },
      },
      {
        authorization: {
          ...authorization,
          operatorPolicyDigest: 'd'.repeat(64),
        },
      },
      {
        authorization: {
          ...authorization,
          pricingAuthorityDigest: 'd'.repeat(64),
        },
      },
      {
        authorization: {
          ...authorization,
          retentionAuthorityDigest: 'd'.repeat(64),
        },
      },
      { now: '2026-08-03T00:00:00.000Z' },
      { now: '2026-08-01T23:59:59.999Z' },
    ]) {
      expect(() =>
        validateRepositoryInterviewPreliveAuthorizationClosureV1({
          ...input,
          ...changed,
        }),
      ).toThrow('authorization closure is invalid');
    }
  });

  it('cannot apply calibration authorization to the 30- or 150-member plans', async () => {
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    expect(expected.plans.gateA.planId).not.toBe(
      'repository-interview-calibration-six-v1',
    );
    expect(expected.plans.gateB.planId).not.toBe(
      'repository-interview-calibration-six-v1',
    );
  });
});

function policyDraft(profile: ModelExecutionModelProfileV1) {
  return {
    schemaVersion: '1.0.0' as const,
    policyId: 'synthetic-calibration-policy',
    maximumCandidates: 6,
    concurrency: 1 as const,
    candidateDeadlineMilliseconds: 300_000,
    runDeadlineMilliseconds: 86_400_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
    maximumInputTokensPerProviderCall: 1_000,
    maximumOutputTokensPerProviderCall: 8_192,
    maximumRunInputTokens: 6_000,
    maximumRunCachedInputTokens: 6_000,
    maximumRunOutputTokens: 49_152,
    maximumRunReasoningTokens: 49_152,
    maximumRunTotalTokens: 55_152,
    maximumRunCostMicroUsd: 10_000_000,
    pricing: {
      provider: 'openai' as const,
      modelSnapshot: profile.modelSnapshot,
      inputMicroUsdPerMillionTokens: 10,
      cachedInputMicroUsdPerMillionTokens: 5,
      outputMicroUsdPerMillionTokens: 20,
      pricingAuthorityDate: '2026-08-01',
      pricingAuthorityDigest: PRICING_DIGEST,
    },
  };
}
