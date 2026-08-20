import { describe, expect, it } from 'vitest';

import {
  REVIEWED_CONCEPT_CLAIM_VERSION_V2,
  REVIEWED_CONCEPT_CURATION_AUTHORITY_VERSION_V2,
  REVIEWED_CONCEPT_SCOPE_ADMISSION_VERSION_V2,
  createReviewedConceptCurationAuthorityV2,
  parseReviewedConceptCurationAuthorityV2,
  reviewedConceptClaimDigestV2,
  reviewedConceptScopeAdmissionDigestV2,
  type ReviewedConceptClaimV2,
  type ReviewedConceptScopeAdmissionV2,
} from '../src/index.ts';

const CATALOG_DIGEST = 'a'.repeat(64);
const TAXONOMY_DIGEST = 'b'.repeat(64);

describe('reviewed concept curation V2 contracts', () => {
  it('accepts a bound empty source authority without creating generated claims', () => {
    const authority = authorityWith([]);
    expect(parseReviewedConceptCurationAuthorityV2(authority)).toMatchObject({
      ok: true,
      value: { claims: [] },
    });
  });

  it('retains line-addressed artifact identity and exact-scope admission chains', () => {
    const base = claim({
      candidateId: 'candidate-a',
      fieldId: 'required-infrastructure',
      conceptId: 'redis',
      state: 'present',
      claimScope: { kind: 'candidate-lineage' },
    });
    const first = admission(base.claimId, 1, null, 'snapshot-a');
    const second = admission(
      base.claimId,
      2,
      first.admissionDigest,
      'snapshot-b',
    );
    const authority = authorityWith([{ ...base, admissions: [first, second] }]);
    const parsed = parseReviewedConceptCurationAuthorityV2(authority);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error('Expected reviewed curation authority.');
    expect(parsed.value.claims[0]).toMatchObject({
      claimId: base.claimId,
      admissions: [
        { sequence: 1, priorAdmissionDigest: null },
        { sequence: 2, priorAdmissionDigest: first.admissionDigest },
      ],
    });
  });

  it('rejects artifact IDs without all immutable digests, mutable URLs, and ranges over 80 lines', () => {
    const accepted = claim({
      candidateId: 'candidate-a',
      fieldId: 'capability-variants-features',
      conceptId: 'feature-a',
      state: 'present',
      claimScope: { kind: 'candidate-lineage' },
    });
    const artifactOnly = structuredClone(accepted) as unknown as Record<
      string,
      unknown
    >;
    artifactOnly['basisReferences'] = [
      { kind: 'artifact-lines', artifactId: 'artifact-a' },
    ];
    expect(
      parseReviewedConceptCurationAuthorityV2(authorityWithRaw([artifactOnly])),
    ).toMatchObject({ ok: false });

    const mutableUrl = structuredClone(accepted) as unknown as Record<
      string,
      unknown
    >;
    mutableUrl['basisReferences'] = [
      {
        ...(accepted.basisReferences[0] ?? {}),
        url: 'https://example.test/latest',
      },
    ];
    expect(
      parseReviewedConceptCurationAuthorityV2(authorityWithRaw([mutableUrl])),
    ).toMatchObject({ ok: false });

    const excessive = claim({
      candidateId: 'candidate-a',
      fieldId: 'capability-variants-features',
      conceptId: 'feature-a',
      state: 'present',
      claimScope: { kind: 'candidate-lineage' },
      startLine: 1,
      endLine: 81,
    });
    expect(
      parseReviewedConceptCurationAuthorityV2(authorityWithRaw([excessive])),
    ).toMatchObject({ ok: false });
  });

  it('rejects rewritten durable claims, reordered claims, and rewritten admission history', () => {
    const first = claim({
      candidateId: 'candidate-a',
      fieldId: 'capability-variants-features',
      conceptId: 'feature-a',
      state: 'present',
      claimScope: { kind: 'candidate-lineage' },
    });
    const second = claim({
      candidateId: 'candidate-b',
      fieldId: 'capability-variants-features',
      conceptId: 'feature-b',
      state: 'absent',
      claimScope: { kind: 'candidate-lineage' },
    });
    expect(
      parseReviewedConceptCurationAuthorityV2(
        authorityWithRaw([{ ...first, state: 'absent' }]),
      ),
    ).toMatchObject({ ok: false });
    expect(
      parseReviewedConceptCurationAuthorityV2(
        authorityWithRaw([second, first]),
      ),
    ).toMatchObject({ ok: false });

    const lineage = claim({
      candidateId: 'candidate-a',
      fieldId: 'optional-infrastructure',
      conceptId: 'redis',
      state: 'present',
      claimScope: { kind: 'candidate-lineage' },
    });
    const scope = admission(lineage.claimId, 1, null, 'snapshot-a');
    expect(
      parseReviewedConceptCurationAuthorityV2(
        authorityWithRaw([
          {
            ...lineage,
            admissions: [{ ...scope, priorAdmissionDigest: 'f'.repeat(64) }],
          },
        ]),
      ),
    ).toMatchObject({ ok: false });
  });

  it.each([
    { kind: 'dependency-declaration', packageName: 'redis' },
    { kind: 'catalog-field', field: 'rationale' },
    { kind: 'curator-identity', reviewerId: 'reviewer-a' },
    { kind: 'narrative-judgment', statement: 'Redis appears required.' },
  ])('does not admit $kind as infrastructure basis', (basis) => {
    const reviewed = claim({
      candidateId: 'candidate-a',
      fieldId: 'required-infrastructure',
      conceptId: 'redis',
      state: 'present',
      claimScope: {
        kind: 'exact-version',
        versionScope: {
          kind: 'repository-snapshot',
          snapshotId: 'snapshot-a',
        },
      },
    });
    expect(
      parseReviewedConceptCurationAuthorityV2(
        authorityWithRaw([{ ...reviewed, basisReferences: [basis] }]),
      ),
    ).toMatchObject({ ok: false });
  });
});

