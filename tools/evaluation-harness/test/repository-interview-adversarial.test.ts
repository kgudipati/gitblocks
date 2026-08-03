import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  splitRepositoryArtifactLogicalLines,
} from '@gitblocks/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadRepositoryInterviewEvaluationCorpusV1 } from '../src/repository-interview-evaluation-corpus.ts';
import { createRepositoryInterviewEvaluationSchemaRegistry } from '../src/repository-interview-evaluation-schema-registry.ts';
import { findGitBlocksRoot } from '../src/repository-root.ts';

const root = findGitBlocksRoot(process.cwd());
const topics = [
  'purpose-and-scope',
  'runtime-and-framework',
  'integration-surface',
  'data-and-state',
  'deployment-and-operations',
  'security-and-trust',
  'maintenance-and-support',
  'adoption-and-limitations',
] as const;

interface InterviewsRuntime {
  readonly loadRepositoryInterviewSpecification: (
    path: string,
  ) => Promise<unknown>;
  readonly renderRepositoryInterviewPromptV1: (input: unknown) => {
    readonly ok: boolean;
    readonly value?: {
      readonly instructionText: string;
      readonly evidenceText: string;
    };
  };
  readonly resolveRepositoryInterviewProviderOutputV1: (input: unknown) => {
    readonly ok: boolean;
    readonly issues: readonly { readonly code: string }[];
  };
}

let interviews: InterviewsRuntime;
let specification: unknown;

beforeAll(async () => {
  const moduleUrl = pathToFileURL(
    join(root, 'packages/interviews/src/index.ts'),
  ).href;
  interviews = (await import(moduleUrl)) as InterviewsRuntime;
  specification = await interviews.loadRepositoryInterviewSpecification(
    'interviews/repository/specifications/1.0.0',
  );
});

describe('repository-interview adversarial fixture authority', () => {
  it('contains exactly 12 closed, bounded, synthetic-only fixtures', () => {
    const loaded = loadRepositoryInterviewEvaluationCorpusV1(root);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const registry = createRepositoryInterviewEvaluationSchemaRegistry(root);
    expect(loaded.corpus.adversarialFixtures).toHaveLength(12);
    for (const fixture of loaded.corpus.adversarialFixtures) {
      expect(registry.validate('adversarial-fixture', fixture)).toEqual([]);
      expect(
        fixture.syntheticArtifacts.every(({ artifactAlias }) =>
          /^A[1-4]$/u.test(artifactAlias),
        ),
      ).toBe(true);
    }
  });

  it('renders hostile fixture text only as evidence data through the accepted renderer', () => {
    const loaded = loadRepositoryInterviewEvaluationCorpusV1(root);
    if (!loaded.ok) throw new Error('corpus fixture invalid');
    for (const fixture of loaded.corpus.adversarialFixtures) {
      const context = syntheticArtifactContext(fixture.syntheticArtifacts);
      const rendered = interviews.renderRepositoryInterviewPromptV1({
        ...context,
        specification,
      });
      expect(rendered.ok).toBe(true);
      const evidence = JSON.parse(rendered.value?.evidenceText ?? '{}') as {
        readonly artifacts?: readonly {
          readonly lines?: readonly { readonly text?: string }[];
        }[];
      };
      const visibleLines = (evidence.artifacts ?? []).flatMap(({ lines }) =>
        (lines ?? []).map(({ text }) => text),
      );
      for (const line of fixture.syntheticArtifacts.flatMap(
        ({ lines }) => lines,
      )) {
        expect(rendered.value?.instructionText).not.toContain(line);
        expect(visibleLines).toContain(line);
      }
    }
  });

  it('fails closed on provider-authored trusted identity and unknown alias/range output', () => {
    const context = syntheticContext('line one\nline two');
    const rendered = interviews.renderRepositoryInterviewPromptV1({
      ...context,
      specification,
    });
    if (!rendered.ok || rendered.value === undefined)
      throw new Error('prompt fixture invalid');
    const output = unknownOutput('A1', 1, 1);
    const forged = interviews.resolveRepositoryInterviewProviderOutputV1({
      providerOutput: { ...output, candidateId: 'synthetic-forgery' },
      prompt: rendered.value,
      specification,
    });
    expect(forged.ok).toBe(false);
    const alias = interviews.resolveRepositoryInterviewProviderOutputV1({
      providerOutput: unknownOutput('A2', 1, 1),
      prompt: rendered.value,
      specification,
    });
    expect(alias.ok).toBe(false);
    expect(alias.issues.map(({ code }) => code)).toContain(
      'unknown-artifact-alias',
    );
    const range = interviews.resolveRepositoryInterviewProviderOutputV1({
      providerOutput: unknownOutput('A1', 1, 3),
      prompt: rendered.value,
      specification,
    });
    expect(range.ok).toBe(false);
    expect(range.issues.map(({ code }) => code)).toContain(
      'citation-out-of-range',
    );
  });
});

