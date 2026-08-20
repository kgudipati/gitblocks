import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  CONTRACT_VERSION,
  REVIEWED_CONCEPT_CLAIM_VERSION_V2,
  REVIEWED_CONCEPT_CURATION_AUTHORITY_VERSION_V2,
  REVIEWED_CONCEPT_SCOPE_ADMISSION_VERSION_V2,
  STRUCTURED_INFRASTRUCTURE_STATUS_PROJECTION_RULE_ID,
  STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION,
  contractCanonicalDigest,
  createRepositoryArtifactSetV1,
  createRepositoryArtifactV1,
  createReviewedConceptCurationAuthorityV2,
  parseCapabilityTaxonomyV1,
  repositoryArtifactContentSha256,
  repositoryArtifactGitBlobObjectId,
  reviewedConceptClaimDigestV2,
  reviewedConceptScopeAdmissionDigestV2,
  type CapabilityTaxonomyV1,
  type ReviewedConceptBasisReferenceV2,
  type ReviewedConceptClaimV2,
  type ReviewedConceptScopeAdmissionV2,
} from '@gitblocks/contracts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  buildCandidateProfileArtifactsV2,
  parsePublicCatalog,
  type PublicCatalog,
  type ReviewedConceptArtifactMaterialV2,
  type StructuredInfrastructureStatusAuthorityV1,
} from '../src/index.ts';

let catalog: PublicCatalog;
let taxonomy: CapabilityTaxonomyV1;

type TestConceptAssertion =
  | {
      readonly conceptId: string;
      readonly state: 'absent' | 'present';
    }
  | {
      readonly conceptId: string;
      readonly state: 'conflict';
      readonly claims: readonly { readonly state: 'absent' | 'present' }[];
    };

beforeAll(async () => {
  const [catalogText, taxonomyText] = await Promise.all([
    readFile(
      fileURLToPath(
        new URL('../../../catalog/public-v1/manifest.json', import.meta.url),
      ),
      'utf8',
    ),
    readFile(
      fileURLToPath(
        new URL(
          '../../../catalog/capability-taxonomy/1.0.0/manifest.json',
          import.meta.url,
        ),
      ),
      'utf8',
    ),
  ]);
  catalog = parsePublicCatalog(catalogText);
  const parsedTaxonomy = parseCapabilityTaxonomyV1(
    JSON.parse(taxonomyText) as unknown,
  );
  if (!parsedTaxonomy.ok) throw new Error('Taxonomy fixture is invalid.');
  taxonomy = parsedTaxonomy.value;
});

