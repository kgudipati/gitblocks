import {
  closePersistenceClient,
  createPersistenceClient,
  loadCandidateDossierSnapshot,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { describe, expect, it } from 'vitest';

import {
  ingestPublicCatalog,
  IngestionError,
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
        license: testLicenseAt('4444444444444444444444444444444444444444'),
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
        license: testLicenseAt('4444444444444444444444444444444444444444'),
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
        ),
        persistCandidateProfile(
          client,
          profile,
          prior,
          '2026-07-29T00:00:00.000Z',
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

  it.each([
    ['license', 'github-license'],
    ['releases', 'github-release'],
    ['community', 'github-community'],
    ['file-security-md', 'github-file'],
    ['advisories', 'github-advisory'],
  ] as const)(
    'does not publish a transient %s refresh and recovers without stale material',
    async (failedOperation, sourceType) => {
      const client = createPersistenceClient(CONFIG);
      const candidate = recoveryCandidate(failedOperation, sourceType);
      const catalog = manifestWithDigest({
        catalogVersion: 'public-v1',
        publishedAt: '2026-08-10T00:00:00.000Z',
        candidates: [candidate],
      });
      let phase: 'complete' | 'temporary' = 'complete';
      let now = '2026-08-10T12:00:00.000Z';
      const transport: ProviderTransport = {
        requestJson: (request) => {
          if (phase === 'temporary' && request.operation === failedOperation) {
            return Promise.reject(
              new IngestionError('ingestion.provider-unavailable'),
            );
          }
          return Promise.resolve(recoveryProviderResponse(request, candidate));
        },
      };
      const run = () =>
        ingestPublicCatalog({
          catalog,
          persistence: client,
          provider: { transport, githubToken: 'injected-test-token' },
          clock: { now: () => new Date(now) },
          databaseMigrationVersion: 1,
        });
      try {
        const first = await run();
        const firstCandidate = first.candidates[0];
        expect(firstCandidate?.outcome).toBe('created');
        expect(firstCandidate?.snapshotId).not.toBeNull();
        const firstSnapshotId = firstCandidate?.snapshotId;
        if (firstSnapshotId === null || firstSnapshotId === undefined) {
          return;
        }

        phase = 'temporary';
        now = '2026-08-11T12:00:00.000Z';
        const second = await run();
        expect(second.candidates[0]).toMatchObject({
          outcome: 'partial',
          snapshotId: null,
          incompleteSourceCodes: [
            failedOperation === 'file-security-md'
              ? 'github-file-unavailable-security-md'
              : failedOperation === 'advisories'
                ? 'github-advisories-unavailable'
                : `github-${failedOperation}-unavailable`,
          ],
          safeErrorCode: 'ingestion.provider-unavailable',
        });
        await expect(
          loadCandidateDossierSnapshot(client, {
            snapshotId: firstSnapshotId,
          }),
        ).resolves.toMatchObject({
          identity: { candidateId: candidate.candidateId },
        });

        phase = 'complete';
        now = '2026-08-12T12:00:00.000Z';
        const third = await run();
        expect(third.candidates[0]).toMatchObject({
          outcome: 'unchanged',
          snapshotId: firstSnapshotId,
          incompleteSourceCodes: [],
        });
        const active = await loadPriorMaterial(
          client,
          candidate.candidateId,
          now,
        );
        expect(
          active.limitations.some(
            (limitation) =>
              limitation.limitationCode.includes('unavailable') ||
              limitation.statement.toLowerCase().includes('unavailable'),
          ),
        ).toBe(false);
        expect(
          active.unknowns.some((unknown) =>
            unknown.statement.toLowerCase().includes('request failure'),
          ),
        ).toBe(false);
      } finally {
        await closePersistenceClient(client);
      }
    },
  );

  it('creates no snapshot or durable material for every fatal optional-source outcome', async () => {
    const client = createPersistenceClient(CONFIG);
    const fatalCodes = [
      'ingestion.cancelled',
      'ingestion.deadline-exceeded',
      'ingestion.provider-rate-limited',
      'ingestion.provider-authentication',
      'ingestion.provider-authorization',
      'ingestion.provider-response',
      'ingestion.provider-identity',
      'ingestion.body-too-large',
      'ingestion.content-type',
      'ingestion.redirect',
      'ingestion.internal-invariant',
    ] as const;
    try {
      for (const [index, code] of fatalCodes.entries()) {
        const candidate = batchCandidate(
          `phase5-fatal-${String(index).padStart(2, '0')}`,
          `fatal-${String(index).padStart(2, '0')}`,
        );
        const transport: ProviderTransport = {
          requestJson: (request) =>
            request.operation === 'releases'
              ? Promise.reject(new IngestionError(code))
              : Promise.resolve(recoveryProviderResponse(request, candidate)),
        };
        const receipt = await ingestPublicCatalog({
          catalog: manifestWithDigest({
            catalogVersion: 'public-v1',
            publishedAt: '2026-08-12T00:00:00.000Z',
            candidates: [candidate],
          }),
          persistence: client,
          provider: { transport, githubToken: 'injected-test-token' },
          clock: { now: () => new Date('2026-08-12T12:00:00.000Z') },
          databaseMigrationVersion: 1,
        });
        expect(receipt.candidates[0]).toMatchObject({
          outcome: 'failed',
          snapshotId: null,
          safeErrorCode: code,
        });
        expect(
          await loadPriorMaterial(
            client,
            candidate.candidateId,
            '2026-08-12T12:00:00.000Z',
          ),
        ).toEqual({
          observations: [],
          limitations: [],
          unknowns: [],
        });
      }
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('preserves stable catalog identity when a moved repository resolves to a new canonical location', async () => {
    const client = createPersistenceClient(CONFIG);
    const candidate: CatalogCandidate = {
      ...batchCandidate('phase5-move-refresh', 'project'),
      github: { owner: 'old-owner', repository: 'project' },
      status: 'moved',
      rationale:
        'phase5-move-refresh is a moved authorization fixture that verifies stable catalog identity.',
      selectionSources: [
        'https://github.com/old-owner/project/blob/HEAD/README.md',
      ],
    };
    const catalog = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: '2026-08-13T00:00:00.000Z',
      candidates: [candidate],
    });
    let moved = false;
    let now = '2026-08-13T12:00:00.000Z';
    const transport: ProviderTransport = {
      requestJson: (request) =>
        Promise.resolve(
          recoveryProviderResponse(request, candidate, {
            owner: moved ? 'new-owner' : 'old-owner',
            repository: 'project',
          }),
        ),
    };
    const run = () =>
      ingestPublicCatalog({
        catalog,
        persistence: client,
        provider: { transport, githubToken: 'injected-test-token' },
        clock: { now: () => new Date(now) },
        databaseMigrationVersion: 1,
      });
    try {
      const first = await run();
      const firstSnapshotId = first.candidates[0]?.snapshotId;
      expect(firstSnapshotId).not.toBeNull();
      moved = true;
      now = '2026-08-14T12:00:00.000Z';
      const second = await run();
      const secondSnapshotId = second.candidates[0]?.snapshotId;
      expect(second.candidates[0]?.outcome).toBe('updated');
      expect(secondSnapshotId).not.toBe(firstSnapshotId);
      if (
        firstSnapshotId === null ||
        firstSnapshotId === undefined ||
        secondSnapshotId === null ||
        secondSnapshotId === undefined
      ) {
        return;
      }
      const historical = await loadCandidateDossierSnapshot(client, {
        snapshotId: firstSnapshotId,
      });
      const current = await loadCandidateDossierSnapshot(client, {
        snapshotId: secondSnapshotId,
      });
      expect(historical.identity.repository).toEqual({
        host: 'github',
        owner: 'old-owner',
        name: 'project',
      });
      expect(current.identity.repository).toEqual(
        historical.identity.repository,
      );
      expect(
        current.observations.find(
          (observation) => observation.topic === 'repository-identity',
        )?.observation,
      ).toContain('now resolves to new-owner/project');
      expect(
        current.limitations.map((limitation) => limitation.limitationCode),
      ).toContain('repository-moved');
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('uses introducedAt independently of manifest publication and rejects identity-time rewrites', async () => {
    const client = createPersistenceClient(CONFIG);
    const firstCandidate = batchCandidate(
      'phase5-introduction-stable',
      'introduction-stable',
    );
    const transport: ProviderTransport = {
      requestJson: (request) =>
        Promise.resolve(recoveryProviderResponse(request, firstCandidate)),
    };
    const ingest = (
      candidate: CatalogCandidate,
      publishedAt: string,
      now: string,
    ) =>
      ingestPublicCatalog({
        catalog: manifestWithDigest({
          catalogVersion: 'public-v1',
          publishedAt,
          candidates: [candidate],
        }),
        persistence: client,
        provider: { transport, githubToken: 'injected-test-token' },
        clock: { now: () => new Date(now) },
        databaseMigrationVersion: 1,
      });
    try {
      const first = await ingest(
        firstCandidate,
        '2026-08-15T00:00:00.000Z',
        '2026-08-15T12:00:00.000Z',
      );
      const laterPublication = await ingest(
        firstCandidate,
        '2026-09-01T00:00:00.000Z',
        '2026-09-01T12:00:00.000Z',
      );
      expect(laterPublication.catalogDigest).not.toBe(first.catalogDigest);
      expect(laterPublication.candidates[0]).toMatchObject({
        outcome: 'unchanged',
        snapshotId: first.candidates[0]?.snapshotId,
      });

      const changedIntroduction = await ingest(
        {
          ...firstCandidate,
          introducedAt: '2026-08-16T00:00:00.000Z',
        },
        '2026-09-02T00:00:00.000Z',
        '2026-09-02T12:00:00.000Z',
      );
      expect(changedIntroduction.candidates[0]).toMatchObject({
        outcome: 'failed',
        snapshotId: null,
        safeErrorCode: 'ingestion.persistence',
      });

      const newCandidate = batchCandidate(
        'phase5-introduction-later',
        'introduction-later',
      );
      const laterTransport: ProviderTransport = {
        requestJson: (request) =>
          Promise.resolve(recoveryProviderResponse(request, newCandidate)),
      };
      const added = await ingestPublicCatalog({
        catalog: manifestWithDigest({
          catalogVersion: 'public-v1',
          publishedAt: '2026-09-03T00:00:00.000Z',
          candidates: [
            {
              ...newCandidate,
              introducedAt: '2026-09-03T00:00:00.000Z',
            },
          ],
        }),
        persistence: client,
        provider: {
          transport: laterTransport,
          githubToken: 'injected-test-token',
        },
        clock: { now: () => new Date('2026-09-03T12:00:00.000Z') },
        databaseMigrationVersion: 1,
      });
      expect(added.candidates[0]?.outcome).toBe('created');
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
    introducedAt: '2026-07-29T00:00:00.000Z',
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

function recoveryCandidate(
  operation: string,
  sourceType:
    | 'github-license'
    | 'github-release'
    | 'github-community'
    | 'github-file'
    | 'github-advisory',
): CatalogCandidate {
  const npmPackage =
    sourceType === 'github-advisory'
      ? `@gitblocks-test/recovery-${operation}`
      : null;
  return {
    candidateId: `phase5-recovery-${operation}`,
    displayName: `Recovery ${operation}`,
    introducedAt: '2026-08-10T00:00:00.000Z',
    github: {
      owner: 'gitblocks-test',
      repository: `recovery-${operation}`,
    },
    npmPackage,
    primaryCapabilityFamily: 'authorization',
    additionalCapabilityFamilies: [],
    rationale: `Recovery ${operation} is a deterministic authorization recovery fixture.`,
    selectionSources: [
      `https://github.com/gitblocks-test/recovery-${operation}/blob/HEAD/README.md`,
    ],
    expectedSourceTypes: [
      'github-repository',
      sourceType,
      ...(sourceType === 'github-advisory' ? (['npm-package'] as const) : []),
    ].sort() as CatalogCandidate['expectedSourceTypes'],
    status: 'active',
    allowlistedFiles: sourceType === 'github-file' ? ['SECURITY.md'] : [],
  };
}

function recoveryProviderResponse(
  request: TransportRequest,
  candidate: CatalogCandidate,
  canonical: {
    readonly owner: string;
    readonly repository: string;
  } = candidate.github,
): JsonResponse {
  const path = request.url.pathname;
  const commitSha = '6666666666666666666666666666666666666666';
  if (request.provider === 'npm') {
    const packageName = candidate.npmPackage;
    if (packageName === null) {
      throw new Error('Unexpected npm request in deterministic fixture.');
    }
    return databaseResponse({
      name: packageName,
      'dist-tags': { latest: '1.0.0' },
      versions: {
        '1.0.0': {
          repository: {
            type: 'git',
            url: `git+https://github.com/${canonical.owner}/${canonical.repository}.git`,
          },
          license: 'MIT',
        },
      },
      time: { '1.0.0': '2026-08-09T12:00:00.000Z' },
    });
  }
  if (path === '/advisories') {
    return databaseResponse([]);
  }
  if (path.includes('/commits/')) {
    return databaseResponse({
      sha: commitSha,
      html_url: `https://github.com/${canonical.owner}/${canonical.repository}/commit/${commitSha}`,
      commit: { committer: { date: '2026-08-09T12:00:00.000Z' } },
    });
  }
  if (path.endsWith('/releases')) {
    return databaseResponse([]);
  }
  if (path.endsWith('/license')) {
    return databaseResponse({
      name: 'LICENSE',
      path: 'LICENSE',
      sha: '7777777777777777777777777777777777777777',
      html_url: `https://github.com/${canonical.owner}/${canonical.repository}/blob/${commitSha}/LICENSE`,
      license: { spdx_id: 'MIT' },
    });
  }
  if (path.endsWith('/community/profile')) {
    return databaseResponse({
      health_percentage: 50,
      files: { security: null },
    });
  }
  if (path.endsWith('/contents/SECURITY.md')) {
    const text = '# Security';
    return databaseResponse({
      type: 'file',
      encoding: 'base64',
      content: Buffer.from(text).toString('base64'),
      size: Buffer.byteLength(text),
      sha: '8888888888888888888888888888888888888888',
      html_url: `https://github.com/${canonical.owner}/${canonical.repository}/blob/${commitSha}/SECURITY.md`,
    });
  }
  return databaseResponse({
    owner: { login: canonical.owner },
    name: canonical.repository,
    html_url: `https://github.com/${canonical.owner}/${canonical.repository}`,
    description: null,
    homepage: null,
    topics: [],
    default_branch: 'main',
    private: false,
    fork: false,
    archived: false,
    pushed_at: '2026-08-09T12:00:00.000Z',
    updated_at: '2026-08-09T12:00:00.000Z',
    license: { spdx_id: 'MIT' },
  });
}

function databaseResponse(value: unknown): JsonResponse {
  return { value, headers: new Headers(), status: 200 };
}

function testLicenseAt(commitSha: string) {
  const immutableUrl = `https://github.com/gitblocks-test/candidate/blob/${commitSha}/LICENSE`;
  return {
    spdxId: 'Apache-2.0',
    path: 'LICENSE',
    sha: '2222222222222222222222222222222222222222',
    sourceUrl: immutableUrl,
    immutableUrl,
  };
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
