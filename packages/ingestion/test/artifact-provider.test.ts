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
const PYTHON_MODULES_TREE_SHA = '5'.repeat(40);
const DAGSTER_TREE_SHA = '6'.repeat(40);
const DOCS_TREE_SHA = '8'.repeat(40);
const SYMLINK_TARGET = 'python_modules/dagster/README.md';
const SYMLINK_BYTES = Buffer.from(SYMLINK_TARGET, 'utf8');

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
    expect(
      requests.find(
        (request) => request.operation === 'artifact-default-branch-ref',
      )?.url.pathname,
    ).toBe('/repos/gitblocks-test/candidate/git/ref/heads/main');
    expect(
      requests.find((request) => request.operation === 'artifact-exact-commit')
        ?.url.pathname,
    ).toBe(`/repos/gitblocks-test/candidate/git/commits/${COMMIT_SHA}`);
    expect(
      requests.some(
        (request) =>
          request.url.pathname ===
          '/repos/gitblocks-test/candidate/commits/main',
      ),
    ).toBe(false);
    expect(
      requests
        .filter(({ operation }) =>
          ['artifact-default-branch-ref', 'artifact-exact-commit'].includes(
            operation,
          ),
        )
        .map(({ maximumBytes }) => maximumBytes),
    ).toEqual([256 * 1_024, 256 * 1_024]);
    expect(requests.map((request) => request.operation)).toEqual([
      'artifact-repository',
      'artifact-hash-algorithm',
      'artifact-default-branch-ref',
      'artifact-exact-commit',
      'artifact-readme',
      'artifact-tree',
      'artifact-blob',
    ]);
    expect(decodedByteBudget.operationalDecodedBytes).toBe(
      BYTES.byteLength * 2,
    );
  });

  it('resolves a slash-containing default branch through an exact Git reference', async () => {
    const requests: TransportRequest[] = [];
    const collector = createRepositoryArtifactCollector({
      transport: providerTransport(requests, {
        defaultBranch: 'release/current',
      }),
      githubToken: 'synthetic-token',
    });

    await collector.collectCandidate({
      candidate: TEST_CANDIDATE,
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-1',
      decodedByteBudget: artifactBudget(),
    });

    expect(
      requests.find(
        ({ operation }) => operation === 'artifact-default-branch-ref',
      )?.url.pathname,
    ).toBe('/repos/gitblocks-test/candidate/git/ref/heads/release/current');
  });

  it.each([
    ['a different reference name', { referenceName: 'refs/heads/other' }],
    ['a non-commit reference object', { referenceObjectType: 'tag' }],
    ['a different commit response SHA', { commitResponseSha: '5'.repeat(40) }],
  ] as const)(
    'rejects %s during exact commit resolution',
    async (_, options) => {
      const collector = createRepositoryArtifactCollector({
        transport: providerTransport([], options),
        githubToken: 'synthetic-token',
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
      ).rejects.toMatchObject({ code: 'ingestion.provider-response' });
    },
  );

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
      'artifact-default-branch-ref',
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

  it('resolves one bounded root README symlink to its normal target artifact', async () => {
    const requests: TransportRequest[] = [];
    const budget = createArtifactDecodedByteBudget(64 * 1_024 * 1_024);
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport(requests, { treeMode: '120000' }),
    });

    const publication = await collector.collectCandidate({
      candidate: TEST_CANDIDATE,
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-symlink',
      decodedByteBudget: budget.createCandidateScope(),
    });

    expect(publication.artifacts).toHaveLength(1);
    expect(publication.artifacts[0]?.artifact).toMatchObject({
      path: SYMLINK_TARGET,
      blobObjectId: BLOB_SHA,
      content: CONTENT,
      byteCount: BYTES.byteLength,
      blobApiUrl: `https://api.github.com/repositories/123456789/git/blobs/${BLOB_SHA}`,
      displayUrl: `https://github.com/gitblocks-test/candidate/blob/${COMMIT_SHA}/python_modules/dagster/README.md`,
    });
    expect(publication.artifactSet.entries).toEqual([
      expect.objectContaining({
        selector: 'root-readme',
        requestedPath: null,
        resolvedPath: SYMLINK_TARGET,
        outcome: 'present',
        artifactId: publication.artifacts[0]?.artifact.artifactId,
      }),
    ]);
    expect(
      publication.artifacts.reduce(
        (total, { artifact }) => total + artifact.byteCount,
        0,
      ),
    ).toBe(BYTES.byteLength);
    expect(budget.operationalDecodedBytes).toBe(
      BYTES.byteLength * 2 + SYMLINK_BYTES.byteLength,
    );
    expect(requests.map(({ operation }) => operation)).toEqual([
      'artifact-repository',
      'artifact-hash-algorithm',
      'artifact-default-branch-ref',
      'artifact-exact-commit',
      'artifact-readme',
      'artifact-tree',
      'artifact-symlink-blob',
      'artifact-tree',
      'artifact-tree',
      'artifact-blob',
    ]);
  });

  it('keeps explicit path symlinks unsupported', async () => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], { treeMode: '120000' }),
    });

    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForPath('required'),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-explicit-symlink',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toMatchObject({
      code: 'ingestion.unsupported-artifact-type',
    });
  });

  it('accepts parent operands only when POSIX normalization remains inside the repository', async () => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], {
        treeMode: '120000',
        readmePath: 'docs/README.md',
        symlinkTargetBytes: Buffer.from(`../${SYMLINK_TARGET}`),
      }),
    });

    const publication = await collector.collectCandidate({
      candidate: TEST_CANDIDATE,
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-normalized-symlink',
      decodedByteBudget: artifactBudget(),
    });

    expect(publication.artifacts[0]?.artifact.path).toBe(SYMLINK_TARGET);
    expect(publication.artifactSet.entries[0]).toMatchObject({
      selector: 'root-readme',
      requestedPath: null,
      resolvedPath: SYMLINK_TARGET,
      outcome: 'present',
    });
  });

  it.each([
    ['an empty target', Buffer.alloc(0), 'ingestion.unsupported-artifact-type'],
    [
      'an absolute target',
      Buffer.from('/README.md'),
      'ingestion.unsupported-artifact-type',
    ],
    [
      'a URL-like target',
      Buffer.from('https://example.test/README.md'),
      'ingestion.unsupported-artifact-type',
    ],
    [
      'a backslash target',
      Buffer.from('docs\\README.md'),
      'ingestion.unsupported-artifact-type',
    ],
    [
      'a NUL target',
      Buffer.from('docs/\0README.md'),
      'ingestion.provider-response',
    ],
    [
      'a control-character target',
      Buffer.from('docs/\nREADME.md'),
      'ingestion.unsupported-artifact-type',
    ],
    ['invalid UTF-8', Buffer.from([0xc3, 0x28]), 'ingestion.provider-response'],
    [
      'an overlong target',
      Buffer.from(`${'a'.repeat(513)}.md`),
      'ingestion.body-too-large',
    ],
    [
      'too many normalized path segments',
      Buffer.from('a/b/c/d/e/f/g/h/README.md'),
      'ingestion.unsupported-artifact-type',
    ],
    [
      'a repository escape',
      Buffer.from('../README.md'),
      'ingestion.unsupported-artifact-type',
    ],
    [
      'normalization to the repository root',
      Buffer.from('docs/..'),
      'ingestion.unsupported-artifact-type',
    ],
    [
      'normalization to a parent',
      Buffer.from('..'),
      'ingestion.unsupported-artifact-type',
    ],
  ] as const)(
    'rejects root README symlink with %s',
    async (_, targetBytes, code) => {
      const collector = createRepositoryArtifactCollector({
        githubToken: 'synthetic-token',
        transport: providerTransport([], {
          treeMode: '120000',
          symlinkTargetBytes: targetBytes,
        }),
      });

      await expect(
        collector.collectCandidate({
          candidate: TEST_CANDIDATE,
          manifest: manifestForRoot(),
          collectedAt: '2026-07-29T12:00:00.000Z',
          publishedAt: '2026-07-29T12:01:00.000Z',
          correlationId: 'artifact-run-unsafe-symlink',
          decodedByteBudget: artifactBudget(),
        }),
      ).rejects.toMatchObject({ code });
    },
  );

  it.each([
    ['a dangling target', { targetMissing: true }],
    [
      'a target directory',
      { targetTreeMode: '040000', targetTreeType: 'tree' },
    ],
    [
      'a target submodule',
      { targetTreeMode: '160000', targetTreeType: 'commit' },
    ],
    [
      'target mode 120000',
      { targetTreeMode: '120000', targetTreeType: 'blob' },
    ],
    [
      'a two-hop symlink chain',
      { targetTreeMode: '120000', targetTreeType: 'blob' },
    ],
    [
      'an unsupported file mode',
      { targetTreeMode: '100600', targetTreeType: 'blob' },
    ],
  ] as const)('rejects root README symlink with %s', async (_, fault) => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], { treeMode: '120000', ...fault }),
    });

    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-target-object',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toBeInstanceOf(IngestionError);
  });

  it.each([
    ['target tree SHA disagreement', { targetTreeObjectMismatch: true }],
    ['target blob byte disagreement', { targetBlobBytesMismatch: true }],
    ['symlink blob SHA disagreement', { symlinkBlobObjectMismatch: true }],
    ['target blob SHA disagreement', { blobObjectMismatch: true }],
  ] as const)('rejects root README symlink %s', async (_, fault) => {
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport([], { treeMode: '120000', ...fault }),
    });

    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-symlink-mismatch',
        decodedByteBudget: artifactBudget(),
      }),
    ).rejects.toMatchObject({
      code: 'ingestion.artifact-hash-mismatch',
    });
  });

  it('rejects before decoding a symlink target when the run budget is exhausted', async () => {
    const requests: TransportRequest[] = [];
    const budget = createArtifactDecodedByteBudget(BYTES.byteLength);
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport(requests, { treeMode: '120000' }),
    });

    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-symlink-budget',
        decodedByteBudget: budget.createCandidateScope(),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.body-too-large' });

    expect(budget.operationalDecodedBytes).toBe(BYTES.byteLength);
    expect(requests.at(-1)?.operation).toBe('artifact-symlink-blob');
  });

  it('rejects before decoding the target blob when the remaining run budget is insufficient', async () => {
    const requests: TransportRequest[] = [];
    const budget = createArtifactDecodedByteBudget(
      BYTES.byteLength + SYMLINK_BYTES.byteLength,
    );
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: providerTransport(requests, { treeMode: '120000' }),
    });

    await expect(
      collector.collectCandidate({
        candidate: TEST_CANDIDATE,
        manifest: manifestForRoot(),
        collectedAt: '2026-07-29T12:00:00.000Z',
        publishedAt: '2026-07-29T12:01:00.000Z',
        correlationId: 'artifact-run-target-budget',
        decodedByteBudget: budget.createCandidateScope(),
      }),
    ).rejects.toMatchObject({ code: 'ingestion.body-too-large' });

    expect(budget.operationalDecodedBytes).toBe(
      BYTES.byteLength + SYMLINK_BYTES.byteLength,
    );
    expect(requests.at(-1)?.operation).toBe('artifact-blob');
  });

  it('keeps root README symlink requests serialized, bounded, and non-recursive', async () => {
    const requests: TransportRequest[] = [];
    let active = 0;
    let maximumActive = 0;
    const base = providerTransport(requests, { treeMode: '120000' });
    const collector = createRepositoryArtifactCollector({
      githubToken: 'synthetic-token',
      transport: {
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
      },
    });

    await collector.collectCandidate({
      candidate: TEST_CANDIDATE,
      manifest: manifestForRoot(),
      collectedAt: '2026-07-29T12:00:00.000Z',
      publishedAt: '2026-07-29T12:01:00.000Z',
      correlationId: 'artifact-run-symlink-bounds',
      decodedByteBudget: artifactBudget(),
    });

    expect(maximumActive).toBe(1);
    expect(
      requests
        .filter(({ operation }) =>
          ['artifact-tree', 'artifact-symlink-blob', 'artifact-blob'].includes(
            operation,
          ),
        )
        .every(({ maximumBytes }) => maximumBytes === 512 * 1_024),
    ).toBe(true);
    expect(
      requests
        .filter(({ operation }) => operation === 'artifact-tree')
        .every(({ url }) => !url.searchParams.has('recursive')),
    ).toBe(true);
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
    ['160000', 'commit'],
  ] as const)(
    'rejects unsupported root README tree object %s/%s',
    async (mode, type) => {
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
    },
  );

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
    readonly defaultBranch?: string;
    readonly referenceName?: string;
    readonly referenceObjectType?: string;
    readonly commitResponseSha?: string;
    readonly symlinkTargetBytes?: Buffer;
    readonly targetMissing?: boolean;
    readonly targetTreeMode?: string;
    readonly targetTreeType?: string;
    readonly targetTreeObjectMismatch?: boolean;
    readonly targetBlobBytesMismatch?: boolean;
    readonly symlinkBlobObjectMismatch?: boolean;
    readonly readmePath?: string;
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
        default_branch: options?.defaultBranch ?? 'main',
        private: false,
      });
    case 'artifact-hash-algorithm':
      return json({ hash_algorithm: options?.hashAlgorithm ?? 'sha1' });
    case 'artifact-default-branch-ref':
      return json({
        ref:
          options?.referenceName ??
          `refs/heads/${options?.defaultBranch ?? 'main'}`,
        object: {
          type: options?.referenceObjectType ?? 'commit',
          sha: COMMIT_SHA,
        },
      });
    case 'artifact-exact-commit':
      return json({
        sha: options?.commitResponseSha ?? COMMIT_SHA,
        tree: { sha: TREE_SHA },
      });
    case 'artifact-readme':
      return json(
        contentPayload(
          options?.contentFault,
          options?.readmePath ?? 'README.md',
        ),
      );
    case 'artifact-content':
      return json(contentPayload(options?.contentFault));
    case 'artifact-tree':
      return json(treePayload(request, options));
    case 'artifact-symlink-blob': {
      const symlinkBytes = options?.symlinkTargetBytes ?? SYMLINK_BYTES;
      return json({
        content: symlinkBytes.toString('base64'),
        encoding: 'base64',
        size: symlinkBytes.byteLength,
        sha: options?.symlinkBlobObjectMismatch
          ? '4'.repeat(40)
          : gitBlobSha1(symlinkBytes),
      });
    }
    case 'artifact-blob': {
      const blobBytes = options?.targetBlobBytesMismatch
        ? Buffer.from('different synthetic target\n')
        : faultBytes(options?.contentFault);
      return json({
        content: blobBytes.toString('base64'),
        encoding: 'base64',
        size:
          options?.contentFault === 'size-mismatch'
            ? BYTES.byteLength + 1
            : blobBytes.byteLength,
        sha:
          options?.contentFault === 'hash-mismatch' ||
          options?.blobObjectMismatch
            ? '4'.repeat(40)
            : BLOB_SHA,
        url: `https://api.github.com/repos/gitblocks-test/candidate/git/blobs/${BLOB_SHA}`,
      });
    }
    default:
      throw new Error('Unexpected synthetic artifact request.');
  }
}

