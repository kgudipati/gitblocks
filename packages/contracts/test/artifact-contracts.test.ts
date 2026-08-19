import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CONTRACT_SCHEMA_NAMES,
  createRepositoryArtifactChunkV1,
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  parseRepositoryArtifactChunkV1,
  parseRepositoryArtifactSetV1,
  parseRepositoryArtifactV1,
  serializeContractSchemaV1,
  splitRepositoryArtifactLogicalLines,
  type RepositoryArtifactChunkV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
} from '../src/index.ts';

const PRIOR_SCHEMA_DIGESTS = {
  'candidate-dossier':
    'd16d0424ed45edcf61d8084cbd21ebbb396366522d1b1a425b6cf8405e0680af',
  'capability-request':
    '1ea959ae0cb76608b7d0e8a902b9e508dc381c90c2fe2fd4df561b80d4398003',
  'error-envelope':
    '7a708cc440a7992cb164715dce6029befbe78970c3283d8a1bff9298c87603d0',
  'fit-assessment-request':
    'fcf09c1f5329cbc1660559326d2755d34fdbf1a504595086eb94dc9af57278bb',
  'fit-assessment-response':
    '330b5b3940858428b1881701774bac785a7c93cf2d50e6dcb4ec37091a696a4d',
  'repository-fingerprint':
    '73f42c7a7cd20de24372ecddb7afa33925ca1f4d67cb1f9598cd9d56ea87477c',
} as const;

const CONTENT = '# Héllo\r\nexact bytes\n';
const COMMIT = '1'.repeat(40);
const BLOB = gitBlobSha1(Buffer.from(CONTENT));

function artifactInput(
  overrides: Partial<
    Omit<RepositoryArtifactV1, 'artifactId' | 'identityDigest' | 'recordDigest'>
  > = {},
): Omit<
  RepositoryArtifactV1,
  'artifactId' | 'identityDigest' | 'recordDigest'
> {
  return {
    contractVersion: '1.0.0',
    candidateId: 'audit-pino',
    provider: 'github',
    providerRepositoryId: '123456789012345678',
    gitObjectAlgorithm: 'sha1',
    commitObjectId: COMMIT,
    path: 'README.md',
    blobObjectId: BLOB,
    blobApiUrl:
      'https://api.github.com/repositories/123456789012345678/git/blobs/' +
      BLOB,
    displayUrl: 'https://github.com/pinojs/pino/blob/' + COMMIT + '/README.md',
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: sha256(CONTENT),
    byteCount: Buffer.byteLength(CONTENT),
    lineCount: 3,
    content: CONTENT,
    firstMaterialization: {
      catalogOwner: 'pinojs',
      catalogRepository: 'pino',
      providerOwner: 'pinojs',
      providerRepository: 'pino',
      collectedAt: '2026-07-29T12:00:00.000Z',
    },
    ...overrides,
  };
}

function chunkInput(
  artifact: RepositoryArtifactV1,
  overrides: Partial<
    Omit<
      RepositoryArtifactChunkV1,
      'chunkId' | 'identityDigest' | 'recordDigest'
    >
  > = {},
): Omit<
  RepositoryArtifactChunkV1,
  'chunkId' | 'identityDigest' | 'recordDigest'
> {
  return {
    contractVersion: '1.0.0',
    artifactId: artifact.artifactId,
    candidateId: artifact.candidateId,
    chunkerVersion: 'exact-lines-v1',
    ordinal: 0,
    startByte: 0,
    endByteExclusive: artifact.byteCount,
    byteCount: artifact.byteCount,
    startLine: 1,
    endLine: 3,
    contentSha256: artifact.contentSha256,
    content: artifact.content,
    ...overrides,
  };
}

function setInput(
  artifact: RepositoryArtifactV1,
  overrides: Partial<
    Omit<
      RepositoryArtifactSetV1,
      'artifactSetId' | 'identityDigest' | 'recordDigest'
    >
  > = {},
): Omit<
  RepositoryArtifactSetV1,
  'artifactSetId' | 'identityDigest' | 'recordDigest'
