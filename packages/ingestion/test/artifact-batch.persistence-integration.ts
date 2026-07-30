import {
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  repositoryArtifactContentSha256,
  repositoryArtifactGitBlobObjectId,
  repositoryArtifactUtf8ByteLength,
} from '@gitblocks/contracts';
import {
  closePersistenceClient,
  createPersistenceClient,
  putCatalogCandidate,
  type PersistenceClientConfig,
  type PublishRepositoryArtifactSetCommand,
} from '@gitblocks/persistence';
import { describe, expect, it } from 'vitest';

import {
  IngestionError,
  chunkRepositoryArtifact,
  collectPublicRepositoryArtifacts,
  type CatalogCandidate,
  type Clock,
  type PublicArtifactManifest,
  type PublicCatalog,
  type RepositoryArtifactCollector,
} from '../src/index.ts';

const CONFIG = readDatabaseConfig();
const CATALOG_DIGEST = '7'.repeat(64);
const MANIFEST_DIGEST = '8'.repeat(64);
const ALPHA = candidate('phase6-batch-alpha', 'alpha');
const BETA = candidate('phase6-batch-beta', 'beta');

describe('repository artifact batch orchestration', () => {
  it('isolates a failed candidate and proves an immediate rerun reuses first materialization', async () => {
    const client = createPersistenceClient(CONFIG);
    try {
      await Promise.all(
        [ALPHA, BETA].map((entry) =>
          putCatalogCandidate(client, {
            identity: {
              candidateId: entry.candidateId,
              displayName: entry.displayName,
              repository: {
                host: 'github',
                owner: entry.github.owner,
                name: entry.github.repository,
              },
              package: null,
            },
            createdAt: entry.introducedAt,
          }),
        ),
      );
      const collector: RepositoryArtifactCollector = {
        collectCandidate: (command) =>
          command.candidate.candidateId === BETA.candidateId
            ? Promise.reject(
                new IngestionError('ingestion.provider-authorization'),
              )
            : Promise.resolve(
                publication(
                  command.candidate,
                  command.collectedAt,
                  command.publishedAt,
                ),
              ),
      };
      const first = await run(client, collector, clockAt(0));
      expect(first.outcomeCounts).toEqual({
        created: 1,
        idempotent: 0,
        failed: 1,
      });
      expect(first.candidates[1]).toMatchObject({
        candidateId: BETA.candidateId,
        outcome: 'failed',
        artifactSetId: null,
        safeErrorCode: 'ingestion.provider-authorization',
      });

      const second = await run(client, collector, clockAt(10), first);
      expect(second.outcomeCounts).toEqual({
        created: 0,
        idempotent: 1,
        failed: 1,
      });
      expect(second.inserted).toEqual({
        artifacts: 0,
        chunks: 0,
        artifactSets: 0,
        entries: 0,
      });
      expect(second.rerunComparison).toMatchObject({
        identicalArtifactSetCount: 1,
        identicalMaterializationCount: 1,
        zeroNewRowCandidateCount: 1,
        newRowCount: 0,
      });
    } finally {
      await closePersistenceClient(client);
    }
  });

  it('fails before publication when the run byte bound is reached', async () => {
    const client = createPersistenceClient(CONFIG);
    try {
      await putCatalogCandidate(client, {
        identity: {
          candidateId: ALPHA.candidateId,
          displayName: ALPHA.displayName,
          repository: {
            host: 'github',
            owner: ALPHA.github.owner,
            name: ALPHA.github.repository,
          },
          package: null,
        },
        createdAt: ALPHA.introducedAt,
      });
      const collector: RepositoryArtifactCollector = {
        collectCandidate: (command) =>
          Promise.resolve(
            publication(
              command.candidate,
              command.collectedAt,
              command.publishedAt,
              '# Too large for the synthetic one-byte run bound.\n',
            ),
          ),
      };
      const receipt = await collectPublicRepositoryArtifacts({
        catalog: publicCatalog([ALPHA]),
        manifest: artifactManifest([ALPHA]),
        persistence: client,
        collector,
        getProviderMetrics: providerMetrics,
        clock: clockAt(20),
        databaseMigrationVersion: 3,
        maximumDecodedBytes: 1,
      });
      expect(receipt.candidates[0]).toMatchObject({
        outcome: 'failed',
        artifactSetId: null,
        safeErrorCode: 'ingestion.body-too-large',
      });
      expect(receipt.inserted).toEqual({
        artifacts: 0,
        chunks: 0,
        artifactSets: 0,
        entries: 0,
      });
    } finally {
      await closePersistenceClient(client);
    }
  });
});

async function run(
  persistence: ReturnType<typeof createPersistenceClient>,
  collector: RepositoryArtifactCollector,
  clock: Clock,
  priorReceipt?: Awaited<ReturnType<typeof collectPublicRepositoryArtifacts>>,
) {
  return collectPublicRepositoryArtifacts({
    catalog: publicCatalog([ALPHA, BETA]),
    manifest: artifactManifest([ALPHA, BETA]),
    persistence,
    collector,
    getProviderMetrics: providerMetrics,
    clock,
    candidateConcurrency: 2,
    maximumRunMilliseconds: 10_000,
    databaseMigrationVersion: 3,
    ...(priorReceipt === undefined ? {} : { priorReceipt }),
  });
}

