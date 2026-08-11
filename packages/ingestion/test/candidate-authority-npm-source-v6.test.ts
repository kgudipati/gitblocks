import { describe, expect, it } from 'vitest';

import { CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS } from '../src/candidate-authority-provider-contract.ts';
import { createTransport } from '../src/transport.ts';

describe('candidate-authority npm selected-version successor contract', () => {
  it('replaces the full packument operation with a selected-version operation', () => {
    expect(CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS).toContain(
      'npm-selected-version-metadata',
    );
    expect(CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS).not.toContain(
      'npm-package-metadata',
    );
    expect(CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS).toHaveLength(13);
  });

  it('enforces the unchanged two-megabyte selected-version transport boundary', async () => {
    const transport = createTransport({
      fetch: () =>
        Promise.resolve(
          new Response('{"discarded":true}', {
            headers: {
              'content-length': String(2_097_153),
              'content-type': 'application/json',
            },
          }),
        ),
      sleep: () => Promise.resolve(),
    });
    await expect(
      transport.requestJson({
        url: new URL('https://registry.npmjs.org/synthetic-package/latest'),
        provider: 'npm',
        operation: 'npm-selected-version-metadata',
        maximumBytes: 2_097_152,
        maximumNodes: 100_000,
        correlationId: 'synthetic-contract-fixture',
        candidateId: 'synthetic-candidate',
      }),
    ).rejects.toMatchObject({ code: 'ingestion.body-too-large' });
  });
});