> {
  return {
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
    providerRepositoryId: artifact.providerRepositoryId,
    providerCanonicalOwner: 'pinojs',
    providerCanonicalRepository: 'pino',
    gitObjectAlgorithm: 'sha1',
    commitObjectId: artifact.commitObjectId,
    entries: [
      {
        selectionId: 'selection-' + '2'.repeat(48),
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
    publishedAt: '2026-07-29T12:01:00.000Z',
    ...overrides,
  };
}

describe('immutable repository artifact contracts', () => {
  it.each([
    ['alpha', ['alpha']],
    ['alpha\nbeta', ['alpha', 'beta']],
    ['alpha\r\nbeta', ['alpha', 'beta']],
    ['alpha\rbeta', ['alpha', 'beta']],
    ['alpha\n', ['alpha', '']],
    ['\n', ['', '']],
    ['', ['']],
    ['\ralpha\n\nbeta\r\n', ['', 'alpha', '', 'beta', '']],
  ])('shares exact logical-line semantics for %j', (content, expected) => {
    expect(splitRepositoryArtifactLogicalLines(content)).toEqual(expected);
  });

  it('makes the shared logical-line helper agree with artifact lineCount', () => {
    for (const content of [
      'alpha',
      'alpha\nbeta',
      'alpha\r\nbeta',
      'alpha\rbeta',
      'alpha\n',
      '\n',
      '',
      '\ralpha\n\nbeta\r\n',
    ]) {
      const artifact = createRepositoryArtifactV1(
        artifactInput({
          content,
          contentSha256: sha256(content),
          byteCount: Buffer.byteLength(content),
          lineCount: splitRepositoryArtifactLogicalLines(content).length,
          blobObjectId: gitBlobSha1(Buffer.from(content)),
          blobApiUrl:
            'https://api.github.com/repositories/123456789012345678/git/blobs/' +
            gitBlobSha1(Buffer.from(content)),
        }),
      );
      expect(parseRepositoryArtifactV1(artifact)).toMatchObject({ ok: true });
      expect(
        splitRepositoryArtifactLogicalLines(artifact.content),
      ).toHaveLength(artifact.lineCount);
    }
  });

  it('rejects invalid Unicode instead of replacing it while splitting lines', () => {
    expect(() => splitRepositoryArtifactLogicalLines('\ud800')).toThrow(
      /invalid Unicode/u,
    );
  });

  it('adds three closed schema roots without changing the six accepted roots', () => {
    expect(CONTRACT_SCHEMA_NAMES).toContain('repository-artifact');
    expect(CONTRACT_SCHEMA_NAMES).toContain('repository-artifact-chunk');
    expect(CONTRACT_SCHEMA_NAMES).toContain('repository-artifact-set');

    for (const [name, expected] of Object.entries(PRIOR_SCHEMA_DIGESTS)) {
      expect(
        createHash('sha256')
          .update(
            serializeContractSchemaV1(
              name as keyof typeof PRIOR_SCHEMA_DIGESTS,
            ),
          )
          .digest('hex'),
      ).toBe(expected);
    }
  });

  it('creates and parses exact Unicode and line-ending preserving records', () => {
    const artifact = createRepositoryArtifactV1(artifactInput());
    const chunk = createRepositoryArtifactChunkV1(chunkInput(artifact));
    const set = createRepositoryArtifactSetV1(setInput(artifact));

    expect(parseRepositoryArtifactV1(artifact)).toMatchObject({ ok: true });
    expect(parseRepositoryArtifactChunkV1(chunk)).toMatchObject({ ok: true });
    expect(parseRepositoryArtifactSetV1(set)).toMatchObject({ ok: true });
    expect(artifact.content).toBe(CONTENT);
    expect(Buffer.from(artifact.content)).toEqual(Buffer.from(CONTENT));
    expect(artifact.artifactId).toHaveLength(57);
    expect(chunk.chunkId).toHaveLength(54);
    expect(set.artifactSetId).toHaveLength(61);
  });

  it('rejects additional fields, unsupported algorithms, and byte-bound violations', () => {
    const artifact = createRepositoryArtifactV1(artifactInput());
    expect(
      parseRepositoryArtifactV1({ ...artifact, injected: true }),
    ).toMatchObject({
      ok: false,
      issues: [{ code: 'contract.additional-property' }],
    });
    expect(
      parseRepositoryArtifactV1({
        ...artifact,
        gitObjectAlgorithm: 'sha256',
        commitObjectId: '1'.repeat(64),
        blobObjectId: '2'.repeat(64),
      }),
    ).toMatchObject({ ok: false });

    const overArtifact = {
      ...artifact,
      content: 'a'.repeat(256 * 1_024 + 1),
      byteCount: 256 * 1_024 + 1,
    };
    expect(parseRepositoryArtifactV1(overArtifact)).toMatchObject({
      ok: false,
    });
    const chunk = createRepositoryArtifactChunkV1(chunkInput(artifact));
    expect(
      parseRepositoryArtifactChunkV1({
        ...chunk,
        content: 'a'.repeat(16 * 1_024 + 1),
        byteCount: 16 * 1_024 + 1,
        endByteExclusive: 16 * 1_024 + 1,
      }),
    ).toMatchObject({ ok: false });
  });

  it('accepts exact hard boundaries without widening unrelated preflight', () => {
    const exactArtifactContent = 'a'.repeat(256 * 1_024);
    const exactArtifact = createRepositoryArtifactV1(
      artifactInput({
        content: exactArtifactContent,
        byteCount: 256 * 1_024,
        lineCount: 1,
        contentSha256: sha256(exactArtifactContent),
        blobObjectId: gitBlobSha1(Buffer.from(exactArtifactContent)),
        blobApiUrl:
          'https://api.github.com/repositories/123456789012345678/git/blobs/' +
          gitBlobSha1(Buffer.from(exactArtifactContent)),
      }),
    );
    expect(parseRepositoryArtifactV1(exactArtifact)).toMatchObject({
      ok: true,
    });

    const exactChunkContent = 'b'.repeat(16 * 1_024);
    const exactChunk = createRepositoryArtifactChunkV1(
      chunkInput(exactArtifact, {
        endByteExclusive: 16 * 1_024,
        byteCount: 16 * 1_024,
        endLine: 1,
        contentSha256: sha256(exactChunkContent),
        content: exactChunkContent,
      }),
    );
    expect(parseRepositoryArtifactChunkV1(exactChunk)).toMatchObject({
      ok: true,
    });
  });

  it('accepts only a display URL derived from first materialization, commit, and path', () => {
    const arbitrary = createRepositoryArtifactV1(
      artifactInput({
        displayUrl: 'https://example.com/unrelated',
      }),
    );
    expect(parseRepositoryArtifactV1(arbitrary)).toMatchObject({ ok: false });

    const mutable = createRepositoryArtifactV1(
      artifactInput({
        displayUrl:
          'https://github.com/pinojs/pino/blob/' +
          COMMIT +
          '/README.md?download=1',
      }),
    );
    expect(parseRepositoryArtifactV1(mutable)).toMatchObject({ ok: false });
  });

  it('keeps source identity stable across repository moves and curator reclassification', () => {
    const original = createRepositoryArtifactV1(artifactInput());
    const moved = createRepositoryArtifactV1(
      artifactInput({
        displayUrl:
          'https://github.com/new-owner/new-name/blob/' + COMMIT + '/README.md',
        firstMaterialization: {
          catalogOwner: 'old-owner',
          catalogRepository: 'old-name',
          providerOwner: 'new-owner',
          providerRepository: 'new-name',
          collectedAt: '2026-07-29T13:00:00.000Z',
        },
      }),
    );
    expect(moved.artifactId).toBe(original.artifactId);
    expect(moved.identityDigest).toBe(original.identityDigest);
    expect(moved.recordDigest).not.toBe(original.recordDigest);

    const readmeSet = createRepositoryArtifactSetV1(setInput(original));
    const rootEntry = setInput(original).entries[0];
    if (rootEntry?.outcome !== 'present') {
      throw new Error('Expected a present synthetic root entry.');
    }
    const reclassifiedSet = createRepositoryArtifactSetV1(
      setInput(original, {
        entries: [
          {
            ...rootEntry,
            artifactKind: 'contributing',
            selector: 'path',
            requirement: 'required',
            rationale: 'Curated contributor workflow.',
            requestedPath: 'README.md',
          },
        ],
      }),
    );
    expect(readmeSet.entries[0]?.artifactId).toBe(
      reclassifiedSet.entries[0]?.artifactId,
    );
    expect(readmeSet.artifactSetId).not.toBe(reclassifiedSet.artifactSetId);
  });

  it('excludes publication time from set identity but includes it in the record digest', () => {
    const artifact = createRepositoryArtifactV1(artifactInput());
    const first = createRepositoryArtifactSetV1(setInput(artifact));
    const later = createRepositoryArtifactSetV1(
      setInput(artifact, { publishedAt: '2026-07-29T14:00:00.000Z' }),
    );
    expect(later.artifactSetId).toBe(first.artifactSetId);
    expect(later.identityDigest).toBe(first.identityDigest);
    expect(later.recordDigest).not.toBe(first.recordDigest);
  });

  it('rejects identity, complete-record, content, and count mismatches', () => {
    const artifact = createRepositoryArtifactV1(artifactInput());
    const mutations: RepositoryArtifactV1[] = [
      { ...artifact, artifactId: 'artifact-' + '0'.repeat(48) },
      { ...artifact, identityDigest: '0'.repeat(64) },
      { ...artifact, recordDigest: '0'.repeat(64) },
      { ...artifact, byteCount: artifact.byteCount + 1 },
      { ...artifact, lineCount: artifact.lineCount + 1 },
      { ...artifact, contentSha256: '0'.repeat(64) },
    ];
    for (const mutation of mutations) {
      expect(parseRepositoryArtifactV1(mutation)).toMatchObject({ ok: false });
    }
  });

  it('makes every non-digest record field participate in complete digests', () => {
    const artifact = createRepositoryArtifactV1(artifactInput());
    const mutable = structuredClone(artifact) as Record<string, unknown>;
    for (const key of Object.keys(mutable)) {
      if (key === 'recordDigest') {
        continue;
      }
      const changed = structuredClone(mutable);
      changed[key] = mutate(changed[key]);
      expect(parseRepositoryArtifactV1(changed)).toMatchObject({ ok: false });
    }

    const chunk = createRepositoryArtifactChunkV1(chunkInput(artifact));
    const set = createRepositoryArtifactSetV1(setInput(artifact));
    expect(
      parseRepositoryArtifactChunkV1({
        ...chunk,
        recordDigest: '0'.repeat(64),
      }),
    ).toMatchObject({ ok: false });
    expect(
      parseRepositoryArtifactSetV1({ ...set, recordDigest: '0'.repeat(64) }),
    ).toMatchObject({ ok: false });
  });
});

function mutate(value: unknown): unknown {
  if (typeof value === 'string') {
    return `${value}x`;
  }
  if (typeof value === 'number') {
    return value + 1;
  }
  if (value === null) {
    return 'changed';
  }
  if (typeof value === 'object') {
    return { ...(value as Record<string, unknown>), changed: true };
  }
  return null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function gitBlobSha1(bytes: Buffer): string {
  return createHash('sha1')
    .update(`blob ${String(bytes.byteLength)}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}
