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
  loadCandidateDossierSnapshot,
  PersistenceError,
  putCatalogCandidate,
  recordEvidenceInvalidation,
  recordEvidenceSupersession,
  selectActiveDossierMaterial,
  setCandidateCapabilityFamilies,
  verifyMigrations,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '../../src/index.ts';
import { createCandidateDossier, type MutableValue } from '../fixtures.ts';

const OWNER_CONFIG = readOwnerConfig();
const RUNTIME_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_persistence_test',
  password: 'persistence-test-only',
  maximumConnections: 5,
};
const CREATED_AT = '2026-07-28T22:00:00Z';
const EVIDENCE_CUTOFF = '2026-07-28T21:00:00Z';
const CANDIDATE_LOCK_SEED = 44392817;

let ownerSql: Sql;

describe(
  'PostgreSQL public evidence persistence',
  { concurrent: false },
  () => {
    beforeAll(async () => {
      ownerSql = directSql(OWNER_CONFIG);
      await resetDatabase();
    });

    beforeEach(async () => {
      await resetDatabase();
    });

    afterAll(async () => {
      await ownerSql.end({ timeout: 5 });
    });

    it('applies cleanly, repeats safely, verifies checksums, and serializes concurrent migrators', async () => {
      await dropGitBlocksSchema();
      const first = createPersistenceClient(OWNER_CONFIG);
      const second = createPersistenceClient(OWNER_CONFIG);
      try {
        const concurrent = await Promise.all([
          applyMigrations(first),
          applyMigrations(second),
        ]);
        const repeated = await applyMigrations(first);
        const verified = await verifyMigrations(second);

        expect(concurrent).toHaveLength(2);
        expect(repeated).toEqual(verified);
        expect(verified.postgresqlVersion).toMatch(/^18\.4\b/u);
        expect(verified.migrations).toHaveLength(2);
        expect(firstOrThrow(verified.migrations)).toMatchObject({
          version: 1,
          name: 'evidence-persistence',
        });
        expect(verified.migrations.at(-1)).toMatchObject({
          version: 2,
          name: 'runtime-migration-verification',
        });
        expect(
          verified.migrations.every((migration) =>
            /^[0-9a-f]{64}$/u.test(migration.checksum),
          ),
        ).toBe(true);
        expect(firstOrThrow(verified.migrations).checksum).toMatch(
          /^[0-9a-f]{64}$/u,
        );
        const history = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from gitblocks.schema_migrations
      `;
        expect(history[0]?.count).toBe(2);

        const runtime = createPersistenceClient(RUNTIME_CONFIG);
        try {
          await expect(verifyMigrations(runtime)).resolves.toEqual(verified);
        } finally {
          await closePersistenceClient(runtime);
        }
      } finally {
        await Promise.all([
          closePersistenceClient(first),
          closePersistenceClient(second),
        ]);
      }
    });

    it('detects migration drift, rolls failure back, and never migrates implicitly', async () => {
      await ownerSql`
      update gitblocks.schema_migrations
      set checksum =
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      where version = 1
    `;
      const driftClient = createPersistenceClient(OWNER_CONFIG);
      await expect(verifyMigrations(driftClient)).rejects.toMatchObject({
        code: 'persistence.migration-drift',
      });
      await closePersistenceClient(driftClient);

      await dropGitBlocksSchema();
      await ownerSql.unsafe(`
      create or replace function public.gitblocks_test_reject_migration()
      returns event_trigger
      language plpgsql
      as $$
      begin
        if pg_catalog.current_query()
          like '%create table gitblocks.catalog_candidates%' then
          raise exception using errcode = 'P0001', message = 'test failure';
        end if;
      end
      $$;
      create event trigger gitblocks_test_reject_migration
      on ddl_command_start
      execute function public.gitblocks_test_reject_migration();
    `);
      const failingClient = createPersistenceClient(OWNER_CONFIG);
      try {
        await expect(applyMigrations(failingClient)).rejects.toBeInstanceOf(
          PersistenceError,
        );
      } finally {
        await closePersistenceClient(failingClient);
        await ownerSql.unsafe(`
        drop event trigger if exists gitblocks_test_reject_migration;
        drop function if exists public.gitblocks_test_reject_migration();
      `);
      }
      const failedSchemas = await ownerSql<
        readonly { readonly count: number }[]
      >`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_namespace
      where nspname = 'gitblocks'
    `;
      expect(failedSchemas[0]?.count).toBe(0);

      const lazyClient = createPersistenceClient(OWNER_CONFIG);
      await closePersistenceClient(lazyClient);
      const lazySchemas = await ownerSql<readonly { readonly count: number }[]>`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_namespace
      where nspname = 'gitblocks'
    `;
      expect(lazySchemas[0]?.count).toBe(0);
    });

    it('creates only the public schema and one least-privilege non-owner role', async () => {
      const tables = await ownerSql<
        readonly {
          readonly tablename: string;
          readonly rowsecurity: boolean;
        }[]
      >`
      select
        class.relname as tablename,
        class.relrowsecurity as rowsecurity
      from pg_catalog.pg_class as class
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
        and class.relkind = 'r'
        and class.relname <> 'schema_migrations'
      order by class.relname
    `;
      expect(tables).toHaveLength(13);
      expect(tables.every((table) => !table.rowsecurity)).toBe(true);
      expect(tables.map((table) => table.tablename)).not.toEqual(
        expect.arrayContaining([
          'tenants',
          'tenant_tombstones',
          'organizations',
          'organization_dossier_refs',
        ]),
      );

      const policies = await ownerSql<readonly { readonly count: number }[]>`
      select pg_catalog.count(*)::integer as count
      from pg_catalog.pg_policy as policy
      join pg_catalog.pg_class as class
        on class.oid = policy.polrelid
      join pg_catalog.pg_namespace as namespace
        on namespace.oid = class.relnamespace
      where namespace.nspname = 'gitblocks'
    `;
      expect(policies[0]?.count).toBe(0);

      const role = await ownerSql<
        readonly {
          readonly rolname: string;
          readonly rolsuper: boolean;
          readonly rolbypassrls: boolean;
        }[]
      >`
      select rolname, rolsuper, rolbypassrls
      from pg_catalog.pg_roles
      where rolname = 'gitblocks_persistence_test'
    `;
      expect(role).toEqual([
        {
          rolname: 'gitblocks_persistence_test',
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
      expect(migrationSql).not.toMatch(/\btenant\b|\bexpiry\b|\bpurge\b/iu);
      expect(migrationSql).not.toMatch(
        /\brow level security\b|\bcreate policy\b/iu,
      );
      expect(migrationSql).not.toMatch(/\bcreate table (?!gitblocks\.)/iu);
      expect(migrationSql).not.toMatch(/\breferences (?!gitblocks\.)/iu);
    });

    it('enforces candidate identity uniqueness and complete candidate idempotency', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      const dossier = createCandidateDossier('candidate-alpha');
      try {
        await expect(
          Promise.all([
            putCatalogCandidate(runtime, {
              identity: dossier.identity,
              createdAt: CREATED_AT,
            }),
            putCatalogCandidate(runtime, {
              identity: dossier.identity,
              createdAt: CREATED_AT,
            }),
          ]),
        ).resolves.toEqual([undefined, undefined]);
        await expect(
          putCatalogCandidate(runtime, {
            identity: dossier.identity,
            createdAt: '2026-07-28T22:00:01Z',
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });

        const repositoryConflict = withCandidateId(
          createCandidateDossier('candidate-beta'),
          'repository-conflict',
          'ALPHA',
        );
        repositoryConflict.identity.repository.owner =
          dossier.identity.repository.owner.toUpperCase();
        repositoryConflict.identity.package = {
          registry: 'npm',
          name: 'repository-conflict',
        };
        await expect(
          putCatalogCandidate(runtime, {
            identity: repositoryConflict.identity,
            createdAt: CREATED_AT,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });

        const packageConflict = withCandidateId(
          createCandidateDossier('candidate-beta'),
          'package-conflict',
          'package-conflict',
        );
        packageConflict.identity.package = {
          registry: 'npm',
          name: 'example-alpha',
        };
        await expect(
          putCatalogCandidate(runtime, {
            identity: packageConflict.identity,
            createdAt: CREATED_AT,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });

        await expect(
          ownerSql`
          update gitblocks.catalog_candidates
          set display_name = 'forbidden'
          where candidate_id = ${dossier.identity.candidateId}
        `,
        ).rejects.toMatchObject({ code: 'P0001' });
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('round-trips all seven provenance variants and enforces complete immutable-record conflicts', async () => {
      const first = createPersistenceClient(RUNTIME_CONFIG);
      const second = createPersistenceClient(RUNTIME_CONFIG);
      const dossier = createProvenanceDossier();
      try {
        await putCatalogCandidate(first, {
          identity: dossier.identity,
          createdAt: CREATED_AT,
        });
        await setCandidateCapabilityFamilies(first, {
          candidateId: dossier.identity.candidateId,
          capabilityFamilies: [dossier.capabilityFamily],
        });
        for (const observation of dossier.observations) {
          await appendEvidenceObservation(first, {
            observation,
            createdAt: CREATED_AT,
          });
        }

        const concurrent = structuredClone(firstOrThrow(dossier.observations));
        concurrent.evidenceId = 'evidence-concurrent';
        await expect(
          Promise.all([
            appendEvidenceObservation(first, {
              observation: concurrent,
              createdAt: CREATED_AT,
            }),
            appendEvidenceObservation(second, {
              observation: concurrent,
              createdAt: CREATED_AT,
            }),
          ]),
        ).resolves.toEqual([undefined, undefined]);
        await expect(
          appendEvidenceObservation(first, {
            observation: concurrent,
            createdAt: '2026-07-28T22:00:01Z',
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });

        const changed = structuredClone(concurrent);
        changed.observation = 'Changed immutable payload.';
        const conflictBase = structuredClone(concurrent);
        conflictBase.evidenceId = 'evidence-concurrent-conflict';
        changed.evidenceId = conflictBase.evidenceId;
        const outcomes = await Promise.allSettled([
          appendEvidenceObservation(first, {
            observation: conflictBase,
            createdAt: CREATED_AT,
          }),
          appendEvidenceObservation(second, {
            observation: changed,
            createdAt: CREATED_AT,
          }),
        ]);
        expect(
          outcomes.filter((outcome) => outcome.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          outcomes.filter((outcome) => outcome.status === 'rejected'),
        ).toHaveLength(1);

        for (const limitation of dossier.limitations) {
          await appendCandidateLimitation(first, {
            limitation,
            createdAt: CREATED_AT,
          });
          await expect(
            appendCandidateLimitation(first, {
              limitation,
              createdAt: CREATED_AT,
            }),
          ).resolves.toBeUndefined();
          await expect(
            appendCandidateLimitation(first, {
              limitation,
              createdAt: '2026-07-28T22:00:01Z',
            }),
          ).rejects.toMatchObject({ code: 'persistence.conflict' });
        }
        for (const unknown of dossier.unknowns) {
          await appendCandidateUnknown(first, {
            unknown,
            createdAt: CREATED_AT,
          });
          await expect(
            appendCandidateUnknown(first, {
              unknown,
              createdAt: CREATED_AT,
            }),
          ).resolves.toBeUndefined();
          const changedUnknown = structuredClone(unknown);
          changedUnknown.statement = 'Changed immutable unknown statement.';
          await expect(
            appendCandidateUnknown(first, {
              unknown: changedUnknown,
              createdAt: CREATED_AT,
            }),
          ).rejects.toMatchObject({ code: 'persistence.conflict' });
        }
        await createCandidateDossierSnapshot(first, {
          snapshotId: 'snapshot-provenance',
          dossier,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        });
        await expect(
          loadCandidateDossierSnapshot(first, {
            snapshotId: 'snapshot-provenance',
          }),
        ).resolves.toEqual(dossier);

        const normalized = await ownerSql<
          readonly {
            readonly provenance_kind: string;
            readonly published: boolean;
            readonly collected: boolean;
            readonly validated: boolean;
          }[]
        >`
        select
          provenance_kind,
          published_at is not null as published,
          collected_at is not null as collected,
          validated_at is not null as validated
        from gitblocks.evidence_observations
        where evidence_id like 'evidence-%'
          and evidence_id <> 'evidence-concurrent'
          and evidence_id <> 'evidence-concurrent-conflict'
        order by provenance_kind
      `;
        expect(normalized).toHaveLength(7);
        expect(
          normalized.find(
            (row) => row.provenance_kind === 'approved-validation',
          ),
        ).toMatchObject({
          published: false,
          collected: false,
          validated: true,
        });
        expect(
          normalized.find(
            (row) => row.provenance_kind === 'mutable-documentation',
          ),
        ).toMatchObject({
          published: false,
          collected: true,
          validated: false,
        });

        await expect(
          appendCandidateLimitation(first, {
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
          closePersistenceClient(first),
          closePersistenceClient(second),
        ]);
      }
    });

    it('uses evidence-world timestamps rather than insertion time for every provenance variant', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      const dossier = createProvenanceDossier();
      try {
        await putCatalogCandidate(runtime, {
          identity: dossier.identity,
          createdAt: '2026-07-28T18:00:00Z',
        });
        for (const observation of dossier.observations) {
          await appendEvidenceObservation(runtime, {
            observation,
            createdAt: '2026-07-28T18:00:00Z',
          });
        }
        for (const limitation of dossier.limitations) {
          await appendCandidateLimitation(runtime, {
            limitation,
            createdAt: CREATED_AT,
          });
        }
        for (const unknown of dossier.unknowns) {
          await appendCandidateUnknown(runtime, {
            unknown,
            createdAt: CREATED_AT,
          });
        }

        const beforeCollection = await selectActiveDossierMaterial(runtime, {
          candidateId: dossier.identity.candidateId,
          evidenceCutoff: '2026-07-28T20:00:00Z',
        });
        expect(beforeCollection.observations).toEqual([]);

        const afterAllEvidenceTimes = await selectActiveDossierMaterial(
          runtime,
          {
            candidateId: dossier.identity.candidateId,
            evidenceCutoff: EVIDENCE_CUTOFF,
          },
        );
        expect(afterAllEvidenceTimes.observations).toHaveLength(7);
        expect(afterAllEvidenceTimes.limitations).toHaveLength(1);
        expect(afterAllEvidenceTimes.unknowns).toHaveLength(1);

        const futureCollection = structuredClone(
          firstOrThrow(dossier.observations),
        );
        futureCollection.evidenceId = 'future-collection';
        if (futureCollection.source.kind !== 'git-commit') {
          throw new Error('Fixture source kind changed.');
        }
        futureCollection.source.collectedAt = '2026-07-28T22:00:00Z';
        futureCollection.freshness.asOf = '2026-07-28T22:00:00Z';
        await appendEvidenceObservation(runtime, {
          observation: futureCollection,
          createdAt: '2026-07-28T18:00:00Z',
        });

        const futureFreshness = structuredClone(
          firstOrThrow(dossier.observations),
        );
        futureFreshness.evidenceId = 'future-freshness';
        futureFreshness.freshness.asOf = '2026-07-28T22:00:00Z';
        await appendEvidenceObservation(runtime, {
          observation: futureFreshness,
          createdAt: '2026-07-28T18:00:00Z',
        });

        const cutoff = await selectActiveDossierMaterial(runtime, {
          candidateId: dossier.identity.candidateId,
          evidenceCutoff: '2026-07-28T21:30:00Z',
        });
        expect(cutoff.observations.map((item) => item.evidenceId)).not.toEqual(
          expect.arrayContaining(['future-collection', 'future-freshness']),
        );

        const futureDossier = structuredClone(dossier);
        futureDossier.observations = [futureCollection];
        futureDossier.limitations = [];
        futureDossier.unknowns = [];
        await expect(
          createCandidateDossierSnapshot(runtime, {
            snapshotId: 'future-evidence-snapshot',
            dossier: futureDossier,
            evidenceCutoff: '2026-07-28T21:30:00Z',
            createdAt: CREATED_AT,
          }),
        ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('uses a serialized set diff and keeps snapshots independent of current capability membership', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      const dossier = createCandidateDossier('candidate-alpha');
      try {
        await seedDossier(runtime, dossier);
        const before = await membershipVersions(dossier.identity.candidateId);
        await setCandidateCapabilityFamilies(runtime, {
          candidateId: dossier.identity.candidateId,
          capabilityFamilies: ['authorization'],
        });
        expect(await membershipVersions(dossier.identity.candidateId)).toEqual(
          before,
        );

        await createCandidateDossierSnapshot(runtime, {
          snapshotId: 'snapshot-capability-history',
          dossier,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        });
        await setCandidateCapabilityFamilies(runtime, {
          candidateId: dossier.identity.candidateId,
          capabilityFamilies: ['authorization'],
        });
        expect(await membershipVersions(dossier.identity.candidateId)).toEqual(
          before,
        );

        await setCandidateCapabilityFamilies(runtime, {
          candidateId: dossier.identity.candidateId,
          capabilityFamilies: ['authorization', 'webhooks'],
        });
        expect(
          (await membershipVersions(dossier.identity.candidateId))[
            'authorization'
          ],
        ).toBe(before['authorization']);
        await setCandidateCapabilityFamilies(runtime, {
          candidateId: dossier.identity.candidateId,
          capabilityFamilies: ['webhooks'],
        });
        await expect(
          loadCandidateDossierSnapshot(runtime, {
            snapshotId: 'snapshot-capability-history',
          }),
        ).resolves.toEqual(dossier);

        await expect(
          createCandidateDossierSnapshot(runtime, {
            snapshotId: 'snapshot-current-membership-rejected',
            dossier,
            evidenceCutoff: EVIDENCE_CUTOFF,
            createdAt: CREATED_AT,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('keeps historical snapshots exact and detects retry changes in cutoff or ordered membership', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      const dossier = createCandidateDossier('candidate-alpha');
      try {
        await seedDossier(runtime, dossier);
        const command = {
          snapshotId: 'snapshot-retry',
          dossier,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        } as const;
        await createCandidateDossierSnapshot(runtime, command);
        await expect(
          createCandidateDossierSnapshot(runtime, command),
        ).resolves.toBeUndefined();
        await expect(
          createCandidateDossierSnapshot(runtime, {
            ...command,
            evidenceCutoff: '2026-07-28T21:30:00Z',
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });

        const additional = structuredClone(firstOrThrow(dossier.observations));
        additional.evidenceId = 'evidence-additional';
        additional.observation = 'Additional public evidence.';
        await appendEvidenceObservation(runtime, {
          observation: additional,
          createdAt: CREATED_AT,
        });
        const changedMembership = structuredClone(dossier);
        changedMembership.observations.push(additional);
        await expect(
          createCandidateDossierSnapshot(runtime, {
            ...command,
            dossier: changedMembership,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });

        const other = createCandidateDossier('candidate-beta');
        await seedDossier(runtime, other);
        const crossCandidate = structuredClone(dossier);
        crossCandidate.observations = [
          structuredClone(firstOrThrow(other.observations)),
        ];
        await expect(
          createCandidateDossierSnapshot(runtime, {
            snapshotId: 'snapshot-cross-candidate',
            dossier: crossCandidate,
            evidenceCutoff: EVIDENCE_CUTOFF,
            createdAt: CREATED_AT,
          }),
        ).rejects.toBeInstanceOf(PersistenceError);

        await expect(
          loadCandidateDossierSnapshot(runtime, {
            snapshotId: 'snapshot-retry',
          }),
        ).resolves.toEqual(dossier);
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('applies lifecycle timing, rejects cycles, and returns reference-closed active material', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      const dossier = createCandidateDossier('candidate-alpha');
      const original = firstOrThrow(dossier.observations);
      dossier.unknowns = [
        {
          scope: 'candidate',
          unknownId: 'unknown-original-support',
          candidateId: dossier.identity.candidateId,
          topic: 'runtime-uncertainty',
          statement: 'The original evidence leaves one bounded unknown.',
          evidenceIds: [original.evidenceId],
        },
      ];
      const correction = structuredClone(original);
      correction.evidenceId = 'evidence-correction';
      correction.observation = 'Corrected immutable public evidence.';
      try {
        await seedDossier(runtime, dossier);
        await createCandidateDossierSnapshot(runtime, {
          snapshotId: 'snapshot-lifecycle-history',
          dossier,
          evidenceCutoff: EVIDENCE_CUTOFF,
          createdAt: CREATED_AT,
        });
        await appendEvidenceObservation(runtime, {
          observation: correction,
          createdAt: '2026-07-28T22:01:00Z',
        });
        const supersession = {
          candidateId: dossier.identity.candidateId,
          supersessionId: 'supersession-correction',
          supersededEvidenceId: original.evidenceId,
          supersedingEvidenceId: correction.evidenceId,
          reasonCode: 'corrected-observation',
          createdAt: '2026-07-28T22:10:00Z',
          effectiveAt: '2026-07-28T22:10:00Z',
        } as const;
        await recordEvidenceSupersession(runtime, supersession);
        await expect(
          recordEvidenceSupersession(runtime, supersession),
        ).resolves.toBeUndefined();
        await expect(
          recordEvidenceSupersession(runtime, {
            ...supersession,
            reasonCode: 'changed-reason',
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });

        const before = await selectActiveDossierMaterial(runtime, {
          candidateId: dossier.identity.candidateId,
          evidenceCutoff: '2026-07-28T22:09:00Z',
        });
        expect(before.observations.map((item) => item.evidenceId)).toEqual([
          'evidence-alpha',
          'evidence-correction',
        ]);
        expect(before.limitations).toHaveLength(1);
        expect(before.unknowns).toHaveLength(1);

        const afterSupersession = await selectActiveDossierMaterial(runtime, {
          candidateId: dossier.identity.candidateId,
          evidenceCutoff: '2026-07-28T22:10:00Z',
        });
        expect(
          afterSupersession.observations.map((item) => item.evidenceId),
        ).toEqual(['evidence-correction']);
        expect(afterSupersession.limitations).toEqual([]);
        expect(afterSupersession.unknowns).toEqual([]);

        await recordEvidenceInvalidation(runtime, {
          candidateId: dossier.identity.candidateId,
          invalidationId: 'invalidation-correction',
          evidenceId: correction.evidenceId,
          reasonCode: 'withdrawn-source',
          createdAt: '2026-07-28T22:20:00Z',
          effectiveAt: '2026-07-28T22:20:00Z',
        });
        const afterInvalidation = await selectActiveDossierMaterial(runtime, {
          candidateId: dossier.identity.candidateId,
          evidenceCutoff: '2026-07-28T22:20:00Z',
        });
        expect(afterInvalidation).toEqual({
          observations: [],
          limitations: [],
          unknowns: [],
        });

        await expect(
          recordEvidenceSupersession(runtime, {
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
            candidateId: dossier.identity.candidateId,
            supersessionId: 'supersession-self',
            supersededEvidenceId: original.evidenceId,
            supersedingEvidenceId: original.evidenceId,
            reasonCode: 'self-attempt',
            createdAt: '2026-07-28T22:30:00Z',
            effectiveAt: '2026-07-28T22:30:00Z',
          }),
        ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
        await expect(
          loadCandidateDossierSnapshot(runtime, {
            snapshotId: 'snapshot-lifecycle-history',
          }),
        ).resolves.toEqual(dossier);
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('stores five non-pilot public dossiers across every capability family', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
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
          await seedDossier(runtime, dossier);
          const snapshotId = `nonpilot-${String(index + 1)}-snapshot`;
          await createCandidateDossierSnapshot(runtime, {
            snapshotId,
            dossier,
            evidenceCutoff: EVIDENCE_CUTOFF,
            createdAt: CREATED_AT,
          });
          await expect(
            loadCandidateDossierSnapshot(runtime, { snapshotId }),
          ).resolves.toEqual(dossier);
        }
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('keeps injection inert and maps deadlines, cancellation, and connection failures to safe errors', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      const dossier = createCandidateDossier('candidate-alpha');
      const sentinel = `inert'); drop schema gitblocks cascade; --`;
      firstOrThrow(dossier.observations).observation = sentinel;
      try {
        await seedDossier(runtime, dossier);
        const active = await selectActiveDossierMaterial(runtime, {
          candidateId: dossier.identity.candidateId,
          evidenceCutoff: CREATED_AT,
        });
        expect(active.observations[0]?.observation).toBe(sentinel);
        const schema = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from pg_catalog.pg_namespace
        where nspname = 'gitblocks'
      `;
        expect(schema[0]?.count).toBe(1);

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
          select pg_catalog.pg_advisory_xact_lock(
            pg_catalog.hashtextextended(
              ${dossier.identity.candidateId},
              ${CANDIDATE_LOCK_SEED}
            )
          )
        `;
          announceLock?.();
          await released;
        });
        await locked;
        await expect(
          setCandidateCapabilityFamilies(
            runtime,
            {
              candidateId: dossier.identity.candidateId,
              capabilityFamilies: ['authorization'],
            },
            { lockTimeoutMilliseconds: 25 },
          ),
        ).rejects.toMatchObject({ code: 'persistence.deadline' });

        const cancellationController = new AbortController();
        const cancellation = setCandidateCapabilityFamilies(
          runtime,
          {
            candidateId: dossier.identity.candidateId,
            capabilityFamilies: ['authorization'],
          },
          {
            signal: cancellationController.signal,
            lockTimeoutMilliseconds: 5_000,
          },
        );
        await new Promise((resolve) => setTimeout(resolve, 25));
        cancellationController.abort();
        await expect(cancellation).rejects.toMatchObject({
          code: 'persistence.deadline',
        });
        releaseLock?.();
        await lockHolder;

        const preAbortedController = new AbortController();
        preAbortedController.abort();
        await expect(
          selectActiveDossierMaterial(
            runtime,
            {
              candidateId: dossier.identity.candidateId,
              evidenceCutoff: CREATED_AT,
            },
            { signal: preAbortedController.signal },
          ),
        ).rejects.toMatchObject({ code: 'persistence.deadline' });

        const badClient = createPersistenceClient({
          ...RUNTIME_CONFIG,
          password: 'credential-sentinel',
          connectTimeoutMilliseconds: 250,
        });
        let caught: unknown;
        try {
          await selectActiveDossierMaterial(badClient, {
            candidateId: dossier.identity.candidateId,
            evidenceCutoff: CREATED_AT,
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

        const operationsSource = await readFile(
          new URL('../../src/operations.ts', import.meta.url),
          'utf8',
        );
        expect(operationsSource).not.toMatch(
          /\bexec\b|\bspawn\b|\bdynamic import\b|\.unsafe\b/iu,
        );
      } finally {
        await closePersistenceClient(runtime);
      }
    });
  },
);

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

async function seedDossier(
  client: PersistenceClient,
  dossier: CandidateDossierV1,
): Promise<void> {
  await putCatalogCandidate(client, {
    identity: dossier.identity,
    createdAt: CREATED_AT,
  });
  await setCandidateCapabilityFamilies(client, {
    candidateId: dossier.identity.candidateId,
    capabilityFamilies: [dossier.capabilityFamily],
  });
  for (const observation of dossier.observations) {
    await appendEvidenceObservation(client, {
      observation,
      createdAt: CREATED_AT,
    });
  }
  for (const limitation of dossier.limitations) {
    await appendCandidateLimitation(client, {
      limitation,
      createdAt: CREATED_AT,
    });
  }
  for (const unknown of dossier.unknowns) {
    await appendCandidateUnknown(client, {
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
      scope: 'bounded-validation',
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

async function membershipVersions(
  candidateId: string,
): Promise<Readonly<Record<string, string>>> {
  const rows = await ownerSql<
    readonly {
      readonly capability_family: string;
      readonly version: string;
    }[]
  >`
    select capability_family, xmin::text as version
    from gitblocks.candidate_capability_families
    where candidate_id = ${candidateId}
    order by capability_family
  `;
  return Object.fromEntries(
    rows.map((row) => [row.capability_family, row.version]),
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
