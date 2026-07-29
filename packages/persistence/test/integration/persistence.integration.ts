import { readFile } from 'node:fs/promises';

import postgres, { type Sql } from 'postgres';
import type {
  CandidateDossierV1,
  EvidenceObservationV1,
} from '@gitblocks/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  appendCandidateLimitation,
  appendCandidateUnknown,
  appendEvidenceObservation,
  applyMigrations,
  closePersistenceClient,
  createCandidateDossierSnapshot,
  createPersistenceClient,
  createTenant,
  deleteTenantData,
  loadCandidateDossierSnapshot,
  PersistenceError,
  purgeExpiredTenantData,
  putCatalogCandidate,
  recordEvidenceInvalidation,
  recordEvidenceSupersession,
  selectActiveDossierMaterial,
  setCandidateCapabilityFamilies,
  verifyMigrations,
  type PersistenceClient,
  type PersistenceClientConfig,
  type StorageScope,
} from '../../src/index.ts';
import { createCandidateDossier, type MutableValue } from '../fixtures.ts';

const OWNER_CONFIG = readOwnerConfig();
const RUNTIME_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_runtime_test',
  password: 'runtime-test-only',
  maximumConnections: 5,
};
const PUBLIC_WRITER_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_public_test',
  password: 'public-test-only',
  maximumConnections: 5,
};
const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';
const CREATED_AT = '2026-07-28T22:00:00Z';
const EVIDENCE_CUTOFF = '2026-07-28T21:00:00Z';
const TENANT_EXPIRY = '2026-08-28T22:00:00Z';

const TENANT_A_SCOPE: StorageScope = {
  kind: 'tenant',
  tenantId: TENANT_A,
  expiresAt: TENANT_EXPIRY,
};
const TENANT_B_SCOPE: StorageScope = {
  kind: 'tenant',
  tenantId: TENANT_B,
  expiresAt: TENANT_EXPIRY,
};
const PUBLIC_SCOPE: StorageScope = { kind: 'public' };

let ownerSql: Sql;

