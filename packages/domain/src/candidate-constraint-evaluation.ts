import type {
  CapabilityQueryConstraintFacet,
  CapabilityQueryConstraintModality,
} from './capability-query.ts';
import type {
  NormalizedCapabilityConstraint,
  PreservedCapabilityQueryDeclaration,
} from './capability-query-normalization.ts';
import type {
  DeterministicCandidateProfile,
  DeterministicProfileFieldId,
  DeterministicProfileFieldRecord,
} from './deterministic-candidate-profile.ts';
import { validateDeterministicCandidateProfile } from './deterministic-candidate-profile.ts';
import {
  addIssue,
  finalizeIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';
import type { CapabilityFamily } from './model.ts';

export const CANDIDATE_CONSTRAINT_EVALUATION_VERSION =
  'candidate-constraint-evaluation/1.0.0' as const;

export type CandidateConstraintState = 'conflict' | 'satisfied' | 'unresolved';
export type CandidateConstraintMatch = 'match' | 'mismatch' | 'unresolved';

export interface CandidateConstraintNormalizationInput {
  readonly outcome: 'clarification-required' | 'normalized' | 'unsupported';
  readonly taxonomyVersion: string;
  readonly taxonomySemanticDigest: string;
  readonly primaryFamilyId: CapabilityFamily | null;
  readonly normalizedConstraints: readonly NormalizedCapabilityConstraint[];
  readonly preservedDeclarations: readonly PreservedCapabilityQueryDeclaration[];
}

export interface CandidateConstraintEvaluationInput {
  readonly profile: DeterministicCandidateProfile;
  readonly normalization: CandidateConstraintNormalizationInput;
}

export interface CandidateConstraintEvaluationItem {
  readonly evaluationId: string;
  readonly sourceKind:
    'normalized-constraint' | 'preserved-declaration' | 'primary-family';
  readonly modality: CapabilityQueryConstraintModality;
  readonly facet: CapabilityQueryConstraintFacet;
  readonly conceptId: string | null;
  readonly profileFieldId: DeterministicProfileFieldId | null;
  readonly match: CandidateConstraintMatch;
  readonly state: CandidateConstraintState;
  readonly ruleId: string;
}

export interface CandidateConstraintEvaluation {
  readonly candidateId: string;
  readonly normalizationTaxonomyVersion: string;
  readonly normalizationTaxonomySemanticDigest: string;
  readonly overallHardState: CandidateConstraintState;
  readonly evaluations: readonly CandidateConstraintEvaluationItem[];
}

export function evaluateCandidateConstraintProfileState(input: {
  readonly profileState: 'conflict' | 'known' | 'not-applicable' | 'unknown';
  readonly modality: CapabilityQueryConstraintModality;
  readonly knownMatch?: boolean;
}): Pick<CandidateConstraintEvaluationItem, 'match' | 'state'> {
  const match: CandidateConstraintMatch =
    input.profileState === 'unknown' || input.profileState === 'conflict'
      ? 'unresolved'
      : input.profileState === 'not-applicable'
        ? 'mismatch'
        : input.knownMatch === true
          ? 'match'
          : input.knownMatch === false
            ? 'mismatch'
            : 'unresolved';
  return {
    match,
    state: stateForMatch(match, input.modality),
  };
}

export function evaluateCandidateConstraints(
  input: CandidateConstraintEvaluationInput,
): DomainResult<CandidateConstraintEvaluation> {
  const issues: DomainIssue[] = [];
  const parsedProfile = validateDeterministicCandidateProfile(input.profile);
  const primaryFamilyId = input.normalization.primaryFamilyId;
  if (!parsedProfile.ok) {
    addIssue(issues, 'profile.evaluation', '$.profile');
  }
  if (
    input.normalization.outcome !== 'normalized' ||
    primaryFamilyId === null ||
    input.profile.taxonomyBinding.taxonomyVersion !==
      input.normalization.taxonomyVersion ||
    input.profile.taxonomyBinding.taxonomySemanticDigest !==
      input.normalization.taxonomySemanticDigest
  ) {
    addIssue(issues, 'profile.evaluation', '$.normalization');
  }
  const finalized = finalizeIssues(issues);
  if (finalized.length > 0 || !parsedProfile.ok || primaryFamilyId === null) {
    return { ok: false, issues: finalized };
  }

  const primary = evaluatePrimaryFamily(parsedProfile.value, primaryFamilyId);
  const constraints = input.normalization.normalizedConstraints.map(
    (constraint) =>
      evaluateNormalizedConstraint(parsedProfile.value, constraint),
  );
  const declarations = input.normalization.preservedDeclarations.map(
    evaluatePreservedDeclaration,
  );
  const evaluations = [primary, ...constraints, ...declarations];
  const hard = evaluations.filter(
    ({ modality }) => modality === 'required' || modality === 'prohibited',
  );
  const overallHardState = hard.some(({ state }) => state === 'conflict')
    ? 'conflict'
    : hard.some(({ state }) => state === 'unresolved')
      ? 'unresolved'
      : 'satisfied';

  return {
    ok: true,
    value: {
      candidateId: parsedProfile.value.candidateId,
      normalizationTaxonomyVersion: input.normalization.taxonomyVersion,
      normalizationTaxonomySemanticDigest:
        input.normalization.taxonomySemanticDigest,
      overallHardState,
      evaluations,
    },
  };
}

function evaluatePrimaryFamily(
  profile: DeterministicCandidateProfile,
  family: CapabilityFamily,
): CandidateConstraintEvaluationItem {
  const field = getField(profile, 'capability-family');
  const match =
    field.state === 'known'
      ? field.value.primaryFamily === family
        ? 'match'
        : 'mismatch'
      : 'unresolved';
  return makeItem({
    evaluationId: 'primary-capability-family',
    sourceKind: 'primary-family',
    modality: 'required',
    facet: 'capability',
    conceptId: family,
    profileFieldId: 'capability-family',
    match,
    ruleId: 'evaluate-primary-capability-family',
  });
}

function evaluateNormalizedConstraint(
  profile: DeterministicCandidateProfile,
  constraint: NormalizedCapabilityConstraint,
): CandidateConstraintEvaluationItem {
  const mapping = exactMapping(constraint.facet);
  if (
    constraint.resolutionBasis !== 'controlled-taxonomy' ||
    constraint.conceptId === null ||
    mapping === null
  ) {
    return makeItem({
      evaluationId: constraint.normalizedConstraintId,
      sourceKind: 'normalized-constraint',
      modality: constraint.modality,
      facet: constraint.facet,
      conceptId: constraint.conceptId,
      profileFieldId: mapping?.fieldId ?? null,
      match: 'unresolved',
      ruleId: 'unresolved-without-exact-profile-mapping',
    });
  }
  const field = getField(profile, mapping.fieldId);
  const match = evaluateFieldConcept(field, constraint.conceptId);
  return makeItem({
    evaluationId: constraint.normalizedConstraintId,
    sourceKind: 'normalized-constraint',
    modality: constraint.modality,
    facet: constraint.facet,
    conceptId: constraint.conceptId,
    profileFieldId: mapping.fieldId,
    match,
    ruleId: mapping.ruleId,
  });
}

function evaluatePreservedDeclaration(
  declaration: PreservedCapabilityQueryDeclaration,
): CandidateConstraintEvaluationItem {
  return makeItem({
    evaluationId: declaration.constraintId,
    sourceKind: 'preserved-declaration',
    modality: declaration.modality,
    facet: declaration.facet,
    conceptId: null,
    profileFieldId: null,
    match: 'unresolved',
    ruleId: 'preserved-declaration-has-no-controlled-profile-mapping',
  });
}

function evaluateFieldConcept(
  field: DeterministicProfileFieldRecord,
  conceptId: string,
): CandidateConstraintMatch {
  if (field.state === 'unknown' || field.state === 'conflict') {
    return 'unresolved';
  }
  if (field.state === 'not-applicable') {
    return 'mismatch';
  }
  if (
    field.fieldId !== 'adoption-unit-type' &&
    field.fieldId !== 'capability-variants-features' &&
    field.fieldId !== 'required-infrastructure'
  ) {
    return 'unresolved';
  }
  const value = (field as { readonly value: unknown }).value as {
    readonly completeness: 'complete';
    readonly conceptIds: readonly string[];
  };
  return value.conceptIds.includes(conceptId) ? 'match' : 'mismatch';
}

function makeItem(
  item: Omit<CandidateConstraintEvaluationItem, 'state'>,
): CandidateConstraintEvaluationItem {
  const state = stateForMatch(item.match, item.modality);
  return { ...item, state };
}

function stateForMatch(
  match: CandidateConstraintMatch,
  modality: CapabilityQueryConstraintModality,
): CandidateConstraintState {
  return match === 'unresolved'
    ? 'unresolved'
    : modality === 'prohibited'
      ? match === 'match'
        ? 'conflict'
        : 'satisfied'
      : match === 'match'
        ? 'satisfied'
        : 'conflict';
}

function exactMapping(facet: CapabilityQueryConstraintFacet): {
  readonly fieldId: DeterministicProfileFieldId;
  readonly ruleId: string;
} | null {
  switch (facet) {
    case 'architecture':
      return {
        fieldId: 'adoption-unit-type',
        ruleId: 'evaluate-complete-adoption-unit-concept-set',
      };
    case 'feature':
      return {
        fieldId: 'capability-variants-features',
        ruleId: 'evaluate-complete-feature-concept-set',
      };
    case 'infrastructure':
      return {
        fieldId: 'required-infrastructure',
        ruleId: 'evaluate-required-infrastructure-only',
      };
    case 'capability':
    case 'datastore':
    case 'deployment':
    case 'ecosystem':
    case 'framework':
    case 'license':
    case 'maintenance':
    case 'other':
    case 'release':
    case 'repository-state':
    case 'runtime':
    case 'security':
      return null;
  }
}

function getField<FieldId extends DeterministicProfileFieldId>(
  profile: DeterministicCandidateProfile,
  fieldId: FieldId,
): DeterministicProfileFieldRecord<FieldId> {
  const field = profile.fields.find(
    (candidate) => candidate.fieldId === fieldId,
  );
  if (field === undefined) {
    throw new Error('Validated candidate profile field is missing.');
  }
  return field as DeterministicProfileFieldRecord<FieldId>;
}
