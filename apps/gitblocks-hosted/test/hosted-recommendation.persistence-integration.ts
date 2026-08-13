import {
  Client,
  StreamableHTTPClientTransport,
  type FetchLike,
} from '@modelcontextprotocol/client';
import type { TargetFitAssessmentResponseV1 } from '@gitblocks/contracts';
import type {
  DeterministicCandidateProfile,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import {
  appendCandidateLimitation,
  appendCandidateUnknown,
  appendEvidenceObservation,
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  publishServingCatalogSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import postgres, { type Sql } from 'postgres';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { FitAssessmentModelRequestV1 } from '../src/application.ts';
import { GITBLOCKS_MCP_HOST } from '../src/mcp-http.ts';
import { startGitBlocksMcpProcess } from '../src/mcp-process.ts';
import { GITBLOCKS_RECOMMEND_OSS_TOOL_NAME } from '../src/mcp-server.ts';
import {
  candidateDossier,
  groundedModelResponse,
  loadAcceptedAuthorities,
  recommendationRequest,
} from './fixtures.ts';

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
const EVIDENCE_CREATED_AT = '2026-08-12T19:00:00.000Z';
const EVIDENCE_CUTOFF = '2026-08-12T20:00:00.000Z';
const AUTHORIZATION_FINALISTS = [
  'auth-casbin-casbin',
  'auth-casbin-casbin-js',
  'auth-casbin-node-casbin',
  'auth-warrant',
  'auth-aserto-topaz',
] as const;
const nativeFetch = globalThis.fetch.bind(globalThis);
const loopbackFetch: FetchLike = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== GITBLOCKS_MCP_HOST) {
    throw new Error('PostgreSQL MCP test permits loopback HTTP only.');
  }
  return nativeFetch(input, init);
};

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

describe('hosted recommendation PostgreSQL and official MCP exercise', () => {
  it('returns a target-grounded recommendation and rejects invented target facts without reloading the serving snapshot', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const authorities = await loadAcceptedAuthorities();
    const model = vi.fn((input: FitAssessmentModelRequestV1) => {
      const response = structuredClone(groundedModelResponse(input));
      if (input.fitAssessmentRequest.assessmentRequestId.includes('invalid')) {
        inventRepositoryFact(response);
      }
      return Promise.resolve(response);
    });
    let hostedProcess;
    let client: Client | undefined;
    try {
      await seedAcceptedCandidateIdentities(writer);
      await seedFinalistEvidence(writer);
      await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: authorities.profiles,
        candidateRetrievalMetadataAuthority: authorities.metadata,
        publishedAt: PUBLISHED_AT,
      });
      await closePersistenceClient(writer);

      hostedProcess = await startGitBlocksMcpProcess({
        database: SERVING_CONFIG,
        fitModel: { assess: model },
        clock: { now: () => EVIDENCE_CUTOFF },
        port: 0,
      });

      await ownerSql.unsafe(`
        revoke select on table
          gitblocks.serving_catalog_snapshots,
          gitblocks.serving_catalog_current_snapshot,
          gitblocks.serving_candidate_profile_records,
          gitblocks.serving_candidate_retrieval_metadata_records
        from gitblocks_serving
      `);

      client = new Client(
        { name: 'gitblocks-r6-postgresql-mcp-test', version: '0.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      await client.connect(
        new StreamableHTTPClientTransport(hostedProcess.endpoint, {
          fetch: loopbackFetch,
        }),
      );
      expect((await client.listTools()).tools.map(({ name }) => name)).toEqual([
        GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
      ]);

      const valid = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequest({
          id: 'postgres-valid-recommendation',
          term: 'authorization',
        }),
      });
      expect(valid.isError).not.toBe(true);
      expect(valid.structuredContent).toMatchObject({
        outcome: 'recommend',
        responsibleOptions: [{ candidateId: AUTHORIZATION_FINALISTS[0] }],
        targetFitAssessment: {
          inferenceRepositoryFactBindings: [
            { repositoryFactIds: ['fact-runtime'] },
          ],
        },
      });
      expect(
        responsibleOptionCount(valid.structuredContent),
      ).toBeLessThanOrEqual(3);

      const invalid = await client.callTool({
        name: GITBLOCKS_RECOMMEND_OSS_TOOL_NAME,
        arguments: recommendationRequest({
          id: 'postgres-invalid-model-output',
          term: 'authorization',
        }),
      });
      expect(invalid).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'GitBlocks recommendation failed.' }],
      });
      expect(model).toHaveBeenCalledTimes(2);
      expect(
        model.mock.calls.every(
          ([input]) => input.fitAssessmentRequest.candidates.length === 5,
        ),
      ).toBe(true);
      expect(
        model.mock.calls[0]?.[0].fitAssessmentRequest.candidates.map(
          ({ identity }) => identity.candidateId,
        ),
      ).toEqual(AUTHORIZATION_FINALISTS);

      await client.close();
      client = undefined;
      await hostedProcess.close();
      hostedProcess = undefined;
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
        client?.close(),
        hostedProcess?.close(),
        closePersistenceClient(writer),
      ]);
    }
  });
});

async function seedAcceptedCandidateIdentities(
  client: PersistenceClient,
): Promise<void> {
  const { profiles } = await loadAcceptedAuthorities();
  for (const contractProfile of profiles.profiles) {
    const profile = contractProfile as unknown as DeterministicCandidateProfile;
    const identity = profileIdentity(profile);
    const family = knownField(profile, 'capability-family');
    await putCatalogCandidate(client, {
      identity,
      createdAt: '2026-08-12T17:00:00.000Z',
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

async function seedFinalistEvidence(client: PersistenceClient): Promise<void> {
  const { profiles } = await loadAcceptedAuthorities();
  const profileById = new Map(
    profiles.profiles.map((profile) => [
      profile.candidateId,
      profile as unknown as DeterministicCandidateProfile,
    ]),
  );
  for (const candidateId of AUTHORIZATION_FINALISTS) {
    const profile = profileById.get(candidateId);
    if (profile === undefined) throw new Error('Finalist profile is missing.');
    const dossier = {
      ...candidateDossier(candidateId, EVIDENCE_CUTOFF),
      identity: profileIdentity(profile),
    };
    for (const observation of dossier.observations) {
      await appendEvidenceObservation(client, {
        observation,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
    for (const limitation of dossier.limitations) {
      await appendCandidateLimitation(client, {
        limitation,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
    for (const unknown of dossier.unknowns) {
      await appendCandidateUnknown(client, {
        unknown,
        createdAt: EVIDENCE_CREATED_AT,
      });
    }
  }
}

function profileIdentity(profile: DeterministicCandidateProfile) {
  const repository = knownField(profile, 'repository-identity');
  const packageMapping = knownField(profile, 'package-identity-mapping');
  return {
    candidateId: profile.candidateId,
    displayName: repository.value.displayName,
    repository: {
      host: 'github' as const,
      owner: repository.value.githubOwner,
      name: repository.value.githubRepository,
    },
    package:
      packageMapping.value.mapping === 'mapped'
        ? {
            registry: 'npm' as const,
            name: packageMapping.value.packageName,
          }
        : null,
  };
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

function inventRepositoryFact(value: TargetFitAssessmentResponseV1): void {
  const binding = value.inferenceRepositoryFactBindings[0];
  if (binding !== undefined) binding.repositoryFactIds = ['fact-invented'];
}

function responsibleOptionCount(value: unknown): number {
  return typeof value === 'object' &&
    value !== null &&
    'responsibleOptions' in value &&
    Array.isArray(value.responsibleOptions)
    ? value.responsibleOptions.length
    : 0;
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
