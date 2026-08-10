import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createDeterministicCandidateProfileV1,
  parseDeterministicCandidateProfileAuthorityV1,
  parseDeterministicCandidateProfileV1,
  type DeterministicCandidateProfileAuthorityV1,
  type DeterministicCandidateProfileInputV1,
  type DeterministicCandidateProfileV1,
} from '../src/index.ts';

const authorityPath = fileURLToPath(
  new URL(
    '../../../catalog/public-v1/candidate-profile-authority.json',
    import.meta.url,
  ),
);
let authority: DeterministicCandidateProfileAuthorityV1;
let validProfile: DeterministicCandidateProfileV1;

beforeAll(async () => {
  const parsed = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(await readFile(authorityPath, 'utf8')) as unknown,
  );
  expect(parsed.ok).toBe(true);
  if (!parsed.ok) throw new Error('Committed profile authority is invalid.');
  authority = parsed.value;
  const first = authority.profiles[0];
  if (first === undefined) throw new Error('Profile authority is empty.');
  validProfile = first;
}, 60_000);

describe('DeterministicCandidateProfileV1', () => {
  it('accepts one complete minimum profile and all exact fields once', () => {
    const parsed = parseDeterministicCandidateProfileV1(validProfile);
    expect(parsed.ok).toBe(true);
    expect(validProfile.fields).toHaveLength(27);
    expect(new Set(validProfile.fields.map(fieldId))).toHaveLength(27);
  });

  it('rejects missing, duplicate, wrongly scoped, and wrong-value fields', () => {
    expectInvalid({ ...validProfile, fields: validProfile.fields.slice(1) });
    expectInvalid({
      ...validProfile,
      fields: [validProfile.fields[0], ...validProfile.fields.slice(0, -1)],
    });
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        scope: 'version-specific',
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        value: { primaryFamily: 'authorization', additionalFamilies: [] },
      })),
    );
  });

  it('rejects invalid state-specific payloads', () => {
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        valueExtractionRuleId: null,
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [],
      })),
    );
    const unknown = requireField(validProfile, 'archived-state');
    expectInvalid(
      replaceField(validProfile, 'archived-state', (field) => ({
        ...field,
        value: { archived: false },
      })),
    );
    expect(unknown['state']).toBe('unknown');
    const unmapped = authority.profiles.find(
      (profile) =>
        requireField(profile, 'package-publication-version')['state'] ===
        'not-applicable',
    );
    expect(unmapped).toBeDefined();
    if (unmapped !== undefined) {
      expectInvalid(
        replaceField(unmapped, 'package-publication-version', (field) => ({
          ...field,
          sourceReferences: [],
        })),
      );
    }
    expectInvalid(
      replaceField(validProfile, 'adoption-unit-type', (field) => ({
        ...field,
        state: 'conflict',
        stateReasonCode: 'conflicting-approved-structured-values',
        stateRuleId: 'retain-conflicting-approved-claims',
        valueExtractionRuleId: null,
        claims: [conceptClaim(['library'], 'snapshot-one')],
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'adoption-unit-type', (field) => ({
        ...field,
        state: 'conflict',
        stateReasonCode: 'conflicting-approved-structured-values',
        stateRuleId: 'retain-conflicting-approved-claims',
        valueExtractionRuleId: null,
        claims: [
          conceptClaim(['library'], 'snapshot-one'),
          {
            ...conceptClaim(['service'], 'snapshot-two'),
            value: { archived: false },
          },
        ],
      })),
    );
  });

  it('preserves exact malformed-field structural diagnostics', () => {
    const malformedCases: readonly [
      string,
      unknown,
      readonly ExpectedContractIssue[],
    ][] = [
      [
        'unknown field ID',
        replaceField(validProfile, 'catalog-role-status', (field) => ({
          ...field,
          fieldId: 'unknown-field-id',
        })),
        [
          additionalPropertyIssue('/fields/0'),
          literalIssue('/fields/0/fieldId'),
        ],
      ],
      [
        'missing field ID',
        replaceField(validProfile, 'catalog-role-status', (field) => {
          const withoutFieldId = { ...field };
          delete withoutFieldId['fieldId'];
          return withoutFieldId;
        }),
        [requiredIssue('/fields/0')],
      ],
      [
        'non-string field ID',
        replaceField(validProfile, 'catalog-role-status', (field) => ({
          ...field,
          fieldId: 27,
        })),
        [
          additionalPropertyIssue('/fields/0'),
          literalIssue('/fields/0/fieldId'),
          typeIssue('/fields/0/fieldId'),
        ],
      ],
      [
        'known field with malformed scope',
        replaceField(validProfile, 'catalog-role-status', (field) => ({
          ...field,
          scope: 'invalid-scope',
        })),
        [
          additionalPropertyIssue('/fields/0'),
          literalIssue('/fields/0/fieldId'),
          literalIssue('/fields/0/scope'),
        ],
      ],
      [
        'known field with malformed state value',
        replaceField(validProfile, 'catalog-role-status', (field) => ({
          ...field,
          value: null,
        })),
        [
          additionalPropertyIssue('/fields/0'),
          literalIssue('/fields/0/fieldId'),
          typeIssue('/fields/0/value'),
        ],
      ],
    ];
    for (const [name, value, issues] of malformedCases) {
      expect(parseDeterministicCandidateProfileV1(value), name).toEqual({
        ok: false,
        issues,
      });
    }
  });

  it('binds repository identity and package applicability to profile-owned fields', () => {
    expect(() =>
      createDeterministicCandidateProfileV1(
        replaceInputField(
          withoutIdentity(validProfile),
          'repository-identity',
          (field) => ({
            ...field,
            value: {
              ...(field['value'] as Record<string, unknown>),
              candidateId: 'wrong-candidate',
            },
          }),
        ),
      ),
    ).toThrow();

    const unmapped = authority.profiles.find(
      (profile) =>
        requireField(profile, 'package-identity-mapping')['value'] !==
          undefined &&
        (
          requireField(profile, 'package-identity-mapping')['value'] as Record<
            string,
            unknown
          >
        )['mapping'] === 'unmapped',
    );
    expect(unmapped).toBeDefined();
    if (unmapped === undefined) return;

    expect(() =>
      createDeterministicCandidateProfileV1(
        replaceInputField(
          withoutIdentity(unmapped),
          'package-identity-mapping',
          (field) => ({
            ...field,
            value: { mapping: 'mapped', packageName: 'forged-package' },
          }),
        ),
      ),
    ).toThrow();

    const mapped = authority.profiles.find(
      (profile) =>
        (
          requireField(profile, 'package-identity-mapping')['value'] as
            Record<string, unknown> | undefined
        )?.['mapping'] === 'mapped',
    );
    expect(mapped).toBeDefined();
    if (mapped === undefined) return;

    expect(() =>
      createDeterministicCandidateProfileV1(
        replaceInputField(
          withoutIdentity(mapped),
          'package-publication-version',
          (field) => ({
            ...field,
            state: 'known',
            stateReasonCode: 'approved-structured-field-value',
            stateRuleId: 'assign-known-approved-structured-value',
            valueExtractionRuleId:
              'extract-package-publication-version-from-structured-authority',
            versionScope: { kind: 'package-version', version: '1.0.0' },
            sourceReferences: [
              {
                kind: 'structured-collection',
                sourceSnapshotId: 'snapshot-one',
                evidenceIds: [],
                sourceTopicCodes: ['package-publication'],
              },
            ],
            value: {
              packageName: 'different-package',
              version: '1.0.0',
              publishedAt: '2026-01-01T00:00:00.000Z',
            },
          }),
        ),
      ),
    ).toThrow();
  });

  it('binds state metadata and value extraction rules to the exact authority kind', () => {
    const input = withoutIdentity(validProfile);
    expect(() =>
      createDeterministicCandidateProfileV1(
        replaceInputField(input, 'archived-state', (field) => ({
          ...field,
          stateReasonCode: 'requires-reviewed-curator-classification',
          stateRuleId: 'assign-unknown-structured-provider-value-missing',
        })),
      ),
    ).toThrow();

    const artifactProfile = createDeterministicCandidateProfileV1(
      replaceInputField(input, 'artifact-chunk-availability', (field) => ({
        ...field,
        state: 'known',
        stateReasonCode: 'approved-artifact-field-value',
        stateRuleId: 'assign-known-approved-artifact-value',
        valueExtractionRuleId:
          'extract-artifact-chunk-availability-from-artifact-set-authority',
        versionScope: {
          kind: 'repository-snapshot',
          snapshotId: 'snapshot-one',
        },
        sourceReferences: [
          {
            kind: 'artifact-set-entry',
            artifactSetId: 'artifact-set-one',
            selectionId: 'selection-one',
            entryOutcome: 'materialized',
            artifactId: 'artifact-one',
          },
        ],
        value: {
          artifactSetId: 'artifact-set-one',
          materializedArtifactCount: 1,
          chunkCount: 3,
        },
      })),
    );
    expect(parseDeterministicCandidateProfileV1(artifactProfile).ok).toBe(true);

    const derivedProfile = createDeterministicCandidateProfileV1(
      replaceInputField(input, 'adoption-unit-type', (field) => ({
        ...field,
        state: 'known',
        stateReasonCode: 'approved-derived-field-value',
        stateRuleId: 'assign-known-deterministic-derived-value',
        valueExtractionRuleId: 'derive-adoption-unit-type-from-profile-fields',
        sourceReferences: [
          {
            kind: 'derived-profile-fields',
            derivationRuleId: 'derive-adoption-from-features',
            inputFieldIds: ['capability-variants-features'],
          },
        ],
        value: { completeness: 'complete', conceptIds: ['library'] },
      })),
    );
    expect(parseDeterministicCandidateProfileV1(derivedProfile).ok).toBe(true);

    const structuredProfile = createDeterministicCandidateProfileV1(
      replaceInputField(input, 'capability-variants-features', (field) => ({
        ...field,
        state: 'known',
        stateReasonCode: 'approved-structured-field-value',
        stateRuleId: 'assign-known-approved-structured-value',
        valueExtractionRuleId:
          'extract-capability-variants-features-from-structured-authority',
        sourceReferences: [
          {
            kind: 'structured-collection',
            sourceSnapshotId: 'snapshot-one',
            evidenceIds: ['evidence-z', 'evidence-a'],
            sourceTopicCodes: ['topic-z', 'topic-a'],
          },
        ],
        value: {
          completeness: 'complete',
          conceptIds: ['decision-caching'],
        },
      })),
    );
    expect(parseDeterministicCandidateProfileV1(structuredProfile).ok).toBe(
      true,
    );
    expect(
      requireField(structuredProfile, 'capability-variants-features')[
        'sourceReferences'
      ],
    ).toEqual([
      {
        kind: 'structured-collection',
        sourceSnapshotId: 'snapshot-one',
        evidenceIds: ['evidence-a', 'evidence-z'],
        sourceTopicCodes: ['topic-a', 'topic-z'],
      },
    ]);

    const unmapped = authority.profiles.find(
      (profile) =>
        requireField(profile, 'package-publication-version')['state'] ===
        'not-applicable',
    );
    expect(unmapped).toBeDefined();
    if (unmapped !== undefined) {
      expect(() =>
        createDeterministicCandidateProfileV1(
          replaceInputField(
            withoutIdentity(unmapped),
            'package-publication-version',
            (field) => ({
              ...field,
              stateReasonCode: 'structured-provider-value-not-committed',
              stateRuleId: 'assign-unknown-structured-provider-value-missing',
            }),
          ),
        ),
      ).toThrow();
    }

    expect(() =>
      createDeterministicCandidateProfileV1(
        replaceInputField(input, 'adoption-unit-type', (field) => ({
          ...field,
          state: 'conflict',
          stateReasonCode: 'approved-structured-field-value',
          stateRuleId: 'assign-known-approved-structured-value',
          valueExtractionRuleId: null,
          sourceReferences: [],
          claims: [
            conceptClaim(['library'], 'snapshot-one'),
            conceptClaim(['service'], 'snapshot-two'),
          ],
        })),
      ),
    ).toThrow();
  });

  it('requires an exact version or snapshot scope for version-specific known values', () => {
    expectInvalid(
      replaceField(validProfile, 'archived-state', (field) => ({
        ...field,
        state: 'known',
        stateReasonCode: 'approved-structured-field-value',
        stateRuleId: 'assign-known-approved-structured-value',
        valueExtractionRuleId:
          'extract-archived-state-from-structured-authority',
        sourceReferences: [structured('snapshot-one')],
        versionScope: null,
        value: { archived: false },
      })),
    );
  });

  it('rejects unknown properties and hostile object/accessor/cycle/sparse inputs', () => {
    expectInvalid({ ...validProfile, arbitraryUrl: 'https://example.com' });
    const inherited = Object.create({ inherited: true }) as object;
    expect(parseDeterministicCandidateProfileV1(inherited).ok).toBe(false);
    const accessor = { ...validProfile } as Record<string, unknown>;
    Object.defineProperty(accessor, 'candidateId', {
      enumerable: true,
      get: () => validProfile.candidateId,
    });
    expect(parseDeterministicCandidateProfileV1(accessor).ok).toBe(false);
    const cyclic: Record<string, unknown> = { ...validProfile };
    cyclic['cycle'] = cyclic;
    expect(parseDeterministicCandidateProfileV1(cyclic).ok).toBe(false);
    const sparse = { ...validProfile, fields: new Array(27) };
    expect(parseDeterministicCandidateProfileV1(sparse).ok).toBe(false);
  });

  it('canonicalizes deterministically without mutating caller data', () => {
    const input = withoutIdentity(validProfile);
    const reversed = {
      ...input,
      fields: [...input.fields].reverse(),
    } as DeterministicCandidateProfileInputV1;
    const before = JSON.stringify(reversed);
    const generated = createDeterministicCandidateProfileV1(reversed);
    expect(JSON.stringify(reversed)).toBe(before);
    expect(generated).toEqual(validProfile);
    expect(generated.fields).not.toBe(reversed.fields);
  });

  it('validates bounded source-reference variants and candidate ownership', () => {
    expect(parseDeterministicCandidateProfileV1(validProfile).ok).toBe(true);
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [
          { ...firstSource(field), candidateId: 'wrong-candidate' },
        ],
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [
          {
            kind: 'catalog-field',
            candidateId: validProfile.candidateId,
            catalogField: 'rationale',
          },
        ],
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [
          {
            kind: 'structured-collection',
            sourceSnapshotId: 'BAD ID',
            evidenceIds: [],
            sourceTopicCodes: [],
          },
        ],
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [
          {
            kind: 'artifact-set-entry',
            artifactSetId: 'artifact-set-one',
            selectionId: 'selection-one',
            entryOutcome: 'materialized',
            artifactId: null,
          },
        ],
      })),
    );
  });

  it('rejects derived cycles, duplicate sources, URLs, and prose escape hatches', () => {
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [
          {
            kind: 'derived-profile-fields',
            derivationRuleId: 'derive-status',
            inputFieldIds: ['catalog-role-status'],
          },
        ],
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [firstSource(field), firstSource(field)],
      })),
    );
    expectInvalid(
      replaceField(validProfile, 'catalog-role-status', (field) => ({
        ...field,
        sourceReferences: [
          {
            ...firstSource(field),
            url: 'https://example.com',
            statement: 'prose',
          },
        ],
      })),
    );
    const input = withoutIdentity(validProfile);
    const cyclic = replaceInputField(
      replaceInputField(input, 'adoption-unit-type', (field) => ({
        ...field,
        state: 'known',
        stateReasonCode: 'approved-derived-field-value',
        stateRuleId: 'assign-known-deterministic-derived-value',
        valueExtractionRuleId: 'derive-adoption-unit-type-from-profile-fields',
        sourceReferences: [
          {
            kind: 'derived-profile-fields',
            derivationRuleId: 'derive-adoption-from-features',
            inputFieldIds: ['capability-variants-features'],
          },
        ],
        value: { completeness: 'complete', conceptIds: ['library'] },
      })),
      'capability-variants-features',
      (field) => ({
        ...field,
        state: 'known',
        stateReasonCode: 'approved-derived-field-value',
        stateRuleId: 'assign-known-deterministic-derived-value',
        valueExtractionRuleId:
          'derive-capability-variants-features-from-profile-fields',
        sourceReferences: [
          {
            kind: 'derived-profile-fields',
            derivationRuleId: 'derive-features-from-adoption',
            inputFieldIds: ['adoption-unit-type'],
          },
        ],
        value: { completeness: 'complete', conceptIds: ['decision-caching'] },
      }),
    );
    expect(() => createDeterministicCandidateProfileV1(cyclic)).toThrow();
  });

  it('rejects semantic profile digest and identity drift', () => {
    expectInvalid({ ...validProfile, semanticProfileDigest: '0'.repeat(64) });
    expectInvalid({
      ...validProfile,
      deterministicProfileId: `profile-${'0'.repeat(48)}`,
    });
  });
});

