import { fileURLToPath } from 'node:url';

import postgres, { type Sql } from 'postgres';
import type {
  DeterministicCandidateProfile,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  PersistenceError,
  publishServingCatalogSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { startHostedDiscoveryComposition } from '../src/composition.ts';
import { runHostedDiscoveryExercise } from '../src/exercise.ts';
import { capabilityInput, loadAcceptedAuthorities } from './fixtures.ts';

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
const PUBLISHED_AT = '2026-08-12T18:00:00.000Z';

let ownerSql: Sql;

beforeAll(() => {
  ownerSql = directSql(OWNER_CONFIG);
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await ownerSql.end({ timeout: 5 });
});

describe('hosted discovery PostgreSQL composition', () => {
  it('executes the one-shot journey and continues deterministic discovery after serving SELECT is revoked', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const servingSql = directSql(SERVING_CONFIG);
    const authorities = await loadAcceptedAuthorities();
    try {
      await seedAcceptedCandidateIdentities(writer);
      const published = await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: authorities.profiles,
        candidateRetrievalMetadataAuthority: authorities.metadata,
        publishedAt: PUBLISHED_AT,
      });
      await closePersistenceClient(writer);

      const output: string[] = [];
      const error: string[] = [];
      const exitCode = await runHostedDiscoveryExercise({
        arguments: [
          '--request',
          fileURLToPath(
            new URL(
              '../examples/authorization-discovery-request.json',
              import.meta.url,
            ),
          ),
        ],
        environment: hostedServingEnvironment(),
        writeOutput: (text) => output.push(text),
        writeError: (text) => error.push(text),
      });
      expect(exitCode).toBe(0);
      expect(error).toEqual([]);
      const summary = JSON.parse(output.join('')) as Readonly<
        Record<string, unknown>
      >;
      expect(summary).toMatchObject({
        operation: 'hosted-discovery.exercise',
        status: 'complete',
        snapshotId: published.snapshotId,
        candidateCount: 150,
        servingSnapshotLoads: 1,
        discoveryRequests: 2,
        deterministicReplay: true,
        eligibleCandidateIds: [
          'auth-casbin-casbin',
          'auth-casbin-casbin-js',
          'auth-casbin-node-casbin',
          'auth-warrant',
          'auth-aserto-topaz',
          'auth-authzed-spicedb',
          'auth-cerbos-cerbos',
          'auth-open-policy-agent',
          'auth-openfga',
          'auth-ory-keto',
        ],
        evidenceNeededCandidateIds: [],
      });

      const composition = await startHostedDiscoveryComposition({
        database: SERVING_CONFIG,
      });
      expect(composition.readiness()).toMatchObject({ ready: true });
      await ownerSql.unsafe(
        'revoke select on all tables in schema gitblocks from gitblocks_serving',
      );
      await expect(
        servingSql`
          select snapshot_id
          from gitblocks.serving_catalog_current_snapshot
          where selector
        `,
      ).rejects.toMatchObject({ code: '42501' });

      const request = capabilityInput({
        id: 'post-start-no-database',
        term: 'authorization',
      });
      const first = composition.discoverCapability(request);
      const second = composition.discoverCapability(request);
      expect(first).toMatchObject({
        ok: true,
        result: { outcome: 'retrieved' },
      });
      expect(second).toEqual(first);
      await composition.close();
      expect(composition.readiness()).toEqual({ ready: false });

      const sessions = await ownerSql<readonly { readonly count: number }[]>`
        select pg_catalog.count(*)::integer as count
        from pg_catalog.pg_stat_activity
        where datname = ${SERVING_CONFIG.database}
          and usename = ${SERVING_CONFIG.username}
          and application_name = 'gitblocks-persistence'
      `;
      expect(sessions).toEqual([{ count: 0 }]);
    } finally {
      await Promise.all([
        servingSql.end({ timeout: 5 }),
        closePersistenceClient(writer),
      ]);
    }
  });

  it('fails startup through the existing not-found persistence boundary when no current snapshot exists', async () => {
    await expect(
      startHostedDiscoveryComposition({ database: SERVING_CONFIG }),
    ).rejects.toBeInstanceOf(PersistenceError);
    await expect(
      startHostedDiscoveryComposition({ database: SERVING_CONFIG }),
    ).rejects.toMatchObject({ code: 'persistence.not-found' });
  });

  it('fails startup through the existing corrupt-record boundary for inconsistent serving state', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const authorities = await loadAcceptedAuthorities();
    try {
      await seedAcceptedCandidateIdentities(writer);
      const published = await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: authorities.profiles,
        candidateRetrievalMetadataAuthority: authorities.metadata,
        publishedAt: PUBLISHED_AT,
      });
      const candidateId = authorities.profiles.profiles.at(0)?.candidateId;
      if (candidateId === undefined) {
        throw new Error('Accepted profile authority is empty.');
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
        where snapshot_id = ${published.snapshotId}
          and candidate_id = ${candidateId}
      `;
      await ownerSql.unsafe(
        'alter table gitblocks.serving_candidate_profile_records enable trigger serving_candidate_profile_records_immutable',
      );

      await expect(
        startHostedDiscoveryComposition({ database: SERVING_CONFIG }),
      ).rejects.toMatchObject({ code: 'persistence.corrupt-record' });
    } finally {
      await closePersistenceClient(writer);
    }
  });
});

async function seedAcceptedCandidateIdentities(
  client: PersistenceClient,
): Promise<void> {
  const { profiles } = await loadAcceptedAuthorities();
  for (const contractProfile of profiles.profiles) {
    const profile = contractProfile as unknown as DeterministicCandidateProfile;
    const repository = knownField(profile, 'repository-identity');
    const packageMapping = knownField(profile, 'package-identity-mapping');
    const family = knownField(profile, 'capability-family');
    await putCatalogCandidate(client, {
      identity: {
        candidateId: profile.candidateId,
        displayName: repository.value.displayName,
        repository: {
          host: 'github',
          owner: repository.value.githubOwner,
          name: repository.value.githubRepository,
        },
        package:
          packageMapping.value.mapping === 'mapped'
            ? {
                registry: 'npm',
                name: packageMapping.value.packageName,
              }
            : null,
      },
      createdAt: '2026-07-29T00:00:00.000Z',
    });
    await setCandidateCapabilityFamilies(client, {
      candidateId: profile.candidateId,
      capabilityFamilies: [
        family.value.primaryFamily,
        ...family.value.additionalFamilies,
      ],
    });
  }
}

function knownField<
  Id extends
    'capability-family' | 'package-identity-mapping' | 'repository-identity',
>(profile: DeterministicCandidateProfile, fieldId: Id) {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  ) as DeterministicProfileFieldRecord<Id> | undefined;
  if (field?.state !== 'known') {
    throw new Error('Accepted serving identity field is unavailable.');
  }
  return field;
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

function hostedServingEnvironment(): Readonly<Record<string, string>> {
  return {
    GITBLOCKS_HOSTED_SERVING_DB_HOST: SERVING_CONFIG.host,
    GITBLOCKS_HOSTED_SERVING_DB_PORT: String(SERVING_CONFIG.port),
    GITBLOCKS_HOSTED_SERVING_DB_DATABASE: SERVING_CONFIG.database,
    GITBLOCKS_HOSTED_SERVING_DB_USERNAME: SERVING_CONFIG.username,
    GITBLOCKS_HOSTED_SERVING_DB_PASSWORD: SERVING_CONFIG.password,
    GITBLOCKS_HOSTED_SERVING_DB_SSL: 'disable',
  };
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
