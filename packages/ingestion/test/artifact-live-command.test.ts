import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

import type {
  MigrationVerification,
  PersistenceClient,
} from '@gitblocks/persistence';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import {
  runArtifactLiveCliV1,
  type ArtifactLiveCliDependenciesV1,
} from '../scripts/artifact-live-command.ts';
import {
  ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1,
  ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
  ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
} from '../scripts/artifact-live-scope-policy.ts';
import type {
  ArtifactReceipt,
  RepositoryArtifactCollector,
} from '../src/index.ts';

const executeFile = promisify(execFile);
const ARGUMENTS = [
  '--catalog',
  '/explicit/catalog.json',
  '--manifest',
  '/explicit/artifact-manifest.json',
  '--receipt',
  '/explicit/artifact-receipt.json',
] as const;
const CLIENT = Object.freeze({
  kind: 'gitblocks-postgresql-persistence' as const,
}) as PersistenceClient;
const RECEIPT = Object.freeze({
  receiptVersion: 'public-artifact-receipt/1.0.0',
  catalogVersion: 'public-v1',
  catalogDigest: '1'.repeat(64),
  artifactManifestVersion: 'public-artifacts-v1',
  artifactManifestDigest: '2'.repeat(64),
  collectorVersion: 'repository-artifacts-v1',
  chunkerVersion: 'exact-lines-v1',
  runId: `artifact-run-${'3'.repeat(48)}`,
  startedAt: '2026-08-13T00:00:00.000Z',
  completedAt: '2026-08-13T00:00:01.000Z',
  requestedCandidateCount: 1,
  completedCandidateCount: 1,
  artifactCount: 1,
  chunkCount: 1,
  absenceCount: 0,
  operationalDecodedBytes: 12,
  materializedArtifactBytes: 12,
  githubRequestCount: 1,
  providerRateLimit: null,
  databaseMigrationVersion: 7,
  inserted: { artifacts: 1, chunks: 1, artifactSets: 1, entries: 1 },
  failuresByCode: [],
  outcomeCounts: { created: 1, idempotent: 0, failed: 0 },
  rerunComparison: null,
  candidates: [],
  receiptDigest: '4'.repeat(64),
} satisfies ArtifactReceipt);

let catalogText: string;
let manifestText: string;

beforeAll(async () => {
  [catalogText, manifestText] = await Promise.all([
    readFile(
      new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
      'utf8',
    ),
    readFile(
      new URL(
        '../../../catalog/public-v1/artifact-manifest.json',
        import.meta.url,
      ),
      'utf8',
    ),
  ]);
});

