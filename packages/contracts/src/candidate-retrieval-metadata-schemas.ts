import { Type, type Static } from 'typebox';

import {
  closedObject,
  contractVersionSchema,
  repositoryNameSchema,
  stableIdSchema,
  timestampSchema,
} from './schema-builders.ts';

export const CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION =
  'candidate-retrieval-metadata-authority/1.1.0' as const;
export const CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION =
  'candidate-retrieval-metadata-provider-policy/1.1.0' as const;
export const CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION =
  'profile-materialization-provider-policy/1.0.0' as const;
export const CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION =
  'github-repository-metadata' as const;
export const CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT = 150;
export const CANDIDATE_RETRIEVAL_METADATA_DESCRIPTION_MAX_CODE_UNITS = 500;
export const CANDIDATE_RETRIEVAL_METADATA_TOPIC_MAX_COUNT = 20;
export const CANDIDATE_RETRIEVAL_METADATA_TOPIC_MAX_CODE_UNITS = 100;
export const CANDIDATE_RETRIEVAL_METADATA_LANGUAGE_MAX_CODE_UNITS = 100;
export const CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES = 1_048_576;

const SCHEMA_ROOT_OPTIONS = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
} as const;
const SAFE_REPOSITORY_TEXT_PATTERN =
  '^[^\\u0000-\\u001f\\u007f-\\u009f\\u00ad\\u061c\\u180e\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u206f\\ufeff\\ufff9-\\ufffb]*$';
const digestSchema = Type.String({
  minLength: 64,
  maxLength: 64,
  pattern: '^[0-9a-f]{64}$',
});
const catalogVersionSchema = Type.String({
  minLength: 1,
  maxLength: 64,
  pattern: '^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$',
});
const nullableRepositoryText = (maximum: number) =>
  Type.Union([
    Type.String({
      minLength: 1,
      maxLength: maximum,
      pattern: SAFE_REPOSITORY_TEXT_PATTERN,
    }),
    Type.Null(),
  ]);

export const candidateRetrievalMetadataRecordV1Schema = closedObject({
  candidateId: stableIdSchema,
  catalogOwner: repositoryNameSchema,
  catalogRepository: repositoryNameSchema,
  providerCanonicalOwner: repositoryNameSchema,
  providerCanonicalRepository: repositoryNameSchema,
  repositoryIdentityState: Type.Union([
    Type.Literal('unchanged'),
    Type.Literal('redirected'),
  ]),
  description: nullableRepositoryText(
    CANDIDATE_RETRIEVAL_METADATA_DESCRIPTION_MAX_CODE_UNITS,
  ),
  topics: Type.Array(
    Type.String({
      minLength: 1,
      maxLength: CANDIDATE_RETRIEVAL_METADATA_TOPIC_MAX_CODE_UNITS,
      pattern: SAFE_REPOSITORY_TEXT_PATTERN,
    }),
    {
      maxItems: CANDIDATE_RETRIEVAL_METADATA_TOPIC_MAX_COUNT,
      uniqueItems: true,
    },
  ),
  primaryLanguage: nullableRepositoryText(
    CANDIDATE_RETRIEVAL_METADATA_LANGUAGE_MAX_CODE_UNITS,
  ),
  sourceRecordDigest: digestSchema,
});

export const candidateRetrievalMetadataAuthorityV1Schema = Type.Object(
  {
    contractVersion: contractVersionSchema,
    authorityVersion: Type.Literal(
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION,
    ),
    catalogVersion: catalogVersionSchema,
    catalogDigest: digestSchema,
    providerPolicyVersion: Type.Literal(
      CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
    ),
    providerPolicyDigest: digestSchema,
    sourceProviderPolicyVersion: Type.Literal(
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
    ),
    sourceProviderPolicyDigest: digestSchema,
    sourceOperation: Type.Literal(
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
    ),
    collectedAt: timestampSchema,
    snapshotId: Type.String({
      minLength: 60,
      maxLength: 60,
      pattern: '^retrieval-metadata-snapshot-[0-9a-f]{32}$',
    }),
    candidates: Type.Array(candidateRetrievalMetadataRecordV1Schema, {
      minItems: CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
      maxItems: CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
    }),
    authoritySemanticDigest: digestSchema,
  },
  {
    ...SCHEMA_ROOT_OPTIONS,
    $id: 'https://gitblocks.dev/schemas/contracts/candidate-retrieval-metadata-authority/1.1.0',
    additionalProperties: false,
  },
);

export type CandidateRetrievalMetadataRecordV1 = Static<
  typeof candidateRetrievalMetadataRecordV1Schema
>;
export type CandidateRetrievalMetadataAuthorityV1 = Static<
  typeof candidateRetrievalMetadataAuthorityV1Schema
>;
