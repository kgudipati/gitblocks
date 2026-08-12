import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import postgres, { type Sql } from 'postgres';
import {
  createCandidateRetrievalMetadataAuthorityV1,
  parseCandidateRetrievalMetadataAuthorityV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type DeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';
import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  loadServingCatalogSnapshot,
  PersistenceError,
  publishServingCatalogSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  bootstrapServingCatalogV1,
  parsePublicCatalog,
  type PublicCatalog,
} from '../src/index.ts';

const OWNER_CONFIG = readOwnerConfig();
const WRITER_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_persistence_test',
  password: 'persistence-test-only',
  maximumConnections: 5,
};
const SERVING_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_serving_test',
  password: 'serving-test-only',
  maximumConnections: 2,
};
const PUBLISHED_AT = '2026-08-11T18:00:00.000Z';

let ownerSql: Sql;
let catalog: PublicCatalog;
let profiles: DeterministicCandidateProfileAuthorityV1;
let metadata: CandidateRetrievalMetadataAuthorityV1;

beforeAll(async () => {
  ownerSql = directSql(OWNER_CONFIG);
  const [catalogText, profileText, metadataText] = await Promise.all([
    acceptedText('manifest.json'),
    acceptedText('candidate-profile-authority.json'),
    acceptedText('candidate-retrieval-metadata-authority.json'),
  ]);
  catalog = parsePublicCatalog(catalogText);
  const parsedProfiles = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(profileText) as unknown,
  );
  const parsedMetadata = parseCandidateRetrievalMetadataAuthorityV1(
    JSON.parse(metadataText) as unknown,
  );
  if (!parsedProfiles.ok || !parsedMetadata.ok) {
    throw new Error('Accepted serving fixtures are invalid.');
  }
  profiles = parsedProfiles.value;
  metadata = parsedMetadata.value;
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await ownerSql.end({ timeout: 5 });
});

