import { type CapabilityQueryNormalizationResultV1 } from '@gitblocks/contracts';
import {
  evaluateCandidateConstraints,
  type DeterministicCandidateProfileAuthority,
  type DeterministicProfileFieldRecord,
} from '@gitblocks/domain';

import type {
  GeneratedCandidateDecision,
  GeneratedHardFilterProjection,
} from './contracts.ts';
import { retrievalSemanticDigest } from './stable-json.ts';

export function generateHardFilterProjection(
  normalization: CapabilityQueryNormalizationResultV1,
  authority: DeterministicCandidateProfileAuthority,
): GeneratedHardFilterProjection {
  if (normalization.outcome !== 'normalized') {
    throw new Error('Hard-filter projection requires a normalized query.');
  }
  const decisions = authority.profiles.map((profile) => {
    const evaluated = evaluateCandidateConstraints({
      profile,
      normalization: {
        outcome: normalization.outcome,
        taxonomyVersion: normalization.taxonomyVersion,
        taxonomySemanticDigest: normalization.taxonomySemanticDigest,
        primaryFamilyId: normalization.primaryFamilyId,
        normalizedConstraints: normalization.normalizedConstraints,
        preservedDeclarations: normalization.preservedDeclarations,
      },
    });
    if (!evaluated.ok) {
      throw new Error('Accepted candidate constraint evaluation failed.');
    }
    const status = profile.fields.find(
      (field) => field.fieldId === 'catalog-role-status',
    ) as DeterministicProfileFieldRecord<'catalog-role-status'> | undefined;
    if (status?.state !== 'known') {
      throw new Error('Candidate catalog status is unavailable.');
    }
    const negativeControl = status.value.catalogStatus === 'negative-control';
    const hardState = evaluated.value.overallHardState;
    const lane =
      hardState === 'conflict' || negativeControl
        ? 'excluded'
        : hardState === 'unresolved'
          ? 'evidence-needed'
          : 'eligible';
    return {
      candidateId: profile.candidateId,
      hardState,
      lane,
      negativeControl,
    } satisfies GeneratedCandidateDecision;
  });
  const hardStateCounts = {
    conflict: decisions.filter(({ hardState }) => hardState === 'conflict')
      .length,
    satisfied: decisions.filter(({ hardState }) => hardState === 'satisfied')
      .length,
    unresolved: decisions.filter(({ hardState }) => hardState === 'unresolved')
      .length,
  };
  const laneCounts = {
    eligible: decisions.filter(({ lane }) => lane === 'eligible').length,
    'evidence-needed': decisions.filter(
      ({ lane }) => lane === 'evidence-needed',
    ).length,
    excluded: decisions.filter(({ lane }) => lane === 'excluded').length,
  };
  return {
    decisions,
    digest: retrievalSemanticDigest(decisions),
    hardStateCounts,
    laneCounts,
  };
}
