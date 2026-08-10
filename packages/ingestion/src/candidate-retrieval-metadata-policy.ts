/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Trust-boundary validation intentionally rechecks literal policy fields at runtime. */

import {
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES,
  CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION,
  CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT,
  CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
  CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS,
  requireExactKeys,
  requireRecord,
  type ProfileMaterializationProviderOperationPolicy,
  type ProfileMaterializationProviderPolicy,
} from './profile-materialization-contracts.ts';
import { operationPolicy } from './profile-materialization-policy.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_PATH =
  'catalog/public-v1/profile-materialization-provider-policy.json' as const;
export const CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_PATH =
  'catalog/public-v1/candidate-retrieval-metadata-provider-policy.json' as const;
export const CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH =
  'catalog/public-v1/candidate-retrieval-metadata-authority.json' as const;
export const CANDIDATE_RETRIEVAL_METADATA_STAGING_PATH =
  'catalog/public-v1/.candidate-retrieval-metadata-authority.json.staging' as const;
export const CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT =
  'GITBLOCKS_RETRIEVAL_METADATA_GITHUB_TOKEN' as const;
export const CANDIDATE_RETRIEVAL_METADATA_FUTURE_COLLECTION_COMMAND =
  'pnpm retrieval:metadata:collect' as const;
export const CANDIDATE_RETRIEVAL_METADATA_VALIDATION_COMMAND =
  'pnpm retrieval:metadata:validate' as const;
export const CANDIDATE_RETRIEVAL_METADATA_IDENTITY_PROBE_COMMAND =
  'pnpm retrieval:metadata:identity-probe' as const;
export const CANDIDATE_RETRIEVAL_METADATA_IDENTITY_PROBE_PREFLIGHT_COMMAND =
  'pnpm retrieval:metadata:identity-probe:preflight' as const;

export const CANDIDATE_RETRIEVAL_METADATA_RETAINED_FIELDS = Object.freeze([
  'catalog-owner',
  'catalog-repository',
  'description',
  'primary-language',
  'provider-canonical-owner',
  'provider-canonical-repository',
  'repository-identity-state',
  'topics',
] as const);

export interface CandidateRetrievalMetadataProviderPolicy {
  readonly policyVersion: typeof CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION;
  readonly catalogBinding: {
    readonly catalogVersion: 'public-v1';
    readonly catalogDigest: string;
  };
  readonly sourceProviderPolicyBinding: {
    readonly policyVersion: typeof CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION;
    readonly policyDigest: string;
  };
  readonly allowedOperations: readonly [
    typeof CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
  ];
  readonly authority: {
    readonly authorityVersion: typeof CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION;
    readonly outputPath: typeof CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH;
    readonly candidateCount: typeof CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT;
    readonly maximumSerializedBytes: typeof CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES;
  };
  readonly retainedFields: typeof CANDIDATE_RETRIEVAL_METADATA_RETAINED_FIELDS;
  readonly credentialEnvironmentName: typeof CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT;
  readonly logicalRequestBudget: typeof CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT;
  readonly worstCaseRequestAttemptBudget: 450;
  readonly policySemanticDigest: string;
}

export interface CandidateRetrievalMetadataCollectionEnvelope {
  readonly policy: CandidateRetrievalMetadataProviderPolicy;
  readonly sourceOperation: ProfileMaterializationProviderOperationPolicy;
}

export function parseCandidateRetrievalMetadataProviderPolicy(
  catalog: PublicCatalog,
  sourcePolicy: ProfileMaterializationProviderPolicy,
  supplied: unknown,
): CandidateRetrievalMetadataCollectionEnvelope {
  const policy = requireRecord(supplied);
  requireExactKeys(policy, [
    'allowedOperations',
    'authority',
    'catalogBinding',
    'credentialEnvironmentName',
    'logicalRequestBudget',
    'policySemanticDigest',
    'policyVersion',
    'retainedFields',
    'sourceProviderPolicyBinding',
    'worstCaseRequestAttemptBudget',
  ]);
  const catalogBinding = requireRecord(policy['catalogBinding']);
  requireExactKeys(catalogBinding, ['catalogDigest', 'catalogVersion']);
  const sourceBinding = requireRecord(policy['sourceProviderPolicyBinding']);
  requireExactKeys(sourceBinding, ['policyDigest', 'policyVersion']);
  const authority = requireRecord(policy['authority']);
  requireExactKeys(authority, [
    'authorityVersion',
    'candidateCount',
    'maximumSerializedBytes',
    'outputPath',
  ]);
  const candidate = {
    policyVersion: policy['policyVersion'],
    catalogBinding,
    sourceProviderPolicyBinding: sourceBinding,
    allowedOperations: policy['allowedOperations'],
    authority,
    retainedFields: policy['retainedFields'],
    credentialEnvironmentName: policy['credentialEnvironmentName'],
    logicalRequestBudget: policy['logicalRequestBudget'],
    worstCaseRequestAttemptBudget: policy['worstCaseRequestAttemptBudget'],
    policySemanticDigest: policy['policySemanticDigest'],
  } as unknown as CandidateRetrievalMetadataProviderPolicy;
  const sourceOperation = operationPolicy(
    sourcePolicy,
    CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
  );
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['policySemanticDigest'];
  if (
    candidate.policyVersion !==
      CANDIDATE_RETRIEVAL_METADATA_PROVIDER_POLICY_VERSION ||
    candidate.catalogBinding.catalogVersion !== catalog.catalogVersion ||
    candidate.catalogBinding.catalogDigest !== catalog.manifestDigest ||
    candidate.sourceProviderPolicyBinding.policyVersion !==
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_POLICY_VERSION ||
    candidate.sourceProviderPolicyBinding.policyDigest !==
      sourcePolicy.policySemanticDigest ||
    sourcePolicy.policySemanticDigest !==
      PROFILE_MATERIALIZATION_ACCEPTED_BINDINGS.providerPolicyDigest ||
    !sameStrings(candidate.allowedOperations, [
      CANDIDATE_RETRIEVAL_METADATA_SOURCE_OPERATION,
    ]) ||
    candidate.authority.authorityVersion !==
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_VERSION ||
    candidate.authority.outputPath !==
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_PATH ||
    candidate.authority.candidateCount !==
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT ||
    candidate.authority.maximumSerializedBytes !==
      CANDIDATE_RETRIEVAL_METADATA_AUTHORITY_MAX_BYTES ||
    !sameStrings(
      candidate.retainedFields,
      CANDIDATE_RETRIEVAL_METADATA_RETAINED_FIELDS,
    ) ||
    candidate.credentialEnvironmentName !==
      CANDIDATE_RETRIEVAL_METADATA_GITHUB_TOKEN_ENVIRONMENT ||
    candidate.logicalRequestBudget !==
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT ||
    candidate.worstCaseRequestAttemptBudget !==
      CANDIDATE_RETRIEVAL_METADATA_CANDIDATE_COUNT *
        sourceOperation.maximumAttempts ||
    candidate.policySemanticDigest !== canonicalizeJson(withoutDigest).digest
  ) {
    throw ingestionError('ingestion.invalid-manifest');
  }
  return deepFreeze({ policy: candidate, sourceOperation });
}

function sameStrings(supplied: unknown, expected: readonly string[]): boolean {
  return (
    Array.isArray(supplied) &&
    supplied.length === expected.length &&
    supplied.every(
      (value, index) => typeof value === 'string' && value === expected[index],
    )
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