describe('DeterministicCandidateProfileAuthorityV1', () => {
  it('accepts exactly 150 canonically ordered unique catalog-bound profiles', () => {
    const parsed = parseDeterministicCandidateProfileAuthorityV1(authority);
    expect(parsed.ok).toBe(true);
    expect(authority.profiles).toHaveLength(150);
    expect(
      new Set(authority.profiles.map(({ candidateId }) => candidateId)),
    ).toHaveLength(150);
  });

  it('rejects missing, duplicate, unknown/permuted, and authority-mismatched candidates', () => {
    expectInvalidAuthority({
      ...authority,
      profiles: authority.profiles.slice(1),
    });
    expectInvalidAuthority({
      ...authority,
      profiles: [authority.profiles[0], ...authority.profiles.slice(0, -1)],
    });
    expectInvalidAuthority({
      ...authority,
      profiles: [...authority.profiles].reverse(),
    });
    expectInvalidAuthority({
      ...authority,
      profiles: authority.profiles.map((profile, index) =>
        index === 0
          ? { ...profile, candidateId: 'unknown-candidate' }
          : profile,
      ),
    });
  }, 30_000);

  it('rejects catalog, taxonomy, rules, profile, and authority digest drift', () => {
    expectInvalidAuthority({ ...authority, catalogDigest: '0'.repeat(64) });
    expectInvalidAuthority({
      ...authority,
      taxonomySemanticDigest: '0'.repeat(64),
    });
    expectInvalidAuthority({
      ...authority,
      profileRulesVersion: 'wrong-rules',
    });
    expectInvalidAuthority({
      ...authority,
      profiles: authority.profiles.map((profile, index) =>
        index === 0
          ? { ...profile, semanticProfileDigest: '0'.repeat(64) }
          : profile,
      ),
    });
    expectInvalidAuthority({
      ...authority,
      semanticAuthorityDigest: '0'.repeat(64),
    });
  }, 30_000);

  it('preserves structural diagnostic precedence across composed validation', () => {
    const invalidProfile = authority.profiles.map((profile, index) =>
      index === 0 ? { ...profile, contractVersion: '2.0.0' } : profile,
    );
    expect(
      parseDeterministicCandidateProfileAuthorityV1({
        ...authority,
        profiles: invalidProfile,
        semanticAuthorityDigest: 'x',
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: 'contract.version',
          path: '/profiles/0/contractVersion',
          message: 'Contract version is unsupported.',
        },
      ],
    });
    expect(
      parseDeterministicCandidateProfileAuthorityV1({
        ...authority,
        catalogDigest: 'x',
        profiles: invalidProfile,
      }),
    ).toMatchObject({
      ok: false,
      issues: [
        {
          code: 'contract.bounds',
          path: '/catalogDigest',
          message: 'Contract value is outside the allowed bounds.',
        },
      ],
    });
  });

  it('preserves exact authority nesting for malformed profile fields', () => {
    const profiles = authority.profiles.map((profile, index) =>
      index === 0
        ? (replaceField(profile, 'catalog-role-status', (field) => ({
            ...field,
            fieldId: 'unknown-field-id',
          })) as DeterministicCandidateProfileV1)
        : profile,
    );
    expect(
      parseDeterministicCandidateProfileAuthorityV1({
        ...authority,
        profiles,
      }),
    ).toEqual({
      ok: false,
      issues: [
        additionalPropertyIssue('/profiles/0/fields/0'),
        literalIssue('/profiles/0/fields/0/fieldId'),
      ],
    });
  });
});

