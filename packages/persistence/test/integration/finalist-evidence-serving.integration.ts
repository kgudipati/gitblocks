import postgres, { type Sql } from 'postgres';
import type { CandidateDossierV1 } from '@gitblocks/contracts';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  appendCandidateLimitation,
  appendCandidateUnknown,
  appendEvidenceObservation,
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  loadCandidateRepositoryArtifactMaterial,
  loadActiveCandidateDossier,
  putCatalogCandidate,
  publishRepositoryArtifactSet,
  recordEvidenceInvalidation,
  recordEvidenceSupersession,
  setCandidateCapabilityFamilies,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '../../src/index.ts';
import {
  createArtifactPublication,
  createCandidateDossier,
} from '../fixtures.ts';

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
const CREATED_AT = '2026-07-28T22:00:00Z';

const SERVING_SELECT_TABLES = [
  'candidate_capability_families',
  'candidate_limitations',
  'candidate_material_unknowns',
  'catalog_candidates',
  'evidence_invalidations',
  'evidence_observations',
  'evidence_supersessions',
  'repository_artifact_chunks',
  'repository_artifact_set_entries',
  'repository_artifact_sets',
  'repository_artifacts',
  'serving_candidate_profile_records',
  'serving_candidate_retrieval_metadata_records',
  'serving_catalog_current_snapshot',
  'serving_catalog_snapshots',
] as const;

let ownerSql: Sql;

