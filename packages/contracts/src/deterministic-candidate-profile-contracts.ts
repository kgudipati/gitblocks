import {
  canonicalizeDeterministicCandidateProfile,
  validateDeterministicCandidateProfile,
  validateDeterministicCandidateProfileAuthority,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileAuthority,
} from '@gitblocks/domain';

import { contractCanonicalDigest } from './artifact-identity.ts';
import {
  contractIssue,
  mapDomainIssues,
  type ContractIssue,
  type ContractParseResult,
} from './diagnostics.ts';
import { cloneOwnedJson } from './owned-json.ts';
import {
  deterministicCandidateProfileAuthorityV1Validator,
  deterministicCandidateProfileV1Validator,
  structurallyValidate,
} from './structural-validation.ts';
import type {
  DeterministicCandidateProfileAuthorityV1,
  DeterministicCandidateProfileV1,
} from './deterministic-candidate-profile-schemas.ts';

export type DeterministicCandidateProfileInputV1 = Omit<
  DeterministicCandidateProfile,
  'deterministicProfileId' | 'semanticProfileDigest'
>;

export function createDeterministicCandidateProfileV1(
  input: DeterministicCandidateProfileInputV1,
): DeterministicCandidateProfileV1 {
  const canonicalInput = canonicalizeDeterministicCandidateProfile({
    ...cloneOwnedJson(input),
    deterministicProfileId: `profile-${'0'.repeat(48)}`,
    semanticProfileDigest: '0'.repeat(64),
  });
  const semanticProfileDigest =
    deterministicCandidateProfileSemanticDigest(canonicalInput);
  const candidate = {
    ...canonicalInput,
    deterministicProfileId: `profile-${semanticProfileDigest.slice(0, 48)}`,
    semanticProfileDigest,
  };
  const validated = validateDeterministicCandidateProfile(candidate);
  if (!validated.ok) {
    throw new Error('Deterministic candidate profile input is invalid.');
  }
  return validated.value as unknown as DeterministicCandidateProfileV1;
}

export function parseDeterministicCandidateProfileV1(
  value: unknown,
): ContractParseResult<
  DeterministicCandidateProfileV1,
  DeterministicCandidateProfile
> {
  const structural = structurallyValidate(
    value,
    deterministicCandidateProfileV1Validator,
  );
  if (!structural.ok) return structural;
  const domainValue =
    structural.value as unknown as DeterministicCandidateProfile;
  const semantic = validateDeterministicCandidateProfile(domainValue);
  if (!semantic.ok) {
    return { ok: false, issues: mapDomainIssues(semantic.issues) };
  }
  const issues: ContractIssue[] = [];
  if (!profileIdentityMatches(structural.value, semantic.value)) {
    issues.push(
      contractIssue(
        'contract.literal',
        '',
        'Contract value does not match the required literal.',
      ),
    );
  }
  return issues.length === 0
    ? {
        ok: true,
        value: semantic.value as unknown as DeterministicCandidateProfileV1,
        domain: semantic.value,
        issues: [],
      }
    : { ok: false, issues };
}

export function createDeterministicCandidateProfileAuthorityV1(
  input: Omit<
    DeterministicCandidateProfileAuthority,
    'semanticAuthorityDigest'
  >,
): DeterministicCandidateProfileAuthorityV1 {
  const owned = cloneOwnedJson(input);
  const semanticAuthorityDigest =
    deterministicCandidateProfileAuthoritySemanticDigest(owned);
  const authority = {
    ...owned,
    semanticAuthorityDigest,
  } as DeterministicCandidateProfileAuthority;
  const validated = validateDeterministicCandidateProfileAuthority(authority);
  if (!validated.ok) {
    throw new Error(
      'Deterministic candidate profile authority input is invalid.',
    );
  }
  return validated.value as unknown as DeterministicCandidateProfileAuthorityV1;
}

export function parseDeterministicCandidateProfileAuthorityV1(
  value: unknown,
): ContractParseResult<
  DeterministicCandidateProfileAuthorityV1,
  DeterministicCandidateProfileAuthority
> {
  const structural = structurallyValidate(
    value,
    deterministicCandidateProfileAuthorityV1Validator,
  );
  if (!structural.ok) return structural;
  const domainValue =
    structural.value as unknown as DeterministicCandidateProfileAuthority;
  const semantic = validateDeterministicCandidateProfileAuthority(domainValue);
  if (!semantic.ok) {
    return { ok: false, issues: mapDomainIssues(semantic.issues) };
  }
  if (
    structural.value.profiles.some((profile, index) => {
      const semanticProfile = semantic.value.profiles[index];
      return (
        semanticProfile === undefined ||
        !profileIdentityMatches(profile, semanticProfile)
      );
    })
  ) {
    return {
      ok: false,
      issues: [
        contractIssue(
          'contract.literal',
          '/profiles',
          'Contract value does not match the required literal.',
        ),
      ],
    };
  }
  const expectedDigest = deterministicCandidateProfileAuthoritySemanticDigest(
    semantic.value,
  );
  if (structural.value.semanticAuthorityDigest !== expectedDigest) {
    return {
      ok: false,
      issues: [
        contractIssue(
          'contract.literal',
          '/semanticAuthorityDigest',
          'Contract value does not match the required literal.',
        ),
      ],
    };
  }
  return {
    ok: true,
    value:
      semantic.value as unknown as DeterministicCandidateProfileAuthorityV1,
    domain: semantic.value,
    issues: [],
  };
}

export function deterministicCandidateProfileSemanticDigest(
  value: DeterministicCandidateProfileInputV1 | DeterministicCandidateProfile,
): string {
  return contractCanonicalDigest({
    contractVersion: value.contractVersion,
    profileVersion: value.profileVersion,
    candidateId: value.candidateId,
    catalogBinding: value.catalogBinding,
    taxonomyBinding: value.taxonomyBinding,
    profileRulesVersion: value.profileRulesVersion,
    fields: value.fields,
  });
}

export function deterministicCandidateProfileAuthoritySemanticDigest(
  value:
    | Omit<DeterministicCandidateProfileAuthority, 'semanticAuthorityDigest'>
    | DeterministicCandidateProfileAuthority,
): string {
  return contractCanonicalDigest({
    contractVersion: value.contractVersion,
    authorityVersion: value.authorityVersion,
    denominatorVersion: value.denominatorVersion,
    catalogVersion: value.catalogVersion,
    catalogDigest: value.catalogDigest,
    taxonomyVersion: value.taxonomyVersion,
    taxonomySemanticDigest: value.taxonomySemanticDigest,
    profileRulesVersion: value.profileRulesVersion,
    profiles: value.profiles,
  });
}

export function serializeDeterministicCandidateProfileV1(
  value: DeterministicCandidateProfileV1,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeDeterministicCandidateProfileAuthorityV1(
  value: DeterministicCandidateProfileAuthorityV1,
): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function profileIdentityMatches(
  structural: DeterministicCandidateProfileV1,
  semantic: DeterministicCandidateProfile,
): boolean {
  const expectedDigest = deterministicCandidateProfileSemanticDigest(semantic);
  return (
    structural.semanticProfileDigest === expectedDigest &&
    structural.deterministicProfileId ===
      `profile-${expectedDigest.slice(0, 48)}` &&
    serializeDeterministicCandidateProfileV1(structural) ===
      serializeDeterministicCandidateProfileV1(
        semantic as unknown as DeterministicCandidateProfileV1,
      )
  );
}
