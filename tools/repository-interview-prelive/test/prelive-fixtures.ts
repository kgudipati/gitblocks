import { readFile } from 'node:fs/promises';

import {
  createRepositoryArtifactSetV1,
  type RepositoryArtifactSetV1,
} from '@gitblocks/contracts';
import {
  createArtifactReceipt,
  parsePublicArtifactManifest,
  parsePublicCatalog,
  type ArtifactReceipt,
  type ArtifactReceiptCandidate,
  type PublicArtifactManifest,
  type PublicCatalog,
} from '@gitblocks/ingestion';
import { sha256Digest } from '@gitblocks/interviews';

export interface SyntheticArtifactAuthorityV1 {
  readonly catalog: PublicCatalog;
  readonly artifactManifest: PublicArtifactManifest;
  readonly sets: ReadonlyMap<string, RepositoryArtifactSetV1>;
  readonly receipt: ArtifactReceipt;
  readonly candidateIds: readonly string[];
}

export async function syntheticArtifactAuthorityV1(): Promise<SyntheticArtifactAuthorityV1> {
  const catalog = parsePublicCatalog(
    await readFile('catalog/public-v1/manifest.json', 'utf8'),
  );
  const artifactManifest = parsePublicArtifactManifest(
    await readFile('catalog/public-v1/artifact-manifest.json', 'utf8'),
    catalog,
  );
  const sets = new Map<string, RepositoryArtifactSetV1>();
  const candidates: ArtifactReceiptCandidate[] = [];
  catalog.candidates.forEach(({ candidateId }, index) => {
    const set = syntheticArtifactSetV1(candidateId, index);
    sets.set(set.artifactSetId, set);
    candidates.push({
      candidateId,
      outcome: 'created',
      artifactSetId: set.artifactSetId,
      artifactCount: 0,
      chunkCount: 0,
      absenceCount: 1,
      operationalDecodedBytes: 0,
      materializedArtifactBytes: 0,
      inserted: { artifacts: 0, chunks: 0, artifactSets: 1, entries: 1 },
      materializationDigest: sha256Digest(
        `synthetic-materialization:${candidateId}`,
      ),
      safeErrorCode: null,
    });
  });
  const receipt = createArtifactReceipt({
    catalog,
    manifest: artifactManifest,
    runId: 'synthetic-prelive-artifact-run',
    startedAt: '2026-08-01T18:00:00.000Z',
    completedAt: '2026-08-01T18:01:00.000Z',
    candidates,
    providerMetrics: {
      providerRequestCounts: { github: 0, npm: 0 },
      githubRateLimit: null,
    },
    databaseMigrationVersion: 4,
    operationalDecodedBytes: 0,
  });
  return Object.freeze({
    catalog,
    artifactManifest,
    sets,
    receipt,
    candidateIds: Object.freeze(
      catalog.candidates.map(({ candidateId }) => candidateId),
    ),
  });
}

export function syntheticArtifactSetV1(
  candidateId: string,
  index: number,
): RepositoryArtifactSetV1 {
  return createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId,
    catalogVersion: 'public-v1',
    catalogDigest:
      '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634',
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest:
      '17d2a47f8d992275c95d55434bfc24776fb8ac51fc626e7610502f687bf3d02c',
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: String(10_000_000 + index),
    providerCanonicalOwner: 'synthetic-owner',
    providerCanonicalRepository: `repository-${String(index)}`,
    gitObjectAlgorithm: 'sha1',
    commitObjectId: index.toString(16).padStart(40, '0'),
    entries: [
      {
        selectionId: `selection-${sha256Digest(candidateId).slice(0, 48)}`,
        ordinal: 0,
        selector: 'root-readme',
        artifactKind: 'readme',
        requirement: 'optional',
        rationale: null,
        requestedPath: null,
        resolvedPath: null,
        outcome: 'not-found',
        artifactId: null,
      },
    ],
    publishedAt: '2026-08-01T18:00:30.000Z',
  });
}