function syntheticContext(content: string) {
  return syntheticArtifactContext([
    { artifactKind: 'readme', lines: content.split('\n') },
  ]);
}

function syntheticArtifactContext(
  sources: readonly {
    readonly artifactKind: 'documentation' | 'readme';
    readonly lines: readonly string[];
  }[],
) {
  const commit = '1'.repeat(40);
  const artifacts = sources.map((source, index) => {
    const content = source.lines.join('\n');
    const path =
      index === 0 ? 'README.md' : `docs/synthetic-${String(index + 1)}.md`;
    const blob = gitBlobSha1(content);
    return createRepositoryArtifactV1({
      contractVersion: '1.0.0',
      candidateId: 'synthetic-evaluation-candidate',
      provider: 'github',
      providerRepositoryId: '12345',
      gitObjectAlgorithm: 'sha1',
      commitObjectId: commit,
      path,
      blobObjectId: blob,
      blobApiUrl: `https://api.github.com/repositories/12345/git/blobs/${blob}`,
      displayUrl: `https://github.com/synthetic/fixture/blob/${commit}/${path}`,
      mediaType: 'text/plain',
      encoding: 'utf-8',
      contentSha256: sha256(content),
      byteCount: Buffer.byteLength(content),
      lineCount: splitRepositoryArtifactLogicalLines(content).length,
      content,
      firstMaterialization: {
        catalogOwner: 'synthetic',
        catalogRepository: 'fixture',
        providerOwner: 'synthetic',
        providerRepository: 'fixture',
        collectedAt: '2026-07-31T00:00:00.000Z',
      },
    });
  });
  const artifactSet = createRepositoryArtifactSetV1({
    contractVersion: '1.0.0',
    candidateId: 'synthetic-evaluation-candidate',
    catalogVersion: 'public-v1',
    catalogDigest: 'a'.repeat(64),
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: 'b'.repeat(64),
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: '12345',
    providerCanonicalOwner: 'synthetic',
    providerCanonicalRepository: 'fixture',
    gitObjectAlgorithm: 'sha1',
    commitObjectId: commit,
    entries: artifacts.map((artifact, index) => ({
      selectionId: `selection-${String(index + 1).repeat(48)}`,
      ordinal: index,
      selector: index === 0 ? 'root-readme' : 'path',
      artifactKind: sources[index]?.artifactKind ?? 'documentation',
      requirement: index === 0 ? 'optional' : 'required',
      rationale: index === 0 ? null : 'Synthetic evaluation selection.',
      requestedPath: index === 0 ? null : artifact.path,
      resolvedPath: artifact.path,
      outcome: 'present',
      artifactId: artifact.artifactId,
    })),
    publishedAt: '2026-07-31T00:00:01.000Z',
  });
  return { artifactSet, artifacts };
}

function unknownOutput(alias: 'A1' | 'A2', startLine: number, endLine: number) {
  return {
    documentedPositions: [],
    inferences: [],
    limitations: [],
    contradictions: [],
    unknowns: topics.map((topic) => ({
      topic,
      reason: 'insufficient-detail',
      statement: `The supplied artifacts do not establish synthetic ${topic} detail.`,
      partialCitations: [{ artifactAlias: alias, startLine, endLine }],
    })),
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
function gitBlobSha1(value: string): string {
  const bytes = Buffer.from(value, 'utf8');
  return createHash('sha1')
    .update(`blob ${String(bytes.byteLength)}\0`, 'utf8')
    .update(bytes)
    .digest('hex');
}