function publication(
  source: CatalogCandidate,
  collectedAt: string,
  publishedAt: string,
  content = '# Synthetic artifact batch\n',
): PublishRepositoryArtifactSetCommand {
  const repositoryId =
    source.candidateId === ALPHA.candidateId ? '900000001' : '900000002';
  const commitObjectId =
    source.candidateId === ALPHA.candidateId ? '1'.repeat(40) : '2'.repeat(40);
  const blobObjectId = repositoryArtifactGitBlobObjectId('sha1', content);
  const artifact = createRepositoryArtifactV1({
    contractVersion: '1.0.0',
    candidateId: source.candidateId,
    provider: 'github',
    providerRepositoryId: repositoryId,
    gitObjectAlgorithm: 'sha1',
    commitObjectId,
    path: 'README.md',
    blobObjectId,
    blobApiUrl: `https://api.github.com/repositories/${repositoryId}/git/blobs/${blobObjectId}`,
    displayUrl: null,
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: repositoryArtifactContentSha256(content),
    byteCount: repositoryArtifactUtf8ByteLength(content),
    lineCount: content.split(/\r\n|\r|\n/u).length,
    content,
    firstMaterialization: {
      catalogOwner: source.github.owner,
      catalogRepository: source.github.repository,
      providerOwner: source.github.owner,
      providerRepository: source.github.repository,
      collectedAt,
    },
  });
  const artifactSet = createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId: source.candidateId,
    catalogVersion: 'public-v1',
    catalogDigest: CATALOG_DIGEST,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: MANIFEST_DIGEST,
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: repositoryId,
    providerCanonicalOwner: source.github.owner,
    providerCanonicalRepository: source.github.repository,
    gitObjectAlgorithm: 'sha1',
    commitObjectId,
    entries: [
      {
        selectionId: `selection-${source.candidateId === ALPHA.candidateId ? 'a' : 'b'}${'0'.repeat(47)}`,
        ordinal: 0,
        selector: 'root-readme',
        artifactKind: 'readme',
        requirement: 'optional',
        rationale: null,
        requestedPath: null,
        resolvedPath: artifact.path,
        outcome: 'present',
        artifactId: artifact.artifactId,
      },
    ],
    publishedAt,
  });
  return {
    artifactSet,
    artifacts: [{ artifact, chunks: chunkRepositoryArtifact(artifact) }],
  };
}

function candidate(candidateId: string, repository: string): CatalogCandidate {
  return {
    candidateId,
    displayName: `Phase 6 ${repository}`,
    introducedAt: '2026-07-29T00:00:00.000Z',
    github: { owner: 'gitblocks-test', repository },
    npmPackage: null,
    primaryCapabilityFamily: 'authorization',
    additionalCapabilityFamilies: [],
    rationale:
      'Synthetic repository artifact batch candidate used for persistence verification.',
    selectionSources: [`https://github.com/gitblocks-test/${repository}`],
    expectedSourceTypes: ['github-repository'],
    status: 'active',
    allowlistedFiles: [],
  };
}

function publicCatalog(candidates: readonly CatalogCandidate[]): PublicCatalog {
  return {
    catalogVersion: 'public-v1',
    publishedAt: '2026-07-29T00:00:00.000Z',
    manifestDigest: CATALOG_DIGEST,
    candidates,
  };
}

function artifactManifest(
  candidates: readonly CatalogCandidate[],
): PublicArtifactManifest {
  return {
    artifactManifestVersion: 'public-artifacts-v1',
    catalogVersion: 'public-v1',
    catalogDigest: CATALOG_DIGEST,
    candidates: candidates.map((entry) => ({
      candidateId: entry.candidateId,
      selections: [
        {
          selectionId: `selection-${entry.candidateId === ALPHA.candidateId ? 'a' : 'b'}${'0'.repeat(47)}`,
          selector: 'root-readme',
          artifactKind: 'readme',
          requirement: 'optional',
        },
      ],
    })),
    manifestDigest: MANIFEST_DIGEST,
  };
}

function clockAt(offsetMinutes: number): Clock {
  let calls = 0;
  return {
    now: () => {
      const value = new Date(
        Date.parse('2026-07-29T12:00:00.000Z') +
          (offsetMinutes * 60 + calls) * 1_000,
      );
      calls += 1;
      return value;
    },
  };
}

function providerMetrics() {
  return {
    providerRequestCounts: { github: 6, npm: 0 },
    githubRateLimit: null,
  };
}

function readDatabaseConfig(): PersistenceClientConfig {
  return {
    host: requiredEnvironment('GITBLOCKS_TEST_DB_HOST'),
    port: Number(requiredEnvironment('GITBLOCKS_TEST_DB_PORT')),
    database: requiredEnvironment('GITBLOCKS_TEST_DB_DATABASE'),
    username: 'gitblocks_persistence_test',
    password: 'persistence-test-only',
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
