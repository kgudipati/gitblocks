import type {
  CapabilityQueryConstraintFacet,
  CapabilityQueryConstraintModality,
} from './capability-query.ts';
import type {
  NormalizedCapabilityConstraint,
  PreservedCapabilityQueryDeclaration,
} from './capability-query-normalization.ts';
import { isCapabilityQueryTargetFitContext } from './capability-query-normalization.ts';
import type {
  DeterministicCandidateProfileEvaluatorV2,
  DeterministicProfileEvaluatorFieldV2,
} from './deterministic-candidate-profile-v2.ts';
import type {
  DeterministicCandidateProfile,
  DeterministicProfileFieldId,
  DeterministicProfileFieldRecord,
} from './deterministic-candidate-profile.ts';
import {
  DETERMINISTIC_PROFILE_FIELD_IDS,
  validateDeterministicCandidateProfile,
} from './deterministic-candidate-profile.ts';
import {
  addIssue,
  finalizeIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';
import type { CapabilityFamily } from './model.ts';

export const CANDIDATE_CONSTRAINT_EVALUATION_VERSION_V1 =
  'candidate-constraint-evaluation/1.0.0' as const;
export const CANDIDATE_CONSTRAINT_EVALUATION_VERSION =
  'candidate-constraint-evaluation/2.0.0' as const;

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

export interface CandidateConstraintEvaluationInputV2 {
  readonly profile: DeterministicCandidateProfileEvaluatorV2;
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
  const declarationIds = new Set(
    input.normalization.preservedDeclarations.map(
      ({ constraintId }) => constraintId,
    ),
  );
  const controlledConstraintSourceIds = new Set<string>();
  const targetFitContextSourceIds = targetFitContextConstraintSourceIds(
    input.normalization.normalizedConstraints,
  );
  const constraints = input.normalization.normalizedConstraints.flatMap(
    (constraint) => {
      const controlled =
        constraint.resolutionBasis === 'controlled-taxonomy' &&
        constraint.conceptId !== null;
      if (controlled) {
        constraint.sourceConstraintIds.forEach((sourceId) =>
          controlledConstraintSourceIds.add(sourceId),
        );
      }
      const preservedCoverage = constraint.sourceConstraintIds.every(
        (sourceId) => declarationIds.has(sourceId),
      );
      return controlled || !preservedCoverage
        ? [evaluateNormalizedConstraint(parsedProfile.value, constraint)]
        : [];
    },
  );
  const declarations = input.normalization.preservedDeclarations
    .filter(
      ({ constraintId }) =>
        !controlledConstraintSourceIds.has(constraintId) &&
        !targetFitContextSourceIds.has(constraintId),
    )
    .map(evaluatePreservedDeclaration);
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

export function evaluateCandidateConstraintsV2(
  input: CandidateConstraintEvaluationInputV2,
): DomainResult<CandidateConstraintEvaluation> {
  const issues: DomainIssue[] = [];
  const primaryFamilyId = input.normalization.primaryFamilyId;
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
  if (finalized.length > 0 || primaryFamilyId === null) {
    return { ok: false, issues: finalized };
  }

  const primary = evaluatePrimaryFamilyV2(input.profile, primaryFamilyId);
  const declarationIds = new Set(
    input.normalization.preservedDeclarations.map(
      ({ constraintId }) => constraintId,
    ),
  );
  const controlledConstraintSourceIds = new Set<string>();
  const targetFitContextSourceIds = targetFitContextConstraintSourceIds(
    input.normalization.normalizedConstraints,
  );
  const constraints = input.normalization.normalizedConstraints.flatMap(
    (constraint) => {
      const controlled =
        constraint.resolutionBasis === 'controlled-taxonomy' &&
        constraint.conceptId !== null;
      if (controlled) {
        constraint.sourceConstraintIds.forEach((sourceId) =>
          controlledConstraintSourceIds.add(sourceId),
        );
      }
      const preservedCoverage = constraint.sourceConstraintIds.every(
        (sourceId) => declarationIds.has(sourceId),
      );
      return controlled || !preservedCoverage
        ? [evaluateNormalizedConstraintV2(input.profile, constraint)]
        : [];
    },
  );
  const declarations = input.normalization.preservedDeclarations
    .filter(
      ({ constraintId }) =>
        !controlledConstraintSourceIds.has(constraintId) &&
        !targetFitContextSourceIds.has(constraintId),
    )
    .map(evaluatePreservedDeclaration);
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
      candidateId: input.profile.candidateId,
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

function evaluatePrimaryFamilyV2(
  profile: DeterministicCandidateProfileEvaluatorV2,
  family: CapabilityFamily,
): CandidateConstraintEvaluationItem {
  const field = getEvaluatorField(profile, 'capability-family');
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
  const positiveInfrastructure =
    constraint.facet === 'infrastructure' &&
    constraint.modality !== 'prohibited';
  const match = positiveInfrastructure
    ? combinePositiveInfrastructureMatches(
        evaluateFieldConcept(field, constraint.conceptId),
        evaluateFieldConcept(
          getField(profile, 'optional-infrastructure'),
          constraint.conceptId,
        ),
      )
    : evaluateFieldConcept(field, constraint.conceptId);
  return makeItem({
    evaluationId: constraint.normalizedConstraintId,
    sourceKind: 'normalized-constraint',
    modality: constraint.modality,
    facet: constraint.facet,
    conceptId: constraint.conceptId,
    profileFieldId: mapping.fieldId,
    match,
    ruleId: positiveInfrastructure
      ? 'evaluate-required-or-optional-infrastructure'
      : mapping.ruleId,
  });
}

function evaluateNormalizedConstraintV2(
  profile: DeterministicCandidateProfileEvaluatorV2,
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
  const field = getEvaluatorField(profile, mapping.fieldId);
  const positiveInfrastructure =
    constraint.facet === 'infrastructure' &&
    constraint.modality !== 'prohibited';
  const match = positiveInfrastructure
    ? combinePositiveInfrastructureMatches(
        evaluateFieldConceptV2(field, constraint.conceptId),
        evaluateFieldConceptV2(
          getEvaluatorField(profile, 'optional-infrastructure'),
          constraint.conceptId,
        ),
      )
    : evaluateFieldConceptV2(field, constraint.conceptId);
  return makeItem({
    evaluationId: constraint.normalizedConstraintId,
    sourceKind: 'normalized-constraint',
    modality: constraint.modality,
    facet: constraint.facet,
    conceptId: constraint.conceptId,
    profileFieldId: mapping.fieldId,
    match,
    ruleId: positiveInfrastructure
      ? 'evaluate-required-or-optional-infrastructure'
      : mapping.ruleId,
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

function targetFitContextConstraintSourceIds(
  constraints: readonly NormalizedCapabilityConstraint[],
): ReadonlySet<string> {
  return new Set(
    constraints
      .filter(isCapabilityQueryTargetFitContext)
      .flatMap(({ sourceConstraintIds }) => sourceConstraintIds),
  );
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
    field.fieldId !== 'required-infrastructure' &&
    field.fieldId !== 'optional-infrastructure'
  ) {
    return 'unresolved';
  }
  const value = (field as { readonly value: unknown }).value as {
    readonly completeness: 'complete';
    readonly conceptIds: readonly string[];
  };
  return value.conceptIds.includes(conceptId) ? 'match' : 'mismatch';
}

function evaluateFieldConceptV2(
  field: DeterministicProfileEvaluatorFieldV2,
  conceptId: string,
): CandidateConstraintMatch {
  if (
    field.fieldId !== 'adoption-unit-type' &&
    field.fieldId !== 'capability-variants-features' &&
    field.fieldId !== 'required-infrastructure' &&
    field.fieldId !== 'optional-infrastructure'
  ) {
    return 'unresolved';
  }
  if (field.legacyWholeFieldConflict !== undefined) return 'unresolved';
  const assertion = binarySearchAssertion(field.assertions, conceptId);
  if (assertion !== null) {
    return assertion.state === 'present'
      ? 'match'
      : assertion.state === 'absent'
        ? 'mismatch'
        : 'unresolved';
  }
  return field.coverage === 'complete' ? 'mismatch' : 'unresolved';
}

function combinePositiveInfrastructureMatches(
  requiredMatch: CandidateConstraintMatch,
  optionalMatch: CandidateConstraintMatch,
): CandidateConstraintMatch {
  if (requiredMatch === 'match' || optionalMatch === 'match') return 'match';
  return requiredMatch === 'mismatch' && optionalMatch === 'mismatch'
    ? 'mismatch'
    : 'unresolved';
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

function getEvaluatorField<FieldId extends DeterministicProfileFieldId>(
  profile: DeterministicCandidateProfileEvaluatorV2,
  fieldId: FieldId,
): DeterministicProfileEvaluatorFieldV2<FieldId> {
  const ordinal = DETERMINISTIC_PROFILE_FIELD_IDS.indexOf(fieldId);
  const field = profile.fields[ordinal];
  if (field?.fieldId !== fieldId) {
    throw new Error('Validated candidate evaluator field is missing.');
  }
  return field as DeterministicProfileEvaluatorFieldV2<FieldId>;
}

function binarySearchAssertion(
  assertions: readonly {
    readonly conceptId: string;
    readonly state: 'absent' | 'conflict' | 'present';
  }[],
  conceptId: string,
): (typeof assertions)[number] | null {
  let low = 0;
  let high = assertions.length - 1;
  while (low <= high) {
    const middle = (low + high) >>> 1;
    const assertion = assertions[middle];
    if (assertion === undefined) return null;
    if (assertion.conceptId === conceptId) return assertion;
    if (assertion.conceptId < conceptId) low = middle + 1;
    else high = middle - 1;
  }
  return null;
}
