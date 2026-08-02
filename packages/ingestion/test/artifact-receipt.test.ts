import { describe, expect, it } from 'vitest';

import {
  IngestionError,
  createArtifactReceipt,
  manifestWithDigest,
  parseArtifactReceipt,
  type ArtifactReceiptCandidate,
  type PublicArtifactManifest,
} from '../src/index.ts';
import { TEST_CANDIDATE } from './fixtures.ts';

describe('repository artifact receipt', () => {
  it('round trips a closed, content-free, path-free receipt', () => {
    const publicCatalog = catalog();
    const receipt = createArtifactReceipt({
      catalog: publicCatalog,
      manifest: artifactManifest(publicCatalog.manifestDigest),
      runId: 'artifact-run-test',
      startedAt: '2026-07-29T12:00:00.000Z',
      completedAt: '2026-07-29T12:01:00.000Z',
      candidates: [createdCandidate()],
      providerMetrics: {
        providerRequestCounts: { github: 6, npm: 0 },
        githubRateLimit: null,
      },
      databaseMigrationVersion: 3,
      operationalDecodedBytes: 46,
    });
    expect(parseArtifactReceipt(JSON.stringify(receipt))).toEqual(receipt);
    expect(receipt.databaseMigrationVersion).toBe(3);
    expect(() =>
      parseArtifactReceipt(
        JSON.stringify({ ...receipt, databaseMigrationVersion: 4 }),
      ),
    ).toThrow(IngestionError);
    const serialized = JSON.stringify(receipt);
    for (const forbidden of [
      '# Synthetic',
      'README.md',
      'github.com',
      'download_url',
      '\u001b',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('records an immediate rerun with zero rows and stable first materialization', () => {
    const publicCatalog = catalog();
    const manifest = artifactManifest(publicCatalog.manifestDigest);
    const first = createArtifactReceipt({
      catalog: publicCatalog,
      manifest,
      runId: 'artifact-run-first',
      startedAt: '2026-07-29T12:00:00.000Z',
      completedAt: '2026-07-29T12:01:00.000Z',
      candidates: [createdCandidate()],
      providerMetrics: {
        providerRequestCounts: { github: 6, npm: 0 },
        githubRateLimit: null,
      },
      databaseMigrationVersion: 3,
      operationalDecodedBytes: 46,
    });
    const second = createArtifactReceipt({
      catalog: publicCatalog,
      manifest,
      runId: 'artifact-run-second',
      startedAt: '2026-07-29T12:02:00.000Z',
      completedAt: '2026-07-29T12:03:00.000Z',
      candidates: [
        {
          ...createdCandidate(),
          outcome: 'idempotent',
          inserted: { artifacts: 0, chunks: 0, artifactSets: 0, entries: 0 },
        },
      ],
      providerMetrics: {
        providerRequestCounts: { github: 6, npm: 0 },
        githubRateLimit: null,
      },
      databaseMigrationVersion: 3,
      operationalDecodedBytes: 46,
      priorReceipt: first,
    });
    expect(second.rerunComparison).toEqual({
      priorReceiptDigest: first.receiptDigest,
      identicalArtifactSetCount: 1,
      identicalMaterializationCount: 1,
      zeroNewRowCandidateCount: 1,
      newRowCount: 0,
    });
  });

  it('rejects tampering and unknown fields', () => {
    const publicCatalog = catalog();
    const receipt = createArtifactReceipt({
      catalog: publicCatalog,
      manifest: artifactManifest(publicCatalog.manifestDigest),
      runId: 'artifact-run-test',
      startedAt: '2026-07-29T12:00:00.000Z',
      completedAt: '2026-07-29T12:01:00.000Z',
      candidates: [createdCandidate()],
      providerMetrics: {
        providerRequestCounts: { github: 6, npm: 0 },
        githubRateLimit: null,
      },
      databaseMigrationVersion: 3,
      operationalDecodedBytes: 46,
    });
    expect(() =>
      parseArtifactReceipt(
        JSON.stringify({
          ...receipt,
          operationalDecodedBytes: receipt.operationalDecodedBytes + 1,
        }),
      ),
    ).toThrow(IngestionError);
    expect(() =>
      parseArtifactReceipt(JSON.stringify({ ...receipt, unexpected: true })),
    ).toThrow(IngestionError);
  });
});

function catalog() {
  return manifestWithDigest({
    catalogVersion: 'public-v1',
    publishedAt: '2026-07-29T00:00:00.000Z',
    candidates: [TEST_CANDIDATE],
  });
}

function artifactManifest(catalogDigest: string): PublicArtifactManifest {
  return {
    artifactManifestVersion: 'public-artifacts-v1',
    catalogVersion: 'public-v1',
    catalogDigest,
    candidates: [
      {
        candidateId: TEST_CANDIDATE.candidateId,
        selections: [
          {
            selectionId: `selection-${'2'.repeat(48)}`,
            selector: 'root-readme',
            artifactKind: 'readme',
            requirement: 'optional',
          },
        ],
      },
    ],
    manifestDigest: '3'.repeat(64),
  };
}

function createdCandidate(): ArtifactReceiptCandidate {
  return {
    candidateId: TEST_CANDIDATE.candidateId,
    outcome: 'created',
    artifactSetId: `artifact-set-${'4'.repeat(48)}`,
    artifactCount: 1,
    chunkCount: 1,
    absenceCount: 0,
    operationalDecodedBytes: 46,
    materializedArtifactBytes: 23,
    inserted: { artifacts: 1, chunks: 1, artifactSets: 1, entries: 1 },
    materializationDigest: '5'.repeat(64),
    safeErrorCode: null,
  };
}
