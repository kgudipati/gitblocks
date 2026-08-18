import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { createRepositoryArtifactSetV1 } from '@gitblocks/contracts';
import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  publishRepositoryArtifactSet,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createPublicCatalogSeedPlan,
  manifestWithDigest,
  parsePublicCatalog,
  seedPublicCatalogV1,
  selectionId,
  type CatalogSeedPersistencePort,
  type PublicCatalog,
} from '../src/index.ts';

const CATALOG_PATH = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);
const CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';
const ARTIFACT_MANIFEST_DIGEST =
  '17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c';

let runtimeClient: PersistenceClient | undefined;
let runtimeConfig: PersistenceClientConfig | undefined;
let catalog: PublicCatalog;
let ownerSql: TestSql | undefined;
let runtimeSql: TestSql | undefined;

beforeAll(async () => {
  const ownerConfig = readOwnerDatabaseConfig();
  const database = isolatedDatabaseName(ownerConfig.database);
  ownerSql = createTestSql(ownerConfig);
  await ownerSql.unsafe(`create database "${database}"`);
  const isolatedOwnerConfig = { ...ownerConfig, database };
  const migrationClient = createPersistenceClient(isolatedOwnerConfig);
  try {
    await applyMigrations(migrationClient);
  } finally {
    await closePersistenceClient(migrationClient);
  }
  runtimeConfig = {
    ...isolatedOwnerConfig,
    username: 'gitblocks_persistence_test',
    password: 'persistence-test-only',
  };
  runtimeClient = createPersistenceClient(runtimeConfig);
  runtimeSql = createTestSql(runtimeConfig);
  catalog = parsePublicCatalog(await readFile(CATALOG_PATH, 'utf8'));
});

afterAll(async () => {
  if (runtimeClient !== undefined) await closePersistenceClient(runtimeClient);
  if (runtimeSql !== undefined) {
    await runtimeSql.end({ timeout: 5 });
  }
  if (ownerSql !== undefined && runtimeConfig !== undefined) {
    await ownerSql.unsafe(
      `drop database "${runtimeConfig.database}" with (force)`,
    );
    await ownerSql.end({ timeout: 5 });
  }
});