describe('live artifact command authority', () => {
  it('admits the exact persistent authority through the existing collection composition in order', async () => {
    const fixture = dependencies();

    await expect(
      runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
    ).resolves.toBeUndefined();
    expect(fixture.events).toEqual([
      'environment:GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT',
      'environment:GITBLOCKS_ARTIFACT_DB_SCOPE',
      'environment:GITBLOCKS_ARTIFACT_PERSISTENT_ACK',
      'environment:GITBLOCKS_ARTIFACT_DB_HOST',
      'environment:GITBLOCKS_ARTIFACT_DB_PORT',
      'environment:GITBLOCKS_ARTIFACT_DB_DATABASE',
      'environment:GITBLOCKS_ARTIFACT_DB_USERNAME',
      'environment:GITBLOCKS_ARTIFACT_DB_PASSWORD',
      'environment:GITBLOCKS_ARTIFACT_DB_SSL',
      'environment:GITBLOCKS_ARTIFACT_PRODUCTION_ACK',
      'environment:DATABASE_URL',
      'environment:GITBLOCKS_ARTIFACT_GITHUB_TOKEN',
      'read:/explicit/catalog.json',
      'read:/explicit/artifact-manifest.json',
      'create-client',
      'verify-migrations',
      'create-transport',
      'create-collector',
      'collect-artifacts',
      'provider-request',
      'persistence-publication',
      'write-receipt:/explicit/artifact-receipt.json',
      'stdout',
      'close-client',
    ]);
    expect(fixture.createTransport).toHaveBeenCalledTimes(1);
    expect(fixture.createCollector).toHaveBeenCalledTimes(1);
    expect(fixture.collectArtifacts).toHaveBeenCalledTimes(1);
    expect(fixture.receiptWrite).toHaveBeenCalledTimes(1);
  });

  it('preserves the ephemeral path without reading or requiring the persistent acknowledgement', async () => {
    const fixture = dependencies({
      GITBLOCKS_ARTIFACT_DB_SCOPE: 'ephemeral-non-production',
      GITBLOCKS_ARTIFACT_PERSISTENT_ACK: undefined,
      GITBLOCKS_ARTIFACT_DB_HOST: 'synthetic-ephemeral-host',
      GITBLOCKS_ARTIFACT_DB_DATABASE: 'synthetic_artifacts_test',
      GITBLOCKS_ARTIFACT_DB_USERNAME: 'synthetic-artifact-writer',
      GITBLOCKS_ARTIFACT_DB_SSL: 'require',
    });

    await expect(
      runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
    ).resolves.toBeUndefined();
    expect(fixture.environment).not.toHaveBeenCalledWith(
      'GITBLOCKS_ARTIFACT_PERSISTENT_ACK',
    );
    expect(fixture.collectArtifacts).toHaveBeenCalledTimes(1);
  });

  it('admits the separate production boundary with TLS required by default', async () => {
    const fixture = dependencies({
      GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT: undefined,
      GITBLOCKS_ARTIFACT_DB_SCOPE: undefined,
      GITBLOCKS_ARTIFACT_PERSISTENT_ACK: undefined,
      GITBLOCKS_ARTIFACT_DB_HOST: undefined,
      GITBLOCKS_ARTIFACT_DB_PORT: undefined,
      GITBLOCKS_ARTIFACT_DB_DATABASE: undefined,
      GITBLOCKS_ARTIFACT_DB_USERNAME: undefined,
      GITBLOCKS_ARTIFACT_DB_PASSWORD: undefined,
      GITBLOCKS_ARTIFACT_DB_SSL: undefined,
      GITBLOCKS_ARTIFACT_PRODUCTION_ACK:
        ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
      DATABASE_URL: productionDatabaseUrl('gitblocks_artifacts'),
    });

    await expect(
      runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
    ).resolves.toBeUndefined();
    expect(fixture.createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        database: 'gitblocks_artifacts',
        ssl: 'require',
      }),
    );
    expect(fixture.collectArtifacts).toHaveBeenCalledTimes(1);
  });

  it('rejects a production acknowledgement on the dogfood path before effects', async () => {
    const fixture = dependencies({
      GITBLOCKS_ARTIFACT_PRODUCTION_ACK:
        ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
    });

    await expect(
      runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
    ).rejects.toThrow('GITBLOCKS_ARTIFACT_PRODUCTION_ACK');
    expectRejectedBeforeArtifactEffects(fixture);
  });

  it('rejects simultaneous dogfood and production configuration before effects', async () => {
    const fixture = dependencies({
      GITBLOCKS_ARTIFACT_PRODUCTION_ACK:
        ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
      DATABASE_URL: productionDatabaseUrl('gitblocks_artifacts'),
    });

    await expect(
      runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
    ).rejects.toThrow('mutually exclusive');
    expectRejectedBeforeArtifactEffects(fixture);
  });

  it('rejects a production _test database before effects', async () => {
    const fixture = dependencies({
      GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT: undefined,
      GITBLOCKS_ARTIFACT_DB_SCOPE: undefined,
      GITBLOCKS_ARTIFACT_PERSISTENT_ACK: undefined,
      GITBLOCKS_ARTIFACT_DB_HOST: undefined,
      GITBLOCKS_ARTIFACT_DB_PORT: undefined,
      GITBLOCKS_ARTIFACT_DB_DATABASE: undefined,
      GITBLOCKS_ARTIFACT_DB_USERNAME: undefined,
      GITBLOCKS_ARTIFACT_DB_PASSWORD: undefined,
      GITBLOCKS_ARTIFACT_DB_SSL: undefined,
      GITBLOCKS_ARTIFACT_PRODUCTION_ACK:
        ARTIFACT_LIVE_PRODUCTION_ACKNOWLEDGEMENT_V1,
      DATABASE_URL: productionDatabaseUrl('gitblocks_artifacts_test'),
    });

    await expect(
      runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
    ).rejects.toThrow('DATABASE_URL database name must not end in _test.');
    expectRejectedBeforeArtifactEffects(fixture);
  });

  it.each([
    [
      'missing global acknowledgement',
      { GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT: undefined },
    ],
    [
      'wrong global acknowledgement',
      { GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT: 'wrong-global-ack' },
    ],
    [
      'missing persistent acknowledgement',
      { GITBLOCKS_ARTIFACT_PERSISTENT_ACK: undefined },
    ],
    [
      'wrong persistent acknowledgement',
      { GITBLOCKS_ARTIFACT_PERSISTENT_ACK: 'wrong-persistent-ack' },
    ],
    ['missing database scope', { GITBLOCKS_ARTIFACT_DB_SCOPE: undefined }],
    ['unknown database scope', { GITBLOCKS_ARTIFACT_DB_SCOPE: 'production' }],
    ['localhost', { GITBLOCKS_ARTIFACT_DB_HOST: 'localhost' }],
    ['wildcard host', { GITBLOCKS_ARTIFACT_DB_HOST: '0.0.0.0' }],
    ['remote host', { GITBLOCKS_ARTIFACT_DB_HOST: 'db.example.test' }],
    ['wrong database', { GITBLOCKS_ARTIFACT_DB_DATABASE: 'another_test' }],
    ['postgres username', { GITBLOCKS_ARTIFACT_DB_USERNAME: 'postgres' }],
    [
      'database owner shaped username',
      { GITBLOCKS_ARTIFACT_DB_USERNAME: 'gitblocks_dogfood_owner' },
    ],
    [
      'persistence group username',
      { GITBLOCKS_ARTIFACT_DB_USERNAME: 'gitblocks_persistence' },
    ],
    [
      'serving username',
      { GITBLOCKS_ARTIFACT_DB_USERNAME: 'gitblocks_serving' },
    ],
    [
      'arbitrary username',
      { GITBLOCKS_ARTIFACT_DB_USERNAME: 'artifact-writer' },
    ],
    ['required SSL', { GITBLOCKS_ARTIFACT_DB_SSL: 'require' }],
    ['missing host', { GITBLOCKS_ARTIFACT_DB_HOST: undefined }],
    ['missing port', { GITBLOCKS_ARTIFACT_DB_PORT: undefined }],
    ['missing database', { GITBLOCKS_ARTIFACT_DB_DATABASE: undefined }],
    ['missing username', { GITBLOCKS_ARTIFACT_DB_USERNAME: undefined }],
    ['missing password', { GITBLOCKS_ARTIFACT_DB_PASSWORD: undefined }],
    ['missing SSL', { GITBLOCKS_ARTIFACT_DB_SSL: undefined }],
    ['port below bound', { GITBLOCKS_ARTIFACT_DB_PORT: '0' }],
    ['port above bound', { GITBLOCKS_ARTIFACT_DB_PORT: '65536' }],
  ] as const)(
    'rejects %s before transport, collector, provider, persistence publication, or receipt effects',
    async (_name, overrides) => {
      const fixture = dependencies(overrides);

      await expect(
        runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
      ).rejects.toBeInstanceOf(Error);
      expectRejectedBeforeArtifactEffects(fixture);
    },
  );

  it.each([6, 8])(
    'rejects migration %i after verification but before artifact effects',
    async (migrationVersion) => {
      const fixture = dependencies({}, migrationVersion);

      await expect(
        runArtifactLiveCliV1(ARGUMENTS, fixture.dependencies),
      ).rejects.toThrow(
        'The artifact database must be verified at migration 0007.',
      );
      expect(fixture.createClient).toHaveBeenCalledTimes(1);
      expect(fixture.verifyMigrations).toHaveBeenCalledTimes(1);
      expect(fixture.closeClient).toHaveBeenCalledTimes(1);
      expectRejectedBeforeArtifactEffects(fixture, true);
    },
  );

  it('exercises the accepted persistent command boundary in a separate offline process', async () => {
    const result = await executeFile(
      process.execPath,
      [
        '--conditions=gitblocks-source',
        'packages/ingestion/test/artifact-live-process-fixture.ts',
      ],
      {
        cwd: new URL('../../../', import.meta.url),
        env: { PATH: process.env['PATH'] },
      },
    );

    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual([
      'create-client',
      'verify-migration-7',
      'create-transport',
      'create-collector',
      'collect-artifacts',
      'provider-request-fake',
      'persistence-publication-fake',
      'write-receipt-fake',
      'stdout',
      'close-client',
    ]);
  });
});