interface ExpectedContractIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

function additionalPropertyIssue(path: string): ExpectedContractIssue {
  return {
    code: 'contract.additional-property',
    path,
    message: 'Contract value contains an additional field.',
  };
}

function literalIssue(path: string): ExpectedContractIssue {
  return {
    code: 'contract.literal',
    path,
    message: 'Contract value does not match the required literal.',
  };
}

function requiredIssue(path: string): ExpectedContractIssue {
  return {
    code: 'contract.required',
    path,
    message: 'Required contract field is missing.',
  };
}

function typeIssue(path: string): ExpectedContractIssue {
  return {
    code: 'contract.type',
    path,
    message: 'Contract value has an invalid type.',
  };
}

function expectInvalid(value: unknown): void {
  expect(parseDeterministicCandidateProfileV1(value).ok).toBe(false);
}

function expectInvalidAuthority(value: unknown): void {
  expect(parseDeterministicCandidateProfileAuthorityV1(value).ok).toBe(false);
}

function fieldId(value: unknown): unknown {
  return (value as { fieldId?: unknown }).fieldId;
}

function requireField(
  profile: DeterministicCandidateProfileV1,
  id: string,
): Record<string, unknown> {
  const field = (profile.fields as readonly unknown[]).find(
    (entry) => fieldId(entry) === id,
  ) as Record<string, unknown> | undefined;
  if (field === undefined) throw new Error('Required profile field is absent.');
  return field;
}