describe('PostgreSQL serving catalog bootstrap and loading', () => {
  it('installs the minimal constrained schema and SELECT-only serving group', async () => {
    const tables = await ownerSql<
      readonly { readonly table_name: string; readonly row_security: boolean }[]
    >`
      select
        class.relname as table_name,
        class.relrowsecurity as row_security
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
        and class.relkind = 'r'
        and class.relname like 'serving_%'
      order by class.relname
    `;
    expect(tables).toEqual([
      {
        table_name: 'serving_candidate_profile_records',
        row_security: false,
      },
      {
        table_name: 'serving_candidate_retrieval_metadata_records',
        row_security: false,
      },
      { table_name: 'serving_catalog_current_snapshot', row_security: false },
      { table_name: 'serving_catalog_snapshots', row_security: false },
    ]);
    const privileges = await ownerSql<
      readonly {
        readonly table_name: string;
        readonly can_select: boolean;
        readonly can_insert: boolean;
        readonly can_update: boolean;
        readonly can_delete: boolean;
        readonly can_truncate: boolean;
      }[]
    >`
      select
        table_name,
        pg_catalog.has_table_privilege(
          'gitblocks_serving',
          'gitblocks.' || table_name,
          'SELECT'
        ) as can_select,
        pg_catalog.has_table_privilege(
          'gitblocks_serving',
          'gitblocks.' || table_name,
          'INSERT'
        ) as can_insert,
        pg_catalog.has_table_privilege(
          'gitblocks_serving',
          'gitblocks.' || table_name,
          'UPDATE'
        ) as can_update,
        pg_catalog.has_table_privilege(
          'gitblocks_serving',
          'gitblocks.' || table_name,
          'DELETE'
        ) as can_delete,
        pg_catalog.has_table_privilege(
          'gitblocks_serving',
          'gitblocks.' || table_name,
          'TRUNCATE'
        ) as can_truncate
      from information_schema.tables
      where table_schema = 'gitblocks'
        and table_name like 'serving_%'
      order by table_name
    `;
    expect(privileges).toHaveLength(4);
    expect(privileges).toEqual(
      privileges.map(({ table_name }) => ({
        table_name,
        can_select: true,
        can_insert: false,
        can_update: false,
        can_delete: false,
        can_truncate: false,
      })),
    );
    const role = await ownerSql<
      readonly {
        readonly rolcanlogin: boolean;
        readonly rolsuper: boolean;
        readonly rolcreatedb: boolean;
        readonly rolcreaterole: boolean;
        readonly rolbypassrls: boolean;
      }[]
    >`
      select rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
      from pg_catalog.pg_roles
      where rolname = 'gitblocks_serving'
    `;
    expect(role).toEqual([
      {
        rolcanlogin: false,
        rolsuper: false,
        rolcreatedb: false,
        rolcreaterole: false,
        rolbypassrls: false,
      },
    ]);
  });

  it('publishes the accepted 150 records atomically, replays idempotently, and retains history', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const serving = createPersistenceClient(SERVING_CONFIG);
    const servingSql = directSql(SERVING_CONFIG);
    try {
      const first = await bootstrap(writer, profiles, metadata, PUBLISHED_AT);
      expect(first).toMatchObject({
        status: 'serving-catalog-bootstrap-complete',
        publicationStatus: 'created',
        databaseMigrationVersion: 5,
        candidateCount: 150,
      });
      const replay = await bootstrap(writer, profiles, metadata, PUBLISHED_AT);
      expect(replay).toEqual({ ...first, publicationStatus: 'idempotent' });

      const loaded = await loadServingCatalogSnapshot(serving, {
        selection: 'current',
      });
      expect(loaded.candidateProfileAuthority).toEqual(profiles);
      expect(loaded.candidateRetrievalMetadataAuthority).toEqual(metadata);
      expect(loaded.candidateCount).toBe(150);
      expect(loaded.snapshotId).toBe(first.snapshotId);

      await expect(
        bootstrap(writer, profiles, metadata, '2026-08-11T18:00:01.000Z'),
      ).rejects.toMatchObject({ code: 'persistence.conflict' });

      const secondMetadata = changedMetadata(metadata);
      const second = await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: profiles,
        candidateRetrievalMetadataAuthority: secondMetadata,
        publishedAt: '2026-08-11T18:00:02.000Z',
      });
      expect(second.status).toBe('created');
      expect(second.snapshotId).not.toBe(first.snapshotId);
      await expect(
        loadServingCatalogSnapshot(serving, {
          selection: 'snapshot-id',
          snapshotId: first.snapshotId,
        }),
      ).resolves.toMatchObject({
        snapshotId: first.snapshotId,
        candidateRetrievalMetadataAuthority: metadata,
      });
      await expect(
        loadServingCatalogSnapshot(serving, { selection: 'current' }),
      ).resolves.toMatchObject({
        snapshotId: second.snapshotId,
        candidateRetrievalMetadataAuthority: secondMetadata,
      });

      await expectIncompleteSelectionRejected(first.snapshotId);
      await expect(
        ownerSql`
          update gitblocks.serving_candidate_profile_records
          set record_digest = ${'f'.repeat(64)}
          where snapshot_id = ${first.snapshotId}
        `,
      ).rejects.toMatchObject({ code: 'P0001' });

      const readCount = await servingSql<
        readonly { readonly candidate_count: number }[]
      >`
        select candidate_count
        from gitblocks.serving_catalog_snapshots
        where snapshot_id = ${second.snapshotId}
      `;
      expect(readCount).toEqual([{ candidate_count: 150 }]);
      await expect(
        servingSql`
          insert into gitblocks.serving_catalog_current_snapshot (
            selector,
            snapshot_id,
            selected_at
          ) values (true, ${first.snapshotId}, ${PUBLISHED_AT}::timestamptz)
        `,
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        servingSql.unsafe('create table gitblocks.serving_forbidden (id int)'),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        publishServingCatalogSnapshot(serving, {
          candidateProfileAuthority: profiles,
          candidateRetrievalMetadataAuthority: metadata,
          publishedAt: PUBLISHED_AT,
        }),
      ).rejects.toBeInstanceOf(PersistenceError);
    } finally {
      await Promise.all([
        servingSql.end({ timeout: 5 }),
        closePersistenceClient(serving),
        closePersistenceClient(writer),
      ]);
    }
  });

  it('fails closed when profile or metadata state is inconsistent or missing', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const serving = createPersistenceClient(SERVING_CONFIG);
    try {
      const first = await bootstrap(writer, profiles, metadata, PUBLISHED_AT);
      const secondMetadata = changedMetadata(metadata);
      const second = await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: profiles,
        candidateRetrievalMetadataAuthority: secondMetadata,
        publishedAt: '2026-08-11T18:00:02.000Z',
      });
      const firstProfileCandidateId = profiles.profiles.at(0)?.candidateId;
      const firstMetadataCandidateId =
        secondMetadata.candidates.at(0)?.candidateId;
      if (
        firstProfileCandidateId === undefined ||
        firstMetadataCandidateId === undefined
      ) {
        throw new Error('Accepted serving authority is empty.');
      }

      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_profile_records disable trigger serving_candidate_profile_records_immutable',
      );
      await ownerSql`
        update gitblocks.serving_candidate_profile_records
        set profile_payload = pg_catalog.jsonb_set(
          profile_payload,
          '{profileRulesVersion}',
          '"tampered"'::jsonb
        )
        where snapshot_id = ${first.snapshotId}
          and candidate_id = ${firstProfileCandidateId}
      `;
      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_profile_records enable trigger serving_candidate_profile_records_immutable',
      );
      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_retrieval_metadata_records disable trigger serving_candidate_retrieval_metadata_records_immutable',
      );
      await ownerSql`
        update gitblocks.serving_candidate_retrieval_metadata_records
        set metadata_payload = metadata_payload ||
          '{"description":"tampered"}'::jsonb
        where snapshot_id = ${second.snapshotId}
          and candidate_id = ${firstMetadataCandidateId}
      `;
      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_retrieval_metadata_records enable trigger serving_candidate_retrieval_metadata_records_immutable',
      );

      await expect(
        loadServingCatalogSnapshot(serving, {
          selection: 'snapshot-id',
          snapshotId: first.snapshotId,
        }),
      ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });
      await expect(
        loadServingCatalogSnapshot(serving, { selection: 'current' }),
      ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });

      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_profile_records disable trigger serving_candidate_profile_records_immutable',
      );
      await ownerSql`
        delete from gitblocks.serving_candidate_profile_records
        where snapshot_id = ${first.snapshotId}
          and candidate_id = ${firstProfileCandidateId}
      `;
      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_profile_records enable trigger serving_candidate_profile_records_immutable',
      );
      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_retrieval_metadata_records disable trigger serving_candidate_retrieval_metadata_records_immutable',
      );
      await ownerSql`
        delete from gitblocks.serving_candidate_retrieval_metadata_records
        where snapshot_id = ${second.snapshotId}
          and candidate_id = ${firstMetadataCandidateId}
      `;
      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_retrieval_metadata_records enable trigger serving_candidate_retrieval_metadata_records_immutable',
      );

      await expect(
        loadServingCatalogSnapshot(serving, {
          selection: 'snapshot-id',
          snapshotId: first.snapshotId,
        }),
      ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });
      await expect(
        loadServingCatalogSnapshot(serving, { selection: 'current' }),
      ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });
    } finally {
      await Promise.all([
        closePersistenceClient(serving),
        closePersistenceClient(writer),
      ]);
    }
  });
});