function authorityWith(claims: readonly ReviewedConceptClaimV2[]) {
  return createReviewedConceptCurationAuthorityV2({
    contractVersion: '2.0.0',
    authorityVersion: REVIEWED_CONCEPT_CURATION_AUTHORITY_VERSION_V2,
    catalogVersion: 'public-v1',
    catalogDigest: CATALOG_DIGEST,
    taxonomyVersion: '1.0.0',
    taxonomySemanticDigest: TAXONOMY_DIGEST,
    claims: [...claims],
  });
}

function authorityWithRaw(claims: readonly unknown[]) {
  return {
    ...authorityWith([]),
    claims,
  };
}

function claim(input: {
  readonly candidateId: string;
  readonly fieldId: ReviewedConceptClaimV2['fieldId'];
  readonly conceptId: string;
  readonly state: ReviewedConceptClaimV2['state'];
  readonly claimScope: ReviewedConceptClaimV2['claimScope'];
  readonly startLine?: number;
  readonly endLine?: number;
}): ReviewedConceptClaimV2 {
  const provisional: ReviewedConceptClaimV2 = {
    claimVersion: REVIEWED_CONCEPT_CLAIM_VERSION_V2,
    claimId: 'provisional-claim',
    claimDigest: '0'.repeat(64),
    candidateId: input.candidateId,
    fieldId: input.fieldId,
    conceptId: input.conceptId,
    state: input.state,
    claimScope: input.claimScope,
    basisReferences: [
      {
        kind: 'artifact-lines',
        candidateId: input.candidateId,
        artifactSetId: 'artifact-set-a',
        artifactSetIdentityDigest: '1'.repeat(64),
        artifactSetRecordDigest: '2'.repeat(64),
        artifactId: 'artifact-a',
        artifactIdentityDigest: '3'.repeat(64),
        artifactRecordDigest: '4'.repeat(64),
        contentSha256: '5'.repeat(64),
        startLine: input.startLine ?? 1,
        endLine: input.endLine ?? 2,
        excerptSha256: '6'.repeat(64),
      },
    ],
    reviewedAt: '2026-08-19T20:00:00.000Z',
    reviewerId: 'reviewer-a',
    admissions: [],
  };
  const claimDigest = reviewedConceptClaimDigestV2(provisional);
  return {
    ...provisional,
    claimId: `reviewed-claim-${claimDigest.slice(0, 48)}`,
    claimDigest,
  };
}

function admission(
  claimId: string,
  sequence: number,
  priorAdmissionDigest: string | null,
  snapshotId: string,
): ReviewedConceptScopeAdmissionV2 {
  const provisional: ReviewedConceptScopeAdmissionV2 = {
    admissionVersion: REVIEWED_CONCEPT_SCOPE_ADMISSION_VERSION_V2,
    admissionId: 'provisional-admission',
    admissionDigest: '0'.repeat(64),
    claimId,
    sequence,
    priorAdmissionDigest,
    versionScope: { kind: 'repository-snapshot', snapshotId },
    admittedAt: `2026-08-19T20:00:0${String(sequence)}.000Z`,
    reviewerId: 'reviewer-a',
  };
  const admissionDigest = reviewedConceptScopeAdmissionDigestV2(provisional);
  return {
    ...provisional,
    admissionId: `scope-admission-${admissionDigest.slice(0, 48)}`,
    admissionDigest,
  };
}
