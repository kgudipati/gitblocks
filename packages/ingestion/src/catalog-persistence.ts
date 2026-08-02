import type {
  CandidateIdentityV1,
  CapabilityFamilyV1,
} from '@gitblocks/persistence';

import type { CatalogCandidate } from './types.ts';

export function catalogCandidateIdentity(
  candidate: CatalogCandidate,
): CandidateIdentityV1 {
  const repository = Object.freeze({
    host: 'github' as const,
    owner: candidate.github.owner,
    name: candidate.github.repository,
  });
  const packageIdentity =
    candidate.npmPackage === null
      ? null
      : Object.freeze({
          registry: 'npm' as const,
          name: candidate.npmPackage,
        });
  return Object.freeze({
    candidateId: candidate.candidateId,
    displayName: candidate.displayName,
    repository,
    package: packageIdentity,
  });
}

export function catalogCandidateCapabilityFamilies(
  candidate: CatalogCandidate,
): readonly CapabilityFamilyV1[] {
  return Object.freeze(
    [
      ...new Set([
        candidate.primaryCapabilityFamily,
        ...candidate.additionalCapabilityFamilies,
      ]),
    ].sort((left, right) => left.localeCompare(right)),
  );
}
