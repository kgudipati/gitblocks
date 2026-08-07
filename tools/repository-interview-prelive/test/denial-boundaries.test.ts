import { serializeCanonicalJson } from '@gitblocks/interviews';
import { describe, expect, it, vi } from 'vitest';

import {
  buildRepositoryInterviewPreliveExpectedV1,
  materializeRepositoryInterviewOperatorSelectionV1,
  repositoryInterviewPreliveSummaryV1,
} from '../src/index.ts';
import { syntheticArtifactAuthorityV1 } from './prelive-fixtures.ts';

const SENTINELS = Object.freeze([
  'ARTIFACT_TEXT_SENTINEL_7JH4',
  'PROMPT_TEXT_SENTINEL_8KL2',
  'PROVIDER_OUTPUT_SENTINEL_6MP9',
  'PROVIDER_ERROR_SENTINEL_4QW3',
  'REFUSAL_TEXT_SENTINEL_5RT8',
  'CREDENTIAL_SENTINEL_2VX7',
  'DATABASE_HOST_SENTINEL_3BN6',
  'DATABASE_NAME_SENTINEL_9CZ1',
  'DATABASE_USER_SENTINEL_8FH5',
  'SQL_SENTINEL_1WS4',
  'REPOSITORY_OWNER_NAME_SENTINEL_6DG7',
  'URL_SENTINEL_2PK3',
  'COMMIT_SENTINEL_9MN8',
  'ARTIFACT_ID_SENTINEL_4VB5',
  'RETENTION_EVIDENCE_SENTINEL_7XC2',
  'PRICING_EVIDENCE_SENTINEL_3LA6',
  'REVIEWER_IDENTITY_SENTINEL_5UY9',
]);

describe('pre-live network, secret, import, and leakage denial', () => {
  it('validates and materializes through an injected set loader without fetch', async () => {
    const fetch = vi.fn(() => {
      throw new Error(SENTINELS[3]);
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetch,
      writable: true,
    });
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    const fixture = await syntheticArtifactAuthorityV1();
    const result = await materializeRepositoryInterviewOperatorSelectionV1(
      {
        candidatePlan: expected.plans.calibration,
        artifactReceipt: fixture.receipt,
        fullCatalogCandidateIds: fixture.candidateIds,
        selectionId: 'synthetic-denial-selection',
      },
      {
        loadRepositoryArtifactSet(artifactSetId) {
          return Promise.resolve(fixture.sets.get(artifactSetId)!);
        },
      },
    );
    expect(fetch).not.toHaveBeenCalled();
    scan([
      serializeCanonicalJson(result.materialization),
      serializeCanonicalJson(result.selection),
      serializeCanonicalJson(expected.report),
      serializeCanonicalJson(repositoryInterviewPreliveSummaryV1(expected)),
    ]);
  });

  it('imports authority modules without fetch or timer creation', async () => {
    vi.resetModules();
    const fetch = vi.fn(() => {
      throw new Error('network sentinel');
    });
    const timeout = vi.spyOn(globalThis, 'setTimeout');
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetch,
      writable: true,
    });
    await import('../src/index.ts');
    expect(fetch).not.toHaveBeenCalled();
    expect(timeout).not.toHaveBeenCalled();
  }, 30_000);

  it('returns value-free fixed failures', async () => {
    const fixture = await syntheticArtifactAuthorityV1();
    const expected = await buildRepositoryInterviewPreliveExpectedV1(
      process.cwd(),
    );
    let message = '';
    try {
      await materializeRepositoryInterviewOperatorSelectionV1(
        {
          candidatePlan: expected.plans.calibration,
          artifactReceipt: fixture.receipt,
          fullCatalogCandidateIds: fixture.candidateIds,
          selectionId: 'synthetic-denial-selection',
        },
        {
          loadRepositoryArtifactSet() {
            throw new Error(SENTINELS.join('|'));
          },
        },
      );
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe('Repository interview materialization is invalid.');
    scan([message]);
  });
});

function scan(values: readonly string[]): void {
  for (const value of values) {
    for (const sentinel of SENTINELS) expect(value).not.toContain(sentinel);
  }
}
