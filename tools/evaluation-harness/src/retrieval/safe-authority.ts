import { join } from 'node:path';

import {
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseCandidateRetrievalMetadataAuthorityV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';
import type {
  DeterministicCandidateProfile,
  DeterministicCandidateProfileAuthority,
  DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import type { ExpectedCandidateRetrievalMetadataAuthorityBindingV1 } from '@gitblocks/retrieval';

import { loadRetrievalJsonFile } from './json-boundary.ts';

const EXPECTED_PROFILE_COUNT = 150;
const EXPECTED_TAXONOMY_VERSION = '1.0.0';
const EXPECTED_TAXONOMY_DIGEST =
  '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9';
const EXPECTED_PROFILE_AUTHORITY_DIGEST =
  'fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879';
const EXPECTED_CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';
const EXPECTED_EXPANSION_DIGEST =
  '1435521e117e2af18ec55bbf1f30e3f5d2f48fe07d54f0c657917ff027086f4a';
const EXPECTED_METADATA_AUTHORITY_VERSION =
  'candidate-retrieval-metadata-authority/1.1.0';
const EXPECTED_METADATA_AUTHORITY_DIGEST =
  '23c38be5e5b117c74832049ae58f455f4fd1731e167cf170038da516c44e5ef1';
const EXPECTED_METADATA_SNAPSHOT_ID =
  'retrieval-metadata-snapshot-23c38be5e5b117c74832049ae58f455f';
const EXPECTED_METADATA_PROVIDER_POLICY_VERSION =
  'candidate-retrieval-metadata-provider-policy/1.1.0';
const EXPECTED_METADATA_PROVIDER_POLICY_DIGEST =
  'b8cd159d895d4af91f92563b199c0e9beea9bddcb87b869e33429201bd9a5f2e';
const EXPECTED_SOURCE_PROVIDER_POLICY_VERSION =
  'profile-materialization-provider-policy/1.0.0';
const EXPECTED_SOURCE_PROVIDER_POLICY_DIGEST =
  '0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede';
const EXPECTED_SOURCE_OPERATION = 'github-repository-metadata';

export interface SafeRetrievalAuthorityV1 {
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly conceptIds: readonly string[];
  readonly profiles: DeterministicCandidateProfileAuthority;
  readonly expansion: CapabilityRetrievalExpansionV1;
  readonly metadata: CandidateRetrievalMetadataAuthorityV1;
  readonly expectedMetadataBinding: ExpectedCandidateRetrievalMetadataAuthorityBindingV1;
}

export function loadRetrievalSafeAuthorityV1(
  repositoryRoot: string,
  order: 'canonical' | 'reverse' = 'canonical',
): SafeRetrievalAuthorityV1 {
  const taxonomyValue = loadRetrievalJsonFile(
    join(repositoryRoot, 'catalog/capability-taxonomy/1.0.0'),
    'manifest.json',
  );
  const taxonomy = parseCapabilityTaxonomyV1(taxonomyValue);
  if (
    !taxonomy.ok ||
    taxonomy.value.taxonomyVersion !== EXPECTED_TAXONOMY_VERSION ||
    taxonomy.value.semanticDigest !== EXPECTED_TAXONOMY_DIGEST
  ) {
    throw new Error('Safe retrieval taxonomy authority is invalid.');
  }
  const expansionValue = loadRetrievalJsonFile(
    join(repositoryRoot, 'catalog/capability-retrieval-expansion/1.0.0'),
    'manifest.json',
  );
  const expansion = parseCapabilityRetrievalExpansionV1(expansionValue);
  if (
    !expansion.ok ||
    expansion.value.semanticDigest !== EXPECTED_EXPANSION_DIGEST ||
    expansion.value.taxonomyVersion !== taxonomy.value.taxonomyVersion ||
    expansion.value.taxonomySemanticDigest !== taxonomy.value.semanticDigest
  ) {
    throw new Error('Safe retrieval expansion authority is invalid.');
  }
  const profileValue = loadRetrievalJsonFile(
    join(repositoryRoot, 'catalog/public-v1'),
    'candidate-profile-authority.json',
    { maximumFileBytes: 4 * 1024 * 1024 },
  );
  const parsed = parseDeterministicCandidateProfileAuthorityV1(profileValue);
  if (
    !parsed.ok ||
    parsed.domain.profiles.length !== EXPECTED_PROFILE_COUNT ||
    parsed.domain.semanticAuthorityDigest !==
      EXPECTED_PROFILE_AUTHORITY_DIGEST ||
    parsed.domain.catalogDigest !== EXPECTED_CATALOG_DIGEST
  ) {
    throw new Error('Safe retrieval candidate-profile authority is invalid.');
  }
  const profiles = {
    ...parsed.domain,
    profiles: (order === 'reverse'
      ? [...parsed.domain.profiles].reverse()
      : [...parsed.domain.profiles]
    ).sort((left, right) => compareAscii(left.candidateId, right.candidateId)),
  };
  const metadataValue = loadRetrievalJsonFile(
    join(repositoryRoot, 'catalog/public-v1'),
    'candidate-retrieval-metadata-authority.json',
    { maximumFileBytes: 1_048_576 },
  );
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(metadataValue);
  const expectedCandidates = profiles.profiles
    .map(stableRepositoryProjection)
    .filter(
      (candidate): candidate is Exclude<typeof candidate, null> =>
        candidate !== null,
    );
  const expectedById = new Map(
    expectedCandidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  if (
    !metadata.ok ||
    metadata.value.authoritySemanticDigest !==
      EXPECTED_METADATA_AUTHORITY_DIGEST ||
    metadata.value.snapshotId !== EXPECTED_METADATA_SNAPSHOT_ID ||
    metadata.value.candidates.length !== EXPECTED_PROFILE_COUNT ||
    metadata.value.catalogDigest !== EXPECTED_CATALOG_DIGEST ||
    metadata.value.providerPolicyDigest !==
      EXPECTED_METADATA_PROVIDER_POLICY_DIGEST ||
    metadata.value.sourceProviderPolicyDigest !==
      EXPECTED_SOURCE_PROVIDER_POLICY_DIGEST ||
    expectedCandidates.length !== EXPECTED_PROFILE_COUNT ||
    metadata.value.candidates.some((candidate) => {
      const expected = expectedById.get(candidate.candidateId);
      return (
        candidate.catalogOwner !== expected?.catalogOwner ||
        candidate.catalogRepository !== expected.catalogRepository
      );
    })
  ) {
    throw new Error('Safe retrieval metadata authority is invalid.');
  }
  const expectedMetadataBinding = {
    authorityVersion: EXPECTED_METADATA_AUTHORITY_VERSION,
    catalogVersion: profiles.catalogVersion,
    catalogDigest: profiles.catalogDigest,
    providerPolicyVersion: EXPECTED_METADATA_PROVIDER_POLICY_VERSION,
    providerPolicyDigest: EXPECTED_METADATA_PROVIDER_POLICY_DIGEST,
    sourceProviderPolicyVersion: EXPECTED_SOURCE_PROVIDER_POLICY_VERSION,
    sourceProviderPolicyDigest: EXPECTED_SOURCE_PROVIDER_POLICY_DIGEST,
    sourceOperation: EXPECTED_SOURCE_OPERATION,
  } satisfies ExpectedCandidateRetrievalMetadataAuthorityBindingV1;
  return {
    taxonomy: taxonomy.value,
    conceptIds: taxonomy.value.concepts
      .map(({ conceptId }) => conceptId)
      .sort(compareAscii),
    profiles,
    expansion: expansion.value,
    metadata: metadata.value,
    expectedMetadataBinding,
  };
}

function stableRepositoryProjection(profile: DeterministicCandidateProfile): {
  readonly candidateId: string;
  readonly catalogOwner: string;
  readonly catalogRepository: string;
} | null {
  const repository = profile.fields.find(
    ({ fieldId }) => fieldId === 'repository-identity',
  ) as DeterministicProfileFieldRecord<'repository-identity'> | undefined;
  if (
    repository?.state !== 'known' ||
    repository.value.candidateId !== profile.candidateId
  ) {
    return null;
  }
  return {
    candidateId: profile.candidateId,
    catalogOwner: repository.value.githubOwner,
    catalogRepository: repository.value.githubRepository,
  };
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