describe('PostgreSQL persistence integration', { concurrent: false }, () => {
  beforeAll(async () => {
    ownerSql = postgres({
      host: OWNER_CONFIG.host,
      port: OWNER_CONFIG.port,
      database: OWNER_CONFIG.database,
      user: OWNER_CONFIG.username,
      password: OWNER_CONFIG.password,
      ssl: OWNER_CONFIG.ssl,
      max: 5,
      connect_timeout: 5,
      idle_timeout: 5,
      onnotice: () => undefined,
      debug: false,
    });
    await resetDatabase();
    await ensureRuntimeLogins();
  });

  beforeEach(async () => {
    await resetDatabase();
    await ensureRuntimeLogins();
  });

  afterAll(async () => {
    await ownerSql.end({ timeout: 5 });
  });

  it('applies cleanly, repeats safely, verifies checksums, and serializes concurrent migrators', async () => {
    await dropGitBlocksSchema();
    const first = createPersistenceClient(OWNER_CONFIG);
    const second = createPersistenceClient(OWNER_CONFIG);

    try {
      const results = await Promise.all([
        applyMigrations(first),
        applyMigrations(second),
      ]);
      const repeated = await applyMigrations(first);
      const verified = await verifyMigrations(second);

      expect(results).toHaveLength(2);
      expect(repeated).toEqual(verified);
      expect(verified.postgresqlVersion).toMatch(/^18\.4\b/u);
      expect(verified.migrations).toHaveLength(1);
      expect(firstOrThrow(verified.migrations)).toMatchObject({
        version: 1,
        name: 'evidence-persistence',
      });
      expect(firstOrThrow(verified.migrations).checksum).toMatch(
        /^[0-9a-f]{64}$/u,
      );
      const history = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from gitblocks.schema_migrations
      `;
      expect(history[0]?.count).toBe(1);
    } finally {
      await Promise.all([
        closePersistenceClient(first),
        closePersistenceClient(second),
      ]);
    }
  });

  it('detects checksum drift, unknown history, and absent implicit migrations', async () => {
    await ownerSql`
      update gitblocks.schema_migrations
      set checksum =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      where version = 1
    `;
    const owner = createPersistenceClient(OWNER_CONFIG);
    try {
      await expect(verifyMigrations(owner)).rejects.toMatchObject({
        code: 'persistence.migration-drift',
      });
    } finally {
      await closePersistenceClient(owner);
    }

    await resetDatabase();
    await ownerSql`
      insert into gitblocks.schema_migrations (
        version,
        name,
        checksum,
        applied_at
      )
      values (
        2,
        'unknown-migration',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        pg_catalog.clock_timestamp()
      )
    `;
    const unknownOwner = createPersistenceClient(OWNER_CONFIG);
    try {
      await expect(applyMigrations(unknownOwner)).rejects.toMatchObject({
        code: 'persistence.migration-drift',
      });
    } finally {
      await closePersistenceClient(unknownOwner);
    }

    await dropGitBlocksSchema();
    const lazyClient = createPersistenceClient(OWNER_CONFIG);
    await closePersistenceClient(lazyClient);
    const schemas = await ownerSql<readonly { readonly count: number }[]>`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_namespace
      where nspname = 'gitblocks'
    `;
    expect(schemas[0]?.count).toBe(0);
  });

  it('rolls a failed migration and its history back transactionally', async () => {
    await dropGitBlocksSchema();
    await ownerSql.unsafe(`
      create or replace function public.gitblocks_test_reject_migration()
      returns event_trigger
      language plpgsql
      as $$
      begin
        if pg_catalog.current_query() like '%create table gitblocks.tenants%' then
          raise exception using errcode = 'P0001', message = 'test failure';
        end if;
      end
      $$;
      create event trigger gitblocks_test_reject_migration
      on ddl_command_start
      execute function public.gitblocks_test_reject_migration();
    `);
    const owner = createPersistenceClient(OWNER_CONFIG);
    try {
      await expect(applyMigrations(owner)).rejects.toBeInstanceOf(
        PersistenceError,
      );
    } finally {
      await closePersistenceClient(owner);
      await ownerSql.unsafe(`
        drop event trigger if exists gitblocks_test_reject_migration;
        drop function if exists public.gitblocks_test_reject_migration();
      `);
    }
    const schemas = await ownerSql<readonly { readonly count: number }[]>`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_namespace
      where nspname = 'gitblocks'
    `;
    expect(schemas[0]?.count).toBe(0);
  });

  it('uses explicit schema objects, PostgreSQL 18, forced RLS, and non-owner runtime roles', async () => {
    const owner = createPersistenceClient(OWNER_CONFIG);
    try {
      const verified = await verifyMigrations(owner);
      expect(verified.postgresqlVersion).toMatch(/^18\.4\b/u);
    } finally {
      await closePersistenceClient(owner);
    }

    const tables = await ownerSql<
      readonly {
        readonly tablename: string;
        readonly rowsecurity: boolean;
        readonly forcerowsecurity: boolean;
      }[]
    >`
      select
        class.relname as tablename,
        class.relrowsecurity as rowsecurity,
        class.relforcerowsecurity as forcerowsecurity
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
        and class.relkind = 'r'
        and class.relname <> 'schema_migrations'
      order by class.relname
    `;
    expect(tables).toHaveLength(15);
    expect(tables.every((table) => table.rowsecurity)).toBe(true);
    expect(tables.every((table) => table.forcerowsecurity)).toBe(true);

    const roles = await ownerSql<
      readonly {
        readonly rolname: string;
        readonly rolsuper: boolean;
        readonly rolbypassrls: boolean;
      }[]
    >`
      select rolname, rolsuper, rolbypassrls
      from pg_catalog.pg_roles
      where rolname in (
        'gitblocks_runtime_test',
        'gitblocks_public_test'
      )
      order by rolname
    `;
    expect(roles).toEqual([
      {
        rolname: 'gitblocks_public_test',
        rolsuper: false,
        rolbypassrls: false,
      },
      {
        rolname: 'gitblocks_runtime_test',
        rolsuper: false,
        rolbypassrls: false,
      },
    ]);

    const migrationSql = await readFile(
      new URL(
        '../../migrations/0001_evidence_persistence.sql',
        import.meta.url,
      ),
      'utf8',
    );
    expect(migrationSql).not.toMatch(/\bcreate table (?!gitblocks\.)/iu);
    expect(migrationSql).not.toMatch(/\breferences (?!gitblocks\.)/iu);
  });

  it('enforces tenant isolation, public policy, missing context, malformed context, and cross-tenant references', async () => {
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    const publicWriter = createPersistenceClient(PUBLIC_WRITER_CONFIG);
    const dossierA = createCandidateDossier('candidate-alpha');
    const dossierB = createCandidateDossier('candidate-beta');
    const publicDossier = withCandidateId(
      createCandidateDossier('candidate-alpha'),
      'candidate-public',
      'public',
    );
    try {
      await createTenant(runtime, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await createTenant(runtime, {
        tenantId: TENANT_B,
        createdAt: CREATED_AT,
      });
      await seedDossier(runtime, TENANT_A_SCOPE, dossierA);
      await seedDossier(runtime, TENANT_B_SCOPE, dossierB);
      await seedDossier(publicWriter, PUBLIC_SCOPE, publicDossier);

      const directRuntime = directSql(RUNTIME_CONFIG);
      try {
        const missing = await directRuntime<
          readonly { readonly candidate_id: string }[]
        >`
          select candidate_id
          from gitblocks.catalog_candidates
          order by candidate_id
        `;
        expect(missing.map((row) => row.candidate_id)).toEqual([
          'candidate-public',
        ]);

        const malformed = await directRuntime.begin(async (transaction) => {
          await transaction`
            select pg_catalog.set_config(
              'gitblocks.tenant_id',
              'malformed-context',
              true
            )
          `;
          return transaction<readonly { readonly candidate_id: string }[]>`
            select candidate_id
            from gitblocks.catalog_candidates
            order by candidate_id
          `;
        });
        expect(malformed.map((row) => row.candidate_id)).toEqual([
          'candidate-public',
        ]);

        const tenantAVisible = await directRuntime.begin(
          async (transaction) => {
            await transaction`
              select pg_catalog.set_config(
                'gitblocks.tenant_id',
                ${TENANT_A},
                true
              )
            `;
            return transaction<readonly { readonly candidate_id: string }[]>`
              select candidate_id
              from gitblocks.catalog_candidates
              order by candidate_id
            `;
          },
        );
        expect(tenantAVisible.map((row) => row.candidate_id)).toEqual([
          'candidate-alpha',
          'candidate-public',
        ]);
      } finally {
        await directRuntime.end({ timeout: 5 });
      }

      await expect(
        putCatalogCandidate(runtime, {
          scope: PUBLIC_SCOPE,
          identity: withCandidateId(
            dossierA,
            'runtime-public-write',
            'runtime-public',
          ).identity,
          createdAt: CREATED_AT,
        }),
      ).rejects.toMatchObject({ code: 'persistence.isolation' });
      await expect(
        putCatalogCandidate(publicWriter, {
          scope: TENANT_A_SCOPE,
          identity: withCandidateId(
            dossierA,
            'public-tenant-write',
            'public-tenant',
          ).identity,
          createdAt: CREATED_AT,
        }),
      ).rejects.toMatchObject({ code: 'persistence.isolation' });

      await expect(
        appendCandidateLimitation(runtime, {
          scope: TENANT_A_SCOPE,
          createdAt: CREATED_AT,
          limitation: {
            limitationId: 'cross-tenant-limitation',
            limitationCode: 'cross-tenant-reference',
            candidateId: 'candidate-alpha',
            statement: 'This reference must remain rejected.',
            evidenceIds: ['evidence-beta'],
          },
        }),
      ).rejects.toMatchObject({ code: 'persistence.conflict' });
    } finally {
      await Promise.all([
        closePersistenceClient(runtime),
        closePersistenceClient(publicWriter),
      ]);
    }
  });

  it('round-trips every evidence provenance variant with exact immutable snapshot membership', async () => {
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    const dossier = createProvenanceDossier();
    try {
      await createTenant(runtime, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await seedDossier(runtime, TENANT_A_SCOPE, dossier);
      await createCandidateDossierSnapshot(runtime, {
        scope: TENANT_A_SCOPE,
        snapshotId: 'snapshot-provenance',
        dossier,
        evidenceCutoff: EVIDENCE_CUTOFF,
        createdAt: CREATED_AT,
      });

      const loaded = await loadCandidateDossierSnapshot(runtime, {
        scope: TENANT_A_SCOPE,
        snapshotId: 'snapshot-provenance',
      });
      expect(loaded).toEqual(dossier);
      expect(loaded.observations.map((item) => item.source.kind)).toEqual([
        'git-commit',
        'tag',
        'release',
        'package-version',
        'security-advisory',
        'mutable-documentation',
        'approved-validation',
      ]);
    } finally {
      await closePersistenceClient(runtime);
    }
  });

  it('stores separate non-pilot fixtures across every capability family', async () => {
    const publicWriter = createPersistenceClient(PUBLIC_WRITER_CONFIG);
    const families = [
      'authorization',
      'audit-logging',
      'background-jobs',
      'rate-limiting',
      'webhooks',
    ] as const;
    try {
      for (const [index, family] of families.entries()) {
        const dossier = withCandidateId(
          createCandidateDossier('candidate-alpha'),
          `nonpilot-${String(index + 1)}`,
          `nonpilot-${String(index + 1)}`,
        );
        dossier.capabilityFamily = family;
        await seedDossier(publicWriter, PUBLIC_SCOPE, dossier);
        const snapshotId = `nonpilot-${String(index + 1)}-snapshot`;
        await createCandidateDossierSnapshot(publicWriter, {
          scope: PUBLIC_SCOPE,
          snapshotId,
          dossier,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        });
        await expect(
          loadCandidateDossierSnapshot(publicWriter, {
            scope: PUBLIC_SCOPE,
            snapshotId,
          }),
        ).resolves.toEqual(dossier);
      }
    } finally {
      await closePersistenceClient(publicWriter);
    }
  });

  it('enforces immutable idempotency, concurrent inserts, conflicts, update denial, and rollback', async () => {
    const runtimeA = createPersistenceClient(RUNTIME_CONFIG);
    const runtimeB = createPersistenceClient(RUNTIME_CONFIG);
    const dossier = createCandidateDossier('candidate-alpha');
    try {
      await createTenant(runtimeA, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await putCatalogCandidate(runtimeA, {
        scope: TENANT_A_SCOPE,
        identity: dossier.identity,
        createdAt: CREATED_AT,
      });
      await setCandidateCapabilityFamilies(runtimeA, {
        scope: TENANT_A_SCOPE,
        candidateId: dossier.identity.candidateId,
        capabilityFamilies: [dossier.capabilityFamily],
      });

      const observation = firstOrThrow(dossier.observations);
      await expect(
        Promise.all([
          appendEvidenceObservation(runtimeA, {
            scope: TENANT_A_SCOPE,
            observation,
            createdAt: CREATED_AT,
          }),
          appendEvidenceObservation(runtimeB, {
            scope: TENANT_A_SCOPE,
            observation,
            createdAt: CREATED_AT,
          }),
        ]),
      ).resolves.toEqual([undefined, undefined]);
      await expect(
        appendEvidenceObservation(runtimeA, {
          scope: TENANT_A_SCOPE,
          observation,
          createdAt: CREATED_AT,
        }),
      ).resolves.toBeUndefined();

      const conflict = structuredClone(observation);
      conflict.observation = 'Conflicting content for the same stable ID.';
      await expect(
        appendEvidenceObservation(runtimeA, {
          scope: TENANT_A_SCOPE,
          observation: conflict,
          createdAt: CREATED_AT,
        }),
      ).rejects.toMatchObject({ code: 'persistence.conflict' });

      const concurrentBase = structuredClone(observation);
      concurrentBase.evidenceId = 'concurrent-conflict';
      const concurrentChanged = structuredClone(concurrentBase);
      concurrentChanged.observation =
        'A different writer supplied different immutable content.';
      const outcomes = await Promise.allSettled([
        appendEvidenceObservation(runtimeA, {
          scope: TENANT_A_SCOPE,
          observation: concurrentBase,
          createdAt: CREATED_AT,
        }),
        appendEvidenceObservation(runtimeB, {
          scope: TENANT_A_SCOPE,
          observation: concurrentChanged,
          createdAt: CREATED_AT,
        }),
      ]);
      expect(
        outcomes.filter((outcome) => outcome.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = outcomes.filter(
        (outcome) => outcome.status === 'rejected',
      );
      expect(rejected).toHaveLength(1);
      expect(firstOrThrow(rejected).reason).toMatchObject({
        code: 'persistence.conflict',
      });

      await expect(
        ownerSql`
          update gitblocks.evidence_observations
          set topic = 'forbidden-update'
          where evidence_id = ${observation.evidenceId}
        `,
      ).rejects.toMatchObject({ code: 'P0001' });

      await expect(
        appendCandidateLimitation(runtimeA, {
          scope: TENANT_A_SCOPE,
          createdAt: CREATED_AT,
          limitation: {
            limitationId: 'partial-limitation',
            limitationCode: 'missing-reference',
            candidateId: dossier.identity.candidateId,
            statement: 'A failed reference must roll the root row back.',
            evidenceIds: ['missing-evidence'],
          },
        }),
      ).rejects.toMatchObject({ code: 'persistence.conflict' });
      const partial = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from gitblocks.candidate_limitations
        where limitation_id = 'partial-limitation'
      `;
      expect(partial[0]?.count).toBe(0);
    } finally {
      await Promise.all([
        closePersistenceClient(runtimeA),
        closePersistenceClient(runtimeB),
      ]);
    }
  });

  it('keeps historical snapshots stable across new evidence, supersession, invalidation, and active cutoffs', async () => {
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    const dossier = createCandidateDossier('candidate-alpha');
    const original = firstOrThrow(dossier.observations);
    const correction = structuredClone(original);
    correction.evidenceId = 'evidence-alpha-corrected';
    correction.observation =
      'Corrected immutable evidence confirms the supported runtime.';
    const additional = structuredClone(original);
    additional.evidenceId = 'evidence-alpha-additional';
    additional.observation =
      'Additional immutable evidence supplies a separate detail.';
    try {
      await createTenant(runtime, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await seedDossier(runtime, TENANT_A_SCOPE, dossier);
      await createCandidateDossierSnapshot(runtime, {
        scope: TENANT_A_SCOPE,
        snapshotId: 'snapshot-history',
        dossier,
        evidenceCutoff: EVIDENCE_CUTOFF,
        createdAt: CREATED_AT,
      });
      await appendEvidenceObservation(runtime, {
        scope: TENANT_A_SCOPE,
        observation: correction,
        createdAt: '2026-07-28T22:05:00Z',
      });
      await appendEvidenceObservation(runtime, {
        scope: TENANT_A_SCOPE,
        observation: additional,
        createdAt: '2026-07-28T22:06:00Z',
      });
      await recordEvidenceSupersession(runtime, {
        scope: TENANT_A_SCOPE,
        candidateId: dossier.identity.candidateId,
        supersessionId: 'supersession-alpha',
        supersededEvidenceId: original.evidenceId,
        supersedingEvidenceId: correction.evidenceId,
        reasonCode: 'corrected-observation',
        createdAt: '2026-07-28T22:10:00Z',
        effectiveAt: '2026-07-28T22:10:00Z',
      });
      await recordEvidenceInvalidation(runtime, {
        scope: TENANT_A_SCOPE,
        candidateId: dossier.identity.candidateId,
        invalidationId: 'invalidation-alpha',
        evidenceId: correction.evidenceId,
        reasonCode: 'withdrawn-source',
        createdAt: '2026-07-28T22:20:00Z',
        effectiveAt: '2026-07-28T22:20:00Z',
      });

      const before = await selectActiveDossierMaterial(runtime, {
        scope: TENANT_A_SCOPE,
        candidateId: dossier.identity.candidateId,
        evidenceCutoff: '2026-07-28T22:09:00Z',
        limit: 100,
      });
      const superseded = await selectActiveDossierMaterial(runtime, {
        scope: TENANT_A_SCOPE,
        candidateId: dossier.identity.candidateId,
        evidenceCutoff: '2026-07-28T22:15:00Z',
        limit: 100,
      });
      const invalidated = await selectActiveDossierMaterial(runtime, {
        scope: TENANT_A_SCOPE,
        candidateId: dossier.identity.candidateId,
        evidenceCutoff: '2026-07-28T22:21:00Z',
        limit: 100,
      });
      expect(before.observations.map((value) => value.evidenceId)).toEqual([
        'evidence-alpha',
        'evidence-alpha-additional',
        'evidence-alpha-corrected',
      ]);
      expect(superseded.observations.map((value) => value.evidenceId)).toEqual([
        'evidence-alpha-additional',
        'evidence-alpha-corrected',
      ]);
      expect(invalidated.observations.map((value) => value.evidenceId)).toEqual(
        ['evidence-alpha-additional'],
      );

      const historical = await loadCandidateDossierSnapshot(runtime, {
        scope: TENANT_A_SCOPE,
        snapshotId: 'snapshot-history',
      });
      expect(historical).toEqual(dossier);
      await expect(
        recordEvidenceSupersession(runtime, {
          scope: TENANT_A_SCOPE,
          candidateId: dossier.identity.candidateId,
          supersessionId: 'supersession-cycle',
          supersededEvidenceId: correction.evidenceId,
          supersedingEvidenceId: original.evidenceId,
          reasonCode: 'cycle-attempt',
          createdAt: '2026-07-28T22:30:00Z',
          effectiveAt: '2026-07-28T22:30:00Z',
        }),
      ).rejects.toMatchObject({ code: 'persistence.conflict' });
      await expect(
        recordEvidenceSupersession(runtime, {
          scope: TENANT_A_SCOPE,
          candidateId: dossier.identity.candidateId,
          supersessionId: 'supersession-self',
          supersededEvidenceId: original.evidenceId,
          supersedingEvidenceId: original.evidenceId,
          reasonCode: 'self-attempt',
          createdAt: '2026-07-28T22:30:00Z',
          effectiveAt: '2026-07-28T22:30:00Z',
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(runtime);
    }
  });

  it('rejects missing, duplicate, cross-candidate, cross-scope, and conflicting snapshot material atomically', async () => {
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    const publicWriter = createPersistenceClient(PUBLIC_WRITER_CONFIG);
    const dossierA = createCandidateDossier('candidate-alpha');
    const dossierB = createCandidateDossier('candidate-beta');
    try {
      await createTenant(runtime, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await seedDossier(runtime, TENANT_A_SCOPE, dossierA);
      await seedDossier(runtime, TENANT_A_SCOPE, dossierB);
      await seedDossier(publicWriter, PUBLIC_SCOPE, dossierA);

      const missing = structuredClone(dossierA);
      firstOrThrow(missing.observations).evidenceId = 'missing-evidence';
      await expect(
        createCandidateDossierSnapshot(runtime, {
          scope: TENANT_A_SCOPE,
          snapshotId: 'snapshot-missing',
          dossier: missing,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        }),
      ).rejects.toBeInstanceOf(PersistenceError);

      const duplicate = structuredClone(dossierA);
      duplicate.observations.push(
        structuredClone(firstOrThrow(duplicate.observations)),
      );
      await expect(
        createCandidateDossierSnapshot(runtime, {
          scope: TENANT_A_SCOPE,
          snapshotId: 'snapshot-duplicate',
          dossier: duplicate,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });

      const crossCandidate = structuredClone(dossierA);
      crossCandidate.observations = [
        structuredClone(firstOrThrow(dossierB.observations)),
      ];
      await expect(
        createCandidateDossierSnapshot(runtime, {
          scope: TENANT_A_SCOPE,
          snapshotId: 'snapshot-cross-candidate',
          dossier: crossCandidate,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        }),
      ).rejects.toBeInstanceOf(PersistenceError);

      await expect(
        createCandidateDossierSnapshot(publicWriter, {
          scope: PUBLIC_SCOPE,
          snapshotId: 'snapshot-cross-scope',
          dossier: dossierB,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        }),
      ).rejects.toBeInstanceOf(PersistenceError);

      const conflicting = structuredClone(dossierA);
      firstOrThrow(conflicting.observations).observation =
        'Conflicting material must not replace the stored observation.';
      await expect(
        createCandidateDossierSnapshot(runtime, {
          scope: TENANT_A_SCOPE,
          snapshotId: 'snapshot-conflicting',
          dossier: conflicting,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        }),
      ).rejects.toMatchObject({ code: 'persistence.conflict' });

      const snapshots = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from gitblocks.candidate_dossier_snapshots
      `;
      expect(snapshots[0]?.count).toBe(0);
    } finally {
      await Promise.all([
        closePersistenceClient(runtime),
        closePersistenceClient(publicWriter),
      ]);
    }
  });

  it('purges bounded expiry roots, preserves live/public/other-tenant data, and deletes one tenant with a safe tombstone', async () => {
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    const publicWriter = createPersistenceClient(PUBLIC_WRITER_CONFIG);
    const dossierA = createCandidateDossier('candidate-alpha');
    const dossierB = createCandidateDossier('candidate-beta');
    const publicDossier = withCandidateId(
      createCandidateDossier('candidate-alpha'),
      'candidate-public',
      'public-retained',
    );
    const candidateExpiryScope: StorageScope = {
      kind: 'tenant',
      tenantId: TENANT_A,
      expiresAt: '2026-07-31T00:00:00Z',
    };
    const snapshotExpiryScope: StorageScope = {
      kind: 'tenant',
      tenantId: TENANT_A,
      expiresAt: '2026-07-30T00:00:00Z',
    };
    try {
      await createTenant(runtime, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await createTenant(runtime, {
        tenantId: TENANT_B,
        createdAt: CREATED_AT,
      });
      await seedDossier(runtime, candidateExpiryScope, dossierA);
      await seedDossier(runtime, TENANT_B_SCOPE, dossierB);
      await seedDossier(publicWriter, PUBLIC_SCOPE, publicDossier);
      await createCandidateDossierSnapshot(runtime, {
        scope: snapshotExpiryScope,
        snapshotId: 'snapshot-expiring',
        dossier: dossierA,
        evidenceCutoff: EVIDENCE_CUTOFF,
        createdAt: CREATED_AT,
      });

      const firstPurge = await purgeExpiredTenantData(runtime, {
        tenantId: TENANT_A,
        expiresBeforeOrAt: '2026-07-30T12:00:00Z',
        batchSize: 1,
      });
      expect(firstPurge).toEqual({
        deletedSnapshots: 1,
        deletedCandidates: 0,
      });
      const activeBeforeCandidateExpiry = await selectActiveDossierMaterial(
        runtime,
        {
          scope: candidateExpiryScope,
          candidateId: dossierA.identity.candidateId,
          evidenceCutoff: '2026-07-30T12:00:00Z',
          limit: 100,
        },
      );
      expect(Array.isArray(activeBeforeCandidateExpiry.observations)).toBe(
        true,
      );

      const secondPurge = await purgeExpiredTenantData(runtime, {
        tenantId: TENANT_A,
        expiresBeforeOrAt: '2026-08-01T00:00:00Z',
        batchSize: 1,
      });
      expect(secondPurge).toEqual({
        deletedSnapshots: 0,
        deletedCandidates: 1,
      });

      const publicRows = await selectActiveDossierMaterial(runtime, {
        scope: PUBLIC_SCOPE,
        candidateId: publicDossier.identity.candidateId,
        evidenceCutoff: '2026-08-01T00:00:00Z',
        limit: 100,
      });
      expect(publicRows.observations).toHaveLength(1);
      const tenantBRows = await selectActiveDossierMaterial(runtime, {
        scope: TENANT_B_SCOPE,
        candidateId: dossierB.identity.candidateId,
        evidenceCutoff: '2026-08-01T00:00:00Z',
        limit: 100,
      });
      expect(tenantBRows.observations).toHaveLength(1);

      await deleteTenantData(runtime, {
        tenantId: TENANT_B,
        deletedAt: '2026-08-01T00:01:00Z',
        reasonCode: 'tenant-request',
      });
      await expect(
        selectActiveDossierMaterial(runtime, {
          scope: TENANT_B_SCOPE,
          candidateId: dossierB.identity.candidateId,
          evidenceCutoff: '2026-08-01T00:02:00Z',
          limit: 100,
        }),
      ).rejects.toMatchObject({ code: 'persistence.not-found' });
      const activePublic = await selectActiveDossierMaterial(runtime, {
        scope: PUBLIC_SCOPE,
        candidateId: publicDossier.identity.candidateId,
        evidenceCutoff: '2026-08-01T00:02:00Z',
        limit: 100,
      });
      expect(Array.isArray(activePublic.observations)).toBe(true);

      const tombstoneColumns = await ownerSql<
        readonly { readonly column_name: string }[]
      >`
        select column_name
        from information_schema.columns
        where table_schema = 'gitblocks'
          and table_name = 'tenant_tombstones'
        order by ordinal_position
      `;
      expect(tombstoneColumns.map((column) => column.column_name)).toEqual([
        'tenant_id',
        'deleted_at',
        'reason_code',
      ]);
      const tombstones = await ownerSql<
        readonly {
          readonly tenant_id: string;
          readonly reason_code: string;
        }[]
      >`
        select tenant_id::text, reason_code
        from gitblocks.tenant_tombstones
      `;
      expect(tombstones).toEqual([
        { tenant_id: TENANT_B, reason_code: 'tenant-request' },
      ]);
    } finally {
      await Promise.all([
        closePersistenceClient(runtime),
        closePersistenceClient(publicWriter),
      ]);
    }
  });

  it('keeps SQL-injection sentinels inert and errors free of credentials, SQL, parameters, URLs, payloads, and stacks', async () => {
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    const dossier = createCandidateDossier('candidate-alpha');
    const sentinel = `inert'); drop schema gitblocks cascade; --`;
    firstOrThrow(dossier.observations).observation = sentinel;
    try {
      await createTenant(runtime, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await seedDossier(runtime, TENANT_A_SCOPE, dossier);
      const active = await selectActiveDossierMaterial(runtime, {
        scope: TENANT_A_SCOPE,
        candidateId: dossier.identity.candidateId,
        evidenceCutoff: CREATED_AT,
        limit: 100,
      });
      expect(active.observations[0]?.observation).toBe(sentinel);
      const schema = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from pg_catalog.pg_namespace
        where nspname = 'gitblocks'
      `;
      expect(schema[0]?.count).toBe(1);

      const badClient = createPersistenceClient({
        ...RUNTIME_CONFIG,
        password: 'credential-sentinel',
        connectTimeoutMilliseconds: 250,
      });
      let caught: unknown;
      try {
        await selectActiveDossierMaterial(badClient, {
          scope: {
            kind: 'tenant',
            tenantId: TENANT_A,
            expiresAt: TENANT_EXPIRY,
          },
          candidateId: dossier.identity.candidateId,
          evidenceCutoff: CREATED_AT,
          limit: 100,
        });
      } catch (error) {
        caught = error;
      } finally {
        await closePersistenceClient(badClient);
      }
      expect(caught).toMatchObject({
        code: 'persistence.connection',
        stack: undefined,
      });
      const serialized = JSON.stringify(caught);
      expect(serialized).not.toContain('credential-sentinel');
      expect(serialized).not.toContain(sentinel);
      expect(serialized).not.toContain('https://');
      expect(serialized).not.toContain('select ');
    } finally {
      await closePersistenceClient(runtime);
    }
  });

  it('maps server lock deadlines and caller cancellation to one safe deadline error', async () => {
    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    const dossier = createCandidateDossier('candidate-alpha');
    try {
      await createTenant(runtime, {
        tenantId: TENANT_A,
        createdAt: CREATED_AT,
      });
      await putCatalogCandidate(runtime, {
        scope: TENANT_A_SCOPE,
        identity: dossier.identity,
        createdAt: CREATED_AT,
      });

      let releaseLock: (() => void) | undefined;
      let announceLock: (() => void) | undefined;
      const locked = new Promise<void>((resolve) => {
        announceLock = resolve;
      });
      const released = new Promise<void>((resolve) => {
        releaseLock = resolve;
      });
      const lockHolder = ownerSql.begin(async (transaction) => {
        await transaction`
          select 1
          from gitblocks.catalog_candidates
          where scope_key = ${`tenant:${TENANT_A}`}
            and candidate_id = ${dossier.identity.candidateId}
          for update
        `;
        announceLock?.();
        await released;
      });
      await locked;

      await expect(
        setCandidateCapabilityFamilies(
          runtime,
          {
            scope: TENANT_A_SCOPE,
            candidateId: dossier.identity.candidateId,
            capabilityFamilies: ['authorization'],
          },
          { lockTimeoutMilliseconds: 25 },
        ),
      ).rejects.toMatchObject({ code: 'persistence.deadline' });

      const controller = new AbortController();
      controller.abort();
      await expect(
        setCandidateCapabilityFamilies(
          runtime,
          {
            scope: TENANT_A_SCOPE,
            candidateId: dossier.identity.candidateId,
            capabilityFamilies: ['authorization'],
          },
          { signal: controller.signal },
        ),
      ).rejects.toMatchObject({ code: 'persistence.deadline' });

      releaseLock?.();
      await lockHolder;
    } finally {
      await closePersistenceClient(runtime);
    }
  });

  it('uses indexes for active-as-of and expiry paths without unbounded batches', async () => {
    const indexNames = await ownerSql<
      readonly { readonly indexname: string }[]
    >`
      select indexname
      from pg_catalog.pg_indexes
      where schemaname = 'gitblocks'
      order by indexname
    `;
    expect(indexNames.map((index) => index.indexname)).toEqual(
      expect.arrayContaining([
        'evidence_observations_active_page',
        'evidence_observations_tenant_expiry',
        'candidate_dossier_snapshots_tenant_expiry',
        'catalog_candidates_tenant_expiry',
      ]),
    );

    const runtime = createPersistenceClient(RUNTIME_CONFIG);
    try {
      await expect(
        purgeExpiredTenantData(runtime, {
          tenantId: TENANT_A,
          expiresBeforeOrAt: CREATED_AT,
          batchSize: 501,
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
      await expect(
        selectActiveDossierMaterial(runtime, {
          scope: TENANT_A_SCOPE,
          candidateId: 'candidate-alpha',
          evidenceCutoff: CREATED_AT,
          limit: 101,
        }),
      ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
    } finally {
      await closePersistenceClient(runtime);
    }
  });
});

async function resetDatabase(): Promise<void> {
  await dropGitBlocksSchema();
  const owner = createPersistenceClient(OWNER_CONFIG);
  try {
    await applyMigrations(owner);
  } finally {
    await closePersistenceClient(owner);
  }
}

async function dropGitBlocksSchema(): Promise<void> {
  await ownerSql.unsafe('drop schema if exists gitblocks cascade');
}

async function ensureRuntimeLogins(): Promise<void> {
  await ownerSql.unsafe(`
    do $gitblocks_test_roles$
    begin
      if not exists (
        select 1
        from pg_catalog.pg_roles
        where rolname = 'gitblocks_runtime_test'
      ) then
        create role gitblocks_runtime_test
          login
          password 'runtime-test-only'
          nosuperuser
          nocreatedb
          nocreaterole
          noreplication
          nobypassrls
          in role gitblocks_runtime;
      else
        grant gitblocks_runtime to gitblocks_runtime_test;
      end if;
      if not exists (
        select 1
        from pg_catalog.pg_roles
        where rolname = 'gitblocks_public_test'
      ) then
        create role gitblocks_public_test
          login
          password 'public-test-only'
          nosuperuser
          nocreatedb
          nocreaterole
          noreplication
          nobypassrls
          in role gitblocks_public_writer;
      else
        grant gitblocks_public_writer to gitblocks_public_test;
      end if;
    end
    $gitblocks_test_roles$;
  `);
}

async function seedDossier(
  client: PersistenceClient,
  scope: StorageScope,
  dossier: CandidateDossierV1,
): Promise<void> {
  await putCatalogCandidate(client, {
    scope,
    identity: dossier.identity,
    createdAt: CREATED_AT,
  });
  await setCandidateCapabilityFamilies(client, {
    scope,
    candidateId: dossier.identity.candidateId,
    capabilityFamilies: [dossier.capabilityFamily],
  });
  for (const observation of dossier.observations) {
    await appendEvidenceObservation(client, {
      scope,
      observation,
      createdAt: CREATED_AT,
    });
  }
  for (const limitation of dossier.limitations) {
    await appendCandidateLimitation(client, {
      scope,
      limitation,
      createdAt: CREATED_AT,
    });
  }
  for (const unknown of dossier.unknowns) {
    await appendCandidateUnknown(client, {
      scope,
      unknown,
      createdAt: CREATED_AT,
    });
  }
}

function createProvenanceDossier(): MutableValue<CandidateDossierV1> {
  const dossier = createCandidateDossier('candidate-alpha');
  const base = firstOrThrow(dossier.observations);
  const observations: MutableValue<EvidenceObservationV1>[] = [
    withSource(base, 'evidence-git-commit', base.source),
    withSource(base, 'evidence-tag', {
      kind: 'tag',
      sourceType: 'official-repository',
      sourceUrl: 'https://github.com/example/alpha',
      tag: 'v1.2.3',
      immutableUrl: 'https://github.com/example/alpha/tree/v1.2.3',
      publishedAt: '2026-07-28T19:00:00Z',
      collectedAt: '2026-07-28T20:30:00Z',
    }),
    withSource(base, 'evidence-release', {
      kind: 'release',
      sourceType: 'official-release',
      sourceUrl: 'https://github.com/example/alpha/releases',
      release: 'v1.2.3',
      immutableUrl: 'https://github.com/example/alpha/releases/tag/v1.2.3',
      publishedAt: '2026-07-28T19:00:00Z',
      collectedAt: '2026-07-28T20:30:00Z',
    }),
    withSource(base, 'evidence-package-version', {
      kind: 'package-version',
      sourceType: 'package-registry',
      sourceUrl: 'https://www.npmjs.com/package/example-alpha',
      packageVersion: '1.2.3',
      immutableUrl: 'https://www.npmjs.com/package/example-alpha/v/1.2.3',
      publishedAt: '2026-07-28T19:00:00Z',
      collectedAt: '2026-07-28T20:30:00Z',
    }),
    withSource(base, 'evidence-security-advisory', {
      kind: 'security-advisory',
      sourceType: 'security-advisory',
      sourceUrl: 'https://github.com/advisories/ghsa-abcd-1234',
      advisoryId: 'ghsa-abcd-1234',
      immutableUrl: 'https://github.com/advisories/ghsa-abcd-1234',
      publishedAt: '2026-07-28T19:00:00Z',
      collectedAt: '2026-07-28T20:30:00Z',
    }),
    withSource(base, 'evidence-mutable-documentation', {
      kind: 'mutable-documentation',
      sourceType: 'official-documentation',
      sourceUrl: 'https://docs.example.com/alpha',
      limitationCode: 'source-is-mutable',
      collectedAt: '2026-07-28T20:30:00Z',
    }),
    withSource(base, 'evidence-approved-validation', {
      kind: 'approved-validation',
      sourceType: 'approved-validation',
      validationReferenceId: 'validation-alpha',
      scope: 'tenant-validation',
      validatedAt: '2026-07-28T20:30:00Z',
    }),
  ];
  dossier.observations = observations;
  dossier.limitations = [
    {
      limitationId: 'limitation-provenance',
      limitationCode: 'bounded-source-review',
      candidateId: dossier.identity.candidateId,
      statement: 'Every supplied source was reviewed as bounded evidence.',
      evidenceIds: observations.map((observation) => observation.evidenceId),
    },
  ];
  dossier.unknowns = [
    {
      scope: 'candidate',
      unknownId: 'unknown-provenance',
      candidateId: dossier.identity.candidateId,
      topic: 'future-source-change',
      statement: 'Future mutable documentation changes remain unknown.',
      evidenceIds: ['evidence-mutable-documentation'],
    },
  ];
  return dossier;
}

function withSource(
  base: MutableValue<EvidenceObservationV1>,
  evidenceId: string,
  source: EvidenceObservationV1['source'],
): MutableValue<EvidenceObservationV1> {
  return {
    ...structuredClone(base),
    evidenceId,
    observation: `The ${source.kind} variant preserves exact provenance.`,
    source: structuredClone(source),
  };
}

function withCandidateId(
  dossier: MutableValue<CandidateDossierV1>,
  candidateId: string,
  repositoryName: string,
): MutableValue<CandidateDossierV1> {
  dossier.identity.candidateId = candidateId;
  dossier.identity.displayName = `Candidate ${candidateId}`;
  dossier.identity.repository.name = repositoryName;
  dossier.identity.package = {
    registry: 'npm',
    name: `example-${repositoryName}`,
  };
  for (const observation of dossier.observations) {
    observation.candidateId = candidateId;
    observation.evidenceId = `${observation.evidenceId}-${candidateId}`;
  }
  for (const limitation of dossier.limitations) {
    limitation.candidateId = candidateId;
    limitation.limitationId = `${limitation.limitationId}-${candidateId}`;
    limitation.evidenceIds = dossier.observations.map(
      (observation) => observation.evidenceId,
    );
  }
  for (const unknown of dossier.unknowns) {
    unknown.candidateId = candidateId;
    unknown.unknownId = `${unknown.unknownId}-${candidateId}`;
    unknown.evidenceIds = dossier.observations.map(
      (observation) => observation.evidenceId,
    );
  }
  return dossier;
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

function firstOrThrow<Value>(values: readonly Value[]): Value {
  const value = values[0];
  if (value === undefined) {
    throw new Error('Test fixture requires at least one value.');
  }
  return value;
}