describe('native deterministic candidate profile V2 generation', () => {
  it('leaves every concept field unknown and reports exact zero-curation coverage', () => {
    const generated = buildCandidateProfileArtifactsV2(
      catalog,
      taxonomy,
      emptyCuration(),
    );
    expect(generated.authority.authorityVersion).toBe(
      'deterministic-candidate-profile-authority/2.0.0',
    );
    expect(generated.authority.denominatorVersion).toBe(
      'deterministic-profile-coverage/2.0.0',
    );
    expect(generated.authority.profiles).toHaveLength(150);
    expect(generated.authority.profiles[0]?.contractVersion).toBe('2.0.0');
    expect(generated.coverage.totals).toEqual({
      profiles: 150,
      fieldsPerProfile: 27,
      candidateFieldCells: 4_050,
      nonConceptFieldCells: 3_600,
      nonConceptStates: {
        known: 600,
        unknown: 2_790,
        notApplicable: 210,
        conflict: 0,
      },
      conceptFieldCells: 450,
      conceptFieldCoverage: { unknown: 450, partial: 0, complete: 0 },
      fullyPopulatedConceptFields: 0,
      conceptPairs: {
        total: 3_060,
        present: 0,
        absent: 0,
        conflicting: 0,
        unaddressed: 3_060,
      },
      taxonomyConcepts: {
        total: 45,
        withAnyAssertion: 0,
        unaddressed: 45,
      },
    });
    expect(generated.coverage.hardConstraintDemand).toEqual({
      state: 'unbound',
      authorityVersion: null,
      authorityDigest: null,
      reasonCode: 'product-demand-authority-not-bound',
    });
    expect(generated.coverage.perConceptField).toEqual([
      expect.objectContaining({
        fieldId: 'capability-variants-features',
        fullyPopulated: 0,
        coverage: { unknown: 150, partial: 0, complete: 0 },
      }),
      expect.objectContaining({
        fieldId: 'required-infrastructure',
        fullyPopulated: 0,
        coverage: { unknown: 150, partial: 0, complete: 0 },
      }),
      expect.objectContaining({
        fieldId: 'optional-infrastructure',
        fullyPopulated: 0,
        coverage: { unknown: 150, partial: 0, complete: 0 },
      }),
    ]);
  });

  it('validates exact artifact bytes and emits partial concept-local provenance', () => {
    const material = artifactMaterial();
    const basis = artifactBasis(material, 2, 3);
    const reviewed = claim({
      fieldId: 'capability-variants-features',
      conceptId: 'actor-request-context',
      state: 'present',
      claimScope: { kind: 'candidate-lineage' },
      basisReferences: [basis],
    });
    const generated = buildCandidateProfileArtifactsV2(
      catalog,
      taxonomy,
      curation([reviewed]),
      { curationMaterial: { artifactMaterial: [material] } },
    );
    const field = conceptField(
      generated.authority,
      'audit-bunyan',
      'capability-variants-features',
    );
    expect(field).toMatchObject({
      coverage: 'partial',
      assertions: [
        {
          conceptId: 'actor-request-context',
          state: 'present',
          sourceReferences: [
            {
              kind: 'reviewed-curation-claim',
              claimId: reviewed.claimId,
              admissionId: null,
            },
          ],
        },
      ],
    });
    expect(generated.coverage.totals.fullyPopulatedConceptFields).toBe(0);
    expect(generated.coverage.totals.conceptFieldCoverage).toEqual({
      unknown: 449,
      partial: 1,
      complete: 0,
    });

    const wrongExcerpt = {
      ...reviewed,
      basisReferences: [{ ...basis, excerptSha256: 'f'.repeat(64) }],
    } as ReviewedConceptClaimV2;
    const digest = reviewedConceptClaimDigestV2(wrongExcerpt);
    expect(() =>
      buildCandidateProfileArtifactsV2(
        catalog,
        taxonomy,
        curation([
          {
            ...wrongExcerpt,
            claimId: `reviewed-claim-${digest.slice(0, 48)}`,
            claimDigest: digest,
          },
        ]),
        { curationMaterial: { artifactMaterial: [material] } },
      ),
    ).toThrow();
  });

  it('requires and references an exact-scope admission for infrastructure lineage claims', () => {
    const material = artifactMaterial();
    const lineage = claim({
      fieldId: 'required-infrastructure',
      conceptId: 'always-on-worker',
      state: 'present',
      claimScope: { kind: 'candidate-lineage' },
      basisReferences: [artifactBasis(material, 1, 2)],
    });
    const withoutAdmission = buildCandidateProfileArtifactsV2(
      catalog,
      taxonomy,
      curation([lineage]),
      { curationMaterial: { artifactMaterial: [material] } },
    );
    expect(
      conceptField(
        withoutAdmission.authority,
        'audit-bunyan',
        'required-infrastructure',
      ).coverage,
    ).toBe('unknown');

    const admitted = admission(lineage.claimId, 'scope-current');
    const generated = buildCandidateProfileArtifactsV2(
      catalog,
      taxonomy,
      curation([{ ...lineage, admissions: [admitted] }]),
      { curationMaterial: { artifactMaterial: [material] } },
    );
    expect(
      conceptField(
        generated.authority,
        'audit-bunyan',
        'required-infrastructure',
      ),
    ).toMatchObject({
      coverage: 'partial',
      versionScope: {
        kind: 'repository-snapshot',
        snapshotId: 'scope-current',
      },
      assertions: [
        {
          sourceReferences: [
            {
              admissionId: admitted.admissionId,
              admissionDigest: admitted.admissionDigest,
            },
          ],
        },
      ],
    });
  });

  it('admits structured infrastructure semantics only through the named direct-status projection', () => {
    const structured = structuredAuthority('required');
    const record = structured.records[0]!;
    const basis: ReviewedConceptBasisReferenceV2 = {
      kind: 'structured-semantic',
      sourceAuthorityVersion: structured.authorityVersion,
      sourceAuthorityDigest: structured.semanticAuthorityDigest,
      sourceSchemaVersion: STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION,
      sourceRecordId: record.sourceRecordId,
      sourceRecordDigest: record.sourceRecordDigest,
      projectionRuleId: STRUCTURED_INFRASTRUCTURE_STATUS_PROJECTION_RULE_ID,
    };
    const reviewed = claim({
      fieldId: 'required-infrastructure',
      conceptId: 'always-on-worker',
      state: 'present',
      claimScope: {
        kind: 'exact-version',
        versionScope: record.versionScope,
      },
      basisReferences: [basis],
    });
    expect(() =>
      buildCandidateProfileArtifactsV2(
        catalog,
        taxonomy,
        curation([reviewed]),
        {
          curationMaterial: {
            structuredInfrastructureAuthorities: [structured],
          },
        },
      ),
    ).not.toThrow();

    const wrongStatus = structuredAuthority('optional');
    expect(() =>
      buildCandidateProfileArtifactsV2(
        catalog,
        taxonomy,
        curation([reviewed]),
        {
          curationMaterial: {
            structuredInfrastructureAuthorities: [wrongStatus],
          },
        },
      ),
    ).toThrow();
  });

  it('retains opposite claims as one concept-local conflict', () => {
    const material = artifactMaterial();
    const common = {
      fieldId: 'capability-variants-features' as const,
      conceptId: 'actor-request-context',
      claimScope: { kind: 'candidate-lineage' as const },
      basisReferences: [artifactBasis(material, 1, 1)],
    };
    const present = claim({ ...common, state: 'present' });
    const absent = claim({
      ...common,
      state: 'absent',
      reviewedAt: '2026-08-19T20:00:01.000Z',
    });
    const generated = buildCandidateProfileArtifactsV2(
      catalog,
      taxonomy,
      curation([present, absent].sort(claimOrder)),
      { curationMaterial: { artifactMaterial: [material] } },
    );
    const assertions = conceptField(
      generated.authority,
      'audit-bunyan',
      'capability-variants-features',
    ).assertions;
    expect(assertions).toHaveLength(1);
    const assertion = assertions[0];
    expect(assertion?.conceptId).toBe('actor-request-context');
    expect(assertion?.state).toBe('conflict');
    if (assertion?.state !== 'conflict')
      throw new Error('Expected a concept-local conflict.');
    expect(assertion.claims.map((claim) => claim.state).sort()).toEqual([
      'absent',
      'present',
    ]);
    expect(generated.coverage.totals.conceptPairs.conflicting).toBe(1);
  });
});

