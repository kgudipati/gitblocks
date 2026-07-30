import type { PersistenceClient } from '@gitblocks/persistence';
import { describe, expect, it } from 'vitest';

import {
  IngestionError,
  collectPublicRepositoryArtifacts,
  createArtifactDecodedByteBudget,
  type CatalogCandidate,
  type PublicArtifactManifest,
  type PublicCatalog,
  type RepositoryArtifactCollector,
} from '../src/index.ts';

const CANDIDATES = [
  candidate('artifact-budget-alpha', 'alpha'),
  candidate('artifact-budget-beta', 'beta'),
  candidate('artifact-budget-gamma', 'gamma'),
] as const;

describe('aggregate artifact decoded-byte budget', () => {
  it('charges a failed candidate and prevents repeated failures from crossing the run bound', async () => {
    const collector: RepositoryArtifactCollector = {
      collectCandidate: (command) => {
        command.decodedByteBudget.reserve(6);
        return Promise.reject(
          new IngestionError('ingestion.provider-response'),
        );
      },
    };
    const receipt = await run(CANDIDATES, collector, 10, 1);

    expect(receipt.operationalDecodedBytes).toBe(6);
    expect(receipt.materializedArtifactBytes).toBe(0);
    expect(receipt.candidates).toEqual([
      expect.objectContaining({
        candidateId: CANDIDATES[0].candidateId,
        operationalDecodedBytes: 6,
        materializedArtifactBytes: 0,
        safeErrorCode: 'ingestion.provider-response',
      }),
      expect.objectContaining({
        candidateId: CANDIDATES[1].candidateId,
        operationalDecodedBytes: 0,
        materializedArtifactBytes: 0,
        safeErrorCode: 'ingestion.body-too-large',
      }),
      expect.objectContaining({
        candidateId: CANDIDATES[2].candidateId,
        operationalDecodedBytes: 0,
        materializedArtifactBytes: 0,
        safeErrorCode: 'ingestion.body-too-large',
      }),
    ]);
    expect(receipt.operationalDecodedBytes).toBeLessThanOrEqual(10);
  });

  it('does not overshoot when two candidate workers reserve concurrently', async () => {
    let ready = 0;
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const collector: RepositoryArtifactCollector = {
      collectCandidate: async (command) => {
        ready += 1;
        if (ready === 2) {
          release?.();
        }
        await gate;
        command.decodedByteBudget.reserve(6);
        throw new IngestionError('ingestion.provider-unavailable');
      },
    };
    const receipt = await run(CANDIDATES.slice(0, 2), collector, 10, 2);

    expect(receipt.operationalDecodedBytes).toBe(6);
    expect(
      receipt.candidates.map(
        ({ operationalDecodedBytes }) => operationalDecodedBytes,
      ),
    ).toEqual([6, 0]);
    expect(receipt.failuresByCode).toEqual([
      { code: 'ingestion.body-too-large', count: 1 },
      { code: 'ingestion.provider-unavailable', count: 1 },
    ]);
  });

  it('makes a rejected reservation atomic and value-free', () => {
    const budget = createArtifactDecodedByteBudget(10);
    const first = budget.createCandidateScope();
    const second = budget.createCandidateScope();

    first.reserve(6);
    expect(() => {
      second.reserve(5);
    }).toThrow(new IngestionError('ingestion.body-too-large'));
    expect(budget.operationalDecodedBytes).toBe(6);
    expect(first.operationalDecodedBytes).toBe(6);
    expect(second.operationalDecodedBytes).toBe(0);
    expect(JSON.stringify({ budget })).not.toContain('candidate content');
  });

  it('does not invoke the collector after caller cancellation', async () => {
    const controller = new AbortController();
    controller.abort();
    let called = false;
    const collector: RepositoryArtifactCollector = {
      collectCandidate: () => {
        called = true;
        return Promise.reject(new Error('must not run'));
      },
    };
    const receipt = await run(
      CANDIDATES.slice(0, 2),
      collector,
      10,
      2,
      controller.signal,
    );

    expect(called).toBe(false);
    expect(receipt.operationalDecodedBytes).toBe(0);
    expect(receipt.failuresByCode).toEqual([
      { code: 'ingestion.cancelled', count: 2 },
    ]);
  });
});

function run(
  candidates: readonly CatalogCandidate[],
  collector: RepositoryArtifactCollector,
  maximumDecodedBytes: number,
  candidateConcurrency: number,
  signal?: AbortSignal,
) {
  return collectPublicRepositoryArtifacts({
    catalog: catalog(candidates),
    manifest: manifest(candidates),
    persistence: {} as PersistenceClient,
    collector,
    getProviderMetrics: () => ({
      providerRequestCounts: { github: 0, npm: 0 },
      githubRateLimit: null,
    }),
    clock: {
      now: () => new Date('2026-07-30T12:00:00.000Z'),
    },
    candidateConcurrency,
    maximumDecodedBytes,
    maximumRunMilliseconds: 10_000,
    databaseMigrationVersion: 3,
    ...(signal === undefined ? {} : { signal }),
  });
}

function catalog(candidates: readonly CatalogCandidate[]): PublicCatalog {
  return {
    catalogVersion: 'public-v1',
    publishedAt: '2026-07-29T00:00:00.000Z',
    manifestDigest: '1'.repeat(64),
    candidates,
  };
}

function manifest(
  candidates: readonly CatalogCandidate[],
): PublicArtifactManifest {
  return {
    artifactManifestVersion: 'public-artifacts-v1',
    catalogVersion: 'public-v1',
    catalogDigest: '1'.repeat(64),
    candidates: candidates.map((entry, index) => ({
      candidateId: entry.candidateId,
      selections: [
        {
          selectionId: `selection-${String(index + 1).repeat(48)}`,
          selector: 'root-readme',
          artifactKind: 'readme',
          requirement: 'optional',
        },
      ],
    })),
    manifestDigest: '2'.repeat(64),
  };
}

function candidate(candidateId: string, repository: string): CatalogCandidate {
  return {
    candidateId,
    displayName: candidateId,
    introducedAt: '2026-07-29T00:00:00.000Z',
    github: { owner: 'gitblocks-test', repository },
    npmPackage: null,
    primaryCapabilityFamily: 'authorization',
    additionalCapabilityFamilies: [],
    rationale: 'Synthetic aggregate decoded-byte budget candidate.',
    selectionSources: [`https://github.com/gitblocks-test/${repository}`],
    expectedSourceTypes: ['github-repository'],
    status: 'active',
    allowlistedFiles: [],
  };
}
