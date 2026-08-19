import {
  canonicalizeDeterministicCandidateProfile,
  validateDeterministicCandidateProfile,
  validateDeterministicCandidateProfileAuthority,
  validateDeterministicCandidateProfileAuthorityV2,
  validateDeterministicCandidateProfileV2,
  type DeterministicCandidateProfile,
  type DeterministicCandidateProfileAuthority,
  type DeterministicCandidateProfileAuthorityV2Domain,
  type DeterministicCandidateProfileV2Domain,
  type PublishedDeterministicCandidateProfileAuthority,
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
  deterministicCandidateProfileAuthorityV2Validator,
  deterministicCandidateProfileV1Validator,
  deterministicCandidateProfileV2Validator,
  structurallyValidate,
} from './structural-validation.ts';
import type {
  DeterministicCandidateProfileAuthorityV1,
  DeterministicCandidateProfileAuthorityV2,
  DeterministicCandidateProfileV1,
  DeterministicCandidateProfileV2,
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

export type DeterministicCandidateProfileInputV2 = Omit<
  DeterministicCandidateProfileV2Domain,
  'deterministicProfileId' | 'semanticProfileDigest'
>;

export function createDeterministicCandidateProfileV2(
  input: DeterministicCandidateProfileInputV2,
): DeterministicCandidateProfileV2 {
  const owned = cloneOwnedJson(input);
  const semanticProfileDigest =
    deterministicCandidateProfileSemanticDigestV2(owned);
  const candidate = {
    ...owned,
    deterministicProfileId: `profile-${semanticProfileDigest.slice(0, 48)}`,
    semanticProfileDigest,
  } as DeterministicCandidateProfileV2Domain;
  const validated = validateDeterministicCandidateProfileV2(candidate);
  if (!validated.ok) {
    throw new Error('Deterministic candidate profile V2 input is invalid.');
  }
  return validated.value as unknown as DeterministicCandidateProfileV2;
}

export function parseDeterministicCandidateProfileV2(
  value: unknown,
): ContractParseResult<
  DeterministicCandidateProfileV2,
  DeterministicCandidateProfileV2Domain
> {
  const structural = structurallyValidate(
    value,
    deterministicCandidateProfileV2Validator,
  );
  if (!structural.ok) return structural;
  const domainValue =
    structural.value as unknown as DeterministicCandidateProfileV2Domain;
  const semantic = validateDeterministicCandidateProfileV2(domainValue);
  if (!semantic.ok) {
    return { ok: false, issues: mapDomainIssues(semantic.issues) };
  }
  const expectedDigest = deterministicCandidateProfileSemanticDigestV2(
    semantic.value,
  );
  if (
    structural.value.semanticProfileDigest !== expectedDigest ||
    structural.value.deterministicProfileId !==
      `profile-${expectedDigest.slice(0, 48)}` ||
    serializeDeterministicCandidateProfileV2(structural.value) !==
      serializeDeterministicCandidateProfileV2(
        semantic.value as unknown as DeterministicCandidateProfileV2,
      )
  ) {
    return {
      ok: false,
      issues: [
        contractIssue(
          'contract.literal',
          '',
          'Contract value does not match the required literal.',
        ),
      ],
    };
  }
  return {
    ok: true,
    value: semantic.value as unknown as DeterministicCandidateProfileV2,
    domain: semantic.value,
    issues: [],
  };
}

export function createDeterministicCandidateProfileAuthorityV2(
  input: Omit<
    DeterministicCandidateProfileAuthorityV2Domain,
    'semanticAuthorityDigest'
  >,
): DeterministicCandidateProfileAuthorityV2 {
  const owned = cloneOwnedJson(input);
  const semanticAuthorityDigest =
    deterministicCandidateProfileAuthoritySemanticDigestV2(owned);
  const authority = {
    ...owned,
    semanticAuthorityDigest,
  } as DeterministicCandidateProfileAuthorityV2Domain;
  const validated = validateDeterministicCandidateProfileAuthorityV2(authority);
  if (!validated.ok) {
    throw new Error(
      'Deterministic candidate profile V2 authority input is invalid.',
    );
  }
  return validated.value as unknown as DeterministicCandidateProfileAuthorityV2;
}

export function parseDeterministicCandidateProfileAuthorityV2(
  value: unknown,
): ContractParseResult<
  DeterministicCandidateProfileAuthorityV2,
  DeterministicCandidateProfileAuthorityV2Domain
> {
  const structural = structurallyValidate(
    value,
    deterministicCandidateProfileAuthorityV2Validator,
  );
  if (!structural.ok) return structural;
  const domainValue =
    structural.value as unknown as DeterministicCandidateProfileAuthorityV2Domain;
  const semantic =
    validateDeterministicCandidateProfileAuthorityV2(domainValue);
  if (!semantic.ok) {
    return { ok: false, issues: mapDomainIssues(semantic.issues) };
  }
  if (
    structural.value.profiles.some((profile, index) => {
      const semanticProfile = semantic.value.profiles[index];
      if (semanticProfile === undefined) return true;
      const expected =
        deterministicCandidateProfileSemanticDigestV2(semanticProfile);
      return (
        profile.semanticProfileDigest !== expected ||
        profile.deterministicProfileId !== `profile-${expected.slice(0, 48)}`
      );
    }) ||
    structural.value.semanticAuthorityDigest !==
      deterministicCandidateProfileAuthoritySemanticDigestV2(semantic.value)
  ) {
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
      semantic.value as unknown as DeterministicCandidateProfileAuthorityV2,
    domain: semantic.value,
    issues: [],
  };
}

export type DeterministicCandidateProfileAuthorityPublished =
  | DeterministicCandidateProfileAuthorityV1
  | DeterministicCandidateProfileAuthorityV2;

export function parseDeterministicCandidateProfileAuthority(
  value: unknown,
): ContractParseResult<
  DeterministicCandidateProfileAuthorityPublished,
  PublishedDeterministicCandidateProfileAuthority
> {
  const authorityVersion = safeOwnString(value, 'authorityVersion');
  if (authorityVersion === 'deterministic-candidate-profile-authority/2.0.0') {
    return parseDeterministicCandidateProfileAuthorityV2(value);
  }
  return parseDeterministicCandidateProfileAuthorityV1(value);
}

export function deterministicCandidateProfileSemanticDigestV2(
  value:
    | DeterministicCandidateProfileInputV2
    | DeterministicCandidateProfileV2Domain,
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

export function deterministicCandidateProfileAuthoritySemanticDigestV2(
  value:
    | Omit<
        DeterministicCandidateProfileAuthorityV2Domain,
        'semanticAuthorityDigest'
      >
    | DeterministicCandidateProfileAuthorityV2Domain,
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

export function serializeDeterministicCandidateProfileV2(
  value: DeterministicCandidateProfileV2,
): string {
  if (
    safeOwnString(value, 'profileVersion') !==
      'deterministic-candidate-profile/2.0.0' ||
    Object.hasOwn(value, 'runtimeAuthorityKind')
  ) {
    throw new Error(
      'Only a published deterministic profile V2 is serializable.',
    );
  }
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function serializeDeterministicCandidateProfileAuthorityV2(
  value: DeterministicCandidateProfileAuthorityV2,
): string {
  if (
    safeOwnString(value, 'authorityVersion') !==
      'deterministic-candidate-profile-authority/2.0.0' ||
    Object.hasOwn(value, 'runtimeAuthorityKind')
  ) {
    throw new Error(
      'Only a published deterministic profile V2 authority is serializable.',
    );
  }
  return `${JSON.stringify(value, null, 2)}\n`;
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

function safeOwnString(value: unknown, key: string): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined &&
    'value' in descriptor &&
    typeof descriptor.value === 'string'
    ? descriptor.value
    : null;
}
