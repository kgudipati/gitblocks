import { Type, type Static } from 'typebox';

import { CAPABILITY_TAXONOMY_LIMITS } from '@gitblocks/domain';

import {
  capabilityFamilySchema,
  closedObject,
  contractVersionSchema,
  semanticVersionSchema,
  stableIdSchema,
} from './schema-builders.ts';

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;
const SAFE_PRESENTATION_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u061c\\u180e\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff\\ufff9-\\ufffb]*$';
const DIGEST_PATTERN = '^[0-9a-f]{64}$';

const presentationLabelSchema = Type.String({
  minLength: 1,
  maxLength: 160,
  pattern: SAFE_PRESENTATION_PATTERN,
});
const boundedDefinitionSchema = Type.String({
  minLength: 1,
  maxLength: 500,
  pattern: SAFE_PRESENTATION_PATTERN,
});
const familySetSchema = Type.Array(capabilityFamilySchema, {
  minItems: 1,
  maxItems: 5,
  uniqueItems: true,
});
const nullableStableIdSchema = Type.Union([stableIdSchema, Type.Null()]);
const recordStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('deprecated'),
]);

export const capabilityTaxonomyConceptV1Schema = closedObject({
  conceptId: stableIdSchema,
  kind: Type.Union([
    Type.Literal('family'),
    Type.Literal('architecture'),
    Type.Literal('feature'),
    Type.Literal('infrastructure'),
    Type.Literal('deployment'),
  ]),
  displayLabel: presentationLabelSchema,
  definition: boundedDefinitionSchema,
  applicableFamilyIds: familySetSchema,
  parentConceptId: nullableStableIdSchema,
  status: recordStatusSchema,
  replacementConceptId: nullableStableIdSchema,
});

export const capabilityTaxonomyResolvedAliasV1Schema = closedObject({
  aliasKey: stableIdSchema,
  conceptId: stableIdSchema,
  status: recordStatusSchema,
  replacementAliasKey: nullableStableIdSchema,
});

export const capabilityTaxonomyAmbiguityV1Schema = closedObject({
  aliasKey: stableIdSchema,
  possibleConceptIds: Type.Array(stableIdSchema, {
    minItems: 2,
    maxItems: 16,
    uniqueItems: true,
  }),
  clarificationReasonCode: stableIdSchema,
  clarificationContext: boundedDefinitionSchema,
});

export const capabilityTaxonomyExclusionV1Schema = closedObject({
  termKey: stableIdSchema,
  applicableFamilyIds: familySetSchema,
  exclusionReasonCode: stableIdSchema,
  explanation: boundedDefinitionSchema,
});

export const capabilityTaxonomyReleaseMetadataV1Schema = closedObject({
  name: presentationLabelSchema,
  notes: boundedDefinitionSchema,
});

const capabilityTaxonomySemanticProperties = {
  taxonomyVersion: semanticVersionSchema,
  concepts: Type.Array(capabilityTaxonomyConceptV1Schema, {
    minItems: 15,
    maxItems: CAPABILITY_TAXONOMY_LIMITS.concepts,
  }),
  resolvedAliases: Type.Array(capabilityTaxonomyResolvedAliasV1Schema, {
    minItems: 15,
    maxItems: CAPABILITY_TAXONOMY_LIMITS.resolvedAliases,
  }),
  ambiguities: Type.Array(capabilityTaxonomyAmbiguityV1Schema, {
    maxItems: CAPABILITY_TAXONOMY_LIMITS.ambiguities,
  }),
  exclusions: Type.Array(capabilityTaxonomyExclusionV1Schema, {
    maxItems: CAPABILITY_TAXONOMY_LIMITS.exclusions,
  }),
} as const;

export const capabilityTaxonomySourceV1Schema = Type.Object(
  {
    ...capabilityTaxonomySemanticProperties,
    releaseMetadata: capabilityTaxonomyReleaseMetadataV1Schema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/capability-taxonomy-source/1.0.0',
    additionalProperties: false,
  },
);

export const capabilityTaxonomyV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    ...capabilityTaxonomySemanticProperties,
    releaseMetadata: capabilityTaxonomyReleaseMetadataV1Schema,
    semanticDigest: Type.String({
      minLength: 64,
      maxLength: 64,
      pattern: DIGEST_PATTERN,
    }),
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/capability-taxonomy/1.0.0',
    additionalProperties: false,
  },
);

export type CapabilityTaxonomyConceptV1 = Static<
  typeof capabilityTaxonomyConceptV1Schema
>;
export type CapabilityTaxonomyResolvedAliasV1 = Static<
  typeof capabilityTaxonomyResolvedAliasV1Schema
>;
export type CapabilityTaxonomyAmbiguityV1 = Static<
  typeof capabilityTaxonomyAmbiguityV1Schema
>;
export type CapabilityTaxonomyExclusionV1 = Static<
  typeof capabilityTaxonomyExclusionV1Schema
>;
export type CapabilityTaxonomyReleaseMetadataV1 = Static<
  typeof capabilityTaxonomyReleaseMetadataV1Schema
>;
export type CapabilityTaxonomySourceV1 = Static<
  typeof capabilityTaxonomySourceV1Schema
>;
export type CapabilityTaxonomyV1 = Static<typeof capabilityTaxonomyV1Schema>;