function emptyCuration() {
  return curation([]);
}

function curation(claims: readonly ReviewedConceptClaimV2[]) {
  return createReviewedConceptCurationAuthorityV2({
    contractVersion: '2.0.0',
    authorityVersion: REVIEWED_CONCEPT_CURATION_AUTHORITY_VERSION_V2,
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    taxonomyVersion: taxonomy.taxonomyVersion,
    taxonomySemanticDigest: taxonomy.semanticDigest,
    claims: [...claims],
  });
}

function claim(input: {
  readonly fieldId: ReviewedConceptClaimV2['fieldId'];
  readonly conceptId: string;
  readonly state: ReviewedConceptClaimV2['state'];
  readonly claimScope: ReviewedConceptClaimV2['claimScope'];
  readonly basisReferences: readonly ReviewedConceptBasisReferenceV2[];
  readonly reviewedAt?: string;
}): ReviewedConceptClaimV2 {
  const provisional: ReviewedConceptClaimV2 = {
    claimVersion: REVIEWED_CONCEPT_CLAIM_VERSION_V2,
    claimId: 'provisional-claim',
    claimDigest: '0'.repeat(64),
    candidateId: 'audit-bunyan',
    fieldId: input.fieldId,
    conceptId: input.conceptId,
    state: input.state,
    claimScope: input.claimScope,
    basisReferences: [...input.basisReferences],
    reviewedAt: input.reviewedAt ?? '2026-08-19T20:00:00.000Z',
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
  snapshotId: string,
): ReviewedConceptScopeAdmissionV2 {
  const provisional: ReviewedConceptScopeAdmissionV2 = {
    admissionVersion: REVIEWED_CONCEPT_SCOPE_ADMISSION_VERSION_V2,
    admissionId: 'provisional-admission',
    admissionDigest: '0'.repeat(64),
    claimId,
    sequence: 1,
    priorAdmissionDigest: null,
    versionScope: { kind: 'repository-snapshot', snapshotId },
    admittedAt: '2026-08-19T20:00:02.000Z',
    reviewerId: 'reviewer-a',
  };
  const admissionDigest = reviewedConceptScopeAdmissionDigestV2(provisional);
  return {
    ...provisional,
    admissionId: `scope-admission-${admissionDigest.slice(0, 48)}`,
    admissionDigest,
  };
}

function artifactMaterial(): ReviewedConceptArtifactMaterialV2 {
  const content = ['line one', 'line two', 'line three', 'line four'].join(
    '\n',
  );
  const commitObjectId = '1'.repeat(40);
  const artifact = createRepositoryArtifactV1({
    contractVersion: CONTRACT_VERSION,
    candidateId: 'audit-bunyan',
    provider: 'github',
    providerRepositoryId: '123',
    gitObjectAlgorithm: 'sha1',
    commitObjectId,
    path: 'README.md',
    blobObjectId: repositoryArtifactGitBlobObjectId('sha1', content),
    blobApiUrl: `https://api.github.com/repositories/123/git/blobs/${repositoryArtifactGitBlobObjectId('sha1', content)}`,
    displayUrl:
      'https://github.com/example/example/blob/1111111111111111111111111111111111111111/README.md',
    mediaType: 'text/plain',
    encoding: 'utf-8',
    contentSha256: repositoryArtifactContentSha256(content),
    byteCount: Buffer.byteLength(content, 'utf8'),
    lineCount: 4,
    content,
    firstMaterialization: {
      catalogOwner: 'example',
      catalogRepository: 'example',
      providerOwner: 'example',
      providerRepository: 'example',
      collectedAt: '2026-08-19T19:00:00.000Z',
    },
  });
  const artifactSet = createRepositoryArtifactSetV1({
    contractVersion: CONTRACT_VERSION,
    candidateId: 'audit-bunyan',
    catalogVersion: catalog.catalogVersion,
    catalogDigest: catalog.manifestDigest,
    artifactManifestVersion: 'public-artifacts-v1',
    artifactManifestDigest: 'a'.repeat(64),
    collectorVersion: 'repository-artifacts-v1',
    chunkerVersion: 'exact-lines-v1',
    provider: 'github',
    providerRepositoryId: '123',
    providerCanonicalOwner: 'example',
    providerCanonicalRepository: 'example',
    gitObjectAlgorithm: 'sha1',
    commitObjectId,
    entries: [
      {
        selectionId: `selection-${'a'.repeat(48)}`,
        ordinal: 0,
        selector: 'root-readme',
        artifactKind: 'readme',
        requirement: 'optional',
        rationale: null,
        requestedPath: null,
        resolvedPath: 'README.md',
        outcome: 'present',
        artifactId: artifact.artifactId,
      },
    ],
    publishedAt: '2026-08-19T19:00:01.000Z',
  });
  return { artifactSet, artifacts: [artifact] };
}

function artifactBasis(
  material: ReviewedConceptArtifactMaterialV2,
  startLine: number,
  endLine: number,
): ReviewedConceptBasisReferenceV2 {
  const artifact = material.artifacts[0]!;
  const excerpt = artifact.content
    .split('\n')
    .slice(startLine - 1, endLine)
    .join('\n');
  return {
    kind: 'artifact-lines',
    candidateId: 'audit-bunyan',
    artifactSetId: material.artifactSet.artifactSetId,
    artifactSetIdentityDigest: material.artifactSet.identityDigest,
    artifactSetRecordDigest: material.artifactSet.recordDigest,
    artifactId: artifact.artifactId,
    artifactIdentityDigest: artifact.identityDigest,
    artifactRecordDigest: artifact.recordDigest,
    contentSha256: artifact.contentSha256,
    startLine,
    endLine,
    excerptSha256: repositoryArtifactContentSha256(excerpt),
  };
}

function structuredAuthority(
  status: 'optional' | 'required',
): StructuredInfrastructureStatusAuthorityV1 {
  const semantic = {
    candidateId: 'audit-bunyan',
    conceptId: 'always-on-worker',
    status,
    versionScope: {
      kind: 'repository-snapshot' as const,
      snapshotId: 'structured-snapshot-a',
    },
  };
  const sourceRecordDigest = contractCanonicalDigest(semantic);
  const record = {
    sourceRecordId: `infra-status-${sourceRecordDigest.slice(0, 48)}`,
    sourceRecordDigest,
    ...semantic,
  };
  const header = {
    authorityVersion: 'synthetic-structured-status/1.0.0',
    sourceSchemaVersion: STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION,
    records: [record],
  };
  return {
    ...header,
    semanticAuthorityDigest: contractCanonicalDigest(header),
  };
}

function conceptField(
  authority: ReturnType<typeof buildCandidateProfileArtifactsV2>['authority'],
  candidateId: string,
  fieldId: ReviewedConceptClaimV2['fieldId'],
) {
  const profile = authority.profiles.find(
    (entry) => entry.candidateId === candidateId,
  );
  const field = (profile?.fields as readonly Record<string, unknown>[]).find(
    (entry) => entry['fieldId'] === fieldId,
  );
  if (field === undefined) throw new Error('Concept field fixture is missing.');
  return field as unknown as {
    readonly coverage: string;
    readonly assertions: readonly TestConceptAssertion[];
  } & Record<string, unknown>;
}

function claimOrder(
  left: ReviewedConceptClaimV2,
  right: ReviewedConceptClaimV2,
) {
  const leftKey = [
    left.candidateId,
    left.fieldId,
    left.conceptId,
    left.claimId,
  ].join('\u0000');
  const rightKey = [
    right.candidateId,
    right.fieldId,
    right.conceptId,
    right.claimId,
  ].join('\u0000');
  return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
}
