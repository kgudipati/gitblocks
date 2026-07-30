import { describe, expect, it } from 'vitest';
import {
  createRepositoryArtifactChunkV1,
  createRepositoryArtifactV1,
  repositoryArtifactContentSha256,
  repositoryArtifactGitBlobObjectId,
  repositoryArtifactUtf8ByteLength,
  type RepositoryArtifactV1,
} from '@gitblocks/contracts';

import {
  chunkRepositoryArtifact,
  verifyRepositoryArtifactChunks,
} from '../src/index.ts';

describe('exact-lines-v1 lossless chunking', () => {
  it.each([
    ['', 1],
    ['no final newline', 1],
    ['final newline\n', 2],
    ['a\nb\nc', 3],
    ['a\r\nb\r\nc', 3],
    ['a\rb\rc', 3],
    ['π🙂\n雪\r\nexact', 3],
    ['# Heading\n```\ncode\n```\n', 5],
  ])(
    'reconstructs exact content %# without normalization',
    (content, lines) => {
      const artifact = artifactFor(content, lines);
      const chunks = chunkRepositoryArtifact(artifact);
      expect(verifyRepositoryArtifactChunks(artifact, chunks)).toBe(true);
      expect(
        Buffer.concat(
          chunks.map((chunk) => Buffer.from(chunk.content, 'utf8')),
        ),
      ).toEqual(Buffer.from(content, 'utf8'));
    },
  );

  it('splits a very long line only at UTF-8 boundaries', () => {
    const content = '🙂'.repeat(12_000);
    const artifact = artifactFor(content, 1);
    const chunks = chunkRepositoryArtifact(artifact);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.byteCount <= 16 * 1_024)).toBe(true);
    expect(chunks.every((chunk) => chunk.startLine === 1)).toBe(true);
    expect(chunks.every((chunk) => chunk.endLine === 1)).toBe(true);
    expect(verifyRepositoryArtifactChunks(artifact, chunks)).toBe(true);
  });

  it('honors exact byte, artifact, line, and chunk boundaries', () => {
    const exactChunk = artifactFor('a'.repeat(16 * 1_024), 1);
    expect(chunkRepositoryArtifact(exactChunk)).toHaveLength(1);

    const exactArtifact = artifactFor('b'.repeat(256 * 1_024), 1);
    expect(chunkRepositoryArtifact(exactArtifact)).toHaveLength(16);

    const manyLines = `${'x\n'.repeat(9_999)}x`;
    const lineBounded = chunkRepositoryArtifact(artifactFor(manyLines, 10_000));
    expect(lineBounded).toHaveLength(50);
    expect(
      lineBounded.every((chunk) => chunk.endLine - chunk.startLine + 1 <= 200),
    ).toBe(true);
  });

  it('detects gaps, overlaps, reordering, mutation, and excessive chunk lists', () => {
    const artifact = artifactFor('a'.repeat(20_000), 1);
    const chunks = chunkRepositoryArtifact(artifact);
    expect(chunks).toHaveLength(2);
    expect(
      verifyRepositoryArtifactChunks(artifact, [...chunks].reverse()),
    ).toBe(false);
    expect(
      verifyRepositoryArtifactChunks(artifact, [
        { ...chunks[0]!, endByteExclusive: chunks[0]!.endByteExclusive - 1 },
        chunks[1]!,
      ]),
    ).toBe(false);
    expect(
      verifyRepositoryArtifactChunks(artifact, [
        chunks[0]!,
        { ...chunks[1]!, startByte: chunks[1]!.startByte - 1 },
      ]),
    ).toBe(false);
    expect(
      verifyRepositoryArtifactChunks(
        artifact,
        Array.from({ length: 65 }, () => chunks[0]!),
      ),
    ).toBe(false);
    const wrongLines = createRepositoryArtifactChunkV1({
      contractVersion: chunks[0]!.contractVersion,
      artifactId: chunks[0]!.artifactId,
      candidateId: chunks[0]!.candidateId,
      chunkerVersion: chunks[0]!.chunkerVersion,
      ordinal: chunks[0]!.ordinal,
      startByte: chunks[0]!.startByte,
      endByteExclusive: chunks[0]!.endByteExclusive,
      byteCount: chunks[0]!.byteCount,
      startLine: 2,
      endLine: 2,
      contentSha256: chunks[0]!.contentSha256,
      content: chunks[0]!.content,
    });
    expect(
      verifyRepositoryArtifactChunks(artifact, [wrongLines, chunks[1]!]),
    ).toBe(false);
  });
});

function artifactFor(content: string, lineCount: number): RepositoryArtifactV1 {
  const repositoryId = '123456789';
  const blobObjectId = repositoryArtifactGitBlobObjectId('sha1', content);
  return createRepositoryArtifactV1({
    contractVersion: '1.0.0',
    candidateId: 'audit-pino',
    provider: 'github',
    providerRepositoryId: repositoryId,
    gitObjectAlgorithm: 'sha1',
    commitObjectId: '1'.repeat(40),
    path: 'README.md',
    blobObjectId,
    blobApiUrl: `https://api.github.com/repositories/${repositoryId}/git/blobs/${blobObjectId}`,
    displayUrl: null,
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: repositoryArtifactContentSha256(content),
    byteCount: repositoryArtifactUtf8ByteLength(content),
    lineCount,
    content,
    firstMaterialization: {
      catalogOwner: 'pinojs',
      catalogRepository: 'pino',
      providerOwner: 'pinojs',
      providerRepository: 'pino',
      collectedAt: '2026-07-29T12:00:00.000Z',
    },
  });
}
