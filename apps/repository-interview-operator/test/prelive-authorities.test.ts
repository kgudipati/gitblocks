import {
  modelExecutionModelProfileDigest,
  type ModelExecutionModelProfileV1,
} from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  createRepositoryInterviewCandidatePlanV1,
  createRepositoryInterviewPreliveAuthorizationV1,
  createRepositoryInterviewSelectionMaterializationV1,
  parseRepositoryInterviewCandidatePlanV1,
  parseRepositoryInterviewPreliveAuthorizationV1,
  parseRepositoryInterviewSelectionMaterializationV1,
} from '../src/index.ts';

const DIGEST_A = 'a'.repeat(64);
const DIGEST_B = 'b'.repeat(64);
const CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';
const ARTIFACT_MANIFEST_DIGEST =
  '17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c';

describe('repository interview pre-live operator authorities', () => {
  it('creates a closed, sorted, owned, deeply frozen candidate plan', () => {
    const candidateIds = ['auth-warrant', 'audit-datadog-trace-js'];
    const plan = createRepositoryInterviewCandidatePlanV1({
      schemaVersion: '1.0.0',
      planId: 'synthetic-candidate-plan',
      catalogVersion: 'public-v1',
      catalogDigest: CATALOG_DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: ARTIFACT_MANIFEST_DIGEST,
      candidateIds: [...candidateIds].sort(),
    });
    candidateIds[0] = 'mutated';

    expect(plan.candidateIds).toEqual([
      'audit-datadog-trace-js',
      'auth-warrant',
    ]);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.candidateIds)).toBe(true);
    expect(parseRepositoryInterviewCandidatePlanV1(plan)).toEqual({
      ok: true,
      value: plan,
      issues: [],
    });
    expect(
      parseRepositoryInterviewCandidatePlanV1({ ...plan, extra: true }).ok,
    ).toBe(false);
    expect(
      parseRepositoryInterviewCandidatePlanV1({
        ...plan,
        candidateIds: [...plan.candidateIds].reverse(),
      }).ok,
    ).toBe(false);
    expect(
      parseRepositoryInterviewCandidatePlanV1({
        ...plan,
        candidateIds: [plan.candidateIds[0], plan.candidateIds[0]],
      }).ok,
    ).toBe(false);
    expect(
      parseRepositoryInterviewCandidatePlanV1({
        ...plan,
        planDigest: DIGEST_A,
      }).ok,
    ).toBe(false);
  });

  it('rejects accessors, sparse arrays, exotic objects, symbols, and cycles without invoking accessors', () => {
    let invoked = false;
    const accessor = Object.defineProperty({}, 'schemaVersion', {
      enumerable: true,
      get() {
        invoked = true;
        return '1.0.0';
      },
    });
    expect(parseRepositoryInterviewCandidatePlanV1(accessor).ok).toBe(false);
    expect(invoked).toBe(false);

    const sparse: unknown[] = [];
    sparse.length = 1;
    expect(
      parseRepositoryInterviewCandidatePlanV1({ candidateIds: sparse }).ok,
    ).toBe(false);
    expect(
      parseRepositoryInterviewCandidatePlanV1(
        Object.create({ schemaVersion: '1.0.0' }),
      ).ok,
    ).toBe(false);
    expect(
      parseRepositoryInterviewCandidatePlanV1({
        [Symbol('sentinel')]: true,
      }).ok,
    ).toBe(false);
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    expect(parseRepositoryInterviewCandidatePlanV1(cyclic).ok).toBe(false);
  });

  it('binds a selection materialization without materialized member data', () => {
    const materialization = createRepositoryInterviewSelectionMaterializationV1(
      {
        schemaVersion: '1.0.0',
        materializationId: 'synthetic-materialization',
        candidatePlanId: 'synthetic-candidate-plan',
        candidatePlanDigest: DIGEST_A,
        artifactCollectionReceiptVersion: 'public-artifact-receipt/1.0.0',
        artifactCollectionReceiptDigest: DIGEST_B,
        catalogVersion: 'public-v1',
        catalogDigest: CATALOG_DIGEST,
        artifactManifestVersion: 'public-artifacts-v1',
        artifactManifestDigest: ARTIFACT_MANIFEST_DIGEST,
        operatorSelectionId: 'synthetic-selection',
        operatorSelectionDigest: DIGEST_A,
        candidateCount: 6,
      },
    );
    expect(
      parseRepositoryInterviewSelectionMaterializationV1(materialization).ok,
    ).toBe(true);
    expect(Object.keys(materialization).sort()).toEqual(
      [
        'schemaVersion',
        'materializationId',
        'candidatePlanId',
        'candidatePlanDigest',
        'artifactCollectionReceiptVersion',
        'artifactCollectionReceiptDigest',
        'catalogVersion',
        'catalogDigest',
        'artifactManifestVersion',
        'artifactManifestDigest',
        'operatorSelectionId',
        'operatorSelectionDigest',
        'candidateCount',
        'materializationDigest',
      ].sort(),
    );
    expect(JSON.stringify(materialization)).not.toContain('artifact-set-');
  });

  it('accepts only bounded calibration pre-live authorization syntax', () => {
    const profiles = [
      profile('gpt-5.4-2026-03-05'),
      profile('gpt-5.4-mini-2026-03-17'),
    ];
    const profileDigests = profiles
      .map(modelExecutionModelProfileDigest)
      .sort() as [string, string];
    const authorization = createRepositoryInterviewPreliveAuthorizationV1({
      schemaVersion: '1.0.0',
      authorizationId: 'synthetic-calibration-authorization',
      scope: 'calibration-six',
      status: 'approved',
      candidatePlanId: 'repository-interview-calibration-six-v1',
      candidatePlanDigest: DIGEST_A,
      artifactCollectionReceiptVersion: 'public-artifact-receipt/1.0.0',
      artifactCollectionReceiptDigest: DIGEST_B,
      selectionMaterializationDigest: DIGEST_A,
      selectionId: 'synthetic-selection',
      selectionDigest: DIGEST_B,
      allowedModelProfileDigests: profileDigests,
      specificationDigest: DIGEST_A,
      catalogDigest: CATALOG_DIGEST,
      artifactManifestDigest: ARTIFACT_MANIFEST_DIGEST,
      operatorPolicyDigest: DIGEST_A,
      pricingAuthorityDigest: DIGEST_B,
      retentionAuthorityDigest: DIGEST_A,
      databaseScope: 'ephemeral-non-production',
      maximumProviderCalls: 12,
      maximumCostMicroUsd: 10_000_000,
      authorizedAt: '2026-08-02T00:00:00.000Z',
      expiresAt: '2026-08-03T00:00:00.000Z',
    });
    expect(
      parseRepositoryInterviewPreliveAuthorizationV1(authorization).ok,
    ).toBe(true);
    for (const invalid of [
      { ...authorization, scope: 'gate-a-thirty' },
      { ...authorization, maximumProviderCalls: 13 },
      { ...authorization, maximumCostMicroUsd: 10_000_001 },
      { ...authorization, expiresAt: authorization.authorizedAt },
      { ...authorization, authorizationDigest: DIGEST_A },
    ]) {
      expect(parseRepositoryInterviewPreliveAuthorizationV1(invalid).ok).toBe(
        false,
      );
    }
  });
});

function profile(modelSnapshot: string): ModelExecutionModelProfileV1 {
  return {
    provider: 'openai',
    endpointProfile: 'responses-v1',
    modelSnapshot,
    providerProjectionVersion: '1.0.0',
    providerProjectionDigest:
      '5d81e5e32cc4871f0068f691302282a4e5dd6dc656ee4be132c050fbc4228ed7',
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