function dependencies(
  environmentOverrides: Readonly<Record<string, string | undefined>> = {},
  migrationVersion = 7,
) {
  const environmentValues: Record<string, string | undefined> = {
    GITBLOCKS_ARTIFACT_ACKNOWLEDGEMENT: ARTIFACT_LIVE_GLOBAL_ACKNOWLEDGEMENT_V1,
    GITBLOCKS_ARTIFACT_DB_SCOPE: 'persistent-private-alpha-dogfood',
    GITBLOCKS_ARTIFACT_PERSISTENT_ACK:
      ARTIFACT_LIVE_PERSISTENT_ACKNOWLEDGEMENT_V1,
    GITBLOCKS_ARTIFACT_DB_HOST: '127.0.0.1',
    GITBLOCKS_ARTIFACT_DB_PORT: '49152',
    GITBLOCKS_ARTIFACT_DB_DATABASE: 'gitblocks_dogfood_test',
    GITBLOCKS_ARTIFACT_DB_USERNAME: 'gitblocks_persistence_dogfood',
    GITBLOCKS_ARTIFACT_DB_PASSWORD: 'database-password-sentinel',
    GITBLOCKS_ARTIFACT_DB_SSL: 'false',
    GITBLOCKS_ARTIFACT_GITHUB_TOKEN: 'github-token-sentinel',
    GITBLOCKS_ARTIFACT_PRODUCTION_ACK: undefined,
    DATABASE_URL: undefined,
    ...environmentOverrides,
  };
  const events: string[] = [];
  const environment = vi.fn((name: string) => {
    events.push(`environment:${name}`);
    return environmentValues[name];
  });
  const createClient = vi.fn(() => {
    events.push('create-client');
    return CLIENT;
  });
  const closeClient = vi.fn(() => {
    events.push('close-client');
    return Promise.resolve();
  });
  const verifyMigrations = vi.fn(() => {
    events.push('verify-migrations');
    return Promise.resolve(migrationVerification(migrationVersion));
  });
  const providerRequest = vi.fn(() => events.push('provider-request'));
  const persistencePublication = vi.fn(() =>
    events.push('persistence-publication'),
  );
  const transport = {
    requestJson: vi.fn(() => Promise.reject(new Error('not called directly'))),
    getMetrics: () => ({
      providerRequestCounts: { github: 0, npm: 0 },
      githubRateLimit: null,
    }),
  };
  const collector: RepositoryArtifactCollector = {
    collectCandidate: vi.fn(() =>
      Promise.reject(new Error('not called directly')),
    ),
  };
  const createTransport = vi.fn(() => {
    events.push('create-transport');
    return transport;
  });
  const createCollector = vi.fn(() => {
    events.push('create-collector');
    return collector;
  });
  const collectArtifacts = vi.fn(() => {
    events.push('collect-artifacts');
    providerRequest();
    persistencePublication();
    return Promise.resolve(RECEIPT);
  });
  const receiptWrite = vi.fn((path: string) => {
    events.push(`write-receipt:${path}`);
    return Promise.resolve();
  });
  const dependencies: ArtifactLiveCliDependenciesV1 = {
    readTextFile: (path) => {
      events.push(`read:${path}`);
      return Promise.resolve(
        path.endsWith('artifact-manifest.json') ? manifestText : catalogText,
      );
    },
    writeTextFileExclusive: receiptWrite,
    readEnvironment: environment,
    createPersistenceClient: createClient,
    closePersistenceClient: closeClient,
    verifyMigrations,
    createTransport,
    createRepositoryArtifactCollector: createCollector,
    collectPublicRepositoryArtifacts: collectArtifacts,
    fetch: vi.fn(() => Promise.reject(new Error('network forbidden'))),
    sleep: vi.fn(() => Promise.resolve()),
    clock: { now: () => new Date('2026-08-13T00:00:00.000Z') },
    writeStdout: () => events.push('stdout'),
    writeStderr: vi.fn(),
  };
  return {
    dependencies,
    events,
    environment,
    createClient,
    closeClient,
    verifyMigrations,
    createTransport,
    createCollector,
    collectArtifacts,
    providerRequest,
    persistencePublication,
    receiptWrite,
  };
}

function productionDatabaseUrl(database: string): string {
  return [
    'postgresql:',
    '//operator:',
    'production-password-sentinel',
    '@managed.invalid/',
    database,
  ].join('');
}

function migrationVerification(version: number): MigrationVerification {
  return {
    postgresqlVersion: '18.4',
    migrations: [
      { version, name: 'synthetic-migration', checksum: '5'.repeat(64) },
    ],
  };
}

function expectRejectedBeforeArtifactEffects(
  fixture: ReturnType<typeof dependencies>,
  afterClientCreation = false,
): void {
  if (!afterClientCreation) {
    expect(fixture.createClient).not.toHaveBeenCalled();
    expect(fixture.verifyMigrations).not.toHaveBeenCalled();
    expect(fixture.closeClient).not.toHaveBeenCalled();
  }
  expect(fixture.createTransport).not.toHaveBeenCalled();
  expect(fixture.createCollector).not.toHaveBeenCalled();
  expect(fixture.collectArtifacts).not.toHaveBeenCalled();
  expect(fixture.providerRequest).not.toHaveBeenCalled();
  expect(fixture.persistencePublication).not.toHaveBeenCalled();
  expect(fixture.receiptWrite).not.toHaveBeenCalled();
}
