import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CAPABILITY_FAMILIES,
  IngestionError,
  artifactManifestWithDigest,
  buildArtifactManifest,
  isSafeArtifactPath,
  parseArtifactSelectionSource,
  parsePublicArtifactManifest,
  parsePublicCatalog,
  selectionId,
  type PublicArtifactManifest,
} from '../src/index.ts';

const catalogPath = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);
const sourcePath = fileURLToPath(
  new URL(
    '../../../catalog/public-v1/artifact-selections.json',
    import.meta.url,
  ),
);
const manifestPath = fileURLToPath(
  new URL('../../../catalog/public-v1/artifact-manifest.json', import.meta.url),
);

describe('public artifact manifest', () => {
  it('binds all 150 catalog candidates to one optional root README attempt', async () => {
    const catalog = parsePublicCatalog(await readFile(catalogPath, 'utf8'));
    const manifest = parsePublicArtifactManifest(
      await readFile(manifestPath, 'utf8'),
      catalog,
    );

    expect(manifest.candidates).toHaveLength(150);
    expect(manifest.catalogDigest).toBe(catalog.manifestDigest);
    expect(manifest.candidates.map(({ candidateId }) => candidateId)).toEqual(
      catalog.candidates.map(({ candidateId }) => candidateId),
    );
    for (const candidate of manifest.candidates) {
      expect(candidate.selections[0]).toMatchObject({
        selector: 'root-readme',
        artifactKind: 'readme',
        requirement: 'optional',
      });
      expect(
        candidate.selections.filter(
          ({ selector }) => selector === 'root-readme',
        ),
      ).toHaveLength(1);
      expect(candidate.selections.length).toBeLessThanOrEqual(4);
    }
  });

  it('contains a reviewable additional-path cohort balanced across families', async () => {
    const catalog = parsePublicCatalog(await readFile(catalogPath, 'utf8'));
    const manifest = parsePublicArtifactManifest(
      await readFile(manifestPath, 'utf8'),
      catalog,
    );
    const additionalCandidates = manifest.candidates.filter(
      ({ selections }) => selections.length > 1,
    );

    expect(additionalCandidates).toHaveLength(30);
    for (const family of CAPABILITY_FAMILIES) {
      const familyIds = new Set(
        catalog.candidates
          .filter(({ primaryCapabilityFamily }) => {
            return primaryCapabilityFamily === family;
          })
          .map(({ candidateId }) => candidateId),
      );
      expect(
        additionalCandidates.filter(({ candidateId }) => {
          return familyIds.has(candidateId);
        }),
      ).toHaveLength(6);
    }

    const additionalSelections = additionalCandidates.flatMap(
      ({ selections }) => selections.slice(1),
    );
    expect(additionalSelections).toHaveLength(30);
    expect(
      additionalSelections.every(
        (selection) =>
          selection.selector === 'path' &&
          selection.artifactKind === 'documentation' &&
          selection.requirement === 'required' &&
          selection.rationale.startsWith('Answers the adoption question ') &&
          selection.rationale.length >= 80,
      ),
    ).toBe(true);
  });

  it('accepts Markdoc as a controlled repository-document extension', () => {
    expect(isSafeArtifactPath('docs/self-hosting/architecture.mdoc')).toBe(
      true,
    );
  });

  it('regenerates exactly from the curator source and catalog', async () => {
    const catalog = parsePublicCatalog(await readFile(catalogPath, 'utf8'));
    const source = parseArtifactSelectionSource(
      await readFile(sourcePath, 'utf8'),
    );
    const generated = buildArtifactManifest(catalog, source);
    const committed = parsePublicArtifactManifest(
      await readFile(manifestPath, 'utf8'),
      catalog,
    );

    expect(generated).toEqual(committed);
  });

  it('rejects missing, unknown, duplicate, and out-of-order candidates', async () => {
    const { catalog, manifest } = await loadManifest();
    const missing = withDigest({
      ...withoutDigest(manifest),
      candidates: manifest.candidates.slice(1),
    });
    expectInvalid(missing, catalog);

    const unknown = withDigest({
      ...withoutDigest(manifest),
      candidates: manifest.candidates.map((candidate, index) =>
        index === 0
          ? { ...candidate, candidateId: 'unknown-candidate' }
          : candidate,
      ),
    });
    expectInvalid(unknown, catalog);

    const duplicate = withDigest({
      ...withoutDigest(manifest),
      candidates: [
        requireCandidate(manifest, 0),
        ...manifest.candidates.slice(0, -1),
      ],
    });
    expectInvalid(duplicate, catalog);

    const reversed = withDigest({
      ...withoutDigest(manifest),
      candidates: [...manifest.candidates].reverse(),
    });
    expectInvalid(reversed, catalog);
  });

  it('rejects missing or duplicate root attempts and excessive selections', async () => {
    const { catalog, manifest } = await loadManifest();
    const first = requireCandidate(manifest, 0);
    expectInvalid(
      replaceCandidate(manifest, 0, {
        ...first,
        selections: first.selections.slice(1),
      }),
      catalog,
    );
    expectInvalid(
      replaceCandidate(manifest, 0, {
        ...first,
        selections: [first.selections[0], first.selections[0]],
      }),
      catalog,
    );

    const extra = pathSelection(first.candidateId, 'docs/extra.md');
    expectInvalid(
      replaceCandidate(manifest, 0, {
        ...first,
        selections: [
          first.selections[0],
          extra,
          pathSelection(first.candidateId, 'docs/extra-2.md'),
          pathSelection(first.candidateId, 'docs/extra-3.md'),
          pathSelection(first.candidateId, 'docs/extra-4.md'),
        ],
      }),
      catalog,
    );
  });

  it('rejects duplicate selections and requested paths', async () => {
    const { catalog, manifest } = await loadManifest();
    const candidate = manifest.candidates.find(
      ({ selections }) => selections.length > 1,
    );
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const index = manifest.candidates.indexOf(candidate);
    const path = candidate.selections[1];
    expect(path?.selector).toBe('path');
    if (path?.selector !== 'path') {
      return;
    }
    expectInvalid(
      replaceCandidate(manifest, index, {
        ...candidate,
        selections: [candidate.selections[0], path, path],
      }),
      catalog,
    );
    const duplicatePath = pathSelection(candidate.candidateId, path.path, {
      artifactKind: 'documentation',
    });
    expectInvalid(
      replaceCandidate(manifest, index, {
        ...candidate,
        selections: [candidate.selections[0], path, duplicatePath],
      }),
      catalog,
    );
  });

  it.each([
    '../README.md',
    'docs\\guide.md',
    '/docs/guide.md',
    'docs/./guide.md',
    'docs/%2e%2e/guide.md',
    'docs/\u0000guide.md',
    'docs/\u202eguide.md',
    'docs/e\u0301.md',
    'a/b/c/d/e/f/g/h/i.md',
    `${'a'.repeat(509)}.md`,
    'docs/guide.exe',
  ])('rejects unsafe path %j', async (unsafePath) => {
    const { catalog, manifest } = await loadManifest();
    const candidate = requireCandidate(manifest, 0);
    expectInvalid(
      replaceCandidate(manifest, 0, {
        ...candidate,
        selections: [
          candidate.selections[0],
          pathSelection(candidate.candidateId, unsafePath),
        ],
      }),
      catalog,
    );
  });

  it('rejects invalid rationale, unsupported kind, and wrong catalog digest', async () => {
    const { catalog, manifest } = await loadManifest();
    const candidate = requireCandidate(manifest, 0);
    const invalidRationale = pathSelection(
      candidate.candidateId,
      'docs/guide.md',
      { rationale: 'too short' },
    );
    expectInvalid(
      replaceCandidate(manifest, 0, {
        ...candidate,
        selections: [candidate.selections[0], invalidRationale],
      }),
      catalog,
    );

    const unsupported = {
      ...pathSelection(candidate.candidateId, 'docs/guide.md'),
      artifactKind: 'source-code',
    };
    expectInvalid(
      replaceCandidate(manifest, 0, {
        ...candidate,
        selections: [candidate.selections[0], unsupported],
      }),
      catalog,
    );

    expectInvalid(
      withDigest({
        ...withoutDigest(manifest),
        catalogDigest: '0'.repeat(64),
      }),
      catalog,
    );
  });

  it('rejects selection ID drift, digest drift, unknown fields, and nondeterministic ordering', async () => {
    const { catalog, manifest } = await loadManifest();
    const candidate = manifest.candidates.find(
      ({ selections }) => selections.length > 1,
    );
    expect(candidate).toBeDefined();
    if (candidate === undefined) {
      return;
    }
    const index = manifest.candidates.indexOf(candidate);
    const selection = candidate.selections[1];
    expect(selection).toBeDefined();
    if (selection === undefined) {
      return;
    }

    expectInvalid(
      replaceCandidate(manifest, index, {
        ...candidate,
        selections: [
          candidate.selections[0],
          { ...selection, selectionId: 'selection-invalid' },
        ],
      }),
      catalog,
    );
    expectInvalid({ ...manifest, manifestDigest: '0'.repeat(64) }, catalog);
    expectInvalid(
      withDigest({
        ...withoutDigest(manifest),
        extra: true,
      } as never),
      catalog,
    );

    const first = requireCandidate(manifest, index);
    if (first.selections.length > 2) {
      expectInvalid(
        replaceCandidate(manifest, index, {
          ...first,
          selections: [
            first.selections[0],
            ...first.selections.slice(1).reverse(),
          ],
        }),
        catalog,
      );
    }
  });

  it('keeps selection IDs deterministic and sensitive to curator semantics', () => {
    const base = {
      candidateId: 'candidate',
      selector: 'path' as const,
      path: 'SECURITY.md',
      artifactKind: 'security-policy' as const,
      requirement: 'required' as const,
      rationale:
        'The security policy records the project-specific vulnerability reporting boundary.',
    };
    expect(selectionId(base)).toBe(selectionId({ ...base }));
    expect(selectionId(base)).not.toBe(
      selectionId({ ...base, artifactKind: 'documentation' }),
    );
    expect(selectionId(base)).not.toBe(
      selectionId({
        ...base,
        rationale:
          'The document is retained as general project documentation for review.',
      }),
    );
  });
});

