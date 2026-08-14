import { readFile } from 'node:fs/promises';

import postgres, { type Sql } from 'postgres';
import {
  createModelExecutionV1,
  validateRepositoryInterviewExecutionV1,
} from '@gitblocks/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  findReusableRepositoryInterview,
  loadRepositoryInterviewExchange,
  publishRepositoryArtifactSet,
  publishRepositoryInterviewExchange,
  putCatalogCandidate,
  verifyMigrations,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '../../src/index.ts';
import { createCandidateDossier } from '../fixtures.ts';
import {
  createFailedRepositoryInterviewExecution,
  createRepositoryInterviewPersistenceFixture,
  type RepositoryInterviewFailureCode,
} from '../repository-interview-fixtures.ts';

const OWNER_CONFIG = readOwnerConfig();
const RUNTIME_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_persistence_test',
  password: 'persistence-test-only',
  maximumConnections: 5,
};

let ownerSql: Sql;

describe(
  'PostgreSQL repository interview persistence',
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

    it('preserves the migration 0004 repository-interview tables under later additive migrations', async () => {
      const owner = createPersistenceClient(OWNER_CONFIG);
      try {
        const verification = await verifyMigrations(owner);
        expect(verification.postgresqlVersion).toMatch(/^18\.4\b/u);
        expect(verification.migrations).toHaveLength(7);
        expect(verification.migrations.at(-1)).toMatchObject({
          version: 7,
          name: 'artifact-evidence-serving',
        });
      } finally {
        await closePersistenceClient(owner);
      }

      const tables = await ownerSql<
        readonly {
          readonly table_name: string;
          readonly row_security: boolean;
        }[]
      >`
        select
          class.relname as table_name,
          class.relrowsecurity as row_security
        from pg_catalog.pg_class as class
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = class.relnamespace
        where namespace.nspname = 'gitblocks'
          and class.relkind = 'r'
          and class.relname <> 'schema_migrations'
        order by class.relname
      `;
      expect(tables).toHaveLength(29);
      expect(tables.every((table) => !table.row_security)).toBe(true);
      expect(tables.map((table) => table.table_name)).toEqual(
        expect.arrayContaining([
          'repository_interview_requests',
          'model_executions',
          'repository_interviews',
          'repository_interview_citations',
          'repository_interview_claims',
          'repository_interview_limitations',
          'repository_interview_contradictions',
          'repository_interview_unknowns',
        ]),
      );
      const policies = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from pg_catalog.pg_policy as policy
        join pg_catalog.pg_class as class on class.oid = policy.polrelid
        join pg_catalog.pg_namespace as namespace
          on namespace.oid = class.relnamespace
        where namespace.nspname = 'gitblocks'
      `;
      expect(policies[0]?.count).toBe(0);

      const earlierChecksums = await Promise.all(
        [1, 2, 3].map(async (version) => {
          const fileName =
            version === 1
              ? '0001_evidence_persistence.sql'
              : version === 2
                ? '0002_runtime_migration_verification.sql'
                : '0003_immutable_repository_artifacts.sql';
          return readFile(
            new URL(`../../migrations/${fileName}`, import.meta.url),
            'utf8',
          );
        }),
      );
      expect(earlierChecksums).toHaveLength(3);
    });

    it('publishes, reconstructs, reuses, and idempotently replays one complete five-family interview', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      try {
        const created = await publishRepositoryInterviewExchange(runtime, {
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        expect(created.status).toBe('created');
        expect(created.inserted).toEqual({
          requests: 1,
          executions: 1,
          interviews: 1,
          citations: fixture.interview.citations.length,
          claims: fixture.interview.claims.length,
          limitations: fixture.interview.limitations.length,
          contradictions: fixture.interview.contradictions.length,
          unknowns: fixture.interview.unknowns.length,
        });
        expect(created.record).toEqual({
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        expect(created.record.request).not.toBe(fixture.request);
        expect(created.record.execution).not.toBe(fixture.execution);
        expect(created.record.interview).not.toBe(fixture.interview);

        const byExecution = await loadRepositoryInterviewExchange(runtime, {
          by: 'execution-id',
          executionId: fixture.execution.executionId,
        });
        const byInterview = await loadRepositoryInterviewExchange(runtime, {
          by: 'interview-id',
          interviewId: fixture.interview.interviewId,
        });
        expect(byExecution).toEqual(created.record);
        expect(byInterview).toEqual(created.record);
        expect(
          validateRepositoryInterviewExecutionV1(
            byExecution.request,
            byExecution.execution,
            requireInterview(byExecution.interview),
          ),
        ).toMatchObject({ ok: true });

        const reused = await findReusableRepositoryInterview(runtime, {
          requestIdentityDigest: fixture.request.identityDigest,
          modelProfileDigest: fixture.execution.modelProfileDigest,
          reuseKeyDigest: fixture.execution.reuseKeyDigest,
        });
        expect(reused).toEqual(created.record);

        const replay = await publishRepositoryInterviewExchange(runtime, {
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        expect(replay.status).toBe('idempotent');
        expect(
          Object.values(replay.inserted).every((count) => count === 0),
        ).toBe(true);

        const counts = await exchangeCounts();
        expect(counts.citations).toBe(2);
        expect(counts.claims).toBe(8);
        expect(counts.limitations).toBe(1);
        expect(counts.contradictions).toBe(1);
        expect(counts.unknowns).toBe(1);
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it.each(['candidate-id', 'artifact-set-id'] as const)(
      'rejects normalized execution %s drift on every read path',
      async (field) => {
        const fixture = createRepositoryInterviewPersistenceFixture();
        const runtime = await seededRuntime(fixture);
        try {
          await publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: fixture.execution,
            interview: fixture.interview,
          });
          await ownerSql.begin(async (transaction) => {
            await transaction`set local session_replication_role = replica`;
            if (field === 'candidate-id') {
              await transaction`
                update gitblocks.model_executions
                set candidate_id = 'candidate-corrupt'
                where execution_id = ${fixture.execution.executionId}
              `;
            } else {
              await transaction`
                update gitblocks.model_executions
                set artifact_set_id = 'artifact-set-corrupt'
                where execution_id = ${fixture.execution.executionId}
              `;
            }
          });
          await expectReplicationRoleOrigin();
          await expectEverySuccessfulReadPathCorrupt(runtime, fixture);
        } finally {
          await closePersistenceClient(runtime);
        }
      },
    );

    it('rejects normalized semantic-member ownership drift on every read path', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      try {
        await publishRepositoryInterviewExchange(runtime, {
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        await ownerSql.begin(async (transaction) => {
          await transaction`set local session_replication_role = replica`;
          await transaction`
            update gitblocks.repository_interview_claims
            set candidate_id = 'candidate-corrupt'
            where interview_id = ${fixture.interview.interviewId}
              and ordinal = 0
          `;
        });
        await expectReplicationRoleOrigin();
        await expectEverySuccessfulReadPathCorrupt(runtime, fixture);
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it.each(['candidate-id', 'artifact-set-id'] as const)(
      'rejects normalized citation %s drift on every read path',
      async (field) => {
        const fixture = createRepositoryInterviewPersistenceFixture();
        const runtime = await seededRuntime(fixture);
        try {
          await publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: fixture.execution,
            interview: fixture.interview,
          });
          await ownerSql.begin(async (transaction) => {
            await transaction`set local session_replication_role = replica`;
            if (field === 'candidate-id') {
              await transaction`
                update gitblocks.repository_interview_citations
                set candidate_id = 'candidate-corrupt'
                where interview_id = ${fixture.interview.interviewId}
                  and ordinal = 0
              `;
            } else {
              await transaction`
                update gitblocks.repository_interview_citations
                set artifact_set_id = 'artifact-set-corrupt'
                where interview_id = ${fixture.interview.interviewId}
                  and ordinal = 0
              `;
            }
          });
          await expectReplicationRoleOrigin();
          await expectEverySuccessfulReadPathCorrupt(runtime, fixture);
        } finally {
          await closePersistenceClient(runtime);
        }
      },
    );

    it.each<RepositoryInterviewFailureCode>([
      'refused',
      'provider-output-invalid',
      'invalid-usage',
      'rate-limited',
      'transport-error',
    ])(
      'stores %s as request plus failed execution without semantic rows',
      async (failureCode) => {
        const fixture = createRepositoryInterviewPersistenceFixture();
        const failed = createFailedRepositoryInterviewExecution(
          fixture.request,
          failureCode,
        );
        const runtime = await seededRuntime(fixture);
        try {
          const first = await publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: failed,
            interview: null,
          });
          expect(first.status).toBe('created');
          expect(first.record.interview).toBeNull();
          expect(first.inserted).toEqual({
            requests: 1,
            executions: 1,
            interviews: 0,
            citations: 0,
            claims: 0,
            limitations: 0,
            contradictions: 0,
            unknowns: 0,
          });
          await expect(
            loadRepositoryInterviewExchange(runtime, {
              by: 'execution-id',
              executionId: failed.executionId,
            }),
          ).resolves.toEqual(first.record);
          await expect(
            publishRepositoryInterviewExchange(runtime, {
              request: fixture.request,
              execution: failed,
              interview: null,
            }),
          ).resolves.toMatchObject({ status: 'idempotent' });
          await expect(
            findReusableRepositoryInterview(runtime, {
              requestIdentityDigest: fixture.request.identityDigest,
              modelProfileDigest: failed.modelProfileDigest,
              reuseKeyDigest: failed.reuseKeyDigest,
            }),
          ).resolves.toBeNull();
        } finally {
          await closePersistenceClient(runtime);
        }
      },
    );

    it('appends request-shared normal and forced history without replacing normal reuse', async () => {
      const normal = createRepositoryInterviewPersistenceFixture();
      const later = createRepositoryInterviewPersistenceFixture({
        executionNonce: 'b'.repeat(32),
        startedAt: '2026-07-31T12:01:00.000Z',
        completedAt: '2026-07-31T12:01:01.000Z',
        publishedAt: '2026-07-31T12:01:01.000Z',
      });
      const forced = createRepositoryInterviewPersistenceFixture({
        executionNonce: 'c'.repeat(32),
        executionMode: 'forced',
        forceReason: 'operator-recovery',
        startedAt: '2026-07-31T12:02:00.000Z',
        completedAt: '2026-07-31T12:02:01.000Z',
        publishedAt: '2026-07-31T12:02:01.000Z',
      });
      const runtime = await seededRuntime(normal);
      try {
        await publishRepositoryInterviewExchange(runtime, {
          request: later.request,
          execution: later.execution,
          interview: later.interview,
        });
        await publishRepositoryInterviewExchange(runtime, {
          request: normal.request,
          execution: normal.execution,
          interview: normal.interview,
        });
        await publishRepositoryInterviewExchange(runtime, {
          request: forced.request,
          execution: forced.execution,
          interview: forced.interview,
        });
        expect(normal.execution.reuseKeyDigest).toBe(
          forced.execution.reuseKeyDigest,
        );
        const reused = await findReusableRepositoryInterview(runtime, {
          requestIdentityDigest: normal.request.identityDigest,
          modelProfileDigest: normal.execution.modelProfileDigest,
          reuseKeyDigest: normal.execution.reuseKeyDigest,
        });
        expect(reused?.execution.executionId).toBe(
          normal.execution.executionId,
        );
        const executionCount = await ownerSql<
          readonly { readonly count: number }[]
        >`
          select pg_catalog.count(*)::integer as count
          from gitblocks.model_executions
        `;
        expect(executionCount[0]?.count).toBe(3);
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('rejects artifact-set and citation closure violations atomically', async () => {
      const missingSet = createRepositoryInterviewPersistenceFixture();
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      try {
        await seedCandidate(runtime);
        await expect(
          publishRepositoryInterviewExchange(runtime, {
            request: missingSet.request,
            execution: missingSet.execution,
            interview: missingSet.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });
        expect(await rootExchangeCount()).toBe(0);
      } finally {
        await closePersistenceClient(runtime);
      }

      const outside = createRepositoryInterviewPersistenceFixture({
        citationArtifactId: `artifact-${'e'.repeat(48)}`,
      });
      const outsideRuntime = await seededRuntime(outside);
      try {
        await expect(
          publishRepositoryInterviewExchange(outsideRuntime, {
            request: outside.request,
            execution: outside.execution,
            interview: outside.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });
        expect(await rootExchangeCount()).toBe(0);
      } finally {
        await closePersistenceClient(outsideRuntime);
      }

      const pastEnd = createRepositoryInterviewPersistenceFixture({
        citationStartLine: 5,
        citationEndLine: 5,
      });
      const rangeRuntime = await seededRuntime(pastEnd);
      try {
        await expect(
          publishRepositoryInterviewExchange(rangeRuntime, {
            request: pastEnd.request,
            execution: pastEnd.execution,
            interview: pastEnd.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });
        expect(await rootExchangeCount()).toBe(0);
      } finally {
        await closePersistenceClient(rangeRuntime);
      }

      const wrongCandidate = createRepositoryInterviewPersistenceFixture({
        requestCandidateId: 'candidate-beta',
      });
      const candidateRuntime = createPersistenceClient(RUNTIME_CONFIG);
      try {
        await seedCandidate(candidateRuntime);
        await publishRepositoryArtifactSet(
          candidateRuntime,
          wrongCandidate.publication,
        );
        await expect(
          publishRepositoryInterviewExchange(candidateRuntime, {
            request: wrongCandidate.request,
            execution: wrongCandidate.execution,
            interview: wrongCandidate.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });
        expect(await rootExchangeCount()).toBe(0);
      } finally {
        await closePersistenceClient(candidateRuntime);
      }

      const wrongDigest = createRepositoryInterviewPersistenceFixture({
        artifactSetIdentityDigest: 'f'.repeat(64),
      });
      const digestRuntime = await seededRuntime(wrongDigest);
      try {
        await expect(
          publishRepositoryInterviewExchange(digestRuntime, {
            request: wrongDigest.request,
            execution: wrongDigest.execution,
            interview: wrongDigest.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });
        expect(await rootExchangeCount()).toBe(0);
      } finally {
        await closePersistenceClient(digestRuntime);
      }
    });

    it('fails closed for malformed ownership and success/failure publication shape', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      const anotherExecution = createModelExecutionV1({
        contractVersion: fixture.execution.contractVersion,
        requestId: fixture.execution.requestId,
        requestIdentityDigest: fixture.execution.requestIdentityDigest,
        executionNonce: 'd'.repeat(32),
        executionMode: 'normal',
        forceReason: null,
        modelProfile: fixture.execution.modelProfile,
        startedAt: fixture.execution.startedAt,
        completedAt: fixture.execution.completedAt,
        attempts: fixture.execution.attempts,
        outcome: fixture.execution.outcome,
      });
      try {
        await expect(
          publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: fixture.execution,
            interview: null,
          }),
        ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
        await expect(
          publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: anotherExecution,
            interview: fixture.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
        const failed = createFailedRepositoryInterviewExecution(
          fixture.request,
          'refused',
        );
        await expect(
          publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: failed,
            interview: fixture.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.invalid-input' });
        expect(await rootExchangeCount()).toBe(0);
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('serializes concurrent exact publication into created plus idempotent', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      try {
        const results = await Promise.all([
          publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: fixture.execution,
            interview: fixture.interview,
          }),
          publishRepositoryInterviewExchange(runtime, {
            request: fixture.request,
            execution: fixture.execution,
            interview: fixture.interview,
          }),
        ]);
        expect(results.map((result) => result.status).sort()).toEqual([
          'created',
          'idempotent',
        ]);
        expect(await rootExchangeCount()).toBe(3);
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('rejects same-identity record changes and concurrent conflicting publication', async () => {
      const first = createRepositoryInterviewPersistenceFixture();
      const changed = createRepositoryInterviewPersistenceFixture({
        publishedAt: '2026-07-31T12:00:02.000Z',
      });
      expect(changed.interview.interviewId).toBe(first.interview.interviewId);
      expect(changed.interview.recordDigest).not.toBe(
        first.interview.recordDigest,
      );
      const runtime = await seededRuntime(first);
      try {
        await publishRepositoryInterviewExchange(runtime, {
          request: first.request,
          execution: first.execution,
          interview: first.interview,
        });
        await expect(
          publishRepositoryInterviewExchange(runtime, {
            request: changed.request,
            execution: changed.execution,
            interview: changed.interview,
          }),
        ).rejects.toMatchObject({ code: 'persistence.conflict' });
      } finally {
        await closePersistenceClient(runtime);
      }

      await resetDatabase();
      const concurrentRuntime = await seededRuntime(first);
      try {
        const outcomes = await Promise.allSettled([
          publishRepositoryInterviewExchange(concurrentRuntime, {
            request: first.request,
            execution: first.execution,
            interview: first.interview,
          }),
          publishRepositoryInterviewExchange(concurrentRuntime, {
            request: changed.request,
            execution: changed.execution,
            interview: changed.interview,
          }),
        ]);
        expect(
          outcomes.filter((outcome) => outcome.status === 'fulfilled'),
        ).toHaveLength(1);
        const rejected = outcomes.find(
          (outcome) => outcome.status === 'rejected',
        );
        expect(rejected).toMatchObject({
          status: 'rejected',
          reason: { code: 'persistence.conflict' },
        });
        expect(await rootExchangeCount()).toBe(3);
      } finally {
        await closePersistenceClient(concurrentRuntime);
      }
    });

    it('rejects deferred missing and extra member closure', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      try {
        await publishRepositoryInterviewExchange(runtime, {
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        await expect(
          ownerSql.begin(async (transaction) => {
            await transaction`
              alter table gitblocks.repository_interview_claims
              disable trigger repository_interview_claims_immutable
            `;
            await transaction`
              delete from gitblocks.repository_interview_claims
              where interview_id = ${fixture.interview.interviewId}
                and ordinal = 0
            `;
            await transaction`set constraints all immediate`;
          }),
        ).rejects.toMatchObject({ code: 'P0001' });

        const source = fixture.interview.claims[0];
        if (source === undefined) {
          throw new Error('Synthetic fixture requires one claim.');
        }
        const extra = {
          ...source,
          claimId: `intclaim-${'f'.repeat(48)}`,
          identityDigest: 'f'.repeat(64),
          recordDigest: 'e'.repeat(64),
        };
        await expect(
          ownerSql.begin(async (transaction) => {
            await transaction`
              insert into gitblocks.repository_interview_claims (
                claim_id,
                interview_id,
                candidate_id,
                ordinal,
                claim_kind,
                topic,
                confidence,
                identity_digest,
                record_digest,
                canonical_payload
              )
              values (
                ${extra.claimId},
                ${fixture.interview.interviewId},
                ${fixture.interview.candidateId},
                ${fixture.interview.claims.length},
                ${extra.kind},
                ${extra.topic},
                ${extra.confidence},
                ${extra.identityDigest},
                ${extra.recordDigest},
                ${transaction.json(extra)}
              )
            `;
            await transaction`set constraints all immediate`;
          }),
        ).rejects.toMatchObject({ code: 'P0001' });
        expect((await exchangeCounts()).claims).toBe(
          fixture.interview.claims.length,
        );
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('fails closed when eligible stored history is incomplete or corrupt', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      try {
        await publishRepositoryInterviewExchange(runtime, {
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        await ownerSql`set session_replication_role = replica`;
        try {
          await ownerSql`
            delete from gitblocks.repository_interview_claims
            where interview_id = ${fixture.interview.interviewId}
              and ordinal = 0
          `;
        } finally {
          await ownerSql`set session_replication_role = origin`;
        }
        await expect(
          findReusableRepositoryInterview(runtime, {
            requestIdentityDigest: fixture.request.identityDigest,
            modelProfileDigest: fixture.execution.modelProfileDigest,
            reuseKeyDigest: fixture.execution.reuseKeyDigest,
          }),
        ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('fails closed for a successful execution whose interview is missing', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      try {
        await publishRepositoryInterviewExchange(runtime, {
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        await ownerSql`set session_replication_role = replica`;
        try {
          await ownerSql`
            delete from gitblocks.repository_interviews
            where interview_id = ${fixture.interview.interviewId}
          `;
        } finally {
          await ownerSql`set session_replication_role = origin`;
        }
        await expect(
          findReusableRepositoryInterview(runtime, {
            requestIdentityDigest: fixture.request.identityDigest,
            modelProfileDigest: fixture.execution.modelProfileDigest,
            reuseKeyDigest: fixture.execution.reuseKeyDigest,
          }),
        ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('returns not-found for unknown historical IDs', async () => {
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      try {
        await expect(
          loadRepositoryInterviewExchange(runtime, {
            by: 'execution-id',
            executionId: `modelexec-${'f'.repeat(48)}`,
          }),
        ).rejects.toMatchObject({ code: 'persistence.not-found' });
        await expect(
          loadRepositoryInterviewExchange(runtime, {
            by: 'interview-id',
            interviewId: `interview-${'f'.repeat(48)}`,
          }),
        ).rejects.toMatchObject({ code: 'persistence.not-found' });
      } finally {
        await closePersistenceClient(runtime);
      }
    });

    it('enforces owner and runtime immutability plus least-privilege grants', async () => {
      const fixture = createRepositoryInterviewPersistenceFixture();
      const runtime = await seededRuntime(fixture);
      const runtimeSql = directSql(RUNTIME_CONFIG);
      try {
        await publishRepositoryInterviewExchange(runtime, {
          request: fixture.request,
          execution: fixture.execution,
          interview: fixture.interview,
        });
        for (const sql of [ownerSql, runtimeSql]) {
          await expect(
            sql`
              update gitblocks.repository_interview_requests
              set prompt_digest = ${'f'.repeat(64)}
              where request_id = ${fixture.request.requestId}
            `,
          ).rejects.toBeDefined();
          await expect(
            sql`
              delete from gitblocks.repository_interview_claims
              where interview_id = ${fixture.interview.interviewId}
            `,
          ).rejects.toBeDefined();
          await expect(
            sql.unsafe(
              'truncate table gitblocks.repository_interview_unknowns',
            ),
          ).rejects.toBeDefined();
        }
        const privileges = await ownerSql<
          readonly {
            readonly update_allowed: boolean;
            readonly delete_allowed: boolean;
            readonly truncate_allowed: boolean;
          }[]
        >`
          select
            pg_catalog.has_table_privilege(
              'gitblocks_persistence',
              'gitblocks.repository_interviews',
              'UPDATE'
            ) as update_allowed,
            pg_catalog.has_table_privilege(
              'gitblocks_persistence',
              'gitblocks.repository_interviews',
              'DELETE'
            ) as delete_allowed,
            pg_catalog.has_table_privilege(
              'gitblocks_persistence',
              'gitblocks.repository_interviews',
              'TRUNCATE'
            ) as truncate_allowed
        `;
        expect(privileges).toEqual([
          {
            update_allowed: false,
            delete_allowed: false,
            truncate_allowed: false,
          },
        ]);
        const authority = await ownerSql<
          readonly {
            readonly can_select: boolean;
            readonly can_insert: boolean;
            readonly can_execute_closure: boolean;
            readonly public_select: boolean;
          }[]
        >`
          select
            pg_catalog.has_table_privilege(
              'gitblocks_persistence',
              'gitblocks.repository_interviews',
              'SELECT'
            ) as can_select,
            pg_catalog.has_table_privilege(
              'gitblocks_persistence',
              'gitblocks.repository_interviews',
              'INSERT'
            ) as can_insert,
            pg_catalog.has_function_privilege(
              'gitblocks_persistence',
              'gitblocks.assert_repository_interview_closure(text)',
              'EXECUTE'
            ) as can_execute_closure,
            pg_catalog.has_table_privilege(
              'public',
              'gitblocks.repository_interviews',
              'SELECT'
            ) as public_select
        `;
        expect(authority).toEqual([
          {
            can_select: true,
            can_insert: true,
            can_execute_closure: false,
            public_select: false,
          },
        ]);
      } finally {
        await runtimeSql.end({ timeout: 5 });
        await closePersistenceClient(runtime);
      }
    });

    it('stores no prompt, artifact body, raw provider, credential, or review columns', async () => {
      const columns = await ownerSql<
        readonly { readonly column_name: string }[]
      >`
        select column_name
        from information_schema.columns
        where table_schema = 'gitblocks'
          and table_name in (
            'repository_interview_requests',
            'model_executions',
            'repository_interviews',
            'repository_interview_citations',
            'repository_interview_claims',
            'repository_interview_limitations',
            'repository_interview_contradictions',
            'repository_interview_unknowns'
          )
        order by column_name
      `;
      const serialized = columns.map((column) => column.column_name).join(' ');
      expect(serialized).not.toMatch(
        /instruction_text|evidence_text|prompt_body|artifact_content|raw_provider_output|provider_response_body|raw_error|reasoning_text|credential|review|selected|current/iu,
      );
    });
  },
);

async function resetDatabase(): Promise<void> {
  await ownerSql.unsafe('drop schema if exists gitblocks cascade');
  const owner = createPersistenceClient(OWNER_CONFIG);
  try {
    await applyMigrations(owner);
  } finally {
    await closePersistenceClient(owner);
  }
}

async function seededRuntime(
  fixture: ReturnType<typeof createRepositoryInterviewPersistenceFixture>,
): Promise<PersistenceClient> {
  const runtime = createPersistenceClient(RUNTIME_CONFIG);
  await seedCandidate(runtime);
  await publishRepositoryArtifactSet(runtime, fixture.publication);
  return runtime;
}

async function seedCandidate(client: PersistenceClient): Promise<void> {
  const dossier = createCandidateDossier('candidate-alpha');
  await putCatalogCandidate(client, {
    identity: dossier.identity,
    createdAt: '2026-07-31T11:00:00.000Z',
  });
}

async function exchangeCounts(): Promise<{
  readonly citations: number;
  readonly claims: number;
  readonly limitations: number;
  readonly contradictions: number;
  readonly unknowns: number;
}> {
  const rows = await ownerSql<
    readonly {
      readonly citations: number;
      readonly claims: number;
      readonly limitations: number;
      readonly contradictions: number;
      readonly unknowns: number;
    }[]
  >`
    select
      (
        select pg_catalog.count(*)::integer
        from gitblocks.repository_interview_citations
      ) as citations,
      (
        select pg_catalog.count(*)::integer
        from gitblocks.repository_interview_claims
      ) as claims,
      (
        select pg_catalog.count(*)::integer
        from gitblocks.repository_interview_limitations
      ) as limitations,
      (
        select pg_catalog.count(*)::integer
        from gitblocks.repository_interview_contradictions
      ) as contradictions,
      (
        select pg_catalog.count(*)::integer
        from gitblocks.repository_interview_unknowns
      ) as unknowns
  `;
  const row = rows[0];
  if (row === undefined) {
    throw new Error('Expected one count row.');
  }
  return row;
}

async function rootExchangeCount(): Promise<number> {
  const rows = await ownerSql<readonly { readonly count: number }[]>`
    select (
      (select pg_catalog.count(*) from gitblocks.repository_interview_requests)
      + (select pg_catalog.count(*) from gitblocks.model_executions)
      + (select pg_catalog.count(*) from gitblocks.repository_interviews)
    )::integer as count
  `;
  return rows[0]?.count ?? -1;
}

async function expectEverySuccessfulReadPathCorrupt(
  runtime: PersistenceClient,
  fixture: ReturnType<typeof createRepositoryInterviewPersistenceFixture>,
): Promise<void> {
  const operations = [
    () =>
      loadRepositoryInterviewExchange(runtime, {
        by: 'execution-id' as const,
        executionId: fixture.execution.executionId,
      }),
    () =>
      loadRepositoryInterviewExchange(runtime, {
        by: 'interview-id' as const,
        interviewId: fixture.interview.interviewId,
      }),
    () =>
      findReusableRepositoryInterview(runtime, {
        requestIdentityDigest: fixture.request.identityDigest,
        modelProfileDigest: fixture.execution.modelProfileDigest,
        reuseKeyDigest: fixture.execution.reuseKeyDigest,
      }),
  ];
  for (const operation of operations) {
    let rejected: unknown;
    try {
      await operation();
    } catch (error) {
      rejected = error;
    }
    expect(rejected).toMatchObject({
      code: 'persistence.corrupt-record',
      message: 'Persisted state failed validation.',
    });
    const serialized = JSON.stringify(rejected);
    expect(serialized).not.toContain('candidate-corrupt');
    expect(serialized).not.toContain('artifact-set-corrupt');
    expect(serialized).not.toContain(fixture.interview.interviewId);
  }
}

async function expectReplicationRoleOrigin(): Promise<void> {
  const rows = await ownerSql<
    readonly { readonly session_replication_role: string }[]
  >`show session_replication_role`;
  expect(rows).toEqual([{ session_replication_role: 'origin' }]);
}

function requireInterview<Value>(value: Value | null): Value {
  if (value === null) {
    throw new Error('Expected a synthetic interview.');
  }
  return value;
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
