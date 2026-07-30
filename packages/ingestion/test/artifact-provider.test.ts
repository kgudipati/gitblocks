import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';
import {
  IngestionError,
  createRepositoryArtifactCollector,
  createArtifactDecodedByteBudget,
  type JsonResponse,
  type ProviderTransport,
  type PublicArtifactManifest,
  type TransportRequest,
} from '../src/index.ts';
import { TEST_CANDIDATE } from './fixtures.ts';

const CONTENT = '# Synthetic\r\nexact π\n';
const BYTES = Buffer.from(CONTENT, 'utf8');
const BLOB_SHA = gitBlobSha1(BYTES);
const COMMIT_SHA = '1'.repeat(40);
const TREE_SHA = '3'.repeat(40);

describe('exact GitHub repository artifact collection', () => {
  it('uses exact refs, numeric repository identity, tree verification, and immutable blobs', async () => {
    const requests: TransportRequest[] = [];
    const transport = providerTransport(requests);
    const decodedByteBudget = createArtifactDecodedByteBudget(
      64 * 1_024 * 1_024,
    );
    const collector = createRepositoryArtifactCollector({
      transport,
      githubToken: 'synthetic-token',
    });
    const publication = await collector.collectCandidate({
      candidate: TEST_CANDIDATE,
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-1',
      decodedByteBudget: decodedByteBudget.createCandidateScope(),
    });

    expect(publication.artifacts).toHaveLength(1);
    expect(publication.artifacts[0]?.artifact).toMatchObject({
      providerRepositoryId: '123456789',
      gitObjectAlgorithm: 'sha1',
      commitObjectId: COMMIT_SHA,
      path: 'README.md',
      blobObjectId: BLOB_SHA,
      content: CONTENT,
      blobApiUrl: `https://api.github.com/repositories/123456789/git/blobs/${BLOB_SHA}`,
    });
    expect(publication.artifactSet.entries).toEqual([
      expect.objectContaining({
        selector: 'root-readme',
        resolvedPath: 'README.md',
        outcome: 'present',
      }),
    ]);
    expect(
      requests.every((request) => request.githubApiVersion === '2026-03-10'),
    ).toBe(true);
    expect(
      requests
        .find((request) => request.operation === 'artifact-readme')
        ?.url.searchParams.get('ref'),
    ).toBe(COMMIT_SHA);
    expect(requests.map((request) => request.operation)).toEqual([
      'artifact-repository',
      'artifact-hash-algorithm',
      'artifact-exact-commit',
      'artifact-readme',
      'artifact-tree',
      'artifact-blob',
    ]);
    expect(decodedByteBudget.operationalDecodedBytes).toBe(
      BYTES.byteLength * 2,
    );
  });

  it('retains both provider body charges when independent blob validation later fails', async () => {
    const requests: TransportRequest[] = [];
    const decodedByteBudget = createArtifactDecodedByteBudget(
      64 * 1_024 * 1_024,
    );
    const collector = createRepositoryArtifactCollector({
      transport: providerTransport(requests, { blobObjectMismatch: true }),
      githubToken: 'synthetic-token',
    });

    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-1',
        decodedByteBudget: decodedByteBudget.createCandidateScope(),
      }),
    ).rejects.toMatchObject({
      code: 'ingestion.artifact-hash-mismatch',
      message: 'The repository artifact failed immutable object verification.',
    });

    expect(decodedByteBudget.operationalDecodedBytes).toBe(
      BYTES.byteLength * 2,
    );
    expect(requests.at(-1)?.operation).toBe('artifact-blob');
    expect(
      JSON.stringify({
        code: 'ingestion.artifact-hash-mismatch',
        message:
          'The repository artifact failed immutable object verification.',
      }),
    ).not.toContain(CONTENT);
  });

  it('rejects before decoding when the aggregate budget cannot reserve the provider body', async () => {
    const requests: TransportRequest[] = [];
    const budget = createArtifactDecodedByteBudget(BYTES.byteLength - 1);
    const collector = createRepositoryArtifactCollector({
      transport: providerTransport(requests),
      githubToken: 'synthetic-token',
    });

    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-1',
        decodedByteBudget: budget.createCandidateScope(),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.body-too-large' });

    expect(budget.operationalDecodedBytes).toBe(0);
    expect(requests.map(({ operation }) => operation)).toEqual([
      'artifact-repository',
      'artifact-hash-algorithm',
      'artifact-exact-commit',
      'artifact-readme',
    ]);
  });

  it('publishes only an optional definitive exact-ref 404 as absence', async () => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], {
        readmeError: new IngestionError('ingestion.provider-not-found'),
      }),
    });
    const publication = await collector.collectCandidate({
      candidate: TEST_CANDIDATE,
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-1',
      decodedByteBudget: artifactBudget(),
    });
    expect(publication.artifacts).toEqual([]);
    expect(publication.artifactSet.entries).toEqual([
      expect.objectContaining({
        outcome: 'not-found',
        artifactId: null,
        resolvedPath: null,
      }),
    ]);
  });

  it('does not publish a required exact-path 404 as absence', async () => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], {
        contentError: new IngestionError('ingestion.provider-not-found'),
      }),
    });
    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForPath('required'),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-1',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.provider-not-found' });
  });

  it('accepts an executable text blob selected by an exact path', async () => {
    const requests: TransportRequest[] = [];
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport(requests, { treeMode: '100755' }),
    });
    const publication = await collector.collectCandidate({
      candidate: TEST_CANDIDATE,
      manifest: manifestForPath('required'),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-1',
      decodedByteBudget: artifactBudget(),
    });
    expect(publication.artifactSet.entries[0]).toMatchObject({
      selector: 'path',
      requestedPath: 'README.md',
      resolvedPath: 'README.md',
      requirement: 'required',
      outcome: 'present',
    });
    expect(
      requests
        .find((request) => request.operation === 'artifact-content')
        ?.url.searchParams.get('ref'),
    ).toBe(COMMIT_SHA);
  });

  it('records a provider-canonical move without using the alias as artifact identity', async () => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], {
        canonicalOwner: 'new-owner',
        canonicalRepository: 'new-name',
      }),
    });
    const publication = await collector.collectCandidate({
      candidate: { ...TEST_CANDIDATE, status: 'moved' },
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-1',
      decodedByteBudget: artifactBudget(),
    });
    expect(publication.artifactSet).toMatchObject({
      providerRepositoryId: '123456789',
      providerCanonicalOwner: 'new-owner',
      providerCanonicalRepository: 'new-name',
    });
    expect(
      publication.artifacts[0]?.artifact.firstMaterialization,
    ).toMatchObject({
      catalogOwner: 'gitblocks-test',
      catalogRepository: 'candidate',
      providerOwner: 'new-owner',
      providerRepository: 'new-name',
    });
  });

  it('serializes GitHub requests across concurrently collected candidates', async () => {
    let active = 0;
    let maximumActive = 0;
    const base = providerTransport([]);
    const transport: ProviderTransport = {
      requestJson: async (request) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        try {
          return await base.requestJson(request);
        } finally {
          active -= 1;
        }
      },
    };
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport,
    });
    const command = {
      candidate: TEST_CANDIDATE,
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-1',
      decodedByteBudget: artifactBudget(),
    } as const;
    await Promise.all([
      collector.collectCandidate(command),
      collector.collectCandidate({
        ...command,
        correlationId: 'artifact-run-2',
      }),
    ]);
    expect(maximumActive).toBe(1);
  });

  it.each([
    'ingestion.provider-authentication',
    'ingestion.provider-authorization',
    'ingestion.provider-rate-limited',
    'ingestion.provider-unavailable',
    'ingestion.deadline-exceeded',
    'ingestion.cancelled',
    'ingestion.provider-response',
    'ingestion.body-too-large',
  ] as const)('does not convert %s into absence', async (code) => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], {
        readmeError: new IngestionError(code),
      }),
    });
    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-1',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toMatchObject({ code });
  });

  it('fails closed for an unsupported repository object algorithm', async () => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], { hashAlgorithm: 'sha256' }),
    });
    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-1',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toMatchObject({
      code: 'ingestion.unsupported-git-object-algorithm',
    });
  });

  it.each([
    ['040000', 'tree'],
    ['120000', 'blob'],
    ['160000', 'commit'],
  ] as const)('rejects unsupported tree object %s/%s', async (mode, type) => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], { treeMode: mode, treeType: type }),
    });
    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-1',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.unsupported-artifact-type' });
  });

  it.each([
    'malformed-base64',
    'noncanonical-base64',
    'size-mismatch',
    'hash-mismatch',
    'invalid-utf8',
    'nul',
  ] as const)('rejects exact-content violation %s', async (contentFault) => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], { contentFault }),
    });
    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-1',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toBeInstanceOf(IngestionError);
  });
});