async function loadManifest(): Promise<{
  readonly catalog: ReturnType<typeof parsePublicCatalog>;
  readonly manifest: PublicArtifactManifest;
}> {
  const catalog = parsePublicCatalog(await readFile(catalogPath, 'utf8'));
  return {
    catalog,
    manifest: parsePublicArtifactManifest(
      await readFile(manifestPath, 'utf8'),
      catalog,
    ),
  };
}

function withoutDigest(
  manifest: PublicArtifactManifest,
): Omit<PublicArtifactManifest, 'manifestDigest'> {
  return {
    artifactManifestVersion: manifest.artifactManifestVersion,
    catalogVersion: manifest.catalogVersion,
    catalogDigest: manifest.catalogDigest,
    candidates: manifest.candidates,
  };
}

function withDigest(
  manifest: Omit<PublicArtifactManifest, 'manifestDigest'>,
): PublicArtifactManifest {
  return artifactManifestWithDigest(manifest);
}

function replaceCandidate(
  manifest: PublicArtifactManifest,
  index: number,
  candidate: unknown,
): PublicArtifactManifest {
  return withDigest({
    ...withoutDigest(manifest),
    candidates: manifest.candidates.map((entry, candidateIndex) =>
      candidateIndex === index ? candidate : entry,
    ) as PublicArtifactManifest['candidates'],
  });
}

function requireCandidate(
  manifest: PublicArtifactManifest,
  index: number,
): PublicArtifactManifest['candidates'][number] {
  const candidate = manifest.candidates[index];
  if (candidate === undefined) {
    throw new Error('Expected manifest candidate.');
  }
  return candidate;
}

function pathSelection(
  candidateId: string,
  path: string,
  overrides: Partial<{
    readonly artifactKind:
      | 'documentation'
      | 'security-policy'
      | 'changelog'
      | 'license'
      | 'contributing';
    readonly requirement: 'required' | 'optional';
    readonly rationale: string;
  }> = {},
) {
  const descriptor = {
    candidateId,
    selector: 'path' as const,
    path,
    artifactKind: overrides.artifactKind ?? ('documentation' as const),
    requirement: overrides.requirement ?? ('required' as const),
    rationale:
      overrides.rationale ??
      'This project-specific document adds reviewed operational detail beyond the root README.',
  };
  return { ...descriptor, selectionId: selectionId(descriptor) };
}

function expectInvalid(
  manifest: unknown,
  catalog: ReturnType<typeof parsePublicCatalog>,
): void {
  expect(() =>
    parsePublicArtifactManifest(JSON.stringify(manifest), catalog),
  ).toThrow(IngestionError);
}
