import {
  STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION,
  contractCanonicalDigest,
  parseRepositoryArtifactSetV1,
  parseRepositoryArtifactV1,
  parseReviewedConceptCurationAuthorityV2,
  repositoryArtifactContentSha256,
  splitRepositoryArtifactLogicalLines,
  type CapabilityTaxonomyV1,
  type RepositoryArtifactSetV1,
  type RepositoryArtifactV1,
  type ReviewedConceptClaimV2,
  type ReviewedConceptCurationAuthorityV2,
  type ReviewedConceptScopeAdmissionV2,
} from '@gitblocks/contracts';

import { ingestionError } from './errors.ts';
import type { PublicCatalog } from './types.ts';

export interface ReviewedConceptArtifactMaterialV2 {
  readonly artifactSet: RepositoryArtifactSetV1;
  readonly artifacts: readonly RepositoryArtifactV1[];
}

export interface StructuredInfrastructureStatusRecordV1 {
  readonly sourceRecordId: string;
  readonly sourceRecordDigest: string;
  readonly candidateId: string;
  readonly conceptId: string;
  readonly status: 'optional' | 'required';
  readonly versionScope:
    | { readonly kind: 'package-version'; readonly version: string }
    | { readonly kind: 'repository-snapshot'; readonly snapshotId: string };
}

export interface StructuredInfrastructureStatusAuthorityV1 {
  readonly authorityVersion: string;
  readonly semanticAuthorityDigest: string;
  readonly sourceSchemaVersion: typeof STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION;
  readonly records: readonly StructuredInfrastructureStatusRecordV1[];
}

export interface ReviewedConceptCurationMaterialV2 {
  readonly artifactMaterial?: readonly ReviewedConceptArtifactMaterialV2[];
  readonly structuredInfrastructureAuthorities?: readonly StructuredInfrastructureStatusAuthorityV1[];
}

export function parseReviewedConceptArtifactMaterialV2(
  value: unknown,
): readonly ReviewedConceptArtifactMaterialV2[] {
  if (!Array.isArray(value) || value.length > 150) {
    throw ingestionError('ingestion.invalid-input');
  }
  const material = value.map((entry) => {
    if (
      !isExactObject(entry, ['artifactSet', 'artifacts']) ||
      !Array.isArray(entry['artifacts']) ||
      entry['artifacts'].length > 4
    ) {
      throw ingestionError('ingestion.invalid-input');
    }
    const artifactSet = parseRepositoryArtifactSetV1(entry['artifactSet']);
    const artifacts = entry['artifacts'].map((artifact) => {
      const parsed = parseRepositoryArtifactV1(artifact);
      if (!parsed.ok) throw ingestionError('ingestion.invalid-input');
      return parsed.value;
    });
    if (!artifactSet.ok) throw ingestionError('ingestion.invalid-input');
    return Object.freeze({ artifactSet: artifactSet.value, artifacts });
  });
  validateArtifactMaterial(material);
  return Object.freeze(material);
}

export interface AcceptedReviewedConceptClaimV2 {
  readonly claim: ReviewedConceptClaimV2;
  readonly admission: ReviewedConceptScopeAdmissionV2 | null;
  readonly versionScope:
    | { readonly kind: 'package-version'; readonly version: string }
    | { readonly kind: 'repository-snapshot'; readonly snapshotId: string }
    | null;
}

