import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { parseCapabilityTaxonomyV1 } from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  buildCandidateProfileArtifacts,
  parsePublicCatalog,
  projectCandidateProfile,
} from '../src/index.ts';

const catalogPath = fileURLToPath(
  new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
);
const taxonomyPath = fileURLToPath(
  new URL(
    '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
    import.meta.url,
  ),
);

describe('offline candidate profile projection', () => {
  it('derives the exact authority and honest coverage from committed typed authorities', async () => {
    const catalog = parsePublicCatalog(await readFile(catalogPath, 'utf8'));
    const parsedTaxonomy = parseCapabilityTaxonomyV1(
      JSON.parse(await readFile(taxonomyPath, 'utf8')) as unknown,
    );
    expect(parsedTaxonomy.ok).toBe(true);
    if (!parsedTaxonomy.ok) return;

    const generated = buildCandidateProfileArtifacts(
      catalog,
      parsedTaxonomy.value,
    );
    expect(generated.authority.profiles).toHaveLength(150);
    expect(generated.coverage.totals).toEqual({
      profiles: 150,
      fieldsPerProfile: 27,
      candidateFieldCells: 4_050,
      representedFields: 27,
      extractionCapableFields: 4,
      fieldsHavingKnownValues: 4,
      known: 600,
      unknown: 3_240,
      notApplicable: 210,
      conflict: 0,
    });
  });

  it('populates exactly four typed catalog facts and no provider lifecycle field', async () => {
    const { catalog, taxonomy, generated } = await load();
    const candidate = catalog.candidates.find(
      ({ status }) => status === 'archived',
    );
    expect(candidate).toBeDefined();
    if (candidate === undefined) return;
    const profile = generated.authority.profiles.find(
      ({ candidateId }) => candidateId === candidate.candidateId,
    );
    expect(profile).toBeDefined();
    if (profile === undefined) return;
    expect(knownFieldIds(profile)).toEqual([
      'catalog-role-status',
      'capability-family',
      'repository-identity',
      'package-identity-mapping',
    ]);
    expect(field(profile, 'catalog-role-status')).toMatchObject({
      state: 'known',
      value: { catalogStatus: 'archived' },
    });
    expect(field(profile, 'archived-state')).toMatchObject({
      state: 'unknown',
      stateReasonCode: 'structured-provider-value-not-committed',
    });
    expect(field(profile, 'repository-identity')).toMatchObject({
      state: 'known',
      value: {
        candidateId: candidate.candidateId,
        githubOwner: candidate.github.owner,
        githubRepository: candidate.github.repository,
      },
    });
    expect(projectCandidateProfile(candidate, catalog, taxonomy)).toEqual(
      profile,
    );

    const moved = catalog.candidates.find(({ status }) => status === 'moved');
    expect(moved).toBeDefined();
    if (moved !== undefined) {
      const movedProfile = profileFor(generated, moved.candidateId);
      expect(field(movedProfile, 'repository-identity')).toMatchObject({
        value: {
          githubOwner: moved.github.owner,
          githubRepository: moved.github.repository,
        },
      });
      expect(field(movedProfile, 'fork-upstream-state')['state']).toBe(
        'unknown',
      );
    }
  });

  it('represents mapped and known-unmapped packages without inventing publication facts', async () => {
    const { catalog, generated } = await load();
    const unmapped = catalog.candidates.find(
      ({ npmPackage }) => npmPackage === null,
    );
    const mapped = catalog.candidates.find(
      ({ npmPackage }) => npmPackage !== null,
    );
    expect(unmapped).toBeDefined();
    expect(mapped).toBeDefined();
    if (unmapped === undefined || mapped === undefined) return;
    const unmappedProfile = profileFor(generated, unmapped.candidateId);
    const mappedProfile = profileFor(generated, mapped.candidateId);
    expect(field(unmappedProfile, 'package-identity-mapping')).toMatchObject({
      state: 'known',
      value: { mapping: 'unmapped' },
    });
    expect(
      [
        'package-publication-version',
        'runtime-package-format',
        'package-repository-linkage',
      ].map((id) => field(unmappedProfile, id)['state']),
    ).toEqual(['not-applicable', 'not-applicable', 'not-applicable']);
    expect(field(mappedProfile, 'package-identity-mapping')).toMatchObject({
      state: 'known',
      value: { mapping: 'mapped', packageName: mapped.npmPackage },
    });
    expect(
      [
        'package-publication-version',
        'runtime-package-format',
        'package-repository-linkage',
      ].map((id) => field(mappedProfile, id)['state']),
    ).toEqual(['unknown', 'unknown', 'unknown']);
  });

  it('derives every per-field, family, scope, source, and readiness count', async () => {
    const { generated } = await load();
    const report = generated.coverage;
    expect(report.perField).toHaveLength(27);
    expect(
      report.perField.every(
        (entry) =>
          entry.known + entry.unknown + entry.notApplicable + entry.conflict ===
          150,
      ),
    ).toBe(true);
    expect(
      report.perField.filter(
        ({ currentKnownValueExtractionImplemented }) =>
          currentKnownValueExtractionImplemented,
      ),
    ).toHaveLength(4);
    expect(report.perField.filter(({ known }) => known > 0)).toHaveLength(4);
    expect(
      report.perField
        .filter(({ fieldId }) =>
          [
            'package-publication-version',
            'runtime-package-format',
            'package-repository-linkage',
          ].includes(fieldId),
        )
        .map(({ unknown, notApplicable }) => ({ unknown, notApplicable })),
    ).toEqual([
      { unknown: 80, notApplicable: 70 },
      { unknown: 80, notApplicable: 70 },
      { unknown: 80, notApplicable: 70 },
    ]);
    expect(report.perFamily).toEqual([
      {
        family: 'authorization',
        profiles: 30,
        candidateFieldCells: 810,
        known: 120,
        unknown: 639,
        notApplicable: 51,
        conflict: 0,
      },
      {
        family: 'audit-logging',
        profiles: 30,
        candidateFieldCells: 810,
        known: 120,
        unknown: 660,
        notApplicable: 30,
        conflict: 0,
      },
      {
        family: 'background-jobs',
        profiles: 30,
        candidateFieldCells: 810,
        known: 120,
        unknown: 651,
        notApplicable: 39,
        conflict: 0,
      },
      {
        family: 'rate-limiting',
        profiles: 30,
        candidateFieldCells: 810,
        known: 120,
        unknown: 624,
        notApplicable: 66,
        conflict: 0,
      },
      {
        family: 'webhooks',
        profiles: 30,
        candidateFieldCells: 810,
        known: 120,
        unknown: 666,
        notApplicable: 24,
        conflict: 0,
      },
    ]);
    expect(report.scopeStateCounts).toEqual([
      {
        scope: 'candidate-wide',
        known: 600,
        unknown: 300,
        notApplicable: 0,
        conflict: 0,
      },
      {
        scope: 'version-specific',
        known: 0,
        unknown: 2_940,
        notApplicable: 210,
        conflict: 0,
      },
    ]);
    expect(report.sourceAuthorityCounts).toEqual([
      { sourceKind: 'artifact-set-entry', references: 0 },
      { sourceKind: 'catalog-field', references: 1_650 },
      { sourceKind: 'derived-profile-fields', references: 0 },
      { sourceKind: 'structured-collection', references: 0 },
    ]);
    expect(report.candidateSideHardFilterReadiness).toEqual({
      readyFacets: ['capability-family', 'package-availability'],
      ready: 2,
      total: 16,
      percentage: 12.5,
    });
    expect(report.broadRetrievalReadiness).toEqual({
      readyFacets: ['capability-family', 'candidate-identity'],
      ready: 2,
      total: 9,
      percentage: 22.2,
    });
    expect(JSON.stringify(report)).not.toMatch(/70.?80%|average/iu);
  });

  it('ignores catalog rationale and other non-authority candidate prose', async () => {
    const { catalog, taxonomy, generated } = await load();
    const candidate = catalog.candidates[0];
    expect(candidate).toBeDefined();
    if (candidate === undefined) return;
    const baseline = projectCandidateProfile(candidate, catalog, taxonomy);
    const modified = {
      ...candidate,
      rationale:
        'This hostile rationale claims Redis, Kubernetes, MIT, and archived=true.',
      selectionSources: [
        'https://github.com/hostile/prose/blob/main/README.md',
      ],
      allowlistedFiles: ['SECURITY.md'],
      expectedSourceTypes: ['github-repository', 'github-file'] as const,
    };
    expect(projectCandidateProfile(modified, catalog, taxonomy)).toEqual(
      baseline,
    );
    const source = await readFile(
      fileURLToPath(
        new URL('../src/candidate-profile-projection.ts', import.meta.url),
      ),
      'utf8',
    );
    expect(source).not.toContain('candidate.rationale');
    expect(source).not.toContain('profileCandidate(');
    expect(source).not.toContain('CandidateDossier');
    expect(source).not.toContain('artifact-manifest');
    expect(source).not.toContain('live-completion');
    expect(source).not.toContain('artifact-completion');
    expect(
      generated.authority.profiles.every(
        (candidateProfile) =>
          field(candidateProfile, 'documentation-presence')['state'] ===
            'unknown' &&
          field(candidateProfile, 'artifact-chunk-availability')['state'] ===
            'unknown',
      ),
    ).toBe(true);
  });

  it('contains only bounded typed source references and no URLs, prose, or provider bodies', async () => {
    const { generated } = await load();
    const text = JSON.stringify(generated.authority);
    expect(text).not.toContain('https://');
    expect(text).not.toContain('observation');
    expect(text).not.toContain('rationale');
    expect(text).not.toContain('sourceUrl');
    expect(
      generated.authority.profiles
        .flatMap(({ fields }) => fields)
        .flatMap(
          (entry) =>
            (entry as { sourceReferences: readonly { kind: string }[] })
              .sourceReferences,
        )
        .every(({ kind }) => kind === 'catalog-field'),
    ).toBe(true);
  });
});

