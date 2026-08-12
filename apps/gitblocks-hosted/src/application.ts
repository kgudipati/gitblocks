import {
  createCandidateRetrievalRequestV1,
  normalizeCapabilityQueryV1,
  parseCandidateRetrievalMetadataAuthorityV1,
  parseCapabilityRetrievalExpansionV1,
  parseCapabilityTaxonomyV1,
  parseDeterministicCandidateProfileAuthorityV1,
  parseCapabilityQueryInputV1,
  type CandidateRetrievalAuthorityBindingsV1,
  type CandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalResultV1,
  type CapabilityQueryNormalizationResultV1,
  type CapabilityRetrievalExpansionV1,
  type CapabilityTaxonomyV1,
  type ContractIssue,
  type DeterministicCandidateProfileAuthorityV1,
} from '@gitblocks/contracts';
import {
  CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
  validateCandidateReferenceAuthority,
  type CandidateReferenceAuthority,
  type DeterministicCandidateProfile,
  type DeterministicProfileFieldId,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/domain';
import type {
  CandidateRetrievalEngineV1,
  CandidateRetrievalOperationIssueV1,
} from '@gitblocks/retrieval';

const DISCOVERY_RESULT_LIMIT = 10;

export interface HostedDiscoverySnapshotV1 {
  readonly snapshotId: string;
  readonly snapshotRecordDigest: string;
  readonly candidateCount: number;
}

export type HostedDiscoveryResultV1 =
  | {
      readonly outcome: 'clarification-required';
      readonly normalization: CapabilityQueryNormalizationResultV1;
    }
  | {
      readonly outcome: 'unsupported';
      readonly normalization: CapabilityQueryNormalizationResultV1;
    }
  | {
      readonly outcome: 'retrieved';
      readonly normalization: CapabilityQueryNormalizationResultV1;
      readonly shortlist: CandidateRetrievalResultV1;
    };

export type HostedDiscoveryFailureV1 =
  | {
      readonly kind: 'contract';
      readonly issues: readonly ContractIssue[];
    }
  | {
      readonly kind: 'application';
      readonly code:
        | 'hosted-discovery-not-ready'
        | 'repository-fingerprint-not-supported'
        | 'retrieval-request-construction-failed';
      readonly path: '/repositoryFingerprintReference' | '';
      readonly message:
        | 'Hosted discovery is not ready.'
        | 'Repository fingerprints are not supported by capability discovery.'
        | 'Candidate retrieval request construction failed.';
    }
  | {
      readonly kind: 'retrieval';
      readonly issues: readonly CandidateRetrievalOperationIssueV1[];
    };

export type HostedDiscoveryOperationResultV1 =
  | {
      readonly ok: true;
      readonly result: HostedDiscoveryResultV1;
    }
  | {
      readonly ok: false;
      readonly failure: HostedDiscoveryFailureV1;
    };

export interface HostedDiscoveryApplicationV1 {
  readonly snapshot: HostedDiscoverySnapshotV1;
  readonly discoverCapability: (
    input: unknown,
  ) => HostedDiscoveryOperationResultV1;
}

export type HostedDiscoveryApplicationCreationResultV1 =
  | {
      readonly ok: true;
      readonly application: HostedDiscoveryApplicationV1;
    }
  | {
      readonly ok: false;
      readonly code: 'invalid-application-authority';
    };

export function createHostedDiscoveryApplication(input: {
  readonly snapshot: HostedDiscoverySnapshotV1;
  readonly taxonomy: unknown;
  readonly candidateProfileAuthority: unknown;
  readonly retrievalExpansionAuthority: unknown;
  readonly candidateRetrievalMetadataAuthority: unknown;
  readonly engine: CandidateRetrievalEngineV1;
}): HostedDiscoveryApplicationCreationResultV1 {
  const taxonomy = parseCapabilityTaxonomyV1(input.taxonomy);
  const profiles = parseDeterministicCandidateProfileAuthorityV1(
    input.candidateProfileAuthority,
  );
  const expansion = parseCapabilityRetrievalExpansionV1(
    input.retrievalExpansionAuthority,
  );
  const metadata = parseCandidateRetrievalMetadataAuthorityV1(
    input.candidateRetrievalMetadataAuthority,
  );
  if (
    !taxonomy.ok ||
    !profiles.ok ||
    !expansion.ok ||
    !metadata.ok ||
    input.snapshot.candidateCount !== profiles.value.profiles.length ||
    input.engine.candidateCount !== profiles.value.profiles.length
  ) {
    return Object.freeze({ ok: false, code: 'invalid-application-authority' });
  }
  const candidateAuthority = createCandidateReferenceAuthority(profiles.value);
  if (candidateAuthority === null) {
    return Object.freeze({ ok: false, code: 'invalid-application-authority' });
  }
  const authorityBindings = createAuthorityBindings(
    taxonomy.value,
    profiles.value,
    expansion.value,
    metadata.value,
  );
  const snapshot = Object.freeze({ ...input.snapshot });
  const application: HostedDiscoveryApplicationV1 = Object.freeze({
    snapshot,
    discoverCapability: (suppliedInput: unknown) => {
      const parsedInput = parseCapabilityQueryInputV1(suppliedInput);
      if (!parsedInput.ok) {
        return Object.freeze({
          ok: false,
          failure: Object.freeze({
            kind: 'contract',
            issues: parsedInput.issues,
          }),
        });
      }
      if (parsedInput.value.repositoryFingerprintReference !== null) {
        return applicationFailure('repository-fingerprint-not-supported');
      }
      const normalized = normalizeCapabilityQueryV1(
        parsedInput.value,
        taxonomy.value,
        candidateAuthority,
      );
      if (!normalized.ok) {
        return Object.freeze({
          ok: false,
          failure: Object.freeze({
            kind: 'contract',
            issues: normalized.issues,
          }),
        });
      }
      if (normalized.value.outcome !== 'normalized') {
        return Object.freeze({
          ok: true,
          result: Object.freeze({
            outcome: normalized.value.outcome,
            normalization: normalized.value,
          }),
        });
      }
      let request;
      try {
        request = createCandidateRetrievalRequestV1({
          normalization: normalized.value,
          authorityBindings,
          eligibleResultLimit: DISCOVERY_RESULT_LIMIT,
          evidenceNeededResultLimit: DISCOVERY_RESULT_LIMIT,
        });
      } catch {
        return applicationFailure('retrieval-request-construction-failed');
      }
      const retrieved = input.engine.retrieve(request);
      if (!retrieved.ok) {
        return Object.freeze({
          ok: false,
          failure: Object.freeze({
            kind: 'retrieval',
            issues: retrieved.issues,
          }),
        });
      }
      return Object.freeze({
        ok: true,
        result: Object.freeze({
          outcome: 'retrieved',
          normalization: normalized.value,
          shortlist: retrieved.result,
        }),
      });
    },
  });
  return Object.freeze({ ok: true, application });
}

export function hostedDiscoveryNotReady(): HostedDiscoveryOperationResultV1 {
  return applicationFailure('hosted-discovery-not-ready');
}

function createCandidateReferenceAuthority(
  authority: DeterministicCandidateProfileAuthorityV1,
): CandidateReferenceAuthority | null {
  const candidates: CandidateReferenceAuthority['candidates'][number][] = [];
  for (const contractProfile of authority.profiles) {
    const profile = contractProfile as unknown as DeterministicCandidateProfile;
    const family = knownField(profile, 'capability-family');
    const repository = knownField(profile, 'repository-identity');
    const packageMapping = knownField(profile, 'package-identity-mapping');
    if (family === null || repository === null || packageMapping === null) {
      return null;
    }
    candidates.push({
      candidateId: profile.candidateId,
      capabilityFamily: family.value.primaryFamily,
      repositoryKey:
        `${repository.value.githubOwner}/${repository.value.githubRepository}`.toLowerCase(),
      npmPackageKey:
        packageMapping.value.mapping === 'mapped'
          ? packageMapping.value.packageName.toLowerCase()
          : null,
    });
  }
  const validated = validateCandidateReferenceAuthority({
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    candidates,
  });
  return validated.ok ? validated.value : null;
}

function createAuthorityBindings(
  taxonomy: CapabilityTaxonomyV1,
  profiles: DeterministicCandidateProfileAuthorityV1,
  expansion: CapabilityRetrievalExpansionV1,
  metadata: CandidateRetrievalMetadataAuthorityV1,
): CandidateRetrievalAuthorityBindingsV1 {
  return Object.freeze({
    taxonomy: Object.freeze({
      taxonomyVersion: taxonomy.taxonomyVersion,
      taxonomySemanticDigest: taxonomy.semanticDigest,
    }),
    candidateProfiles: Object.freeze({
      authorityVersion: profiles.authorityVersion,
      semanticAuthorityDigest: profiles.semanticAuthorityDigest,
      profileRulesVersion: profiles.profileRulesVersion,
    }),
    catalog: Object.freeze({
      catalogVersion: profiles.catalogVersion,
      catalogDigest: profiles.catalogDigest,
    }),
    candidateConstraintEvaluationVersion:
      CANDIDATE_CONSTRAINT_EVALUATION_VERSION,
    retrievalExpansion: Object.freeze({
      authorityVersion: expansion.expansionVersion,
      semanticDigest: expansion.semanticDigest,
    }),
    retrievalMetadata: Object.freeze({
      authorityVersion: metadata.authorityVersion,
      authoritySemanticDigest: metadata.authoritySemanticDigest,
    }),
  });
}

function knownField<Id extends DeterministicProfileFieldId>(
  profile: DeterministicCandidateProfile,
  fieldId: Id,
): Extract<
  DeterministicProfileFieldRecord<Id>,
  { readonly state: 'known' }
> | null {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  ) as DeterministicProfileFieldRecord<Id> | undefined;
  return field?.state === 'known' ? field : null;
}

function applicationFailure(
  code: Extract<
    HostedDiscoveryFailureV1,
    { readonly kind: 'application' }
  >['code'],
): HostedDiscoveryOperationResultV1 {
  const details =
    code === 'hosted-discovery-not-ready'
      ? Object.freeze({
          path: '' as const,
          message: 'Hosted discovery is not ready.' as const,
        })
      : code === 'repository-fingerprint-not-supported'
        ? Object.freeze({
            path: '/repositoryFingerprintReference' as const,
            message:
              'Repository fingerprints are not supported by capability discovery.' as const,
          })
        : Object.freeze({
            path: '' as const,
            message:
              'Candidate retrieval request construction failed.' as const,
          });
  return Object.freeze({
    ok: false,
    failure: Object.freeze({ kind: 'application', code, ...details }),
  });
}