function artifactBudget() {
  return createArtifactDecodedByteBudget(
    64 * 1_024 * 1_024,
  ).createCandidateScope();
}

function manifestForRoot(): PublicArtifactManifest {
  return {
    artifactManifestVersion: 'public-artifacts-v1',
    catalogVersion: 'public-v1',
    catalogDigest:
      '4819dd943b49c75693e6629c5c005a373d711d341115fd4572bbb4ca01f26c96',
    candidates: [
      {
        candidateId: TEST_CANDIDATE.candidateId,
        selections: [
          {
            selectionId: `selection-${'2'.repeat(48)}`,
            selector: 'root-readme',
            artifactKind: 'readme',
            requirement: 'optional',
          },
        ],
      },
    ],
    manifestDigest:
      '2ba28512832f149a3f4068d789004c07f3d6773ec2cc32859555aac1be3fdc43',
  };
}

function manifestForPath(
  requirement: 'required' | 'optional',
): PublicArtifactManifest {
  return {
    ...manifestForRoot(),
    candidates: [
      {
        candidateId: TEST_CANDIDATE.candidateId,
        selections: [
          {
            selectionId: `selection-${'3'.repeat(48)}`,
            selector: 'path',
            path: 'README.md',
            artifactKind: 'documentation',
            requirement,
            rationale:
              'Synthetic exact-path selection used only for closed provider tests.',
          },
        ],
      },
    ],
  };
}