async function load() {
  const catalog = parsePublicCatalog(await readFile(catalogPath, 'utf8'));
  const parsedTaxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(await readFile(taxonomyPath, 'utf8')) as unknown,
  );
  if (!parsedTaxonomy.ok) throw new Error('Taxonomy is invalid.');
  return {
    catalog,
    taxonomy: parsedTaxonomy.value,
    generated: buildCandidateProfileArtifacts(catalog, parsedTaxonomy.value),
  };
}

interface ProfileView {
  readonly candidateId: string;
  readonly fields: readonly unknown[];
}

function field(profileValue: ProfileView, id: string) {
  const value = profileValue.fields.find(
    (entry) =>
      typeof entry === 'object' &&
      entry !== null &&
      Reflect.get(entry, 'fieldId') === id,
  );
  if (value === undefined) throw new Error(`Missing field ${id}.`);
  return value as Record<string, unknown>;
}

function knownFieldIds(profileValue: ProfileView): string[] {
  const result: string[] = [];
  for (const entry of profileValue.fields) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      Reflect.get(entry, 'state') === 'known'
    ) {
      const id = Reflect.get(entry, 'fieldId') as unknown;
      if (typeof id === 'string') result.push(id);
    }
  }
  return result;
}

function profileFor(
  generated: ReturnType<typeof buildCandidateProfileArtifacts>,
  candidateId: string,
): ProfileView {
  const profiles = generated.authority
    .profiles as unknown as readonly ProfileView[];
  const value = profiles.find((entry) => entry.candidateId === candidateId);
  if (value === undefined) throw new Error('Missing generated profile.');
  return value;
}
