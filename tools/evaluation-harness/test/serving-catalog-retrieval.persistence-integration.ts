import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import postgres, { type Sql } from 'postgres';
import {
  CONTRACT_VERSION,
  createCandidateRetrievalRequestV1,
  normalizeCapabilityQueryV1,
  parseCandidateRetrievalMetadataAuthorityV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
  type DeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';
import type {
  DeterministicCandidateProfile,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import {
  applyMigrations,
  closePersistenceClient,
  createPersistenceClient,
  loadServingCatalogSnapshot,
  publishServingCatalogSnapshot,
  putCatalogCandidate,
  setCandidateCapabilityFamilies,
  type PersistenceClient,
  type PersistenceClientConfig,
} from '@gitblocks/persistence';
import { createCandidateRetrievalEngineV1 } from '@gitblocks/retrieval';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

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
let profiles: DeterministicCandidateProfileAuthorityV1;
let metadata: CandidateRetrievalMetadataAuthorityV1;
let taxonomy: CapabilityTaxonomyV1;
let retrievalExpansion: CapabilityRetrievalExpansionV1;

beforeAll(async () => {
  ownerSql = directSql(OWNER_CONFIG);
  const [profileText, metadataText, taxonomyText, expansionText] =
    await Promise.all([
      catalogText('public-v1/candidate-profile-authority.json'),
      catalogText('public-v1/candidate-retrieval-metadata-authority.json'),
      catalogText('capability-taxonomy/1.0.0/manifest.json'),
      catalogText('capability-retrieval-expansion/1.0.0/manifest.json'),
    ]);
  const parsedProfiles = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(profileText) as unknown,
  );
  const parsedMetadata = parseCandidateRetrievalMetadataAuthorityV1(
    JSON.parse(metadataText) as unknown,
  );
  const parsedTaxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(taxonomyText) as unknown,
  );
  const parsedExpansion = parseCapabilityRetrievalExpansionV1(
    JSON.parse(expansionText) as unknown,
  );
  if (
    !parsedProfiles.ok ||
    !parsedMetadata.ok ||
    !parsedTaxonomy.ok ||
    !parsedExpansion.ok
  ) {
    throw new Error('Accepted serving retrieval authorities are invalid.');
  }
  profiles = parsedProfiles.value;
  metadata = parsedMetadata.value;
  taxonomy = parsedTaxonomy.value;
  retrievalExpansion = parsedExpansion.value;
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await ownerSql.end({ timeout: 5 });
});

describe('PostgreSQL-loaded retrieval equivalence', () => {
  it('constructs the existing engine and exactly matches committed-authority retrieval', async () => {
    const writer = createPersistenceClient(WRITER_CONFIG);
    const serving = createPersistenceClient(SERVING_CONFIG);
    try {
      await seedAcceptedCandidateIdentities(writer);
      await publishServingCatalogSnapshot(writer, {
        candidateProfileAuthority: profiles,
        candidateRetrievalMetadataAuthority: metadata,
        publishedAt: PUBLISHED_AT,
      });
      const loaded = await loadServingCatalogSnapshot(serving, {
        selection: 'current',
      });
      const committed = createCandidateRetrievalEngineV1({
        taxonomy,
        candidateProfileAuthority: profiles,
        retrievalExpansionAuthority: retrievalExpansion,
        candidateRetrievalMetadataAuthority: metadata,
        expectedCandidateRetrievalMetadataAuthorityBinding:
          expectedMetadataBinding(metadata),
      });
      const postgresql = createCandidateRetrievalEngineV1({
        taxonomy,
        candidateProfileAuthority: loaded.candidateProfileAuthority,
        retrievalExpansionAuthority: retrievalExpansion,
        candidateRetrievalMetadataAuthority:
          loaded.candidateRetrievalMetadataAuthority,
        expectedCandidateRetrievalMetadataAuthorityBinding:
          loaded.expectedCandidateRetrievalMetadataAuthorityBinding,
      });
      if (!committed.ok || !postgresql.ok) {
        throw new Error('Serving retrieval engine construction failed.');
      }
      const request = representativeAuthorizationRequest();
      const committedResult = committed.engine.retrieve(request);
      const postgresqlResult = postgresql.engine.retrieve(request);
      expect(postgresqlResult).toEqual(committedResult);
      expect(postgresqlResult.ok).toBe(true);
      if (!postgresqlResult.ok) return;
      expect(postgresqlResult.result.diagnostics.candidatesExamined).toBe(150);
      expect(
        postgresqlResult.result.eligibleCandidates.map(
          ({ candidateId }) => candidateId,
        ),
      ).toEqual([
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
      ]);
    } finally {
      await Promise.all([
        closePersistenceClient(serving),
        closePersistenceClient(writer),
      ]);
    }
  });
});

async function seedAcceptedCandidateIdentities(
  client: PersistenceClient,
): Promise<void> {
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

function representativeAuthorizationRequest() {
  const normalization = normalizeCapabilityQueryV1(
    {
      contractVersion: CONTRACT_VERSION,
      queryInputId: 'postgresql-serving-equivalence-query',
      scope: 'local-pre-approval',
      summary: 'Retrieve authorization candidates.',
      capabilityTerms: [
        { termId: 'authorization-capability', originalTerm: 'authorization' },
      ],
      successConditions: [
        {
          conditionId: 'authorization-result',
          statement: 'Return plausible authorization candidates.',
        },
      ],
      draftConstraints: [],
      candidateReferences: [],
      repositoryFingerprintReference: null,
    },
    taxonomy,
  );
  if (!normalization.ok || normalization.value.outcome !== 'normalized') {
    throw new Error('Representative serving query did not normalize.');
  }
  return createCandidateRetrievalRequestV1({
    normalization: normalization.value,
    authorityBindings: {
      taxonomy: {
        taxonomyVersion: taxonomy.taxonomyVersion,
        taxonomySemanticDigest: taxonomy.semanticDigest,
      },
      candidateProfiles: {
        authorityVersion: profiles.authorityVersion,
        semanticAuthorityDigest: profiles.semanticAuthorityDigest,
        profileRulesVersion: profiles.profileRulesVersion,
      },
      catalog: {
        catalogVersion: profiles.catalogVersion,
        catalogDigest: profiles.catalogDigest,
      },
      candidateConstraintEvaluationVersion:
        'candidate-constraint-evaluation/2.0.0',
      retrievalExpansion: {
        authorityVersion: retrievalExpansion.expansionVersion,
        semanticDigest: retrievalExpansion.semanticDigest,
      },
      retrievalMetadata: {
        authorityVersion: metadata.authorityVersion,
        authoritySemanticDigest: metadata.authoritySemanticDigest,
      },
    },
    eligibleResultLimit: 10,
    evidenceNeededResultLimit: 10,
  });
}

function expectedMetadataBinding(
  authority: CandidateRetrievalMetadataAuthorityV1,
) {
  return {
    authorityVersion: authority.authorityVersion,
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    providerPolicyVersion: authority.providerPolicyVersion,
    providerPolicyDigest: authority.providerPolicyDigest,
    sourceProviderPolicyVersion: authority.sourceProviderPolicyVersion,
    sourceProviderPolicyDigest: authority.sourceProviderPolicyDigest,
    sourceOperation: authority.sourceOperation,
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

function catalogText(relativePath: string): Promise<string> {
  return readFile(
    fileURLToPath(new URL(`../../../catalog/${relativePath}`, import.meta.url)),
    'utf8',
  );
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
