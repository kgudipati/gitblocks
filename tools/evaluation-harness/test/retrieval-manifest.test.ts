import { readFileSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { RetrievalCorpusManifest } from '../src/retrieval/contracts.ts';
import { loadRetrievalCorpusV1 } from '../src/retrieval/corpus.ts';
import {
  createRetrievalRepositoryFixture,
  mutateRetrievalManifest,
  readFixtureJson,
  writeFixtureJson,
} from './retrieval-test-fixtures.ts';

describe('retrieval manifest closure', () => {
  it('rejects identity, split, ordering, path, and corpus-digest drift', () => {
    const mutations = [
      (manifest: RetrievalCorpusManifest) =>
        ({
          ...manifest,
          corpusId: 'other-corpus',
        }) as unknown as RetrievalCorpusManifest,
      (manifest: RetrievalCorpusManifest) =>
        ({
          ...manifest,
          corpusVersion: 'retrieval-evaluation-corpus/9.9.9',
        }) as unknown as RetrievalCorpusManifest,
      (manifest: RetrievalCorpusManifest) =>
        ({
          ...manifest,
          caseCounts: { normalization: 19, retrieval: 31 },
        }) as unknown as RetrievalCorpusManifest,
      (manifest: RetrievalCorpusManifest) =>
        ({
          ...manifest,
          familyCounts: {
            ...manifest.familyCounts,
            authorization: { normalization: 3, retrieval: 7 },
          },
        }) as unknown as RetrievalCorpusManifest,
      (manifest: RetrievalCorpusManifest) => ({
        ...manifest,
        taxonomyDigest: '0'.repeat(64),
      }),
      (manifest: RetrievalCorpusManifest) => ({
        ...manifest,
        queryInputSchemaDigest: '0'.repeat(64),
      }),
      (manifest: RetrievalCorpusManifest) => ({
        ...manifest,
        profileAuthorityDigest: '0'.repeat(64),
      }),
      (manifest: RetrievalCorpusManifest) => {
        const files = [...manifest.files];
        [files[0], files[1]] = [files[1]!, files[0]!];
        return { ...manifest, files };
      },
      (manifest: RetrievalCorpusManifest) => ({
        ...manifest,
        files: manifest.files.map((entry, index) =>
          index === 0 ? { ...entry, path: '../escape.json' } : entry,
        ),
      }),
      (manifest: RetrievalCorpusManifest) => ({
        ...manifest,
        files: manifest.files.map((entry, index) =>
          index === 1 ? { ...entry, path: manifest.files[0]!.path } : entry,
        ),
      }),
      (manifest: RetrievalCorpusManifest) => ({
        ...manifest,
        files: manifest.files.map((entry) =>
          entry.kind === 'retrieval-query'
            ? {
                ...entry,
                path: `gold/relevance/${entry.caseId ?? 'missing-case'}.json`,
              }
            : entry,
        ),
      }),
    ];
    for (const mutation of mutations) {
      const root = createRetrievalRepositoryFixture();
      mutateRetrievalManifest(root, mutation);
      expect(loadRetrievalCorpusV1(root).ok).toBe(false);
    }

    const root = createRetrievalRepositoryFixture();
    mutateRetrievalManifest(
      root,
      (manifest) => ({ ...manifest, corpusSemanticDigest: '0'.repeat(64) }),
      false,
    );
    expect(loadRetrievalCorpusV1(root).ok).toBe(false);
  }, 60_000);

  it('rejects missing, unlisted, symlinked, and byte-drifted files', () => {
    const missingRoot = createRetrievalRepositoryFixture();
    unlinkSync(
      join(
        missingRoot,
        'evals/retrieval-v1/queries/retrieval/ret-authorization-01.json',
      ),
    );
    expect(loadRetrievalCorpusV1(missingRoot).ok).toBe(false);

    const unlistedRoot = createRetrievalRepositoryFixture();
    writeFixtureJson(
      unlistedRoot,
      'evals/retrieval-v1/queries/retrieval/unlisted.json',
      {},
    );
    expect(loadRetrievalCorpusV1(unlistedRoot).ok).toBe(false);

    const driftRoot = createRetrievalRepositoryFixture();
    const driftPath = join(
      driftRoot,
      'evals/retrieval-v1/queries/retrieval/ret-authorization-01.json',
    );
    writeFileSync(driftPath, `${readFileSync(driftPath, 'utf8')} `, 'utf8');
    expect(loadRetrievalCorpusV1(driftRoot).ok).toBe(false);

    const symlinkRoot = createRetrievalRepositoryFixture();
    const linkPath = join(
      symlinkRoot,
      'evals/retrieval-v1/queries/retrieval/ret-authorization-01.json',
    );
    unlinkSync(linkPath);
    symlinkSync('ret-authorization-02.json', linkPath);
    expect(loadRetrievalCorpusV1(symlinkRoot).ok).toBe(false);
  }, 30_000);

  it('binds manifest case IDs to filenames and exact document-kind counts', () => {
    const root = createRetrievalRepositoryFixture();
    const manifest = readFixtureJson(
      root,
      'evals/retrieval-v1/manifest.json',
    ) as RetrievalCorpusManifest;
    const target = manifest.files.find(
      ({ kind }) => kind === 'normalization-gold',
    )!;
    mutateRetrievalManifest(root, (value) => ({
      ...value,
      files: value.files.map((entry) =>
        entry.path === target.path
          ? { ...entry, caseId: 'wrong-case-id' }
          : entry,
      ),
    }));
    expect(loadRetrievalCorpusV1(root).ok).toBe(false);
  }, 30_000);

  it('rejects missing and candidate-mismatched accepted profiles', () => {
    for (const mutate of [
      (profiles: Record<string, unknown>[]) => profiles.slice(1),
      (profiles: Record<string, unknown>[]) => [
        { ...profiles[0], candidateId: 'profile-owner-mismatch' },
        ...profiles.slice(1),
      ],
    ]) {
      const root = createRetrievalRepositoryFixture();
      const path = 'catalog/public-v1/candidate-profile-authority.json';
      const authority = readFixtureJson(root, path) as Record<string, unknown>;
      writeFixtureJson(root, path, {
        ...authority,
        profiles: mutate(authority['profiles'] as Record<string, unknown>[]),
      });
      expect(loadRetrievalCorpusV1(root).ok).toBe(false);
    }
  }, 30_000);
});
