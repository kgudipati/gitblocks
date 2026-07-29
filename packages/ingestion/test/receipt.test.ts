import { describe, expect, it } from 'vitest';

import {
  IngestionError,
  createIngestionReceipt,
  manifestWithDigest,
  parseIngestionReceipt,
} from '../src/index.ts';
import { TEST_CANDIDATE } from './fixtures.ts';

describe('ingestion receipt', () => {
  it('round trips a closed, digested, redacted receipt', () => {
    const catalog = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: '2026-07-29T00:00:00.000Z',
      candidates: [TEST_CANDIDATE],
    });
    const receipt = createIngestionReceipt({
      catalog,
      runId: 'run-test',
      startedAt: '2026-07-29T12:00:00.000Z',
      completedAt: '2026-07-29T12:01:00.000Z',
      providerMetrics: {
        providerRequestCounts: { github: 8, npm: 1 },
        githubRateLimit: {
          limit: 5_000,
          remaining: 4_992,
          resetAt: '2026-07-29T13:00:00.000Z',
        },
      },
      databaseMigrationVersion: 1,
      candidates: [
        {
          candidateId: TEST_CANDIDATE.candidateId,
          outcome: 'created',
          snapshotId: 'snap-test',
          evidenceAppended: 8,
          evidenceIdempotent: 0,
          evidenceSuperseded: 0,
          evidenceInvalidated: 0,
          limitationCount: 0,
          unknownCount: 2,
          candidateState: 'created',
          snapshotState: 'created',
          incompleteSourceCodes: [],
          safeErrorCode: null,
        },
      ],
    });
    expect(parseIngestionReceipt(JSON.stringify(receipt))).toEqual(receipt);
    expect(JSON.stringify(receipt)).not.toContain('token');
    expect(JSON.stringify(receipt)).not.toContain('password');
  });

  it('rejects a tampered digest and unknown fields', () => {
    const value = {
      receiptVersion: 'public-ingestion-receipt/1.0.0',
      catalogVersion: 'public-v1',
      catalogDigest: '0'.repeat(64),
      runId: 'run-test',
      startedAt: '2026-07-29T12:00:00.000Z',
      completedAt: '2026-07-29T12:01:00.000Z',
      requestedCandidateCount: 0,
      completedCandidateCount: 0,
      outcomeCounts: {
        created: 0,
        updated: 0,
        unchanged: 0,
        partial: 0,
        failed: 0,
      },
      candidates: [],
      receiptDigest: '0'.repeat(64),
      extra: true,
    };
    expect(() => parseIngestionReceipt(JSON.stringify(value))).toThrow(
      IngestionError,
    );
  });
});
