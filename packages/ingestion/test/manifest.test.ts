import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_FAMILIES,
  IngestionError,
  manifestWithDigest,
  parsePublicCatalog,
} from '../src/index.ts';

const manifestPath = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);

describe('public catalog manifest', () => {
  it('validates the curated 150-repository catalog and exact family balance', async () => {
    const catalog = parsePublicCatalog(await readFile(manifestPath, 'utf8'));
    expect(catalog.candidates).toHaveLength(150);
    expect(new Set(catalog.candidates.map(repositoryKey)).size).toBe(150);
    for (const family of CAPABILITY_FAMILIES) {
      expect(
        catalog.candidates.filter(
          (candidate) => candidate.primaryCapabilityFamily === family,
        ),
      ).toHaveLength(30);
    }
    expect(
      catalog.candidates.filter(
        (candidate) => candidate.status === 'negative-control',
      ).length,
    ).toBeGreaterThan(0);
  });

  it('rejects digest tampering and unknown fields', async () => {
    const value = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      manifestDigest: string;
      extra?: boolean;
    };
    value.manifestDigest = '0'.repeat(64);
    expect(() => parsePublicCatalog(JSON.stringify(value))).toThrow(
      IngestionError,
    );
    value.extra = true;
    expect(() => parsePublicCatalog(JSON.stringify(value))).toThrow(
      IngestionError,
    );
  });

  it('rejects canonical GitHub/npm duplicates and unapproved paths', async () => {
    const catalog = parsePublicCatalog(await readFile(manifestPath, 'utf8'));
    const [first, second] = catalog.candidates;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (first === undefined || second === undefined) {
      return;
    }
    const duplicateRepository = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: catalog.publishedAt,
      candidates: catalog.candidates.map((candidate, index) =>
        index === 1 ? { ...candidate, github: first.github } : candidate,
      ),
    });
    expect(() =>
      parsePublicCatalog(JSON.stringify(duplicateRepository)),
    ).toThrow(IngestionError);

    const packageCandidate = catalog.candidates.find(
      (candidate) => candidate.npmPackage !== null,
    );
    const anotherPackageCandidate = catalog.candidates.find(
      (candidate) =>
        candidate.npmPackage !== null &&
        candidate.candidateId !== packageCandidate?.candidateId,
    );
    expect(packageCandidate).toBeDefined();
    expect(anotherPackageCandidate).toBeDefined();
    if (
      packageCandidate === undefined ||
      anotherPackageCandidate === undefined
    ) {
      return;
    }
    const duplicatePackage = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: catalog.publishedAt,
      candidates: catalog.candidates.map((candidate) =>
        candidate.candidateId === anotherPackageCandidate.candidateId
          ? { ...candidate, npmPackage: packageCandidate.npmPackage }
          : candidate,
      ),
    });
    expect(() => parsePublicCatalog(JSON.stringify(duplicatePackage))).toThrow(
      IngestionError,
    );

    const invalidPath = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: catalog.publishedAt,
      candidates: catalog.candidates.map((candidate, index) =>
        index === 0
          ? {
              ...candidate,
              allowlistedFiles: ['../package.json'],
              expectedSourceTypes: [
                ...new Set([
                  ...candidate.expectedSourceTypes,
                  'github-file' as const,
                ]),
              ].sort(),
            }
          : candidate,
      ),
    });
    expect(() => parsePublicCatalog(JSON.stringify(invalidPath))).toThrow(
      IngestionError,
    );
  });
});

function repositoryKey(candidate: {
  readonly github: { readonly owner: string; readonly repository: string };
}): string {
  return `${candidate.github.owner}/${candidate.github.repository}`.toLowerCase();
}
