import { Type, type Static } from 'typebox';

import {
  closedObject,
  contractVersionSchema,
  semanticVersionSchema,
  stableIdSchema,
} from './schema-builders.ts';

export const CAPABILITY_RETRIEVAL_EXPANSION_VERSION =
  'capability-retrieval-expansion/1.0.0' as const;

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;
const SAFE_PRESENTATION_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u061c\\u180e\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff\\ufff9-\\ufffb]*$';
const digestSchema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: '^[0-9a-f]{64}$',
});
const boundedTextSchema = Type.String({
  minLength: 1,
  maxLength: 500,
  pattern: SAFE_PRESENTATION_PATTERN,
});
const relationshipKindSchema = Type.Union([
  Type.Literal('related-identity-term'),
  Type.Literal('taxonomy-alias'),
]);
const sourceReferenceSchema = closedObject({
  sourceKind: Type.Union([
    Type.Literal('taxonomy-alias'),
    Type.Literal('taxonomy-concept-definition'),
  ]),
  sourceId: stableIdSchema,
});

export const capabilityRetrievalExpansionRuleV1Schema = closedObject({
  sourceConceptId: stableIdSchema,
  relationshipKind: Type.Literal('related-identity-term'),
  targetTerms: Type.Array(stableIdSchema, {
    minItems: 1,
    maxItems: 8,
    uniqueItems: true,
  }),
  rationale: boundedTextSchema,
  sourceReference: closedObject({
    sourceKind: Type.Literal('taxonomy-concept-definition'),
    sourceId: stableIdSchema,
  }),
});

const releaseMetadataSchema = closedObject({
  name: Type.String({
    minLength: 1,
    maxLength: 160,
    pattern: SAFE_PRESENTATION_PATTERN,
  }),
  notes: boundedTextSchema,
});

export const capabilityRetrievalExpansionSourceV1Schema = Type.Object(
  {
    expansionVersion: Type.Literal(CAPABILITY_RETRIEVAL_EXPANSION_VERSION),
    taxonomyVersion: semanticVersionSchema,
    taxonomySemanticDigest: digestSchema,
    includeActiveTaxonomyAliases: Type.Literal(true),
    rules: Type.Array(capabilityRetrievalExpansionRuleV1Schema, {
      maxItems: 64,
    }),
    releaseMetadata: releaseMetadataSchema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/capability-retrieval-expansion-source/1.0.0',
    additionalProperties: false,
  },
);

export const capabilityRetrievalExpansionEdgeV1Schema = closedObject({
  edgeId: stableIdSchema,
  sourceConceptId: stableIdSchema,
  targetTerm: stableIdSchema,
  relationshipKind: relationshipKindSchema,
  rationale: boundedTextSchema,
  sourceReference: sourceReferenceSchema,
});

export const capabilityRetrievalExpansionV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    expansionVersion: Type.Literal(CAPABILITY_RETRIEVAL_EXPANSION_VERSION),
    taxonomyVersion: semanticVersionSchema,
    taxonomySemanticDigest: digestSchema,
    edges: Type.Array(capabilityRetrievalExpansionEdgeV1Schema, {
      maxItems: 512,
    }),
    releaseMetadata: releaseMetadataSchema,
    semanticDigest: digestSchema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/capability-retrieval-expansion/1.0.0',
    additionalProperties: false,
  },
);

export type CapabilityRetrievalExpansionRuleV1 = Static<
  typeof capabilityRetrievalExpansionRuleV1Schema
>;
export type CapabilityRetrievalExpansionSourceV1 = Static<
  typeof capabilityRetrievalExpansionSourceV1Schema
>;
export type CapabilityRetrievalExpansionEdgeV1 = Static<
  typeof capabilityRetrievalExpansionEdgeV1Schema
>;
export type CapabilityRetrievalExpansionV1 = Static<
  typeof capabilityRetrievalExpansionV1Schema
>;
