import { describe, expect, it } from 'vitest';

import {
  buildCandidateProfileArtifacts,
  buildProfileMaterializationArtifacts,
  canonicalizeJson,
} from '../src/index.ts';
import { buildFakeSourceAuthority } from './profile-materialization-fixtures.ts';

const CATALOG_FIELDS = [
  'catalog-role-status',
  'capability-family',
  'repository-identity',
  'package-identity-mapping',
] as const;

const AUTHORIZED = new Set([
  'repository-discovery-metadata',
  'package-publication-version',
  'runtime-package-format',
  'license-identity',
  'archived-state',
  'fork-upstream-state',
  'release-state-recency',
  'security-advisory-state',
  'security-policy-presence',
  'package-repository-linkage',
]);

describe('pure profile materialization', () => {
  it('reproduces 150 deterministic profiles and preserves catalog facts', async () => {
    const fixture = await buildFakeSourceAuthority();
    const first = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const second = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    expect(first.authority.profiles).toHaveLength(150);
    expect(canonicalizeJson(first).text).toBe(canonicalizeJson(second).text);

    const offline = buildCandidateProfileArtifacts(
      fixture.catalog,
      fixture.taxonomy,
    );
    for (let index = 0; index < 150; index += 1) {
      const prior = offline.authority.profiles[index]!;
      const current = first.authority.profiles[index]!;
      for (const fieldId of CATALOG_FIELDS) {
        expect(field(current, fieldId)).toEqual(field(prior, fieldId));
      }
      const currentFields = current.fields as unknown as readonly {
        readonly fieldId: string;
      }[];
      for (const currentField of currentFields) {
        const priorField = field(prior, currentField.fieldId);
        if (!AUTHORIZED.has(currentField.fieldId)) {
          expect(currentField).toEqual(priorField);
        }
      }
    }
  });

  it('binds every known structured fact to exact version scope and source records', async () => {
    const fixture = await buildFakeSourceAuthority();
    const result = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    for (const profile of result.authority.profiles) {
      const projectedFields = profile.fields as unknown as readonly {
        readonly fieldId: string;
        readonly state: string;
        readonly versionScope: unknown;
        readonly sourceReferences: readonly { readonly kind: string }[];
      }[];
      for (const projected of projectedFields.filter((entry) =>
        AUTHORIZED.has(entry.fieldId),
      )) {
        if (projected.state === 'known') {
          expect(projected.versionScope).not.toBeNull();
          expect(projected.sourceReferences).not.toHaveLength(0);
          expect(
            projected.sourceReferences.every(
              (reference) => reference.kind === 'structured-collection',
            ),
          ).toBe(true);
        }
      }
    }
  });

  it('keeps unsupported module types, incomplete advisories, and npm-only licenses unknown', async () => {
    const fixture = await buildFakeSourceAuthority({
      mutate: (records) => {
        const candidateId = records.find(
          (record) => record.operation === 'npm-package',
        )!.candidateId;
        const npm = records.find(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'npm-package',
        )!;
        const npmValue = npm.normalizedValue as Record<string, unknown>;
        npmValue['moduleType'] = 'amd';
        npmValue['licenseDeclaration'] = 'Apache-2.0';
        const advisory = records.find(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'github-advisory',
        )!;
        (advisory.normalizedValue as Record<string, unknown>)['advisories'] =
          [];
        (advisory.normalizedValue as Record<string, unknown>)['complete'] =
          false;
        const license = records.find(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'github-license',
        );
        if (license !== undefined) {
          (license.normalizedValue as Record<string, unknown>)['spdxId'] = null;
        }
      },
    });
    const result = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const candidateId = fixture.authority.sourceRecords.find(
      (record) => record.operation === 'npm-package',
    )!.candidateId;
    const profile = result.authority.profiles.find(
      (entry) => entry.candidateId === candidateId,
    )!;
    expect(field(profile, 'runtime-package-format').state).toBe('unknown');
    expect(field(profile, 'security-advisory-state').state).toBe('unknown');
    const license = field(profile, 'license-identity');
    expect(license.state).not.toBe('conflict');
    if (
      fixture.catalog.candidates
        .find((candidate) => candidate.candidateId === candidateId)!
        .expectedSourceTypes.includes('github-license')
    ) {
      expect(license.state).toBe('unknown');
    }
  });

  it('uses GitHub license authority without manufacturing an npm mismatch conflict', async () => {
    const fixture = await buildFakeSourceAuthority({
      mutate: (records) => {
        const npm = records.find(
          (record) => record.operation === 'npm-package',
        )!;
        (npm.normalizedValue as Record<string, unknown>)['licenseDeclaration'] =
          'Apache-2.0';
      },
    });
    const result = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const candidateId = fixture.authority.sourceRecords.find(
      (record) => record.operation === 'npm-package',
    )!.candidateId;
    const license = field(
      result.authority.profiles.find(
        (entry) => entry.candidateId === candidateId,
      )!,
      'license-identity',
    );
    expect(license.state).toBe('known');
    expect(license).not.toHaveProperty('claims');
  });

  it('keeps both zero and incomplete advisory results unknown independently', async () => {
    for (const mode of ['zero', 'incomplete'] as const) {
      const fixture = await buildFakeSourceAuthority({
        mutate: (records) => {
          const advisory = records.find(
            (record) => record.operation === 'github-advisory',
          )!;
          const value = advisory.normalizedValue as Record<string, unknown>;
          if (mode === 'zero') value['advisories'] = [];
          else value['complete'] = false;
        },
      });
      const result = buildProfileMaterializationArtifacts(
        fixture.catalog,
        fixture.taxonomy,
        fixture.authority,
      );
      const candidateId = fixture.authority.sourceRecords.find(
        (record) => record.operation === 'github-advisory',
      )!.candidateId;
      expect(
        field(
          result.authority.profiles.find(
            (entry) => entry.candidateId === candidateId,
          )!,
          'security-advisory-state',
        ).state,
      ).toBe('unknown');
    }
  });

  it('maps explicit source absence to controlled unknown rather than false', async () => {
    const fixture = await buildFakeSourceAuthority({
      mutate: (records) => {
        const index = records.findIndex(
          (record) => record.operation === 'github-community-profile',
        );
        const community = records[index]!;
        records[index] = {
          ...community,
          outcome: 'established-absence',
          normalizedValue: null,
          controlledCode: 'provider-not-found',
        };
      },
    });
    const result = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const candidateId = fixture.authority.sourceRecords.find(
      (record) => record.operation === 'github-community-profile',
    )!.candidateId;
    const securityPolicy = field(
      result.authority.profiles.find(
        (entry) => entry.candidateId === candidateId,
      )!,
      'security-policy-presence',
    );
    expect(securityPolicy.state).toBe('unknown');
    expect(securityPolicy).not.toHaveProperty('value');
  });

  it('projects only the exact reviewed runtime package formats', async () => {
    for (const [sourceType, expected] of [
      ['module', 'esm'],
      ['commonjs', 'commonjs'],
      [null, 'unspecified'],
    ] as const) {
      const fixture = await buildFakeSourceAuthority({
        mutate: (records) => {
          const npm = records.find(
            (record) => record.operation === 'npm-package',
          )!;
          (npm.normalizedValue as Record<string, unknown>)['moduleType'] =
            sourceType;
        },
      });
      const result = buildProfileMaterializationArtifacts(
        fixture.catalog,
        fixture.taxonomy,
        fixture.authority,
      );
      const candidateId = fixture.authority.sourceRecords.find(
        (record) => record.operation === 'npm-package',
      )!.candidateId;
      const runtime = field(
        result.authority.profiles.find(
          (entry) => entry.candidateId === candidateId,
        )!,
        'runtime-package-format',
      ) as unknown as { readonly state: string; readonly value: unknown };
      expect(runtime.state).toBe('known');
      expect(runtime.value).toMatchObject({
        packageFormat: 'npm-package',
        moduleFormat: expected,
        exportsDeclared: true,
        nodeEngineRange: '>=20',
      });
    }
  });

  it('retains an exact package/repository mismatch as structured linkage state', async () => {
    const fixture = await buildFakeSourceAuthority({
      mutate: (records) => {
        const npm = records.find(
          (record) => record.operation === 'npm-package',
        )!;
        (npm.normalizedValue as Record<string, unknown>)['repositoryIdentity'] =
          { owner: 'different', repository: 'project' };
      },
    });
    const result = buildProfileMaterializationArtifacts(
      fixture.catalog,
      fixture.taxonomy,
      fixture.authority,
    );
    const candidateId = fixture.authority.sourceRecords.find(
      (record) => record.operation === 'npm-package',
    )!.candidateId;
    const linkage = field(
      result.authority.profiles.find(
        (entry) => entry.candidateId === candidateId,
      )!,
      'package-repository-linkage',
    ) as unknown as { readonly state: string; readonly value: unknown };
    expect(linkage.state).toBe('known');
    expect(linkage.value).toEqual({ linkage: 'mismatched' });
  });

  it('changes the profile digest when a contributing source record changes', async () => {
    const first = await buildFakeSourceAuthority();
    const candidateId = first.catalog.candidates[0]!.candidateId;
    const second = await buildFakeSourceAuthority({
      mutate: (records) => {
        const repository = records.find(
          (record) =>
            record.candidateId === candidateId &&
            record.operation === 'github-repository-metadata',
        )!;
        (repository.normalizedValue as Record<string, unknown>)['topics'] = [
          'changed-topic',
        ];
      },
    });
    const firstArtifacts = buildProfileMaterializationArtifacts(
      first.catalog,
      first.taxonomy,
      first.authority,
    );
    const secondArtifacts = buildProfileMaterializationArtifacts(
      second.catalog,
      second.taxonomy,
      second.authority,
    );
    expect(
      firstArtifacts.authority.profiles.find(
        (profile) => profile.candidateId === candidateId,
      )!.semanticProfileDigest,
    ).not.toBe(
      secondArtifacts.authority.profiles.find(
        (profile) => profile.candidateId === candidateId,
      )!.semanticProfileDigest,
    );
  });
});

function field(
  profile: { readonly fields: readonly { readonly fieldId: string }[] },
  fieldId: string,
): (typeof profile.fields)[number] & { readonly state: string } {
  const result = profile.fields.find((entry) => entry.fieldId === fieldId);
  if (result === undefined) throw new Error('Fixture field is missing.');
  return result as (typeof profile.fields)[number] & { readonly state: string };
}
