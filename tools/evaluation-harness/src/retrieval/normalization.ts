import {
  normalizeCapabilityQueryV1,
  parseCapabilityQueryInputV1,
  type CapabilityQueryNormalizationResultV1,
  type DeterministicCandidateProfileAuthority,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/contracts';

import type {
  NormalizationProjection,
  RetrievalQueryDocument,
} from './contracts.ts';

export interface CandidateReferenceAuthorityV1 {
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly candidates: readonly {
    readonly candidateId: string;
    readonly capabilityFamily:
      | 'authorization'
      | 'audit-logging'
      | 'background-jobs'
      | 'rate-limiting'
      | 'webhooks';
    readonly repositoryKey: string;
    readonly npmPackageKey: string | null;
  }[];
}

export function buildCandidateReferenceAuthority(
  authority: DeterministicCandidateProfileAuthority,
): CandidateReferenceAuthorityV1 {
  return {
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    candidates: authority.profiles.map((profile) => {
      const family = profile.fields.find(
        (field) => field.fieldId === 'capability-family',
      ) as DeterministicProfileFieldRecord<'capability-family'> | undefined;
      const repository = profile.fields.find(
        (field) => field.fieldId === 'repository-identity',
      ) as DeterministicProfileFieldRecord<'repository-identity'> | undefined;
      const packageMapping = profile.fields.find(
        (field) => field.fieldId === 'package-identity-mapping',
      ) as
        DeterministicProfileFieldRecord<'package-identity-mapping'> | undefined;
      if (
        family?.state !== 'known' ||
        repository?.state !== 'known' ||
        packageMapping?.state !== 'known'
      ) {
        throw new Error('Required profile identity authority is unavailable.');
      }
      return {
        candidateId: profile.candidateId,
        capabilityFamily: family.value.primaryFamily,
        repositoryKey:
          `${repository.value.githubOwner}/${repository.value.githubRepository}`.toLowerCase(),
        npmPackageKey:
          packageMapping.value.mapping === 'mapped'
            ? packageMapping.value.packageName.toLowerCase()
            : null,
      };
    }),
  };
}

export function normalizeRetrievalQuery(
  query: RetrievalQueryDocument,
  taxonomy: unknown,
  candidateAuthority: CandidateReferenceAuthorityV1,
): CapabilityQueryNormalizationResultV1 {
  const parsed = parseCapabilityQueryInputV1(query.queryInput);
  if (!parsed.ok) {
    throw new Error(
      'Retrieval query input failed the accepted contract parser.',
    );
  }
  const normalized = normalizeCapabilityQueryV1(
    parsed.value,
    taxonomy,
    candidateAuthority,
  );
  if (!normalized.ok) {
    throw new Error('Retrieval query normalization failed.');
  }
  return normalized.value;
}

export function projectNormalization(
  result: CapabilityQueryNormalizationResultV1,
): NormalizationProjection {
  return {
    outcome: result.outcome,
    primaryFamily: result.primaryFamilyId,
    normalizedConcepts: result.normalizedCapabilityConcepts.map((value) => ({
      conceptId: value.conceptId,
      sourceTermIds: [...value.sourceTermIds],
      ruleId: value.ruleId,
    })),
    normalizedConstraints: result.normalizedConstraints.map((value) => ({
      sourceConstraintIds: [...value.sourceConstraintIds],
      modality: value.modality,
      facet: value.facet,
      resolutionBasis: value.resolutionBasis,
      ruleId: value.ruleId,
      conceptId: value.conceptId,
      canonicalTerm: value.canonicalTerm,
    })),
    unresolved: result.unresolvedTerms.map((value) => ({
      sourceIds: [...value.sourceIds],
      reasonCode: value.reasonCode,
      blocking: value.blocking,
    })),
    clarifications: result.clarifications.map((value) => ({
      reasonCode: value.reasonCode,
      sourceIds: [...value.sourceIds],
      possibleConceptIds: [...value.possibleConceptIds],
    })),
    notices: result.notices.map((value) => ({
      reasonCode: value.reasonCode,
      sourceIds: [...value.sourceIds],
      replacementAliasKey: value.replacementAliasKey,
    })),
  };
}
