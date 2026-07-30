import type {
  CandidateDossierV1,
  EvidenceObservationV1,
} from '@gitblocks/contracts';
import {
  createRepositoryArtifactChunkV1,
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  repositoryArtifactContentSha256,
  repositoryArtifactDisplayUrl,
  repositoryArtifactGitBlobObjectId,
  repositoryArtifactUtf8ByteLength,
  type RepositoryArtifactChunkV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';

export type MutableValue<Value> = Value extends readonly (infer Item)[]
  ? MutableValue<Item>[]
  : Value extends object
    ? { -readonly [Key in keyof Value]: MutableValue<Value[Key]> }
    : Value;

export function createEvidence(
  candidateId: 'candidate-alpha' | 'candidate-beta',
): MutableValue<EvidenceObservationV1> {
  const suffix = candidateId === 'candidate-alpha' ? 'alpha' : 'beta';
  const commitSha =
    candidateId === 'candidate-alpha'
      ? '0123456789abcdef0123456789abcdef01234567'
      : '89abcdef0123456789abcdef0123456789abcdef';
  return {
    kind: 'evidence',
    evidenceId: `evidence-${suffix}`,
    candidateId,
    topic: 'runtime-support',
    dimension: 'runtime-framework',
    observation: 'Official evidence establishes runtime support.',
    source: {
      kind: 'git-commit',
      sourceType: 'official-repository',
      sourceUrl: `https://github.com/example/${suffix}`,
      commitSha,
      immutableUrl: `https://github.com/example/${suffix}/tree/${commitSha}`,
      collectedAt: '2026-07-28T20:30:00Z',
      publishedAt: '2026-07-28T19:00:00Z',
    },
    freshness: {
      status: 'current',
      asOf: '2026-07-28T21:00:00Z',
      scope: 'Runtime compatibility at the pinned revision.',
    },
    directness: 'direct',
    limitation: 'No live candidate code was installed or executed.',
  };
}

export function createCandidateDossier(
  candidateId: 'candidate-alpha' | 'candidate-beta',
): MutableValue<CandidateDossierV1> {
  const suffix = candidateId === 'candidate-alpha' ? 'alpha' : 'beta';
  const evidence = createEvidence(candidateId);
  return {
    contractVersion: '1.0.0',
    identity: {
      candidateId,
      displayName: `Candidate ${suffix}`,
      repository: {
        host: 'github',
        owner: 'example',
        name: suffix,
      },
      package: {
        registry: 'npm',
        name: `example-${suffix}`,
      },
    },
    capabilityFamily: 'authorization',
    versionScope: '1.0.0',
    observations: [evidence],
    limitations: [
      {
        limitationId: `limitation-${suffix}`,
        limitationCode: 'live-validation-not-performed',
        candidateId,
        statement:
          evidence.limitation ?? 'No separate candidate limitation is known.',
        evidenceIds: [evidence.evidenceId],
      },
    ],
    unknowns: [],
  };
}

export interface SyntheticArtifactPublication {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly {
    readonly artifact: RepositoryArtifactV1;
    readonly chunks: readonly RepositoryArtifactChunkV1[];
  }[];
}

export function createArtifactPublication(options?: {
  readonly content?: string;
  readonly collectedAt?: string;
  readonly publishedAt?: string;
  readonly providerOwner?: string;
  readonly providerRepository?: string;
  readonly firstMaterializationCatalogOwner?: string;
  readonly firstMaterializationCatalogRepository?: string;
  readonly firstMaterializationProviderOwner?: string;
  readonly firstMaterializationProviderRepository?: string;
}): SyntheticArtifactPublication {
  const content = options?.content ?? '# Synthetic\r\nexact π bytes\n';
  const providerOwner = options?.providerOwner ?? 'example';
  const providerRepository = options?.providerRepository ?? 'alpha';
  const firstMaterializationProviderOwner =
    options?.firstMaterializationProviderOwner ?? providerOwner;
  const firstMaterializationProviderRepository =
    options?.firstMaterializationProviderRepository ?? providerRepository;
  const repositoryId = '123456789012345678';
  const commitObjectId = '1'.repeat(40);
  const blobObjectId = repositoryArtifactGitBlobObjectId('sha1', content);
  const byteCount = repositoryArtifactUtf8ByteLength(content);
  const lineCount = logicalLineCount(content);
  const artifact = createRepositoryArtifactV1({
    contractVersion: '1.0.0',
    candidateId: 'candidate-alpha',
    provider: 'github',
    providerRepositoryId: repositoryId,
    gitObjectAlgorithm: 'sha1',
    commitObjectId,
    path: 'README.md',
    blobObjectId,
    blobApiUrl: `https://api.github.com/repositories/${repositoryId}/git/blobs/${blobObjectId}`,
    displayUrl: repositoryArtifactDisplayUrl({
      providerOwner: firstMaterializationProviderOwner,
      providerRepository: firstMaterializationProviderRepository,
      commitObjectId,
      path: 'README.md',
    }),
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: repositoryArtifactContentSha256(content),
    byteCount,
    lineCount,
    content,
    firstMaterialization: {
      catalogOwner: options?.firstMaterializationCatalogOwner ?? 'example',
      catalogRepository:
        options?.firstMaterializationCatalogRepository ?? 'alpha',
      providerOwner: firstMaterializationProviderOwner,
      providerRepository: firstMaterializationProviderRepository,
      collectedAt: options?.collectedAt ?? '2026-07-29T12:00:00.000Z',
    },
  });
  const chunk = createRepositoryArtifactChunkV1({
    contractVersion: '1.0.0',
    artifactId: artifact.artifactId,
    candidateId: artifact.candidateId,
    chunkerVersion: 'exact-lines-v1',
    ordinal: 0,
    startByte: 0,
    endByteExclusive: byteCount,
    byteCount,
    startLine: 1,
    endLine:
      content.length === 0
        ? 1
        : lineCount - (/(?:\r\n|\r|\n)$/u.test(content) ? 1 : 0),
    contentSha256: artifact.contentSha256,
    content,
  });
  const artifactSet = createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId: artifact.candidateId,
    catalogVersion: 'public-v1',
    catalogDigest:
      '4819dd943b49c75693e6629c5c005a373d711d341115fd4572bbb4ca01f26c96',
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest:
      '2ba28512832f149a3f4068d789004c07f3d6773ec2cc32859555aac1be3fdc43',
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: repositoryId,
    providerCanonicalOwner: providerOwner,
    providerCanonicalRepository: providerRepository,
    gitObjectAlgorithm: 'sha1',
    commitObjectId,
    entries: [
      {
        selectionId: `selection-${'2'.repeat(48)}`,
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
    publishedAt: options?.publishedAt ?? '2026-07-29T12:01:00.000Z',
  });
  return { artifactSet, artifacts: [{ artifact, chunks: [chunk] }] };
}

function logicalLineCount(content: string): number {
  return content.split(/\r\n|\r|\n/u).length;
}
