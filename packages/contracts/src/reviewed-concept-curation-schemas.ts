import { Type, type Static } from 'typebox';

import {
  closedObject,
  stableIdSchema,
  timestampSchema,
} from './schema-builders.ts';

export const REVIEWED_CONCEPT_CLAIM_VERSION_V2 =
  'reviewed-concept-claim/2.0.0' as const;
export const REVIEWED_CONCEPT_SCOPE_ADMISSION_VERSION_V2 =
  'reviewed-concept-scope-admission/2.0.0' as const;
export const REVIEWED_CONCEPT_CURATION_AUTHORITY_VERSION_V2 =
  'reviewed-concept-curation-authority/2.0.0' as const;
export const STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION =
  'structured-infrastructure-status/1.0.0' as const;
export const STRUCTURED_INFRASTRUCTURE_STATUS_PROJECTION_RULE_ID =
  'project-explicit-infrastructure-status-v1' as const;

const digestSchema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: '^[a-f0-9]{64}$',
});
const semanticVersionSchema = Type.String({
  minLength: 5,
  maxLength: 100,
  pattern:
    '^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\\+[0-9A-Za-z.-]+)?$',
});
const versionScopeSchema = Type.Union([
  closedObject({
    kind: Type.Literal('package-version'),
    version: semanticVersionSchema,
  }),
  closedObject({
    kind: Type.Literal('repository-snapshot'),
    snapshotId: stableIdSchema,
  }),
]);

export const reviewedConceptArtifactLinesBasisReferenceV2Schema = closedObject({
  kind: Type.Literal('artifact-lines'),
  candidateId: stableIdSchema,
  artifactSetId: stableIdSchema,
  artifactSetIdentityDigest: digestSchema,
  artifactSetRecordDigest: digestSchema,
  artifactId: stableIdSchema,
  artifactIdentityDigest: digestSchema,
  artifactRecordDigest: digestSchema,
  contentSha256: digestSchema,
  startLine: Type.Integer({ minimum: 1, maximum: 10_000 }),
  endLine: Type.Integer({ minimum: 1, maximum: 10_000 }),
  excerptSha256: digestSchema,
});

export const reviewedConceptStructuredSemanticBasisReferenceV2Schema =
  closedObject({
    kind: Type.Literal('structured-semantic'),
    sourceAuthorityVersion: Type.String({ minLength: 5, maxLength: 100 }),
    sourceAuthorityDigest: digestSchema,
    sourceSchemaVersion: Type.Literal(
      STRUCTURED_INFRASTRUCTURE_STATUS_SCHEMA_VERSION,
    ),
    sourceRecordId: stableIdSchema,
    sourceRecordDigest: digestSchema,
    projectionRuleId: Type.Literal(
      STRUCTURED_INFRASTRUCTURE_STATUS_PROJECTION_RULE_ID,
    ),
  });

export const reviewedConceptBasisReferenceV2Schema = Type.Union([
  reviewedConceptArtifactLinesBasisReferenceV2Schema,
  reviewedConceptStructuredSemanticBasisReferenceV2Schema,
]);

export const reviewedConceptScopeAdmissionV2Schema = closedObject({
  admissionVersion: Type.Literal(REVIEWED_CONCEPT_SCOPE_ADMISSION_VERSION_V2),
  admissionId: stableIdSchema,
  admissionDigest: digestSchema,
  claimId: stableIdSchema,
  sequence: Type.Integer({ minimum: 1, maximum: 10_000 }),
  priorAdmissionDigest: Type.Union([digestSchema, Type.Null()]),
  versionScope: versionScopeSchema,
  admittedAt: timestampSchema,
  reviewerId: stableIdSchema,
});

const claimScopeSchema = Type.Union([
  closedObject({ kind: Type.Literal('candidate-lineage') }),
  closedObject({
    kind: Type.Literal('exact-version'),
    versionScope: versionScopeSchema,
  }),
]);

export const reviewedConceptClaimV2Schema = closedObject({
  claimVersion: Type.Literal(REVIEWED_CONCEPT_CLAIM_VERSION_V2),
  claimId: stableIdSchema,
  claimDigest: digestSchema,
  candidateId: stableIdSchema,
  fieldId: Type.Union([
    Type.Literal('adoption-unit-type'),
    Type.Literal('capability-variants-features'),
    Type.Literal('required-infrastructure'),
    Type.Literal('optional-infrastructure'),
  ]),
  conceptId: stableIdSchema,
  state: Type.Union([Type.Literal('absent'), Type.Literal('present')]),
  claimScope: claimScopeSchema,
  basisReferences: Type.Array(reviewedConceptBasisReferenceV2Schema, {
    minItems: 1,
    maxItems: 8,
    uniqueItems: true,
  }),
  reviewedAt: timestampSchema,
  reviewerId: stableIdSchema,
  admissions: Type.Array(reviewedConceptScopeAdmissionV2Schema, {
    maxItems: 64,
  }),
});

export const reviewedConceptCurationAuthorityV2Schema = Type.Object(
  {
    contractVersion: Type.Literal('2.0.0'),
    authorityVersion: Type.Literal(
      REVIEWED_CONCEPT_CURATION_AUTHORITY_VERSION_V2,
    ),
    catalogVersion: stableIdSchema,
    catalogDigest: digestSchema,
    taxonomyVersion: Type.String({ minLength: 5, maxLength: 32 }),
    taxonomySemanticDigest: digestSchema,
    claims: Type.Array(reviewedConceptClaimV2Schema, { maxItems: 12_750 }),
    semanticAuthorityDigest: digestSchema,
  },
  {
    additionalProperties: false,
    $id: 'https://gitblocks.dev/schemas/contracts/reviewed-concept-curation-authority/2.0.0',
    $schema: 'https://json-schema.org/draft/2020-12/schema',
  },
);

export type ReviewedConceptArtifactLinesBasisReferenceV2 = Static<
  typeof reviewedConceptArtifactLinesBasisReferenceV2Schema
>;
export type ReviewedConceptStructuredSemanticBasisReferenceV2 = Static<
  typeof reviewedConceptStructuredSemanticBasisReferenceV2Schema
>;
export type ReviewedConceptBasisReferenceV2 = Static<
  typeof reviewedConceptBasisReferenceV2Schema
>;
export type ReviewedConceptScopeAdmissionV2 = Static<
  typeof reviewedConceptScopeAdmissionV2Schema
>;
export type ReviewedConceptClaimV2 = Static<
  typeof reviewedConceptClaimV2Schema
>;
export type ReviewedConceptCurationAuthorityV2 = Static<
  typeof reviewedConceptCurationAuthorityV2Schema
>;
