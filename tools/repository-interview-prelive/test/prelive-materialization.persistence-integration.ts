import { createArtifactReceipt } from '@gitblocks/ingestion';
import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  loadRepositoryArtifactSet,
  publishRepositoryArtifactSet,
  putCatalogCandidate,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { serializeCanonicalJson } from '@gitblocks/interviews';
import { describe, expect, it } from 'vitest';

import {
  buildRepositoryInterviewPreliveExpectedV1,
  materializeRepositoryInterviewOperatorSelectionV1,
} from '../src/index.ts';
import {
  syntheticArtifactAuthorityV1,
  syntheticArtifactSetV1,
} from './prelive-fixtures.ts';

const OWNER_CONFIG = readOwnerConfig();
const RUNTIME_CONFIG: PersistenceClientConfig = {
  ...OWNER_CONFIG,
  username: 'gitblocks_persistence_test',
  password: 'persistence-test-only',
  maximumConnections: 2,
};

describe('pre-live PostgreSQL materialization', { concurrent: false }, () => {
  it(
    'materializes exact receipt-named 6/30/150 selections and ignores a newer same-candidate set',
    { timeout: 120_000 },
    async () => {
      const fixture = await syntheticArtifactAuthorityV1();
      const expected = await buildRepositoryInterviewPreliveExpectedV1(
        process.cwd(),
      );
      const owner = createPersistenceClient(OWNER_CONFIG);
      const runtime = createPersistenceClient(RUNTIME_CONFIG);
      try {
        await applyMigrations(owner);
        for (const [index, candidate] of fixture.catalog.candidates.entries()) {
          await putCatalogCandidate(owner, {
            identity: {
              candidateId: candidate.candidateId,
              displayName: `Synthetic pre-live candidate ${String(index + 1)}`,
              repository: {
                host: 'github',
                owner: 'prelive-synthetic',
                name: `candidate-${String(index + 1)}`,
              },
              package: null,
            },
            createdAt: candidate.introducedAt,
          });
        }
        for (const set of fixture.sets.values()) {
          await publishRepositoryArtifactSet(owner, {
            artifactSet: set,
            artifacts: [],
          });
        }
        const firstCandidate = expected.plans.calibration.candidateIds[0];
        if (firstCandidate === undefined) {
          throw new Error('Synthetic calibration plan is empty.');
        }
        const newer = syntheticArtifactSetV1(firstCandidate, 999);
        await publishRepositoryArtifactSet(owner, {
          artifactSet: newer,
          artifacts: [],
        });

        for (const [name, plan, count] of [
          ['six', expected.plans.calibration, 6],
          ['thirty', expected.plans.gateA, 30],
          ['one-hundred-fifty', expected.plans.gateB, 150],
        ] as const) {
          const lookups: string[] = [];
          const materialized =
            await materializeRepositoryInterviewOperatorSelectionV1(
              {
                candidatePlan: plan,
                artifactReceipt: fixture.receipt,
                fullCatalogCandidateIds: fixture.candidateIds,
                selectionId: `postgresql-${name}-selection`,
              },
              {
                async loadRepositoryArtifactSet(artifactSetId) {
                  lookups.push(artifactSetId);
                  return loadRepositoryArtifactSet(runtime, { artifactSetId });
                },
              },
            );
          expect(materialized.selection.members).toHaveLength(count);
          expect(lookups).toEqual(
            materialized.selection.members.map(
              ({ artifactSetId }) => artifactSetId,
            ),
          );
          expect(
            materialized.selection.members.find(
              ({ candidateId }) => candidateId === firstCandidate,
            )?.artifactSetId,
          ).not.toBe(newer.artifactSetId);
          const repeated =
            await materializeRepositoryInterviewOperatorSelectionV1(
              {
                candidatePlan: plan,
                artifactReceipt: fixture.receipt,
                fullCatalogCandidateIds: fixture.candidateIds,
                selectionId: `postgresql-${name}-selection`,
              },
              {
                loadRepositoryArtifactSet: (artifactSetId) =>
                  loadRepositoryArtifactSet(runtime, { artifactSetId }),
              },
            );
          expect(serializeCanonicalJson(repeated)).toBe(
            serializeCanonicalJson(materialized),
          );
        }

        const missingId = `artifact-set-${'f'.repeat(48)}`;
        const candidates = fixture.receipt.candidates.map((candidate, index) =>
          index === 0 ? { ...candidate, artifactSetId: missingId } : candidate,
        );
        const missingReceipt = createArtifactReceipt({
          catalog: fixture.catalog,
          manifest: fixture.artifactManifest,
          runId: 'synthetic-missing-set-run',
          startedAt: '2026-08-01T18:02:00.000Z',
          completedAt: '2026-08-01T18:03:00.000Z',
          candidates,
          providerMetrics: {
            providerRequestCounts: { github: 0, npm: 0 },
            githubRateLimit: null,
          },
          databaseMigrationVersion: 4,
          operationalDecodedBytes: 0,
        });
        await expect(
          materializeRepositoryInterviewOperatorSelectionV1(
            {
              candidatePlan: expected.plans.gateB,
              artifactReceipt: missingReceipt,
              fullCatalogCandidateIds: fixture.candidateIds,
              selectionId: 'postgresql-missing-selection',
            },
            {
              loadRepositoryArtifactSet: (artifactSetId) =>
                loadRepositoryArtifactSet(runtime, { artifactSetId }),
            },
          ),
        ).rejects.toThrow('materialization is invalid');
      } finally {
        await Promise.all([
          closePersistenceClient(owner),
          closePersistenceClient(runtime),
        ]);
      }
    },
  );
});

function readOwnerConfig(): PersistenceClientConfig {
  if (process.env['GITBLOCKS_DB_TEST_ACK'] !== 'ephemeral') {
    throw new Error('PostgreSQL integration database must be ephemeral.');
  }
  return {
    host: required('GITBLOCKS_TEST_DB_HOST'),
    port: Number(required('GITBLOCKS_TEST_DB_PORT')),
    database: required('GITBLOCKS_TEST_DB_DATABASE'),
    username: required('GITBLOCKS_TEST_DB_OWNER'),
    password: required('GITBLOCKS_TEST_DB_PASSWORD'),
    ssl: false,
    maximumConnections: 2,
    statementTimeoutMilliseconds: 10_000,
    lockTimeoutMilliseconds: 5_000,
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.length === 0) {
    throw new Error('PostgreSQL integration configuration is required.');
  }
  return value;
}
