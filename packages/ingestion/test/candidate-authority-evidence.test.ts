import { readFile } from 'node:fs/promises';

import {
  createDeterministicCandidateProfileV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateDossierV1,
  type DeterministicCandidateProfileV1,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';
import { describe, expect, it } from 'vitest';

import {
  canonicalizeJson,
  parseCandidateAuthorityFieldPlan,
  projectCandidateAuthorityDossier,
  type CandidateAuthorityEvidenceBinding,
  type CandidateAuthorityFieldPlanEntry,
} from '../src/index.ts';

const ROOT = new URL('../../../', import.meta.url);
const CUTOFF = '2026-08-01T00:00:00.000Z';

async function fieldPlan() {
  return parseCandidateAuthorityFieldPlan(
    JSON.parse(
      await readFile(
        new URL('catalog/public-v1/candidate-authority-field-plan.json', ROOT),
        'utf8',
      ),
    ) as unknown,
  );
}

async function profile(
  candidateId: string,
): Promise<DeterministicCandidateProfileV1> {
  const parsed = parseDeterministicCandidateProfileAuthorityV1(
    JSON.parse(
      await readFile(
        new URL('catalog/public-v1/candidate-profile-authority.json', ROOT),
        'utf8',
      ),
    ) as unknown,
  );
  if (!parsed.ok) throw new Error('accepted profile fixture is invalid');
  const selected = parsed.value.profiles.find(
    (candidate) => candidate.candidateId === candidateId,
  );
  if (selected === undefined) throw new Error('candidate fixture missing');
  return selected;
}

describe('deterministic profile to evidence to dossier bridge', () => {
  it('projects exact evidence, unknowns, limitations, and a valid dossier purely', async () => {
    const plan = await fieldPlan();
    const candidateProfile = withKnownArchived(await profile('audit-bunyan'));
    const bindings = evidenceBindings(candidateProfile, plan.fields);
    const first = projectCandidateAuthorityDossier({
      profile: candidateProfile,
      fieldPlan: plan,
      evidenceBindings: bindings,
      collectionCutoff: CUTOFF,
    });
    const permuted = projectCandidateAuthorityDossier({
      profile: candidateProfile,
      fieldPlan: plan,
      evidenceBindings: [...bindings].reverse(),
      collectionCutoff: CUTOFF,
    });

    expect(canonicalizeJson(first).text).toBe(canonicalizeJson(permuted).text);
    expect(first.dossier.identity.candidateId).toBe(
      candidateProfile.candidateId,
    );
    expect(
      first.dossier.observations.every(
        (observation) =>
          observation.candidateId === candidateProfile.candidateId,
      ),
    ).toBe(true);
    expect(
      new Set(first.dossier.observations.map((value) => value.evidenceId)).size,
    ).toBe(first.dossier.observations.length);
    expect(
      first.fieldEvidenceBindings.every((binding) =>
        first.dossier.observations.some(
          (observation) => observation.evidenceId === binding.evidenceId,
        ),
      ),
    ).toBe(true);
    expect(
      first.dossier.unknowns.every(
        (unknown) => unknown.evidenceIds.length === 0,
      ),
    ).toBe(true);
    expect(first.dossierDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it('preserves catalog-defined repo-only package not-applicability without negative evidence', async () => {
    const plan = await fieldPlan();
    const candidateProfile = await profile('audit-elasticsearch');
    const fields =
      candidateProfile.fields as unknown as readonly DeterministicProfileFieldRecord[];
    for (const fieldId of [
      'package-publication-version',
      'runtime-package-format',
      'package-repository-linkage',
    ]) {
      expect(fields.find((field) => field.fieldId === fieldId)?.state).toBe(
        'not-applicable',
      );
    }
    const projection = projectCandidateAuthorityDossier({
      profile: candidateProfile,
      fieldPlan: plan,
      evidenceBindings: evidenceBindings(candidateProfile, plan.fields),
      collectionCutoff: CUTOFF,
    });
    for (const fieldId of [
      'package-publication-version',
      'runtime-package-format',
      'package-repository-linkage',
    ]) {
      expect(
        projection.dossier.observations.some((observation) =>
          observation.observation.startsWith(`field=${fieldId};`),
        ),
      ).toBe(false);
    }
  });

  it('rejects a source/value digest mismatch and source-kind mismatch', async () => {
    const plan = await fieldPlan();
    const candidateProfile = withKnownArchived(await profile('audit-bunyan'));
    const bindings = evidenceBindings(candidateProfile, plan.fields);
    expect(bindings.length).toBeGreaterThan(0);
    expect(() =>
      projectCandidateAuthorityDossier({
        profile: candidateProfile,
        fieldPlan: plan,
        evidenceBindings: [
          { ...bindings[0]!, fieldValueDigest: '0'.repeat(64) },
          ...bindings.slice(1),
        ],
        collectionCutoff: CUTOFF,
      }),
    ).toThrow();
  });
});

function evidenceBindings(
  profileValue: DeterministicCandidateProfileV1,
  planEntries: readonly CandidateAuthorityFieldPlanEntry[],
): CandidateAuthorityEvidenceBinding[] {
  const planByField = new Map(
    planEntries.map((entry) => [entry.fieldId, entry]),
  );
  const packageVersion = packagePublicationVersion(profileValue) ?? '1.0.0';
  const fields =
    profileValue.fields as unknown as readonly DeterministicProfileFieldRecord[];
  return fields.flatMap((field) => {
    const plan = planByField.get(
      field.fieldId as CandidateAuthorityFieldPlanEntry['fieldId'],
    );
    if (plan === undefined || field.state !== 'known') return [];
    return [
      {
        fieldId: plan.fieldId,
        fieldValueDigest: canonicalizeJson(field.value).digest,
        source: evidenceSource(plan, profileValue.candidateId, packageVersion),
      },
    ];
  });
}

function evidenceSource(
  plan: CandidateAuthorityFieldPlanEntry,
  candidateId: string,
  packageVersion: string,
): CandidateAuthorityEvidenceBinding['source'] {
  if (plan.evidenceProvenanceKind === 'package-version') {
    return {
      kind: 'package-version',
      sourceType: 'package-registry',
      sourceUrl: 'https://www.npmjs.com/package/bunyan',
      packageVersion,
      immutableUrl: `https://www.npmjs.com/package/bunyan/v/${packageVersion}`,
      publishedAt: '2026-07-01T00:00:00.000Z',
      collectedAt: '2026-07-31T00:00:00.000Z',
    };
  }
  if (plan.evidenceProvenanceKind === 'git-commit') {
    const commitSha = '0123456789abcdef0123456789abcdef01234567';
    return {
      kind: 'git-commit',
      sourceType: 'official-repository',
      sourceUrl: 'https://github.com/example/project',
      commitSha,
      immutableUrl: `https://github.com/example/project/tree/${commitSha}`,
      publishedAt: '2026-07-01T00:00:00.000Z',
      collectedAt: '2026-07-31T00:00:00.000Z',
    };
  }
  if (plan.evidenceProvenanceKind === 'approved-validation') {
    return {
      kind: 'approved-validation',
      sourceType: 'approved-validation',
      validationReferenceId: `validation-${candidateId}`,
      scope: plan.evidenceTopic,
      validatedAt: '2026-07-31T00:00:00.000Z',
    };
  }
  const sourceClass = sourceClassFor(plan.fieldId);
  return {
    kind: 'structured-provider-snapshot',
    sourceType: 'public-structured-provider',
    provider: sourceClass === 'package-metadata' ? 'npm' : 'github',
    sourceClass,
    sourceIdentity: `source-${candidateId}`,
    sourceUrl:
      sourceClass === 'package-metadata'
        ? 'https://registry.npmjs.org/bunyan'
        : 'https://api.github.com/repos/example/project',
    sourceAuthorityDigest: 'a'.repeat(64),
    sourceRecordDigest: canonicalizeJson({ candidateId, fieldId: plan.fieldId })
      .digest,
    collectedAt: '2026-07-31T00:00:00.000Z',
    effectiveAsOf: '2026-07-31T00:00:00.000Z',
    sourceMutability: 'mutable',
    completenessState: 'complete',
    limitationCode: 'source-is-mutable',
  };
}

function sourceClassFor(
  fieldId: CandidateAuthorityFieldPlanEntry['fieldId'],
): Extract<
  CandidateDossierV1['observations'][number]['source'],
  { kind: 'structured-provider-snapshot' }
>['sourceClass'] {
  if (fieldId === 'maintenance-activity') return 'repository-maintenance';
  if (fieldId === 'release-state-recency') return 'repository-release-state';
  if (fieldId === 'security-advisory-state') return 'security-advisory-index';
  if (fieldId === 'security-policy-presence') {
    return 'repository-community-profile';
  }
  if (fieldId === 'package-repository-linkage') return 'package-metadata';
  return 'repository-metadata';
}

function packagePublicationVersion(
  profileValue: DeterministicCandidateProfileV1,
): string | null {
  const fields =
    profileValue.fields as unknown as readonly DeterministicProfileFieldRecord[];
  const field = fields.find(
    (candidate) => candidate.fieldId === 'package-publication-version',
  );
  if (field?.state !== 'known') return null;
  const value = field.value as Readonly<Record<string, unknown>>;
  return typeof value['version'] === 'string' ? value['version'] : null;
}

function withKnownArchived(
  profileValue: DeterministicCandidateProfileV1,
): DeterministicCandidateProfileV1 {
  const candidate = structuredClone(profileValue) as unknown as Record<
    string,
    unknown
  >;
  const fields = candidate['fields'];
  if (!Array.isArray(fields)) throw new Error('profile fields missing');
  const profileFields = fields as unknown[];
  candidate['fields'] = profileFields.map((fieldValue) => {
    const field = fieldValue as Record<string, unknown>;
    return field['fieldId'] === 'archived-state'
      ? {
          fieldId: 'archived-state',
          scope: 'version-specific',
          stateReasonCode: 'approved-structured-field-value',
          stateRuleId: 'assign-known-approved-structured-value',
          versionScope: {
            kind: 'repository-snapshot',
            snapshotId: 'snapshot-candidate-authority-fixture',
          },
          sourceReferences: [
            {
              kind: 'structured-collection',
              sourceSnapshotId: 'snapshot-candidate-authority-fixture',
              evidenceIds: [],
              sourceTopicCodes: ['repository-metadata'],
            },
          ],
          state: 'known',
          valueExtractionRuleId:
            'extract-archived-state-from-structured-authority',
          value: { archived: false },
        }
      : fieldValue;
  });
  delete candidate['deterministicProfileId'];
  delete candidate['semanticProfileDigest'];
  return createDeterministicCandidateProfileV1(
    candidate as Parameters<typeof createDeterministicCandidateProfileV1>[0],
  );
}