async function bootstrap(
  client: PersistenceClient,
  profileAuthority: DeterministicCandidateProfileAuthorityV1,
  metadataAuthority: CandidateRetrievalMetadataAuthorityV1,
  publishedAt: string,
) {
  return bootstrapServingCatalogV1({
    catalog,
    candidateProfileAuthority: profileAuthority,
    candidateRetrievalMetadataAuthority: metadataAuthority,
    publishedAt,
    databaseMigrationVersion: 5,
    persistence: {
      putCatalogCandidate: (command, control) =>
        putCatalogCandidate(client, command, control),
      setCandidateCapabilityFamilies: (command, control) =>
        setCandidateCapabilityFamilies(client, command, control),
      publishServingCatalogSnapshot: (command, control) =>
        publishServingCatalogSnapshot(client, command, control),
    },
  });
}

function changedMetadata(
  authority: CandidateRetrievalMetadataAuthorityV1,
): CandidateRetrievalMetadataAuthorityV1 {
  return createCandidateRetrievalMetadataAuthorityV1({
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    providerPolicyVersion: authority.providerPolicyVersion,
    providerPolicyDigest: authority.providerPolicyDigest,
    sourceProviderPolicyVersion: authority.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: authority.sourceProviderPolicyDigest,
    sourceOperation: authority.sourceOperation,
    collectedAt: '2026-08-11T18:00:01.000Z',
    candidates: authority.candidates.map((record, index) => {
      const { sourceRecordDigest, ...candidate } = record;
      void sourceRecordDigest;
      return {
        ...candidate,
        description:
          index === 0
            ? `${candidate.description ?? ''} historical-test`.trim()
            : candidate.description,
      };
    }),
  });
}