describe('catalog-only seed on PostgreSQL 18.4', () => {
  it('seeds the full catalog only, replays idempotently, rejects drift, and admits artifact provenance', async () => {
    if (runtimeClient === undefined || runtimeSql === undefined) {
      throw new Error('PostgreSQL catalog seed test setup is incomplete.');
    }
    const persistence = persistencePort(runtimeClient);
    const sql = runtimeSql;

    for (const migration of [3, 5] as const) {
      await expect(
        seedPublicCatalogV1({
          catalog,
          databaseMigrationVersion: migration,
          persistence,
        }),
      ).rejects.toThrow();
      expect(await tableCount(sql, 'catalog_candidates')).toBe(0);
    }

    const plan = createPublicCatalogSeedPlan(catalog);
    const summary = await seedPublicCatalogV1({
      catalog,
      databaseMigrationVersion: 4,
      persistence,
    });
    expect(summary).toEqual({
      schemaVersion: '1.0.0',
      status: 'catalog-seed-complete',
      catalogVersion: 'public-v1',
      catalogDigest: CATALOG_DIGEST,
      databaseMigrationVersion: 4,
      candidateCount: 150,
      capabilityFamilyAssignmentCount: plan.capabilityFamilyAssignmentCount,
    });

    const candidateRows = await sql<
      readonly {
        readonly candidate_id: string;
        readonly canonical_payload: unknown;
        readonly created_at: Date;
        readonly record_digest: string;
      }[]
    >`
      select candidate_id, canonical_payload, created_at, record_digest
      from gitblocks.catalog_candidates
      order by candidate_id
    `;
    expect(candidateRows).toHaveLength(150);
    const orderedCandidateRows = [...candidateRows].sort((left, right) =>
      left.candidate_id.localeCompare(right.candidate_id),
    );
    for (const [index, entry] of plan.entries.entries()) {
      const row = orderedCandidateRows[index];
      expect(row).toBeDefined();
      expect(row?.candidate_id).toBe(entry.identity.candidateId);
      expect(row?.canonical_payload).toEqual(entry.identity);
      expect(row?.created_at).toEqual(new Date(entry.createdAt));
      expect(row?.record_digest).toMatch(/^[a-f0-9]{64}$/u);
    }

    const familyRows = await sql<
      readonly {
        readonly candidate_id: string;
        readonly capability_family: string;
      }[]
    >`
      select candidate_id, capability_family
      from gitblocks.candidate_capability_families
      order by candidate_id, capability_family
    `;
    const expectedFamilyRows = plan.entries.flatMap((entry) =>
      entry.capabilityFamilies.map((capabilityFamily) => ({
        candidate_id: entry.identity.candidateId,
        capability_family: capabilityFamily,
      })),
    );
    expect([...familyRows].sort(compareFamilyRows)).toEqual(
      [...expectedFamilyRows].sort(compareFamilyRows),
    );
    expect(familyRows).toHaveLength(plan.capabilityFamilyAssignmentCount);

    const unrelatedBeforePublication = await countsForUnrelatedTables(sql);
    expect(
      Object.values(unrelatedBeforePublication).every((count) => count === 0),
    ).toBe(true);

    const beforeReplay = await exactSeededState(sql);
    await expect(
      seedPublicCatalogV1({
        catalog,
        databaseMigrationVersion: 4,
        persistence,
      }),
    ).resolves.toEqual(summary);
    expect(await exactSeededState(sql)).toEqual(beforeReplay);

    const first = catalog.candidates[0];
    if (first === undefined) {
      throw new Error('PostgreSQL catalog seed fixture is incomplete.');
    }
    const changedCatalog = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: catalog.publishedAt,
      candidates: catalog.candidates.map((candidate, index) =>
        index === 0
          ? { ...candidate, displayName: `${candidate.displayName} changed` }
          : candidate,
      ),
    });
    await expect(
      seedPublicCatalogV1({
        catalog: changedCatalog,
        databaseMigrationVersion: 4,
        persistence,
      }),
    ).rejects.toThrow();
    expect(await exactSeededState(sql)).toEqual(beforeReplay);

    const rootSelectionId = selectionId({
      candidateId: first.candidateId,
      selector: 'root-readme',
      artifactKind: 'readme',
      requirement: 'optional',
    });
    const artifactSet = createRepositoryArtifactSetV1({
      contractVersion: '1.0.0',
      candidateId: first.candidateId,
      catalogVersion: 'public-v1',
      catalogDigest: CATALOG_DIGEST,
      artifactManifestVersion: 'public-artifacts-v1',
      artifactManifestDigest: ARTIFACT_MANIFEST_DIGEST,
      collectorVersion: 'repository-artifacts-v1',
      chunkerVersion: 'exact-lines-v1',
      provider: 'github',
      providerRepositoryId: '1',
      providerCanonicalOwner: first.github.owner,
      providerCanonicalRepository: first.github.repository,
      gitObjectAlgorithm: 'sha1',
      commitObjectId: 'a'.repeat(40),
      entries: [
        {
          selectionId: rootSelectionId,
          ordinal: 0,
          selector: 'root-readme',
          artifactKind: 'readme',
          requirement: 'optional',
          rationale: null,
          requestedPath: null,
          resolvedPath: null,
          outcome: 'not-found',
          artifactId: null,
        },
      ],
      publishedAt: '2026-08-02T00:00:00.000Z',
    });
    await expect(
      publishRepositoryArtifactSet(runtimeClient, {
        artifactSet,
        artifacts: [],
      }),
    ).resolves.toMatchObject({
      inserted: { artifactSets: 1, entries: 1 },
    });
  });
});

function persistencePort(
  client: PersistenceClient,
): CatalogSeedPersistencePort {
  const port: CatalogSeedPersistencePort = {
    putCatalogCandidate: (command, control) =>
      putCatalogCandidate(client, command, control),
    setCandidateCapabilityFamilies: (command, control) =>
      setCandidateCapabilityFamilies(client, command, control),
  };
  return Object.freeze(port);
}