function treePayload(
  request: TransportRequest,
  options?: Parameters<typeof providerTransport>[1],
): Record<string, unknown> {
  if (options?.treeMode !== '120000') {
    return {
      sha: TREE_SHA,
      truncated: false,
      tree: [
        treeEntry(
          'README.md',
          options?.treeMode ?? '100644',
          options?.treeType ?? 'blob',
          BLOB_SHA,
          BYTES.byteLength,
        ),
      ],
    };
  }

  const treeObjectId = request.url.pathname.split('/').at(-1);
  if (treeObjectId === TREE_SHA) {
    const aliasPath = options.readmePath ?? 'README.md';
    const aliasEntry =
      aliasPath === 'README.md'
        ? treeEntry(
            'README.md',
            '120000',
            'blob',
            gitBlobSha1(options.symlinkTargetBytes ?? SYMLINK_BYTES),
            (options.symlinkTargetBytes ?? SYMLINK_BYTES).byteLength,
          )
        : treeEntry('docs', '040000', 'tree', DOCS_TREE_SHA);
    return {
      sha: TREE_SHA,
      truncated: false,
      tree: [
        aliasEntry,
        treeEntry('python_modules', '040000', 'tree', PYTHON_MODULES_TREE_SHA),
      ],
    };
  }
  if (treeObjectId === DOCS_TREE_SHA) {
    return {
      sha: DOCS_TREE_SHA,
      truncated: false,
      tree: [
        treeEntry(
          'README.md',
          '120000',
          'blob',
          gitBlobSha1(options.symlinkTargetBytes ?? SYMLINK_BYTES),
          (options.symlinkTargetBytes ?? SYMLINK_BYTES).byteLength,
        ),
      ],
    };
  }
  if (treeObjectId === PYTHON_MODULES_TREE_SHA) {
    return {
      sha: PYTHON_MODULES_TREE_SHA,
      truncated: false,
      tree: [treeEntry('dagster', '040000', 'tree', DAGSTER_TREE_SHA)],
    };
  }
  if (treeObjectId === DAGSTER_TREE_SHA) {
    return {
      sha: DAGSTER_TREE_SHA,
      truncated: false,
      tree: options.targetMissing
        ? []
        : [
            treeEntry(
              'README.md',
              options.targetTreeMode ?? '100644',
              options.targetTreeType ?? 'blob',
              options.targetTreeObjectMismatch ? '7'.repeat(40) : BLOB_SHA,
              BYTES.byteLength,
            ),
          ],
    };
  }
  throw new Error('Unexpected synthetic tree request.');
}

function treeEntry(
  path: string,
  mode: string,
  type: string,
  sha: string,
  size?: number,
): Record<string, unknown> {
  return {
    path,
    mode,
    type,
    sha,
    ...(size === undefined ? {} : { size }),
  };
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
  path = 'README.md',
): Record<string, unknown> {
  const bytes = faultBytes(fault);
  return {
    type: 'file',
    encoding: 'base64',
    size: fault === 'size-mismatch' ? bytes.byteLength + 1 : bytes.byteLength,
    name: 'README.md',
    path,
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