export function acceptReviewedConceptCurationAuthorityV2(input: {
  readonly authority: unknown;
  readonly catalog: PublicCatalog;
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly material?: ReviewedConceptCurationMaterialV2;
}): {
  readonly authority: ReviewedConceptCurationAuthorityV2;
  readonly claims: readonly AcceptedReviewedConceptClaimV2[];
} {
  const parsed = parseReviewedConceptCurationAuthorityV2(input.authority);
  if (
    !parsed.ok ||
    parsed.value.catalogVersion !== input.catalog.catalogVersion ||
    parsed.value.catalogDigest !== input.catalog.manifestDigest ||
    parsed.value.taxonomyVersion !== input.taxonomy.taxonomyVersion ||
    parsed.value.taxonomySemanticDigest !== input.taxonomy.semanticDigest
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  const catalogById = new Map(
    input.catalog.candidates.map((candidate) => [
      candidate.candidateId,
      candidate,
    ]),
  );
  const taxonomyById = new Map(
    input.taxonomy.concepts.map((concept) => [concept.conceptId, concept]),
  );
  const artifactBySetId = validateArtifactMaterial(
    input.material?.artifactMaterial ?? [],
  );
  const structuredByKey = validateStructuredAuthorities(
    input.material?.structuredInfrastructureAuthorities ?? [],
  );
  const accepted: AcceptedReviewedConceptClaimV2[] = [];
  for (const claim of parsed.value.claims) {
    const candidate = catalogById.get(claim.candidateId);
    const concept = taxonomyById.get(claim.conceptId);
    const expectedKind =
      claim.fieldId === 'adoption-unit-type'
        ? 'architecture'
        : claim.fieldId === 'capability-variants-features'
          ? 'feature'
          : 'infrastructure';
    if (
      candidate === undefined ||
      concept?.kind !== expectedKind ||
      !concept.applicableFamilyIds.some(
        (family) =>
          family === candidate.primaryCapabilityFamily ||
          candidate.additionalCapabilityFamilies.includes(family),
      )
    ) {
      throw ingestionError('ingestion.invalid-input');
    }
    for (const basis of claim.basisReferences) {
      if (basis.kind === 'artifact-lines') {
        validateArtifactBasis(claim, basis, artifactBySetId);
      } else {
        validateStructuredBasis(claim, basis, structuredByKey);
      }
    }
    if (claim.claimScope.kind === 'exact-version') {
      accepted.push({
        claim,
        admission: null,
        versionScope: claim.claimScope.versionScope,
      });
    } else if (
      claim.fieldId === 'adoption-unit-type' ||
      claim.fieldId === 'capability-variants-features'
    ) {
      accepted.push({ claim, admission: null, versionScope: null });
    } else {
      for (const admission of claim.admissions) {
        accepted.push({
          claim,
          admission,
          versionScope: admission.versionScope,
        });
      }
    }
  }
  return Object.freeze({
    authority: parsed.value,
    claims: Object.freeze(accepted),
  });
}

function validateArtifactMaterial(
  material: readonly ReviewedConceptArtifactMaterialV2[],
): ReadonlyMap<
  string,
  {
    readonly set: RepositoryArtifactSetV1;
    readonly artifacts: ReadonlyMap<string, RepositoryArtifactV1>;
  }
> {
  const bySetId = new Map<
    string,
    {
      readonly set: RepositoryArtifactSetV1;
      readonly artifacts: ReadonlyMap<string, RepositoryArtifactV1>;
    }
  >();
  for (const entry of material) {
    const set = parseRepositoryArtifactSetV1(entry.artifactSet);
    if (!set.ok || bySetId.has(set.value.artifactSetId)) {
      throw ingestionError('ingestion.invalid-input');
    }
    const artifacts = new Map<string, RepositoryArtifactV1>();
    for (const supplied of entry.artifacts) {
      const artifact = parseRepositoryArtifactV1(supplied);
      if (!artifact.ok || artifacts.has(artifact.value.artifactId)) {
        throw ingestionError('ingestion.invalid-input');
      }
      artifacts.set(artifact.value.artifactId, artifact.value);
    }
    bySetId.set(set.value.artifactSetId, { set: set.value, artifacts });
  }
  return bySetId;
}

function validateArtifactBasis(
  claim: ReviewedConceptClaimV2,
  basis: Extract<
    ReviewedConceptClaimV2['basisReferences'][number],
    { readonly kind: 'artifact-lines' }
  >,
  material: ReadonlyMap<
    string,
    {
      readonly set: RepositoryArtifactSetV1;
      readonly artifacts: ReadonlyMap<string, RepositoryArtifactV1>;
    }
  >,
): void {
  const resolved = material.get(basis.artifactSetId);
  const artifact = resolved?.artifacts.get(basis.artifactId);
  const setEntry = resolved?.set.entries.find(
    (entry) =>
      entry.outcome === 'present' && entry.artifactId === basis.artifactId,
  );
  if (
    resolved === undefined ||
    artifact === undefined ||
    setEntry === undefined ||
    basis.candidateId !== claim.candidateId ||
    resolved.set.candidateId !== claim.candidateId ||
    artifact.candidateId !== claim.candidateId ||
    resolved.set.identityDigest !== basis.artifactSetIdentityDigest ||
    resolved.set.recordDigest !== basis.artifactSetRecordDigest ||
    artifact.identityDigest !== basis.artifactIdentityDigest ||
    artifact.recordDigest !== basis.artifactRecordDigest ||
    artifact.contentSha256 !== basis.contentSha256 ||
    artifact.commitObjectId !== resolved.set.commitObjectId ||
    basis.endLine < basis.startLine ||
    basis.endLine - basis.startLine + 1 > 80 ||
    basis.endLine > artifact.lineCount
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
  const lines = splitRepositoryArtifactLogicalLines(artifact.content);
  const excerpt = lines.slice(basis.startLine - 1, basis.endLine).join('\n');
  if (
    lines.length !== artifact.lineCount ||
    repositoryArtifactContentSha256(excerpt) !== basis.excerptSha256
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
}

function validateStructuredAuthorities(
  authorities: readonly StructuredInfrastructureStatusAuthorityV1[],
): ReadonlyMap<string, StructuredInfrastructureStatusRecordV1> {
  const records = new Map<string, StructuredInfrastructureStatusRecordV1>();
  for (const authority of authorities) {
    if (
      !runtimeLiteralEquals(
        authority.sourceSchemaVersion,
        STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION,
      ) ||
      authority.semanticAuthorityDigest !==
        contractCanonicalDigest({
          authorityVersion: authority.authorityVersion,
          sourceSchemaVersion: authority.sourceSchemaVersion,
          records: authority.records,
        })
    ) {
      throw ingestionError('ingestion.invalid-input');
    }
    for (const record of authority.records) {
      const expectedDigest = contractCanonicalDigest({
        candidateId: record.candidateId,
        conceptId: record.conceptId,
        status: record.status,
        versionScope: record.versionScope,
      });
      if (
        record.sourceRecordDigest !== expectedDigest ||
        record.sourceRecordId !== `infra-status-${expectedDigest.slice(0, 48)}`
      ) {
        throw ingestionError('ingestion.invalid-input');
      }
      records.set(
        structuredKey(
          authority.authorityVersion,
          authority.semanticAuthorityDigest,
          record.sourceRecordId,
          record.sourceRecordDigest,
        ),
        record,
      );
    }
  }
  return records;
}

function validateStructuredBasis(
  claim: ReviewedConceptClaimV2,
  basis: Extract<
    ReviewedConceptClaimV2['basisReferences'][number],
    { readonly kind: 'structured-semantic' }
  >,
  records: ReadonlyMap<string, StructuredInfrastructureStatusRecordV1>,
): void {
  const record = records.get(
    structuredKey(
      basis.sourceAuthorityVersion,
      basis.sourceAuthorityDigest,
      basis.sourceRecordId,
      basis.sourceRecordDigest,
    ),
  );
  const projectedState =
    claim.fieldId === 'required-infrastructure'
      ? record?.status === 'required'
        ? 'present'
        : 'absent'
      : claim.fieldId === 'optional-infrastructure'
        ? record?.status === 'optional'
          ? 'present'
          : 'absent'
        : null;
  const claimScope =
    claim.claimScope.kind === 'exact-version'
      ? claim.claimScope.versionScope
      : null;
  if (
    record?.candidateId !== claim.candidateId ||
    record.conceptId !== claim.conceptId ||
    projectedState !== claim.state ||
    (claimScope !== null &&
      contractCanonicalDigest(record.versionScope) !==
        contractCanonicalDigest(claimScope))
  ) {
    throw ingestionError('ingestion.invalid-input');
  }
}

function runtimeLiteralEquals(value: string, expected: string): boolean {
  return value === expected;
}

function structuredKey(
  authorityVersion: string,
  authorityDigest: string,
  recordId: string,
  recordDigest: string,
): string {
  return [authorityVersion, authorityDigest, recordId, recordDigest].join(
    '\u0000',
  );
}

function isExactObject(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}