function compareFamilyRows(
  left: { readonly candidate_id: string; readonly capability_family: string },
  right: { readonly candidate_id: string; readonly capability_family: string },
): number {
  return (
    left.candidate_id.localeCompare(right.candidate_id) ||
    left.capability_family.localeCompare(right.capability_family)
  );
}

async function tableCount(sql: TestSql, table: string): Promise<number> {
  const rows = await sql.unsafe<readonly { readonly count: number }[]>(
    `select pg_catalog.count(*)::integer as count from gitblocks.${table}`,
  );
  const count = rows[0]?.count;
  return typeof count === 'number' ? count : -1;
}

async function countsForUnrelatedTables(
  sql: TestSql,
): Promise<Readonly<Record<string, number>>> {
  const tables = [
    'evidence_observations',
    'candidate_limitations',
    'candidate_material_unknowns',
    'candidate_dossier_snapshots',
    'repository_artifacts',
    'repository_artifact_chunks',
    'repository_artifact_sets',
    'repository_artifact_set_entries',
    'repository_interview_requests',
    'model_executions',
    'repository_interviews',
    'repository_interview_citations',
    'repository_interview_claims',
    'repository_interview_limitations',
    'repository_interview_contradictions',
    'repository_interview_unknowns',
  ] as const;
  const counts: Record<string, number> = {};
  for (const table of tables) {
    counts[table] = await tableCount(sql, table);
  }
  return Object.freeze(counts);
}

async function exactSeededState(sql: TestSql) {
  const candidates = await sql<
    readonly {
      readonly candidate_id: string;
      readonly canonical_payload_text: string;
      readonly record_digest: string;
      readonly created_at_text: string;
    }[]
  >`
    select
      candidate_id,
      canonical_payload::text as canonical_payload_text,
      record_digest,
      created_at::text as created_at_text
    from gitblocks.catalog_candidates
    order by candidate_id
  `;
  const families = await sql<
    readonly {
      readonly candidate_id: string;
      readonly capability_family: string;
    }[]
  >`
    select candidate_id, capability_family
    from gitblocks.candidate_capability_families
    order by candidate_id, capability_family
  `;
  return { candidates, families };
}

function readOwnerDatabaseConfig(): PersistenceClientConfig {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  return {
    host: requiredEnvironment('GITBLOCKS_TEST_DB_HOST'),
    port: Number(requiredEnvironment('GITBLOCKS_TEST_DB_PORT')),
    database: requiredEnvironment('GITBLOCKS_TEST_DB_DATABASE'),
    username: requiredEnvironment('GITBLOCKS_TEST_DB_OWNER'),
    password: requiredEnvironment('GITBLOCKS_TEST_DB_PASSWORD'),
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

function isolatedDatabaseName(base: string): string {
  const name = `${base.replace(/_test$/u, '')}_catalog_seed_${String(process.pid)}_test`;
  if (!/^[a-z0-9_]+$/u.test(name) || name.length > 63) {
    throw new Error('PostgreSQL integration database name is invalid.');
  }
  return name;
}

interface TestSql {
  <Rows extends readonly object[]>(
    strings: TemplateStringsArray,
    ...values: readonly unknown[]
  ): Promise<Rows>;
  readonly unsafe: <Rows extends readonly object[]>(
    query: string,
  ) => Promise<Rows>;
  readonly end: (options: { readonly timeout: number }) => Promise<void>;
}

type TestPostgresFactory = (config: {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  readonly ssl: PersistenceClientConfig['ssl'];
  readonly max: number;
  readonly connect_timeout: number;
  readonly idle_timeout: number;
  readonly onnotice: () => void;
  readonly debug: false;
}) => TestSql;

function createTestSql(config: PersistenceClientConfig): TestSql {
  const requireFromPersistence = createRequire(
    new URL('../../persistence/package.json', import.meta.url),
  );
  const loaded: unknown = requireFromPersistence('postgres');
  if (typeof loaded !== 'function') {
    throw new Error('PostgreSQL test dependency is unavailable.');
  }
  const postgres = loaded as TestPostgresFactory;
  return postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,
    max: 1,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => undefined,
    debug: false,
  });
}
