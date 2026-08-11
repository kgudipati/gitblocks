import { readFile } from 'node:fs/promises';

import { repositoryArtifactGitBlobObjectId } from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  extractRepositoryContainerBuildDeclarationFact,
  parseConservativeDockerfileBuildDeclaration,
  type CandidateAuthorityRootDockerfileInput,
} from '../src/index.ts';

const COMMIT_SHA = '0123456789abcdef0123456789abcdef01234567';
const TREE_SHA = 'fedcba9876543210fedcba9876543210fedcba98';
const IDENTITY = {
  repositoryId: '12345',
  owner: 'example',
  repository: 'tool',
} as const;

describe('exact root Dockerfile source hardening', () => {
  it('emits one deterministic affirmative fact for a simple direct FROM declaration', () => {
    const input = dockerfileInput('FROM node:24-alpine\n');
    const first = extractRepositoryContainerBuildDeclarationFact(input);
    const second = extractRepositoryContainerBuildDeclarationFact(
      structuredClone(input),
    );
    expect(first).toEqual(second);
    expect(first.state).toBe('established-facts');
    if (first.state !== 'established-facts') throw new Error('unreachable');
    expect(first.facts).toHaveLength(1);
    expect(first.facts[0]?.factCode).toBe(
      'repository-container-build-declaration',
    );
    expect(first.facts[0]?.factValue).toMatch(
      /^\{"contentDigest":"[a-f0-9]{64}","path":"Dockerfile"\}$/u,
    );
  });

  it('accepts comments, parser directives, case-insensitive instructions, and global ARG before FROM', () => {
    for (const content of [
      '\n# ordinary comment\nfrom scratch\n',
      '# syntax=docker/dockerfile:1\nFROM alpine:3.20 AS runtime\n',
      '# escape=`\nARG BASE=alpine:3.20\nFrOm alpine:3.20\n',
    ]) {
      expect(parseConservativeDockerfileBuildDeclaration(content)).toBe(true);
      expect(
        extractRepositoryContainerBuildDeclarationFact(dockerfileInput(content))
          .state,
      ).toBe('established-facts');
    }
  });

  it('returns unknown for malformed, absent, interpolated, continued, or missing FROM declarations', () => {
    for (const content of [
      'RUN echo no-stage\n',
      'ARG BASE=alpine\nFROM ${BASE}\n',
      'FROM node:24 \\\n+  AS runtime\n',
      '# comment only\nARG BASE\n',
      'FROM\n',
    ]) {
      expect(
        extractRepositoryContainerBuildDeclarationFact(
          dockerfileInput(content),
        ),
      ).toEqual({
        state: 'unknown',
        reason: 'container-build-declaration-not-established',
      });
    }
  });

  it('treats exact root absence and non-root names as unknown, never negative', () => {
    for (const path of [null, 'docker/Dockerfile']) {
      const input = dockerfileInput('FROM scratch\n');
      const entry = input.rootTreeValue as {
        tree: { path: string }[];
      };
      entry.tree =
        path === null ? [] : entry.tree.map((value) => ({ ...value, path }));
      expect(
        extractRepositoryContainerBuildDeclarationFact({
          ...input,
          blobValue: null,
        }),
      ).toEqual({
        state: 'unknown',
        reason: 'root-dockerfile-absence-is-not-deployment-absence',
      });
    }
  });

  it('rejects repository, commit, root-tree, tree/blob, type, and mode disagreement', () => {
    const valid = dockerfileInput('FROM scratch\n');
    const mutations: CandidateAuthorityRootDockerfileInput[] = [
      {
        ...valid,
        observedRepositoryIdentity: { ...IDENTITY, repository: 'other' },
      },
      { ...valid, observedCommitObjectId: 'a'.repeat(40) },
      { ...valid, expectedRootTreeObjectId: 'b'.repeat(40) },
      mutateEntry(valid, { sha: 'c'.repeat(40) }),
      mutateEntry(valid, { type: 'tree' }),
      mutateEntry(valid, { mode: '120000' }),
    ];
    for (const mutation of mutations) {
      expect(() =>
        extractRepositoryContainerBuildDeclarationFact(mutation),
      ).toThrow();
    }
  });

  it('rejects invalid UTF-8, NUL, and oversized immutable blobs', () => {
    for (const bytes of [
      Buffer.from([0xc3, 0x28]),
      Buffer.from('FROM scratch\0\n', 'utf8'),
      Buffer.alloc(256 * 1_024 + 1, 0x61),
    ]) {
      expect(() =>
        extractRepositoryContainerBuildDeclarationFact(
          dockerfileBytesInput(bytes),
        ),
      ).toThrow();
    }
  });

  it('keeps all Dockerfile bytes inert and imports no execution capability', async () => {
    const hostile = [
      'FROM scratch',
      'RUN node -e "globalThis.__candidateExecuted = true"',
      'CMD ["sh", "-c", "touch /tmp/should-never-exist"]',
      '',
    ].join('\n');
    expect(
      extractRepositoryContainerBuildDeclarationFact(dockerfileInput(hostile))
        .state,
    ).toBe('established-facts');
    const source = await readFile(
      new URL('../src/candidate-authority-dockerfile.ts', import.meta.url),
      'utf8',
    );
    expect(source).not.toMatch(
      /node:child_process|docker[\t ]+build|execFile|spawn\(/u,
    );
  });
});

function dockerfileInput(
  content: string,
): CandidateAuthorityRootDockerfileInput {
  return dockerfileBytesInput(Buffer.from(content, 'utf8'));
}

function dockerfileBytesInput(
  bytes: Buffer,
): CandidateAuthorityRootDockerfileInput {
  const content = bytes.toString('utf8');
  const blobSha = repositoryArtifactGitBlobObjectId('sha1', content);
  return {
    expectedRepositoryIdentity: IDENTITY,
    observedRepositoryIdentity: IDENTITY,
    expectedCommitObjectId: COMMIT_SHA,
    observedCommitObjectId: COMMIT_SHA,
    expectedRootTreeObjectId: TREE_SHA,
    rootTreeValue: {
      sha: TREE_SHA,
      truncated: false,
      tree: [
        {
          path: 'Dockerfile',
          mode: '100644',
          type: 'blob',
          sha: blobSha,
          size: bytes.byteLength,
        },
      ],
    },
    blobOutcome: 'established-value',
    blobValue: {
      sha: blobSha,
      size: bytes.byteLength,
      encoding: 'base64',
      content: bytes.toString('base64'),
    },
  };
}

function mutateEntry(
  input: CandidateAuthorityRootDockerfileInput,
  mutation: Record<string, unknown>,
): CandidateAuthorityRootDockerfileInput {
  const rootTree = structuredClone(input.rootTreeValue) as {
    tree: Record<string, unknown>[];
  };
  const first = rootTree.tree[0];
  if (first === undefined) throw new Error('fixture invariant');
  rootTree.tree[0] = { ...first, ...mutation };
  return { ...input, rootTreeValue: rootTree };
}
