import { readFile } from 'node:fs/promises';

import { beforeAll, describe, expect, it } from 'vitest';

import {
  createDeterministicCandidateProfileAuthorityV2,
  createDeterministicCandidateProfileV2,
  parseDeterministicCandidateProfileAuthority,
  parseDeterministicCandidateProfileAuthorityV1,
  parseDeterministicCandidateProfileAuthorityV2,
  projectDeterministicCandidateProfileAuthorityToEvaluatorV2,
  serializeDeterministicCandidateProfileAuthorityV2,
  type DeterministicCandidateProfileAuthorityV1,
  type DeterministicCandidateProfileAuthorityV2,
  type DeterministicCandidateProfileInputV2,
  type DeterministicProfileFieldRecordV1,
  type DeterministicProfileFieldRecordV2,
} from '../src/index.ts';

let v1: DeterministicCandidateProfileAuthorityV1;
let v2: DeterministicCandidateProfileAuthorityV2;

beforeAll(async () => {
  const value: unknown = JSON.parse(
    await readFile(
      new URL(
        '../../../catalog/public-v1/candidate-profile-authority.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  const parsed = parseDeterministicCandidateProfileAuthorityV1(value);
  if (!parsed.ok) throw new Error('Expected committed V1 profile authority.');
  v1 = parsed.value;
  const profiles = parsed.value.profiles.map((profile) =>
    createDeterministicCandidateProfileV2({
      ...profile,
      contractVersion: '2.0.0',
      profileVersion: 'deterministic-candidate-profile/2.0.0',
      profileRulesVersion: 'deterministic-candidate-profile-rules/2.0.0',
      fields: profile.fields.map(projectNativeField),
    }),
  );
  v2 = createDeterministicCandidateProfileAuthorityV2({
    ...parsed.value,
    contractVersion: '2.0.0',
    authorityVersion: 'deterministic-candidate-profile-authority/2.0.0',
    denominatorVersion: 'deterministic-profile-coverage/2.0.0',
    profileRulesVersion: 'deterministic-candidate-profile-rules/2.0.0',
    profiles,
  });
}, 120_000);

describe('DeterministicCandidateProfileAuthorityV2', () => {
  it('parses the V1-or-V2 published authority union by its version discriminant', () => {
    const parsedV1 = parseDeterministicCandidateProfileAuthority(v1);
    const parsedV2 = parseDeterministicCandidateProfileAuthority(v2);
    expect(parsedV1.ok && parsedV1.value.authorityVersion).toBe(
      'deterministic-candidate-profile-authority/1.0.0',
    );
    expect(parsedV2.ok && parsedV2.value.authorityVersion).toBe(
      'deterministic-candidate-profile-authority/2.0.0',
    );
    expect(parseDeterministicCandidateProfileAuthorityV2(v2).ok).toBe(true);
  }, 120_000);

  it('keeps exactly three native assertion fields and the other 24 V1 field shapes', () => {
    const profile = v2.profiles[0];
    expect(profile).toBeDefined();
    const native = profile?.fields.filter((field) => 'coverage' in field) ?? [];
    expect(native.map(({ fieldId }) => fieldId)).toEqual([
      'capability-variants-features',
      'required-infrastructure',
      'optional-infrastructure',
    ]);
    expect(profile?.fields).toHaveLength(27);
    for (const field of native) {
      expect(field).toMatchObject({ coverage: 'unknown', assertions: [] });
    }
  });

  it('rejects partial-empty, unscoped known infrastructure, scoped feature, and native whole-field conflict', () => {
    const base = profileInput(firstV2Profile());
    expect(() =>
      createDeterministicCandidateProfileV2(
        replaceField(base, 'required-infrastructure', (field) => ({
          ...field,
          coverage: 'partial',
          assertions: [],
          versionScope: {
            kind: 'repository-snapshot',
            snapshotId: 'attempt-one',
          },
        })),
      ),
    ).toThrow();
    expect(() =>
      createDeterministicCandidateProfileV2(
        replaceField(base, 'required-infrastructure', (field) => ({
          ...field,
          coverage: 'complete',
          versionScope: null,
        })),
      ),
    ).toThrow();
    expect(() =>
      createDeterministicCandidateProfileV2(
        replaceField(base, 'capability-variants-features', (field) => ({
          ...field,
          versionScope: {
            kind: 'repository-snapshot',
            snapshotId: 'attempt-one',
          },
        })),
      ),
    ).toThrow();

    const poisoned = structuredClone(v2);
    const poisonedProfiles = poisoned.profiles as unknown as {
      readonly fields: readonly Record<string, unknown>[];
    }[];
    const poisonedProfile = poisonedProfiles[0];
    if (poisonedProfile === undefined) throw new Error('Profile is missing.');
    const feature = poisonedProfile.fields.find(
      (field) => field['fieldId'] === 'capability-variants-features',
    );
    if (feature === undefined) throw new Error('Feature field is missing.');
    feature['state'] = 'conflict';
    feature['claims'] = [];
    expect(parseDeterministicCandidateProfileAuthorityV2(poisoned).ok).toBe(
      false,
    );
  });

  it('allows an unknown infrastructure field to retain an attempted scope', () => {
    const base = profileInput(firstV2Profile());
    const created = createDeterministicCandidateProfileV2(
      replaceField(base, 'required-infrastructure', (field) => ({
        ...field,
        coverage: 'unknown',
        assertions: [],
        versionScope: {
          kind: 'repository-snapshot',
          snapshotId: 'attempt-one',
        },
      })),
    );
    const createdFields = created.fields as unknown as readonly Record<
      string,
      unknown
    >[];
    const infrastructure = createdFields.find(
      (field) => field['fieldId'] === 'required-infrastructure',
    );
    if (infrastructure === undefined) {
      throw new Error('Infrastructure field is missing.');
    }
    expect(infrastructure).toMatchObject({
      coverage: 'unknown',
      versionScope: {
        kind: 'repository-snapshot',
        snapshotId: 'attempt-one',
      },
    });
  });

  it('does not serialize a projected V1 evaluator view as published V2', () => {
    const projected =
      projectDeterministicCandidateProfileAuthorityToEvaluatorV2(v1);
    expect(projected).toMatchObject({
      runtimeAuthorityKind: 'projected-v1',
      authorityVersion: 'deterministic-candidate-profile-authority/1.0.0',
      semanticAuthorityDigest: v1.semanticAuthorityDigest,
      profileRulesVersion: v1.profileRulesVersion,
    });
    expect(() =>
      serializeDeterministicCandidateProfileAuthorityV2(projected as never),
    ).toThrow();
  });
});

function firstV2Profile(): DeterministicCandidateProfileAuthorityV2['profiles'][number] {
  const profile = v2.profiles[0];
  if (profile === undefined) throw new Error('Profile authority is empty.');
  return profile;
}

function projectNativeField(
  field: DeterministicProfileFieldRecordV1,
): DeterministicProfileFieldRecordV2 {
  const record = field as unknown as Record<string, unknown>;
  if (
    record['fieldId'] !== 'capability-variants-features' &&
    record['fieldId'] !== 'required-infrastructure' &&
    record['fieldId'] !== 'optional-infrastructure'
  ) {
    return field;
  }
  if (record['state'] !== 'unknown') {
    throw new Error('Committed transition fixture expects unknown V1 fields.');
  }
  const {
    state: ignoredState,
    valueExtractionRuleId: ignoredRule,
    ...common
  } = record;
  void ignoredState;
  void ignoredRule;
  return {
    ...common,
    coverage: 'unknown',
    assertions: [],
  } as DeterministicProfileFieldRecordV2;
}

function profileInput(
  profile: DeterministicCandidateProfileAuthorityV2['profiles'][number],
): DeterministicCandidateProfileInputV2 {
  const {
    deterministicProfileId: ignoredId,
    semanticProfileDigest: ignoredDigest,
    ...input
  } = profile;
  void ignoredId;
  void ignoredDigest;
  return input;
}

function replaceField(
  input: DeterministicCandidateProfileInputV2,
  fieldId:
    | 'capability-variants-features'
    | 'optional-infrastructure'
    | 'required-infrastructure',
  replace: (field: Record<string, unknown>) => Record<string, unknown>,
): DeterministicCandidateProfileInputV2 {
  return {
    ...input,
    fields: input.fields.map((field) =>
      field.fieldId === fieldId
        ? (replace(field as unknown as Record<string, unknown>) as never)
        : field,
    ),
  };
}