describe('PostgreSQL finalist evidence serving', { concurrent: false }, () => {
  beforeAll(() => {
    ownerSql = directSql(OWNER_CONFIG);
  });

  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await ownerSql.end({ timeout: 5 });
  });

  it('grants serving SELECT only on snapshot, finalist evidence, and immutable artifact material tables', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const serving = createPersistenceClient(SERVING_CONFIG);
    const servingSql = directSql(SERVING_CONFIG);
    const dossier = createDossierWithUnknown();
    const publication = createArtifactPublication();
    try {
      await seedDossier(writer, dossier);
      await publishRepositoryArtifactSet(writer, publication);
      await expect(
        loadActiveCandidateDossier(serving, {
          candidateId: dossier.identity.candidateId,
          expectedCapabilityFamily: 'authorization',
          evidenceCutoff: CREATED_AT,
        }),
      ).resolves.toEqual({
        ...dossier,
        versionScope: null,
      });
      await expect(
        loadCandidateRepositoryArtifactMaterial(serving, {
          candidateId: dossier.identity.candidateId,
          expectedCatalogVersion: 'public-v1',
          expectedCatalogDigest: publication.artifactSet.catalogDigest,
          commitSha: publication.artifactSet.commitObjectId,
          evidenceCutoff: publication.artifactSet.publishedAt,
        }),
      ).resolves.toEqual(publication);

      const grants = await ownerSql<
        readonly {
          readonly table_name: string;
          readonly privilege_type: string;
        }[]
      >`
        select table_name, privilege_type
        from information_schema.role_table_grants
        where grantee = 'gitblocks_serving'
          and table_schema = 'gitblocks'
        order by table_name, privilege_type
      `;
      expect(grants).toEqual(
        SERVING_SELECT_TABLES.map((tableName) => ({
          table_name: tableName,
          privilege_type: 'SELECT',
        })),
      );

      await expect(
        servingSql`
          update gitblocks.catalog_candidates
          set display_name = 'forbidden'
          where candidate_id = ${dossier.identity.candidateId}
        `,
      ).rejects.toMatchObject({ code: '42501' });
      const membership = await ownerSql<
        readonly { readonly is_member: boolean }[]
      >`
        select pg_catalog.pg_has_role(
          'gitblocks_serving',
          'gitblocks_persistence',
          'member'
        ) as is_member
      `;
      expect(membership).toEqual([{ is_member: false }]);

      for (const tableName of [
        'repository_artifacts',
        'repository_artifact_chunks',
        'repository_artifact_sets',
        'repository_artifact_set_entries',
      ]) {
        await expect(
          servingSql.unsafe(
            `insert into gitblocks.${tableName} default values`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          servingSql.unsafe(
            `update gitblocks.${tableName} set candidate_id = candidate_id where false`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          servingSql.unsafe(`delete from gitblocks.${tableName} where false`),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          servingSql.unsafe(`truncate table gitblocks.${tableName}`),
        ).rejects.toMatchObject({ code: '42501' });
        await expect(
          servingSql.unsafe(
            `alter table gitblocks.${tableName} add column r9_forbidden integer`,
          ),
        ).rejects.toMatchObject({ code: '42501' });
      }
      await expect(
        servingSql`select interview_id from gitblocks.repository_interviews`,
      ).rejects.toMatchObject({ code: '42501' });
      await expect(
        servingSql`
          select snapshot_id
          from gitblocks.candidate_dossier_snapshots
        `,
      ).rejects.toMatchObject({ code: '42501' });
    } finally {
      await Promise.all([
        closePersistenceClient(writer),
        closePersistenceClient(serving),
        servingSql.end({ timeout: 5 }),
      ]);
    }
  });

  it('applies one cutoff to evidence lifecycle and preserves active limitations and unknowns', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const serving = createPersistenceClient(SERVING_CONFIG);
    const dossier = createDossierWithUnknown();
    const original = requireObservation(dossier);
    const correction = {
      ...structuredClone(original),
      evidenceId: 'evidence-correction',
      observation: 'Corrected immutable public evidence.',
    };
    try {
      await seedDossier(writer, dossier);
      await appendEvidenceObservation(writer, {
        observation: correction,
        createdAt: '2026-07-28T22:01:00Z',
      });
      await recordEvidenceSupersession(writer, {
        candidateId: dossier.identity.candidateId,
        supersessionId: 'supersession-correction',
        supersededEvidenceId: original.evidenceId,
        supersedingEvidenceId: correction.evidenceId,
        reasonCode: 'corrected-observation',
        createdAt: '2026-07-28T22:10:00Z',
        effectiveAt: '2026-07-28T22:10:00Z',
      });

      const before = await loadActiveCandidateDossier(serving, {
        candidateId: dossier.identity.candidateId,
        expectedCapabilityFamily: 'authorization',
        evidenceCutoff: '2026-07-28T22:09:00Z',
      });
      expect(before.observations.map(({ evidenceId }) => evidenceId)).toEqual([
        'evidence-alpha',
        'evidence-correction',
      ]);
      expect(before.limitations).toHaveLength(1);
      expect(before.unknowns).toHaveLength(1);

      const afterSupersession = await loadActiveCandidateDossier(serving, {
        candidateId: dossier.identity.candidateId,
        expectedCapabilityFamily: 'authorization',
        evidenceCutoff: '2026-07-28T22:10:00Z',
      });
      expect(afterSupersession.observations).toEqual([correction]);
      expect(afterSupersession.limitations).toEqual([]);
      expect(afterSupersession.unknowns).toEqual([]);

      await recordEvidenceInvalidation(writer, {
        candidateId: dossier.identity.candidateId,
        invalidationId: 'invalidation-correction',
        evidenceId: correction.evidenceId,
        reasonCode: 'withdrawn-source',
        createdAt: '2026-07-28T22:20:00Z',
        effectiveAt: '2026-07-28T22:20:00Z',
      });
      await expect(
        loadActiveCandidateDossier(serving, {
          candidateId: dossier.identity.candidateId,
          expectedCapabilityFamily: 'authorization',
          evidenceCutoff: '2026-07-28T22:20:00Z',
        }),
      ).resolves.toMatchObject({
        observations: [],
        limitations: [],
        unknowns: [],
      });
    } finally {
      await Promise.all([
        closePersistenceClient(writer),
        closePersistenceClient(serving),
      ]);
    }
  });

  it('loads only relevant, artifact-binding, and limitation-or-unknown-cited observations when dimensions are bounded', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const serving = createPersistenceClient(SERVING_CONFIG);
    const dossier = createDossierWithUnknown();
    const cited = requireObservation(dossier);
    dossier.observations.push(
      {
        ...structuredClone(cited),
        evidenceId: 'evidence-repository-head',
        topic: 'repository-head',
        dimension: 'maintenance',
      },
      {
        ...structuredClone(cited),
        evidenceId: 'evidence-uncited-release',
        topic: 'release-current',
        dimension: 'version-release',
      },
    );
    try {
      await seedDossier(writer, dossier);

      const selected = await loadActiveCandidateDossier(serving, {
        candidateId: dossier.identity.candidateId,
        expectedCapabilityFamily: 'authorization',
        evidenceCutoff: CREATED_AT,
        relevantEvidenceDimensions: ['integration'],
      });

      expect(selected.observations.map(({ evidenceId }) => evidenceId)).toEqual(
        ['evidence-alpha', 'evidence-repository-head'],
      );
      expect(selected.limitations).toEqual(dossier.limitations);
      expect(selected.unknowns).toEqual(dossier.unknowns);
    } finally {
      await Promise.all([
        closePersistenceClient(writer),
        closePersistenceClient(serving),
      ]);
    }
  });

  it('requires capability membership, represents empty evidence honestly, and fails closed on corrupt records', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const serving = createPersistenceClient(SERVING_CONFIG);
    const dossier = createCandidateDossier('candidate-alpha');
    try {
      await putCatalogCandidate(writer, {
        identity: dossier.identity,
        createdAt: CREATED_AT,
      });
      await setCandidateCapabilityFamilies(writer, {
        candidateId: dossier.identity.candidateId,
        capabilityFamilies: ['authorization'],
      });
      await expect(
        loadActiveCandidateDossier(serving, {
          candidateId: dossier.identity.candidateId,
          expectedCapabilityFamily: 'authorization',
          evidenceCutoff: CREATED_AT,
        }),
      ).resolves.toEqual({
        contractVersion: '1.0.0',
        identity: dossier.identity,
        capabilityFamily: 'authorization',
        versionScope: null,
        observations: [],
        limitations: [],
        unknowns: [],
      });
      await expect(
        loadActiveCandidateDossier(serving, {
          candidateId: dossier.identity.candidateId,
          expectedCapabilityFamily: 'webhooks',
          evidenceCutoff: CREATED_AT,
        }),
      ).rejects.toMatchObject({ code: 'persistence.conflict' });

      await ownerSql`
        alter table gitblocks.catalog_candidates
        disable trigger catalog_candidates_immutable
      `;
      await ownerSql`
        update gitblocks.catalog_candidates
        set record_digest = ${'0'.repeat(64)}
        where candidate_id = ${dossier.identity.candidateId}
      `;
      await ownerSql`
        alter table gitblocks.catalog_candidates
        enable trigger catalog_candidates_immutable
      `;
      await expect(
        loadActiveCandidateDossier(serving, {
          candidateId: dossier.identity.candidateId,
          expectedCapabilityFamily: 'authorization',
          evidenceCutoff: CREATED_AT,
        }),
      ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });
    } finally {
      await closePersistenceClient(writer);
      await closePersistenceClient(serving);
    }
  });
});

function createDossierWithUnknown(): ReturnType<typeof createCandidateDossier> {
  const dossier = createCandidateDossier('candidate-alpha');
  const observation = requireObservation(dossier);
  dossier.unknowns = [
    {
      scope: 'candidate',
      unknownId: 'unknown-runtime-edge',
      candidateId: dossier.identity.candidateId,
      topic: 'runtime-uncertainty',
      statement: 'One runtime edge remains unverified.',
      evidenceIds: [observation.evidenceId],
    },
  ];
  return dossier;
}

function requireObservation(
  dossier: CandidateDossierV1,
): CandidateDossierV1['observations'][number] {
  const observation = dossier.observations[0];
  if (observation === undefined) {
    throw new Error('Finalist evidence fixture requires one observation.');
  }
  return observation;
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

async function resetDatabase(): Promise<void> {
  await ownerSql.unsafe('drop schema if exists gitblocks cascade');
  const owner = createPersistenceClient(OWNER_CONFIG);
  try {
    await applyMigrations(owner);
  } finally {
    await closePersistenceClient(owner);
  }
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
