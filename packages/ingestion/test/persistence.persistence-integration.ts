import {
  closePersistenceClient,
  createPersistenceClient,
  loadCandidateDossierSnapshot,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { describe, expect, it } from 'vitest';

import {
  ingestPublicCatalog,
  loadPriorMaterial,
  manifestWithDigest,
  persistCandidateProfile,
  profileCandidate,
  type CatalogCandidate,
  type JsonResponse,
  type ProviderTransport,
  type TransportRequest,
} from '../src/index.ts';
import { testBundle } from './fixtures.ts';

const CONFIG = readDatabaseConfig();

describe('ingestion persistence composition', () => {
  it('reconstructs an exact snapshot, converges unchanged, and records changed evidence', async () => {
    const client = createPersistenceClient(CONFIG);
    try {
      const firstBundle = testBundle();
      const empty = await loadPriorMaterial(
        client,
        firstBundle.candidate.candidateId,
        firstBundle.collectedAt,
      );
      const firstProfile = profileCandidate(firstBundle, empty.observations);
      const first = await persistCandidateProfile(
        client,
        firstProfile,
        empty,
        '2026-07-29T00:00:00.000Z',
        [],
      );
      expect(first.outcome).toBe('created');
      expect(
        await loadCandidateDossierSnapshot(client, {
          snapshotId: firstProfile.snapshotId,
        }),
      ).toEqual(firstProfile.dossier);

      const prior = await loadPriorMaterial(
        client,
        firstBundle.candidate.candidateId,
        '2026-07-30T12:00:00.000Z',
      );
      const unchangedProfile = profileCandidate(
        testBundle({ collectedAt: '2026-07-30T12:00:00.000Z' }),
        prior.observations,
      );
      const unchanged = await persistCandidateProfile(
        client,
        unchangedProfile,
        prior,
        '2026-07-29T00:00:00.000Z',
        [],
      );
      expect(unchanged.outcome).toBe('unchanged');
      expect(unchanged.snapshotId).toBe(first.snapshotId);

      const changedBundle = testBundle({
        collectedAt: '2026-07-31T12:00:00.000Z',
        commit: {
          sha: '4444444444444444444444444444444444444444',
          htmlUrl:
            'https://github.com/gitblocks-test/candidate/commit/4444444444444444444444444444444444444444',
          committedAt: '2026-07-31T10:00:00.000Z',
        },
      });
      const changedProfile = profileCandidate(
        changedBundle,
        prior.observations,
      );
      const changed = await persistCandidateProfile(
        client,
        changedProfile,
        prior,
        '2026-07-29T00:00:00.000Z',
        [],
      );
      expect(changed.outcome).toBe('updated');
      expect(changed.evidenceSuperseded).toBeGreaterThan(0);
      expect(
        await loadCandidateDossierSnapshot(client, {
          snapshotId: changedProfile.snapshotId,
        }),
      ).toEqual(changedProfile.dossier);
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('converges concurrent identical candidate ingestion on one exact snapshot', async () => {
    const client = createPersistenceClient(CONFIG);
    try {
      const bundle = testBundle({
        collectedAt: '2026-08-01T12:00:00.000Z',
        commit: {
          sha: '4444444444444444444444444444444444444444',
          htmlUrl:
            'https://github.com/gitblocks-test/candidate/commit/4444444444444444444444444444444444444444',
          committedAt: '2026-07-31T10:00:00.000Z',
        },
      });
      const prior = await loadPriorMaterial(
        client,
        bundle.candidate.candidateId,
        bundle.collectedAt,
      );
      const profile = profileCandidate(bundle, prior.observations);
      const results = await Promise.all([
        persistCandidateProfile(
          client,
          profile,
          prior,
          '2026-07-29T00:00:00.000Z',
          [],
        ),
        persistCandidateProfile(
          client,
          profile,
          prior,
          '2026-07-29T00:00:00.000Z',
          [],
        ),
      ]);
      expect(new Set(results.map((result) => result.snapshotId))).toEqual(
        new Set([profile.snapshotId]),
      );
      expect(
        await loadCandidateDossierSnapshot(client, {
          snapshotId: profile.snapshotId,
        }),
      ).toEqual(profile.dossier);
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('keeps a completed candidate when an independent required provider identity fails', async () => {
    const client = createPersistenceClient(CONFIG);
    try {
      const candidates = [
        batchCandidate('phase5-batch-valid', 'candidate-batch-valid'),
        batchCandidate('phase5-batch-private', 'candidate-batch-private'),
      ].sort((left, right) =>
        left.candidateId.localeCompare(right.candidateId),
      );
      const catalog = manifestWithDigest({
        catalogVersion: 'public-v1',
        publishedAt: '2026-07-29T00:00:00.000Z',
        candidates,
      });
      const transport: ProviderTransport = {
        requestJson: (request) =>
          Promise.resolve(batchProviderResponse(request)),
        getMetrics: () => ({
          providerRequestCounts: { github: 7, npm: 0 },
          githubRateLimit: null,
        }),
      };
      const receipt = await ingestPublicCatalog({
        catalog,
        persistence: client,
        provider: { transport, githubToken: 'injected-test-token' },
        clock: {
          now: () => new Date('2026-08-02T12:00:00.000Z'),
        },
        candidateConcurrency: 2,
        maximumRunMilliseconds: 10_000,
        databaseMigrationVersion: 1,
      });
      expect(receipt.outcomeCounts).toMatchObject({
        created: 1,
        failed: 1,
      });
      const completed = receipt.candidates.find(
        (candidate) => candidate.candidateId === 'phase5-batch-valid',
      );
      expect(completed?.snapshotId).not.toBeNull();
      if (completed?.snapshotId !== null && completed !== undefined) {
        await expect(
          loadCandidateDossierSnapshot(client, {
            snapshotId: completed.snapshotId,
          }),
        ).resolves.toMatchObject({
          identity: { candidateId: 'phase5-batch-valid' },
        });
      }
    } finally {
      await closePersistenceClient(client);
    }
  });
});

function batchCandidate(
  candidateId: string,
  repository: string,
): CatalogCandidate {
  return {
    candidateId,
    displayName: candidateId,
    github: { owner: 'gitblocks-test', repository },
    npmPackage: null,
    primaryCapabilityFamily: 'authorization',
    additionalCapabilityFamilies: [],
    rationale: 'Reviewed batch boundary fixture.',
    selectionSources: [`https://github.com/gitblocks-test/${repository}`],
    expectedSourceTypes: ['github-release', 'github-repository'],
    status: 'active',
    allowlistedFiles: [],
  };
}

function batchProviderResponse(request: TransportRequest): JsonResponse {
  const segments = request.url.pathname.split('/');
  const repository = segments[3] ?? '';
  const isPrivate = repository === 'candidate-batch-private';
  let value: unknown;
  if (segments.length === 4) {
    value = {
      owner: { login: 'gitblocks-test' },
      name: repository,
      html_url: `https://github.com/gitblocks-test/${repository}`,
      description: null,
      homepage: null,
      topics: [],
      default_branch: 'main',
      private: isPrivate,
      fork: false,
      archived: false,
      pushed_at: '2026-08-01T12:00:00.000Z',
      updated_at: '2026-08-01T12:00:00.000Z',
      license: null,
    };
  } else if (request.url.pathname.includes('/commits/')) {
    value = {
      sha: '5555555555555555555555555555555555555555',
      html_url: `https://github.com/gitblocks-test/${repository}/commit/5555555555555555555555555555555555555555`,
      commit: { committer: { date: '2026-08-01T12:00:00.000Z' } },
    };
  } else if (request.url.pathname.endsWith('/license')) {
    value = { html_url: null, license: { spdx_id: 'NOASSERTION' } };
  } else if (request.url.pathname.endsWith('/community/profile')) {
    value = { health_percentage: 0, files: { security: null } };
  } else {
    value = [];
  }
  return { value, headers: new Headers(), status: 200 };
}

function readDatabaseConfig(): PersistenceClientConfig {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  return {
    host: requiredEnvironment('GITBLOCKS_TEST_DB_HOST'),
    port: parsePort(requiredEnvironment('GITBLOCKS_TEST_DB_PORT')),
    database: requiredEnvironment('GITBLOCKS_TEST_DB_DATABASE'),
    username: 'gitblocks_persistence_test',
    password: 'persistence-test-only',
    ssl: false,
    maximumConnections: 3,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('PostgreSQL integration configuration is required.');
  }
  return value;
}

function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PostgreSQL integration configuration is invalid.');
  }
  return port;
}