function replaceField(
  profile: DeterministicCandidateProfileV1,
  id: string,
  replace: (field: Record<string, unknown>) => Record<string, unknown>,
): unknown {
  return {
    ...profile,
    fields: profile.fields.map((field) =>
      fieldId(field) === id ? replace(field as Record<string, unknown>) : field,
    ),
  };
}

function replaceInputField(
  profile: DeterministicCandidateProfileInputV1,
  id: string,
  replace: (field: Record<string, unknown>) => Record<string, unknown>,
): DeterministicCandidateProfileInputV1 {
  return {
    ...profile,
    fields: profile.fields.map((field) =>
      fieldId(field) === id
        ? replace(field as unknown as Record<string, unknown>)
        : field,
    ),
  } as unknown as DeterministicCandidateProfileInputV1;
}

function firstSource(field: Record<string, unknown>): Record<string, unknown> {
  const sources = field['sourceReferences'];
  if (!Array.isArray(sources) || sources[0] === undefined) {
    throw new Error('Profile field has no source reference.');
  }
  return sources[0] as Record<string, unknown>;
}

function structured(sourceSnapshotId: string) {
  return {
    kind: 'structured-collection',
    sourceSnapshotId,
    evidenceIds: [],
    sourceTopicCodes: ['adoption-unit'],
  };
}

function conceptClaim(conceptIds: string[], snapshotId: string) {
  return {
    value: { completeness: 'complete', conceptIds },
    valueExtractionRuleId:
      'extract-adoption-unit-type-from-structured-authority',
    sourceReferences: [structured(snapshotId)],
  };
}

function withoutIdentity(
  profile: DeterministicCandidateProfileV1,
): DeterministicCandidateProfileInputV1 {
  const input = {
    ...(profile as unknown as DeterministicCandidateProfileInputV1 & {
      deterministicProfileId: string;
      semanticProfileDigest: string;
    }),
  } as Record<string, unknown>;
  Reflect.deleteProperty(input, 'deterministicProfileId');
  Reflect.deleteProperty(input, 'semanticProfileDigest');
  return input as unknown as DeterministicCandidateProfileInputV1;
}
