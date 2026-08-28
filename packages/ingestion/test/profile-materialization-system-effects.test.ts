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
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  PROFILE_MATERIALIZATION_FIXED_PATHS,
  buildProfileMaterializationArtifacts,
  buildProfileMaterializationReceipt,
  compareProfileMaterializationSources,
  controlledFailureCounts,
  deriveProfileMaterializationLiveIdempotency,
  parseProfileMaterializationPersistenceProof,
  parseProfileMaterializationSourceAuthority,
  persistenceProofCounts,
  sourceOutcomeCounts,
  sourceRecordCounts,
  validateProfileMaterializationReceipt,
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
      '87ab01579dbc9d2fea8c0da50c44f3cdbff31bc94ff50eb64fd900d666bd2ca1',
    );
    expect(first.persistenceProof.proofSemanticDigest).toBe(
      'eda1494efc94fe6c07556c34514034792ea0d4b8796b3566050045245126fe9d',
    );
    expect(second.persistenceProof.proofSemanticDigest).toBe(
      'a47c9d14bee3cef747b8eb0db9e98bc13977798ffc19ae243bd03520b207dbdd',
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

  it('preserves newly persisted evidence when a qualified first collection recovers', async () => {
    const scenario = await collectQualifiedRecoveryScenario('first');
    const candidateId = 'auth-casbin-casbin-js';
    const firstEntry = scenario.first.persistenceProof.entries.find(
      (entry) => entry.candidateId === candidateId,
    );
    const secondEntry = scenario.second.persistenceProof.entries.find(
      (entry) => entry.candidateId === candidateId,
    );
    expect(firstEntry).toMatchObject({
      disposition: 'qualified-not-persisted',
      evidenceAppended: 0,
      snapshotId: null,
    });
    expect(secondEntry).toMatchObject({
      disposition: 'persisted',
      outcome: 'created',
      candidateState: 'created',
      snapshotState: 'created',
      evidenceAppended: 10,
    });

    const recoveredRecords =
      scenario.second.sourceAuthority.sourceRecords.filter(
        (record) => record.candidateId === candidateId,
      );
    expect(recoveredRecords).toHaveLength(7);
    expect(
      recoveredRecords.every(
        (record) =>
          record.outcome === 'established-value' &&
          record.evidenceIds.length > 0,
      ),
    ).toBe(true);
    const recoveredEvidenceIds = recoveredRecords.flatMap(
      (record) => record.evidenceIds,
    );
    expect(recoveredEvidenceIds).toHaveLength(10);
    expect(new Set(recoveredEvidenceIds)).toEqual(
      new Set(
        scenario.prior
          .get(candidateId)
          ?.observations.map((observation) => observation.evidenceId) ?? [],
      ),
    );
    expect(
      parseProfileMaterializationSourceAuthority(
        scenario.second.sourceAuthority,
        scenario.fixture,
      ),
    ).toEqual(scenario.second.sourceAuthority);
    expect(
      parseProfileMaterializationPersistenceProof(
        scenario.second.persistenceProof,
        {
          collection: 'second',
          sourceAuthority: scenario.second.sourceAuthority,
          candidateIds: scenario.second.sourceAuthority.candidates.map(
            (candidate) => candidate.candidateId,
          ),
        },
      ),
    ).toEqual(scenario.second.persistenceProof);
    expect(scenario.liveIdempotency).toBe('qualified-optional-source-failures');
    expect(scenario.receipt.qualification).toBe(
      'qualified-optional-source-failures',
    );
    expect(scenario.receipt.controlledFailureCounts).toEqual([
      { code: 'provider-temporarily-unavailable', count: 1 },
    ]);
    expect(scenario.receipt.sourceDriftCounts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceType: 'github-license', changed: 1 }),
      ]),
    );
    expect(
      scenario.receipt.sourceDriftCounts.reduce(
        (total, entry) => total + entry.changed,
        0,
      ),
    ).toBe(1);
    expect(secondEntry?.outcome).not.toBe('unchanged');
  }, 30_000);

  it('preserves prior evidence while a complete first collection becomes qualified', async () => {
    const scenario = await collectQualifiedRecoveryScenario('second');
    const candidateId = 'auth-casbin-casbin-js';
    const firstRecords = scenario.first.sourceAuthority.sourceRecords.filter(
      (record) => record.candidateId === candidateId,
    );
    const secondRecords = scenario.second.sourceAuthority.sourceRecords.filter(
      (record) => record.candidateId === candidateId,
    );
    const secondLicense = secondRecords.find(
      (record) => record.operation === 'github-license',
    );
    expect(secondLicense).toMatchObject({
      outcome: 'unavailable',
      controlledCode: 'provider-temporarily-unavailable',
      evidenceIds: [],
    });
    for (const firstRecord of firstRecords.filter(
      (record) => record.operation !== 'github-license',
    )) {
      const secondRecord = secondRecords.find(
        (record) =>
          record.logicalSourceIdentityDigest ===
          firstRecord.logicalSourceIdentityDigest,
      );
      expect(secondRecord?.sourceRecordDigest).toBe(
        firstRecord.sourceRecordDigest,
      );
      expect(secondRecord?.evidenceIds).toEqual(firstRecord.evidenceIds);
    }
    expect(
      scenario.second.persistenceProof.entries.find(
        (entry) => entry.candidateId === candidateId,
      ),
    ).toMatchObject({
      disposition: 'qualified-not-persisted',
      evidenceAppended: 0,
      evidenceSuperseded: 0,
      evidenceInvalidated: 0,
    });
    expect(scenario.persistenceCalls.get(candidateId)).toBe(1);
    expect(scenario.liveIdempotency).toBe('qualified-optional-source-failures');
    expect(scenario.receipt.qualification).toBe(
      'qualified-optional-source-failures',
    );
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

async function collectQualifiedRecoveryScenario(
  qualifiedCollection: 'first' | 'second',
) {
  const fixture = await buildFakeSourceAuthority();
  const candidateId = 'auth-casbin-casbin-js';
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
  const prior = new Map<string, ActiveDossierMaterial>();
  const persistenceCalls = new Map<string, number>();
  const persistenceAdapter: ProfileMaterializationPersistenceAdapter = {
    createClient: () => ({}) as PersistenceClient,
    closeClient: () => Promise.resolve(),
    seedCatalog: () => Promise.resolve(),
    loadPriorMaterial: (_client, id) =>
      Promise.resolve(
        prior.get(id) ?? { observations: [], limitations: [], unknowns: [] },
      ),
    persistCandidateProfile: (_client, profile) => {
      const id = profile.identity.candidateId;
      const existing = prior.get(id);
      const created = existing === undefined;
      persistenceCalls.set(id, (persistenceCalls.get(id) ?? 0) + 1);
      prior.set(id, {
        observations: profile.observations,
        limitations: profile.limitations,
        unknowns: profile.unknowns,
      });
      return Promise.resolve({
        candidateId: id,
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
        snapshotState: created ? ('created' as const) : ('idempotent' as const),
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
    collectCandidateSources: (candidate, collectedAt) => {
      const complete = fakeCollectionForCandidate(
        fixture.authority,
        candidate,
        collectedAt,
      );
      const isFirstCollection = collectedAt === '2026-08-05T00:00:00.000Z';
      const isQualified =
        candidate.candidateId === candidateId &&
        ((qualifiedCollection === 'first' && isFirstCollection) ||
          (qualifiedCollection === 'second' && !isFirstCollection));
      if (!isQualified) return Promise.resolve(complete);
      return Promise.resolve({
        sourceRecords: complete.sourceRecords.map((record) =>
          record.operation === 'github-license'
            ? {
                ...record,
                outcome: 'unavailable' as const,
                normalizedValue: null,
                controlledCode: 'provider-temporarily-unavailable',
                evidenceIds: [],
              }
            : record,
        ),
        qualifiedFailureCodes: ['provider-temporarily-unavailable'],
        legacyBundle: null,
      });
    },
  });
  const credentials = {
    githubToken: 'fake-github-token',
    ownerUrl: 'unused-owner-url',
    ownerPassword: 'unused-owner-password',
    runtimeUrl: 'unused-runtime-url',
    runtimePassword: 'unused-runtime-password',
  };
  const signal = new AbortController().signal;
  await effects.prepareDatabase(preflight, credentials, signal);
  const first = await effects.collectSourceAuthority(
    'first',
    preflight,
    credentials,
    null,
    signal,
  );
  const second = await effects.collectSourceAuthority(
    'second',
    preflight,
    credentials,
    first.sourceAuthority,
    signal,
  );
  const liveIdempotency = deriveProfileMaterializationLiveIdempotency({
    firstAuthority: first.sourceAuthority,
    secondAuthority: second.sourceAuthority,
    firstProof: first.persistenceProof,
    secondProof: second.persistenceProof,
  });
  const firstArtifacts = buildProfileMaterializationArtifacts(
    fixture.catalog,
    fixture.taxonomy,
    first.sourceAuthority,
  );
  const secondArtifacts = buildProfileMaterializationArtifacts(
    fixture.catalog,
    fixture.taxonomy,
    second.sourceAuthority,
  );
  const drift = compareProfileMaterializationSources(
    first.sourceAuthority,
    second.sourceAuthority,
  );
  const failures = controlledFailureCounts([
    first.sourceAuthority,
    second.sourceAuthority,
  ]);
  const receipt = validateProfileMaterializationReceipt(
    buildProfileMaterializationReceipt({
      receiptVersion: 'profile-materialization-receipt/1.0.0',
      operatorVersion: 'profile-materialization-operator/1.0.0',
      providerPolicyVersion: 'profile-materialization-provider-policy/1.0.0',
      providerPolicyDigest: fixture.policy.policySemanticDigest,
      sourceAuthorityVersion: 'profile-materialization-source-authority/1.0.0',
      persistenceProofVersion:
        'profile-materialization-persistence-proof/1.0.0',
      firstPersistenceProofSemanticDigest:
        first.persistenceProof.proofSemanticDigest,
      secondPersistenceProofSemanticDigest:
        second.persistenceProof.proofSemanticDigest,
      firstPersistenceCounts: persistenceProofCounts(first.persistenceProof),
      secondPersistenceCounts: persistenceProofCounts(second.persistenceProof),
      firstSourceAuthoritySemanticDigest:
        first.sourceAuthority.authoritySemanticDigest,
      secondSourceAuthoritySemanticDigest:
        second.sourceAuthority.authoritySemanticDigest,
      finalSourceAuthoritySemanticDigest:
        second.sourceAuthority.authoritySemanticDigest,
      firstSourceRecordCounts: sourceRecordCounts(first.sourceAuthority),
      secondSourceRecordCounts: sourceRecordCounts(second.sourceAuthority),
      firstSourceOutcomeCounts: sourceOutcomeCounts(first.sourceAuthority),
      secondSourceOutcomeCounts: sourceOutcomeCounts(second.sourceAuthority),
      sourceDriftComparisonDigest: drift.comparisonDigest,
      sourceDriftCounts: drift.counts,
      firstPassA: passDigests(firstArtifacts),
      firstPassB: passDigests(firstArtifacts),
      secondPassA: passDigests(secondArtifacts),
      secondPassB: passDigests(secondArtifacts),
      sameEvidenceReproduction: 'passed',
      liveIdempotency,
      qualification: 'qualified-optional-source-failures',
      catalogVersion: 'public-v1',
      catalogDigest: fixture.catalog.manifestDigest,
      taxonomyVersion: '1.0.0',
      taxonomyDigest: fixture.taxonomy.semanticDigest,
      profileSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.profileSchemaDigest,
      profileAuthoritySchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.profileAuthoritySchemaDigest,
      profileRulesVersion: 'deterministic-candidate-profile-rules/1.0.0',
      projectionVersion: 'profile-materialization-projection/1.0.0',
      migrationInventoryDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.migrationInventoryDigest,
      migrationCount: 4,
      databaseSchemaDigest:
        PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.databaseSchemaDigest,
      productTableCount: 25,
      candidateCount: 150,
      aggregateFieldStates: secondArtifacts.coverage.aggregate.final,
      fieldCoverage: secondArtifacts.coverage.perField.map((field) => ({
        fieldId: field.fieldId,
        ...field.final,
      })),
      familyCoverage: secondArtifacts.coverage.perFamily.map((family) => ({
        family: family.family,
        ...family.final,
      })),
      controlledFailureCounts: failures,
      runIdDigest: 'c'.repeat(64),
    }),
  );
  return {
    fixture,
    first,
    second,
    prior,
    persistenceCalls,
    liveIdempotency,
    receipt,
  };
}

function passDigests(
  artifacts: ReturnType<typeof buildProfileMaterializationArtifacts>,
) {
  return {
    profileAuthorityDigest: artifacts.authority.semanticAuthorityDigest,
    profileCoverageDigest: artifacts.coverage.coverageSemanticDigest,
  };
}
