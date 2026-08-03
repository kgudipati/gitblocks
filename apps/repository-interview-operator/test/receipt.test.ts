import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import {
  createRepositoryInterviewOperatorReceiptV1,
  parseRepositoryInterviewOperatorReceiptV1,
  repositoryInterviewOperatorReceiptDigestV1,
  serializeRepositoryInterviewOperatorReceiptV1,
} from '../src/index.ts';

const DIGEST = 'a'.repeat(64);

describe('operator receipt authority', () => {
  it('keeps the accepted receipt schema snapshot byte-identical', async () => {
    const snapshot = await readFile(
      'apps/repository-interview-operator/schemas/repository-interview-operator-receipt-v1.schema.json',
    );
    expect(createHash('sha256').update(snapshot).digest('hex')).toBe(
      '934ba36ee7bf6640b1886507123978e0421dc56bc98c2fe02583f31a402187c5',
    );
  });

  it('parses, owns, freezes, and digest-binds a closed content-free receipt', () => {
    const draft = receiptDraft();
    const receipt = createRepositoryInterviewOperatorReceiptV1(draft);
    expect(receipt.receiptDigest).toBe(
      repositoryInterviewOperatorReceiptDigestV1(draft),
    );
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.candidateResults)).toBe(true);
    expect(Object.isFrozen(receipt.candidateResults[0]?.usage)).toBe(true);
    expect(serializeRepositoryInterviewOperatorReceiptV1(receipt)).not.toMatch(
      /prompt sentinel|artifact sentinel|provider sentinel|postgresql:\/\//u,
    );
  });

  it('rejects nested open objects and status-dependent provenance drift', () => {
    const receipt = createRepositoryInterviewOperatorReceiptV1(receiptDraft());
    expect(
      parseRepositoryInterviewOperatorReceiptV1({
        ...receipt,
        selection: { ...receipt.selection, unexpected: true },
        receiptDigest: DIGEST,
      }).ok,
    ).toBe(false);
    expect(
      parseRepositoryInterviewOperatorReceiptV1({
        ...receipt,
        candidateResults: [
          { ...receipt.candidateResults[0], interviewRecordDigest: null },
        ],
        receiptDigest: DIGEST,
      }).ok,
    ).toBe(false);
  });

  it('rejects a nested accessor without invocation', () => {
    const receipt = createRepositoryInterviewOperatorReceiptV1(receiptDraft());
    let invoked = false;
    const selection = { ...receipt.selection };
    Object.defineProperty(selection, 'selectionDigest', {
      enumerable: true,
      get() {
        invoked = true;
        return DIGEST;
      },
    });
    expect(
      parseRepositoryInterviewOperatorReceiptV1({
        ...receipt,
        selection,
      }).ok,
    ).toBe(false);
    expect(invoked).toBe(false);
  });

  it('changes its digest with execution or aggregate-usage authority', () => {
    const first = createRepositoryInterviewOperatorReceiptV1(receiptDraft());
    const secondDraft = receiptDraft();
    secondDraft.candidateResults[0]!.executionId = `modelexec-${'b'.repeat(48)}`;
    const second = createRepositoryInterviewOperatorReceiptV1(secondDraft);
    expect(second.receiptDigest).not.toBe(first.receiptDigest);

    const thirdDraft = receiptDraft();
    thirdDraft.candidateResults[0]!.usage = {
      inputTokens: 2,
      cachedInputTokens: 0,
      outputTokens: 1,
      reasoningTokens: 0,
      totalTokens: 3,
    };
    thirdDraft.usage = { ...thirdDraft.candidateResults[0]!.usage };
    const third = createRepositoryInterviewOperatorReceiptV1(thirdDraft);
    expect(third.receiptDigest).not.toBe(first.receiptDigest);
  });
});

function receiptDraft() {
  return {
    schemaVersion: '1.0.0' as const,
    kind: 'repository-interview-operator-receipt' as const,
    runId: `interview-run-${'1'.repeat(48)}`,
    startedAt: '2026-07-31T12:00:00.000Z',
    completedAt: '2026-07-31T12:00:01.000Z',
    durationMilliseconds: 1_000,
    status: 'completed' as const,
    stopCode: null,
    selection: {
      selectionId: 'synthetic-selection',
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
      maximumRunInputTokens: 1_000,
      maximumRunCachedInputTokens: 1_000,
      maximumRunOutputTokens: 8_192,
      maximumRunReasoningTokens: 8_192,
      maximumRunTotalTokens: 9_192,
      maximumRunCostMicroUsd: 120_000_000,
      immediateReuseRequested: false,
    },
    counts: {
      requestedCandidates: 1,
      startedCandidates: 1,
      completedCandidates: 1,
      reusedCandidates: 0,
      createdCandidates: 1,
      idempotentCandidates: 0,
      providerFailedCandidates: 0,
      applicationFailedCandidates: 0,
      persistenceFailedCandidates: 0,
      notStartedCandidates: 0,
      providerCalls: 1,
      providerAttempts: 1,
      providerRetries: 0,
    },
    semanticCounts: {
      interviews: 1,
      claims: 0,
      citations: 0,
      limitations: 0,
      contradictions: 0,
      unknowns: 1,
    },
    usage: {
      inputTokens: 1,
      cachedInputTokens: 0,
      outputTokens: 1,
      reasoningTokens: 0,
      totalTokens: 2,
    },
    cost: {
      currency: 'USD' as const,
      unit: 'micro-usd' as const,
      totalMicroUsd: 1,
      maximumMicroUsd: 120_000_000,
    },
    providerSummary: {
      responses: 1,
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
    candidateResults: [
      {
        ordinal: 0,
        candidateId: 'synthetic-candidate',
        artifactSetId: `artifact-set-${'2'.repeat(48)}`,
        artifactSetIdentityDigest: DIGEST,
        status: 'completed' as const,
        disposition: 'created' as const,
        failureCode: null,
        requestId: `intreq-${'3'.repeat(48)}`,
        requestRecordDigest: DIGEST,
        executionId: `modelexec-${'4'.repeat(48)}`,
        executionRecordDigest: DIGEST,
        interviewId: `interview-${'5'.repeat(48)}`,
        interviewRecordDigest: DIGEST,
        attemptCount: 1,
        retryCount: 0,
        publicationStatus: 'created' as const,
        claims: 0,
        citations: 0,
        limitations: 0,
        contradictions: 0,
        unknowns: 1,
        usage: {
          inputTokens: 1,
          cachedInputTokens: 0,
          outputTokens: 1,
          reasoningTokens: 0,
          totalTokens: 2,
        },
        costMicroUsd: 1,
        durationMilliseconds: 1_000,
      },
    ],
    immediateReuse: { requested: false as const },
    telemetry: { eventCount: 4, telemetryFailureCount: 0 },
  };
}
