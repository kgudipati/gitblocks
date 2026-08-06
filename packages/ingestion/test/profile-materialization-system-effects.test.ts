import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PROFILE_MATERIALIZATION_EXPECTED_DATABASE_SCHEMA_DIGEST,
  PROFILE_MATERIALIZATION_MIGRATION_INVENTORY_DIGEST,
  PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
  createProfileMaterializationDatabasePlan,
  type ActiveDossierMaterial,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { describe, expect, it } from 'vitest';

import {
  PROFILE_MATERIALIZATION_FIXED_PATHS,
  persistenceProofCounts,
  type ProfileMaterializationArguments,
  type ProfileMaterializationPreflightResult,
} from '../src/index.ts';
import {
  createProfileMaterializationSystemEffects,
  type ProfileMaterializationPersistenceAdapter,
} from '../scripts/profile-materialization-system-effects.ts';
import {
  buildFakeSourceAuthority,
  buildFakePersistenceProof,
  fakeCollectionForCandidate,
} from './profile-materialization-fixtures.ts';

describe('profile-materialization fixed filesystem boundary', () => {
  it('rejects symlinked fixed inputs without consulting clock, environment, fetch, or database', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gitblocks-m7a-path-'));
    try {
      const target = join(root, 'controlled.json');
      const catalogDirectory = join(root, 'catalog/public-v1');
      await mkdir(catalogDirectory, { recursive: true });
      await writeFile(target, '{}', { mode: 0o600 });
      await symlink(
        target,
        join(catalogDirectory, 'profile-materialization-provider-policy.json'),
      );
      const effects = createProfileMaterializationSystemEffects({
        repositoryRoot: root,
        environment: new Proxy(
          {},
          {
            get: () => {
              throw new Error('environment access was not expected');
            },
          },
        ),
        fetch: () => {
          throw new Error('fetch was not expected');
        },
        now: () => {
          throw new Error('clock access was not expected');
        },
        databaseOperator: deniedDatabase(),
      });
      await expect(
        effects.readFixedFile(PROFILE_MATERIALIZATION_FIXED_PATHS.policy),
      ).rejects.toThrow();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('rejects a symlinked run-directory parent before any credential read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gitblocks-m7a-path-'));
    try {
      for (const path of [
        PROFILE_MATERIALIZATION_FIXED_PATHS.catalog,
        PROFILE_MATERIALIZATION_FIXED_PATHS.taxonomy,
        PROFILE_MATERIALIZATION_FIXED_PATHS.policy,
      ]) {
        const target = join(root, path);
        await mkdir(join(target, '..'), { recursive: true });
        await writeFile(target, '{}', { mode: 0o600 });
      }
      await mkdir(join(root, 'outside'), { mode: 0o700 });
      await mkdir(join(root, 'verification/retrieval-v1'), {
        recursive: true,
      });
      await symlink(
        join(root, 'outside'),
        join(root, 'verification/retrieval-v1/.profile-materialization-runs'),
      );
      const effects = createProfileMaterializationSystemEffects({
        repositoryRoot: root,
        environment: {},
        fetch: () => {
          throw new Error('fetch was not expected');
        },
        now: () => {
          throw new Error('clock access was not expected');
        },
        databaseOperator: deniedDatabase(),
      });
      await expect(
        effects.validateFixedPaths({
          catalogPath: PROFILE_MATERIALIZATION_FIXED_PATHS.catalog,
          taxonomyPath: PROFILE_MATERIALIZATION_FIXED_PATHS.taxonomy,
          providerPolicyPath: PROFILE_MATERIALIZATION_FIXED_PATHS.policy,
          runDirectory:
            'verification/retrieval-v1/.profile-materialization-runs/m7-abcdefghijklmnopqrstuvwxyz',
        } as ProfileMaterializationArguments),
      ).rejects.toThrow();
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });

  it('uses only the prepared runtime login for both durable collection proofs and closes every client', async () => {
    const fixture = await buildFakeSourceAuthority();
    const databasePlan = createProfileMaterializationDatabasePlan({
      runId: 'm7-abcdefghijklmnopqrstuvwxyz',
      image: PROFILE_MATERIALIZATION_POSTGRES_IMAGE,
      host: '127.0.0.1',
      port: 55432,
      ownerPasswordEnvironmentName:
        'GITBLOCKS_PROFILE_MATERIALIZATION_DB_OWNER_PASSWORD',
    });
    const runtimeConfig: PersistenceClientConfig = {
      host: '127.0.0.1',
      port: 55432,
      database: databasePlan.identity.databaseName,
      username: databasePlan.identity.runtimeRoleName,
      password: 'fake-runtime-password',
      ssl: false,
      maximumConnections: 3,
      connectTimeoutMilliseconds: 5_000,
      idleTimeoutMilliseconds: 5_000,
      statementTimeoutMilliseconds: 10_000,
      lockTimeoutMilliseconds: 5_000,
    };
    const preflight = {
      arguments: {
        concurrency: 3,
        candidateDeadlineMilliseconds: 90_000,
      } as ProfileMaterializationArguments,
      catalog: fixture.catalog,
      taxonomy: fixture.taxonomy,
      policy: fixture.policy,
      databasePlan,
      commandPlanDigest: '0'.repeat(64),
    } satisfies ProfileMaterializationPreflightResult;
    const events: string[] = [];
    const prior = new Map<string, ActiveDossierMaterial>();
    const clients = new Set<PersistenceClient>();
    const persistenceAdapter: ProfileMaterializationPersistenceAdapter = {
      createClient: (config) => {
        expect(config.username).toBe(databasePlan.identity.runtimeRoleName);
        const client = {} as PersistenceClient;
        clients.add(client);
        events.push(`open:${config.username}`);
        return client;
      },
      closeClient: (client) => {
        expect(clients.delete(client)).toBe(true);
        events.push('close');
        return Promise.resolve();
      },
      seedCatalog: (_preflight, client) => {
        expect(clients.has(client)).toBe(true);
        events.push('seed-runtime');
        return Promise.resolve();
      },
      loadPriorMaterial: (_client, candidateId) =>
        Promise.resolve(
          prior.get(candidateId) ?? {
            observations: [],
            limitations: [],
            unknowns: [],
          },
        ),
      persistCandidateProfile: (_client, profile) => {
        const existing = prior.get(profile.identity.candidateId);
        const created = existing === undefined;
        prior.set(profile.identity.candidateId, {
          observations: profile.observations,
          limitations: profile.limitations,
          unknowns: profile.unknowns,
        });
        return Promise.resolve({
          candidateId: profile.identity.candidateId,
          outcome: created ? ('created' as const) : ('unchanged' as const),
          snapshotId: profile.snapshotId,
          evidenceAppended: created ? profile.observations.length : 0,
          evidenceIdempotent: created ? 0 : profile.observations.length,
          evidenceSuperseded: 0,
          evidenceInvalidated: 0,
          limitationCount: profile.limitations.length,
          unknownCount: profile.unknowns.length,
          candidateState: created
            ? ('created' as const)
            : ('idempotent' as const),
          snapshotState: created
            ? ('created' as const)
            : ('idempotent' as const),
          incompleteSourceCodes: [],
          safeErrorCode: null,
        });
      },
    };
    let collectionClock = 0;
    const effects = createProfileMaterializationSystemEffects({
      repositoryRoot: process.cwd(),
      environment: {},
      fetch: () => {
        throw new Error('fetch was not expected');
      },
      now: () =>
        new Date(
          collectionClock++ === 0
            ? '2026-08-05T00:00:00.000Z'
            : '2026-08-05T01:00:00.000Z',
        ),
      databaseOperator: {
        ...deniedDatabase(),
        prepare: () =>
          Promise.resolve({
            runtimeConfig,
            migrationInventoryDigest:
              PROFILE_MATERIALIZATION_MIGRATION_INVENTORY_DIGEST,
            migrationCount: 4,
            databaseSchemaDigest:
              PROFILE_MATERIALIZATION_EXPECTED_DATABASE_SCHEMA_DIGEST,
            productTableCount: 25,
          }),
      },
      persistenceAdapter,
      collectCandidateSources: (candidate, collectedAt) =>
        Promise.resolve(
          fakeCollectionForCandidate(fixture.authority, candidate, collectedAt),
        ),
    });
    const credentials = {
      githubToken: 'fake-github-token',
      ownerUrl: 'unused-owner-url',
      ownerPassword: 'unused-owner-password',
      runtimeUrl: 'unused-runtime-url',
      runtimePassword: 'unused-runtime-password',
    };
    await effects.prepareDatabase(
      preflight,
      credentials,
      new AbortController().signal,
    );
    const first = await effects.collectSourceAuthority(
      'first',
      preflight,
      credentials,
      null,
      new AbortController().signal,
    );
    const second = await effects.collectSourceAuthority(
      'second',
      preflight,
      credentials,
      first.sourceAuthority,
      new AbortController().signal,
    );
    expect(first.sourceAuthority.authoritySemanticDigest).toBe(
      second.sourceAuthority.authoritySemanticDigest,
    );
    expect(first.sourceAuthority.authoritySemanticDigest).toBe(
      '2d8137fae2f22c167232d9086df07e8f737dab0208edb9e384bfb2cc6219f54b',
    );
    expect(first.persistenceProof.proofSemanticDigest).toBe(
      'ba1cfb1144aa0492f153c999c33cee9f5ff903ac04d0f9415fb5c7c1e5e7dca6',
    );
    expect(second.persistenceProof.proofSemanticDigest).toBe(
      '7ce52187715f088381a476626b7953f887fc3ae9c7961124775e88129c36ea8d',
    );
    expect(persistenceProofCounts(first.persistenceProof)).toMatchObject({
      persistedCandidateCount: 150,
      created: 150,
      unchanged: 0,
      evidenceAppended: 1_143,
      evidenceIdempotent: 0,
    });
    expect(persistenceProofCounts(second.persistenceProof)).toMatchObject({
      persistedCandidateCount: 150,
      created: 0,
      unchanged: 150,
      evidenceAppended: 0,
      evidenceIdempotent: 1_143,
      evidenceSuperseded: 0,
      evidenceInvalidated: 0,
    });
    const persistedEvidenceIds = new Set(
      [...prior.values()].flatMap((material) =>
        material.observations.map((observation) => observation.evidenceId),
      ),
    );
    const requiredEvidenceOperations = new Set([
      'github-repository-metadata',
      'github-default-branch-head',
      'github-community-profile',
      'github-allowlisted-file',
      'npm-package',
    ]);
    expect(
      first.sourceAuthority.sourceRecords
        .filter(
          (record) =>
            record.outcome === 'established-value' &&
            requiredEvidenceOperations.has(record.operation),
        )
        .every(
          (record) =>
            record.evidenceIds.length > 0 &&
            record.evidenceIds.every((evidenceId) =>
              persistedEvidenceIds.has(evidenceId),
            ),
        ),
    ).toBe(true);
    expect(events.filter((event) => event === 'seed-runtime')).toHaveLength(1);
    expect(events.filter((event) => event === 'close')).toHaveLength(3);
    expect(clients.size).toBe(0);
  }, 30_000);

  it('publishes each untracked persistence proof with a private fixed path and mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'gitblocks-m7a-proof-'));
    try {
      await mkdir(join(root, 'verification/retrieval-v1'), {
        recursive: true,
      });
      const fixture = await buildFakeSourceAuthority();
      const effects = createProfileMaterializationSystemEffects({
        repositoryRoot: root,
        environment: {},
        fetch: () => {
          throw new Error('fetch was not expected');
        },
        now: () => {
          throw new Error('clock was not expected');
        },
        databaseOperator: deniedDatabase(),
      });
      const runDirectory =
        'verification/retrieval-v1/.profile-materialization-runs/m7-abcdefghijklmnopqrstuvwxyz';
      await effects.publishPersistenceProof(
        'first',
        buildFakePersistenceProof(fixture.authority, 'first'),
        {
          arguments: { runDirectory } as ProfileMaterializationArguments,
        } as ProfileMaterializationPreflightResult,
      );
      const proofPath = join(
        root,
        runDirectory,
        'first-persistence-proof.json',
      );
      const stat = await lstat(proofPath);
      expect(stat.isFile()).toBe(true);
      expect(stat.isSymbolicLink()).toBe(false);
      expect(stat.mode & 0o777).toBe(0o600);
      expect(JSON.parse(await readFile(proofPath, 'utf8'))).toMatchObject({
        proofVersion: 'profile-materialization-persistence-proof/1.0.0',
        collection: 'first',
      });
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});

function deniedDatabase() {
  const denied = (): never => {
    throw new Error('database access was not expected');
  };
  return {
    create: denied,
    proveEmpty: denied,
    prepare: denied,
    dispose: denied,
    proveDisposed: denied,
  };
}
