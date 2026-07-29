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
const sourcePath = fileURLToPath(
  new URL('../../../catalog/public-v1/candidates.json', import.meta.url),
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
    ).toBe(44);
    expect(
      catalog.candidates.filter(
        (candidate) => candidate.allowlistedFiles.length > 0,
      ),
    ).toHaveLength(51);
    expect(
      new Set(catalog.candidates.map((candidate) => candidate.rationale)).size,
    ).toBe(150);
    expect(
      catalog.candidates.find(
        (candidate) => candidate.candidateId === 'audit-winston-logform',
      ),
    ).toMatchObject({
      status: 'negative-control',
      allowlistedFiles: [],
    });
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

  it('requires candidate-specific rationale and classification evidence', async () => {
    const catalog = parsePublicCatalog(await readFile(manifestPath, 'utf8'));
    const genericRationale = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: catalog.publishedAt,
      candidates: catalog.candidates.map((candidate, index) =>
        index === 0
          ? {
              ...candidate,
              rationale:
                'Curated public authorization candidate spanning the V1 mix of libraries, integrations, and self-hostable services.',
            }
          : candidate,
      ),
    });
    expect(() => parsePublicCatalog(JSON.stringify(genericRationale))).toThrow(
      IngestionError,
    );

    const generatedTemplate = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: catalog.publishedAt,
      candidates: catalog.candidates.map((candidate, index) =>
        index === 0
          ? {
              ...candidate,
              rationale: `${candidate.displayName} is relevant to authorization because its official project material describes policy, permission, role, or access decisions.`,
            }
          : candidate,
      ),
    });
    expect(() => parsePublicCatalog(JSON.stringify(generatedTemplate))).toThrow(
      IngestionError,
    );

    const genericHomepage = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: catalog.publishedAt,
      candidates: catalog.candidates.map((candidate, index) =>
        index === 0
          ? {
              ...candidate,
              selectionSources: [
                `https://github.com/${candidate.github.owner}/${candidate.github.repository}`,
              ],
            }
          : candidate,
      ),
    });
    expect(() => parsePublicCatalog(JSON.stringify(genericHomepage))).toThrow(
      IngestionError,
    );
  });

  it('keeps every curator decision explicit in the source catalog', async () => {
    const source = JSON.parse(await readFile(sourcePath, 'utf8')) as unknown[];
    expect(source).toHaveLength(150);
    const requiredKeys = [
      'additionalCapabilityFamilies',
      'allowlistedFiles',
      'candidateId',
      'displayName',
      'expectedSourceTypes',
      'github',
      'introducedAt',
      'npmPackage',
      'primaryCapabilityFamily',
      'rationale',
      'selectionSources',
      'status',
    ];
    for (const candidate of source) {
      expect(Object.keys(candidate as object).sort()).toEqual(requiredKeys);
      expect((candidate as { rationale: string }).rationale).not.toMatch(
        /spanning the V1 mix|curated public candidate|official project material describes/iu,
      );
    }
  });

  it('treats publication time and introduction time as independent digest inputs', async () => {
    const catalog = parsePublicCatalog(await readFile(manifestPath, 'utf8'));
    const later = manifestWithDigest({
      catalogVersion: 'public-v1',
      publishedAt: '2026-08-29T00:00:00.000Z',
      candidates: catalog.candidates,
    });
    const parsed = parsePublicCatalog(JSON.stringify(later));
    expect(parsed.manifestDigest).not.toBe(catalog.manifestDigest);
    expect(
      parsed.candidates.map((candidate) => candidate.introducedAt),
    ).toEqual(catalog.candidates.map((candidate) => candidate.introducedAt));
  });
});

function repositoryKey(candidate: {
  readonly github: { readonly owner: string; readonly repository: string };
}): string {
  return `${candidate.github.owner}/${candidate.github.repository}`.toLowerCase();
}