async function expectIncompleteSelectionRejected(
  sourceSnapshotId: string,
): Promise<void> {
  await expect(
    ownerSql.begin(async (transaction) => {
      await transaction`
        insert into gitblocks.serving_catalog_snapshots (
          snapshot_id,
          snapshot_format_version,
          catalog_version,
          catalog_digest,
          candidate_count,
          profile_authority_header,
          profile_authority_semantic_digest,
          metadata_authority_header,
          metadata_authority_semantic_digest,
          published_at,
          record_digest
        )
        select
          'serving-incomplete-test',
          snapshot_format_version,
          catalog_version,
          catalog_digest,
          candidate_count,
          profile_authority_header,
          profile_authority_semantic_digest,
          metadata_authority_header,
          metadata_authority_semantic_digest,
          published_at,
          ${'e'.repeat(64)}
        from gitblocks.serving_catalog_snapshots
        where snapshot_id = ${sourceSnapshotId}
      `;
      await transaction`
        update gitblocks.serving_catalog_current_snapshot
        set snapshot_id = 'serving-incomplete-test'
        where selector
      `;
    }),
  ).rejects.toMatchObject({ code: 'P0001' });
  const incomplete = await ownerSql<readonly { readonly count: number }[]>`
    select pg_catalog.count(*)::integer as count
    from gitblocks.serving_catalog_snapshots
    where snapshot_id = 'serving-incomplete-test'
  `;
  expect(incomplete).toEqual([{ count: 0 }]);
}

function acceptedText(fileName: string): Promise<string> {
  return readFile(
    fileURLToPath(
      new URL(`../../../catalog/public-v1/${fileName}`, import.meta.url),
    ),
    'utf8',
  );
}

function directSql(config: PersistenceClientConfig): Sql {
  return postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.username,
    password: config.password,
    ssl: config.ssl,
    max: config.maximumConnections ?? 5,
    connect_timeout: 5,
    idle_timeout: 5,
    onnotice: () => undefined,
    debug: false,
  });
}

async function resetDatabase(): Promise<void> {
  await ownerSql.unsafe('drop schema if exists gitblocks cascade');
  const owner = createPersistenceClient(OWNER_CONFIG);
  try {
    await applyMigrations(owner);
  } finally {
    await closePersistenceClient(owner);
  }
}

function readOwnerConfig(): PersistenceClientConfig {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  return {
    host: requiredEnvironment('GITBLOCKS_TEST_DB_HOST'),
    port: parsePort(requiredEnvironment('GITBLOCKS_TEST_DB_PORT')),
    database: requiredEnvironment('GITBLOCKS_TEST_DB_DATABASE'),
    username: requiredEnvironment('GITBLOCKS_TEST_DB_OWNER'),
    password: requiredEnvironment('GITBLOCKS_TEST_DB_PASSWORD'),
    ssl: false,
    maximumConnections: 5,
    connectTimeoutMilliseconds: 5_000,
    idleTimeoutMilliseconds: 5_000,
    statementTimeoutMilliseconds: 60_000,
    lockTimeoutMilliseconds: 10_000,
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
