import { join } from 'node:path';

import {
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  type CapabilityTaxonomyV1,
} from '@gitblocks/contracts';
import type { DeterministicCandidateProfileAuthority } from '@gitblocks/domain';

import { loadRetrievalJsonFile } from './json-boundary.ts';

const EXPECTED_PROFILE_COUNT = 150;
const EXPECTED_TAXONOMY_VERSION = '1.0.0';
const EXPECTED_TAXONOMY_DIGEST =
  '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9';
const EXPECTED_PROFILE_AUTHORITY_DIGEST =
  'fc85d7ea71c69cd5e56e5a73936ceba6263c4ea0ba8fc2d0802556d79cf9e879';
const EXPECTED_CATALOG_DIGEST =
  '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634';

export interface SafeRetrievalAuthorityV1 {
  readonly taxonomy: CapabilityTaxonomyV1;
  readonly conceptIds: readonly string[];
  readonly profiles: DeterministicCandidateProfileAuthority;
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
  return {
    taxonomy: taxonomy.value,
    conceptIds: taxonomy.value.concepts
      .map(({ conceptId }) => conceptId)
      .sort(compareAscii),
    profiles,
  };
}

function compareAscii(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