function providerTransport(
  requests: TransportRequest[],
  options?: {
    readonly readmeError?: IngestionError;
    readonly contentError?: IngestionError;
    readonly hashAlgorithm?: string;
    readonly treeMode?: string;
    readonly treeType?: string;
    readonly contentFault?:
      | 'malformed-base64'
      | 'noncanonical-base64'
      | 'size-mismatch'
      | 'hash-mismatch'
      | 'invalid-utf8'
      | 'nul';
    readonly canonicalOwner?: string;
    readonly canonicalRepository?: string;
    readonly blobObjectMismatch?: boolean;
  },
): ProviderTransport {
  return {
    requestJson: (request) => {
      requests.push(request);
      if (request.operation === 'artifact-readme' && options?.readmeError) {
        return Promise.reject(options.readmeError);
      }
      if (request.operation === 'artifact-content' && options?.contentError) {
        return Promise.reject(options.contentError);
      }
      return Promise.resolve(providerResponse(request, options));
    },
  };
}

function providerResponse(
  request: TransportRequest,
  options?: Parameters<typeof providerTransport>[1],
): JsonResponse {
  const headers = new Headers({ 'content-type': 'application/json' });
  const json = (value: unknown): JsonResponse => ({
    value,
    headers,
    status: 200,
  });
  switch (request.operation) {
    case 'artifact-repository':
      return json({
        id: 123456789,
        name: options?.canonicalRepository ?? 'candidate',
        owner: { login: options?.canonicalOwner ?? 'gitblocks-test' },
        default_branch: 'main',
        private: false,
      });
    case 'artifact-hash-algorithm':
      return json({ hash_algorithm: options?.hashAlgorithm ?? 'sha1' });
    case 'artifact-exact-commit':
      return json({
        sha: COMMIT_SHA,
        commit: { tree: { sha: TREE_SHA } },
      });
    case 'artifact-readme':
    case 'artifact-content':
      return json(contentPayload(options?.contentFault));
    case 'artifact-tree':
      return json({
        sha: TREE_SHA,
        truncated: false,
        tree: [
          {
            path: 'README.md',
            mode: options?.treeMode ?? '100644',
            type: options?.treeType ?? 'blob',
            size: BYTES.byteLength,
            sha: BLOB_SHA,
            url: `https://api.github.com/repos/gitblocks-test/candidate/git/blobs/${BLOB_SHA}`,
          },
        ],
      });
    case 'artifact-blob':
      return json({
        content: encodedContent(options?.contentFault),
        encoding: 'base64',
        size:
          options?.contentFault === 'size-mismatch'
            ? BYTES.byteLength + 1
            : BYTES.byteLength,
        sha:
          options?.contentFault === 'hash-mismatch' ||
          options?.blobObjectMismatch
            ? '4'.repeat(40)
            : BLOB_SHA,
        url: `https://api.github.com/repos/gitblocks-test/candidate/git/blobs/${BLOB_SHA}`,
      });
    default:
      throw new Error('Unexpected synthetic artifact request.');
  }
}

function contentPayload(
  fault:
    | 'malformed-base64'
    | 'noncanonical-base64'
    | 'size-mismatch'
    | 'hash-mismatch'
    | 'invalid-utf8'
    | 'nul'
    | undefined,
): Record<string, unknown> {
  const bytes = faultBytes(fault);
  return {
    type: 'file',
    encoding: 'base64',
    size: fault === 'size-mismatch' ? bytes.byteLength + 1 : bytes.byteLength,
    name: 'README.md',
    path: 'README.md',
    content: encodedContent(fault),
    sha: fault === 'hash-mismatch' ? '4'.repeat(40) : BLOB_SHA,
    git_url: `https://api.github.com/repos/gitblocks-test/candidate/git/blobs/${BLOB_SHA}`,
    html_url: `https://github.com/gitblocks-test/candidate/blob/${COMMIT_SHA}/README.md`,
    download_url: 'https://raw.githubusercontent.com/temporary',
  };
}

function encodedContent(
  fault:
    | 'malformed-base64'
    | 'noncanonical-base64'
    | 'size-mismatch'
    | 'hash-mismatch'
    | 'invalid-utf8'
    | 'nul'
    | undefined,
): string {
  if (fault === 'malformed-base64') {
    return '%%%';
  }
  if (fault === 'noncanonical-base64') {
    return 'AB==';
  }
  return faultBytes(fault).toString('base64');
}

function faultBytes(
  fault:
    | 'malformed-base64'
    | 'noncanonical-base64'
    | 'size-mismatch'
    | 'hash-mismatch'
    | 'invalid-utf8'
    | 'nul'
    | undefined,
): Buffer {
  return fault === 'nul'
    ? Buffer.from('unsafe\0text')
    : fault === 'invalid-utf8'
      ? Buffer.from([0xc3, 0x28])
      : BYTES;
}

function gitBlobSha1(bytes: Buffer): string {
  return createHash('sha1')
    .update(`blob ${String(bytes.byteLength)}\0`)
    .update(bytes)
    .digest('hex');
}
