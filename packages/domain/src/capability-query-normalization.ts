import {
  lookupCapabilityTaxonomyTerm,
  validateCapabilityTaxonomy,
  type CapabilityTaxonomy,
  type CapabilityTaxonomyConcept,
} from './capability-taxonomy.ts';
import {
  CAPABILITY_QUERY_LIMITS,
  canonicalizeCapabilityQueryInput,
  validateCandidateReferenceAuthority,
  validateCapabilityQueryInput,
  type CandidateReferenceAuthority,
  type CapabilityQueryCandidateReference,
  type CapabilityQueryConstraintFacet,
  type CapabilityQueryConstraintModality,
  type CapabilityQueryDraftConstraint,
  type CapabilityQueryInput,
  type CapabilityQueryOutcome,
  type CapabilityQueryRepositoryFingerprintReference,
} from './capability-query.ts';
import {
  addIssue,
  compareText,
  prefixIssues,
  resultFromIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';
import type { CapabilityFamily } from './model.ts';

export type CapabilityQueryTermCanonicalizationResult =
  | { readonly ok: true; readonly value: string }
  | {
      readonly ok: false;
      readonly reason:
        'empty' | 'non-ascii' | 'too-long' | 'unsupported-character';
    };

export type CapabilityQueryConstraintResolutionBasis =
  | 'ambiguity'
  | 'contradiction'
  | 'controlled-taxonomy'
  | 'exclusion'
  | 'preserved-declaration'
  | 'unresolved';

export interface NormalizedCapabilityConcept {
  readonly conceptId: string;
  readonly sourceTermIds: readonly string[];
  readonly ruleId: string;
}

export interface NormalizedCapabilityConstraint {
  readonly normalizedConstraintId: string;
  readonly sourceConstraintIds: readonly string[];
  readonly modality: CapabilityQueryConstraintModality;
  readonly facet: CapabilityQueryConstraintFacet;
  readonly resolutionBasis: CapabilityQueryConstraintResolutionBasis;
  readonly ruleId: string;
  readonly conceptId: string | null;
  readonly canonicalTerm: string | null;
}

export interface PreservedCapabilityQueryDeclaration {
  readonly constraintId: string;
  readonly modality: CapabilityQueryConstraintModality;
  readonly statement: string;
  readonly originalTerm: string;
  readonly facet: CapabilityQueryConstraintFacet;
  readonly reasonCode: string | null;
}

export interface ResolvedCapabilityQueryCandidateReference {
  readonly referenceId: string;
  readonly referenceKind: CapabilityQueryCandidateReference['kind'];
  readonly intent: CapabilityQueryCandidateReference['intent'];
  readonly candidateId: string;
  readonly capabilityFamily: CapabilityFamily;
  readonly ruleId: string;
}

export interface CapabilityQueryUnresolvedTerm {
  readonly unresolvedId: string;
  readonly sourceKind: 'candidate-reference' | 'capability-term' | 'constraint';
  readonly sourceIds: readonly string[];
  readonly canonicalTerm: string | null;
  readonly reasonCode: string;
  readonly blocking: boolean;
}

export interface CapabilityQueryClarification {
  readonly clarificationId: string;
  readonly reasonCode: string;
  readonly sourceIds: readonly string[];
  readonly possibleConceptIds: readonly string[];
  readonly context: string;
}

export interface CapabilityQueryNormalizationNotice {
  readonly noticeId: string;
  readonly reasonCode: string;
  readonly sourceIds: readonly string[];
  readonly replacementAliasKey: string;
}

export interface CapabilityQueryNormalizationStep {
  readonly stepId: string;
  readonly ruleId: string;
  readonly inputSourceIds: readonly string[];
  readonly outputIds: readonly string[];
}

export interface CapabilityQueryNormalizationCore {
  readonly outcome: CapabilityQueryOutcome;
  readonly primaryFamilyId: CapabilityFamily | null;
  readonly normalizedCapabilityConcepts: readonly NormalizedCapabilityConcept[];
  readonly normalizedConstraints: readonly NormalizedCapabilityConstraint[];
  readonly preservedDeclarations: readonly PreservedCapabilityQueryDeclaration[];
  readonly resolvedCandidateReferences: readonly ResolvedCapabilityQueryCandidateReference[];
  readonly unresolvedTerms: readonly CapabilityQueryUnresolvedTerm[];
  readonly clarifications: readonly CapabilityQueryClarification[];
  readonly notices: readonly CapabilityQueryNormalizationNotice[];
  readonly normalizationSteps: readonly CapabilityQueryNormalizationStep[];
  readonly repositoryFingerprintReference: CapabilityQueryRepositoryFingerprintReference | null;
  readonly candidateAuthorityUsed: boolean;
}

interface ClarificationDraft {
  readonly reasonCode: string;
  readonly sourceIds: readonly string[];
  readonly possibleConceptIds: readonly string[];
  readonly context: string;
}

interface UnresolvedDraft {
  readonly sourceKind: CapabilityQueryUnresolvedTerm['sourceKind'];
  readonly sourceIds: readonly string[];
  readonly canonicalTerm: string | null;
  readonly reasonCode: string;
  readonly blocking: boolean;
}

interface NoticeDraft {
  readonly reasonCode: string;
  readonly sourceIds: readonly string[];
  readonly replacementAliasKey: string;
}

interface ConstraintDraft {
  readonly sourceConstraintIds: readonly string[];
  readonly modality: CapabilityQueryConstraintModality;
  readonly facet: CapabilityQueryConstraintFacet;
  readonly resolutionBasis: CapabilityQueryConstraintResolutionBasis;
  readonly ruleId: string;
  readonly conceptId: string | null;
  readonly canonicalTerm: string | null;
}

interface CapabilityResolution {
  readonly concept: CapabilityTaxonomyConcept;
  readonly sourceTermId: string;
  readonly ruleId: string;
}

const TAXONOMY_FACETS = new Set<CapabilityQueryConstraintFacet>([
  'capability',
  'architecture',
  'feature',
  'infrastructure',
  'deployment',
]);

export function canonicalizeCapabilityQueryLookupTermV1(
  value: string,
): CapabilityQueryTermCanonicalizationResult {
  if (value.length > CAPABILITY_QUERY_LIMITS.termCodeUnits) {
    return { ok: false, reason: 'too-long' };
  }
  if (/[^\u0020-\u007e]/u.test(value)) {
    return { ok: false, reason: 'non-ascii' };
  }
  if (/[^A-Za-z0-9 -]/u.test(value)) {
    return { ok: false, reason: 'unsupported-character' };
  }
  let start = 0;
  let end = value.length;
  while (value[start] === ' ') start += 1;
  while (end > start && value[end - 1] === ' ') end -= 1;

  let canonical = '';
  for (let index = start; index < end; index += 1) {
    const character = value[index] ?? '';
    if (character === ' ' || character === '-') {
      if (!canonical.endsWith('-')) canonical += '-';
      continue;
    }
    const code = character.charCodeAt(0);
    canonical +=
      code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : character;
  }
  if (canonical.length === 0) {
    return { ok: false, reason: 'empty' };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(canonical)) {
    return {
      ok: false,
      reason: canonical.length > 64 ? 'too-long' : 'unsupported-character',
    };
  }
  return { ok: true, value: canonical };
}

export function normalizeCapabilityQuery(
  suppliedInput: CapabilityQueryInput,
  suppliedTaxonomy: CapabilityTaxonomy,
  suppliedCandidateAuthority?: CandidateReferenceAuthority,
): DomainResult<CapabilityQueryNormalizationCore> {
  const issues: DomainIssue[] = [];
  const inputValidation = validateCapabilityQueryInput(suppliedInput);
  if (!inputValidation.ok) {
    prefixIssues(issues, 'input', inputValidation.issues);
  }
  const taxonomyValidation = validateCapabilityTaxonomy(suppliedTaxonomy);
  if (!taxonomyValidation.ok) {
    prefixIssues(issues, 'taxonomy', taxonomyValidation.issues);
  }
  let candidateAuthority: CandidateReferenceAuthority | undefined;
  if (
    suppliedInput.candidateReferences.length > 0 &&
    suppliedCandidateAuthority !== undefined
  ) {
    const authorityValidation = validateCandidateReferenceAuthority(
      suppliedCandidateAuthority,
    );
    if (!authorityValidation.ok) {
      prefixIssues(issues, 'candidateAuthority', authorityValidation.issues);
    } else {
      candidateAuthority = authorityValidation.value;
    }
  }
  if (issues.length > 0 || !inputValidation.ok || !taxonomyValidation.ok) {
    return resultFromIssues(emptyCore(suppliedInput), issues);
  }

  const input = canonicalizeCapabilityQueryInput(inputValidation.value);
  const taxonomy = taxonomyValidation.value;
  const concepts = new Map(
    taxonomy.concepts.map((concept) => [concept.conceptId, concept]),
  );
  const clarifications: ClarificationDraft[] = [];
  const unresolved: UnresolvedDraft[] = [];
  const notices: NoticeDraft[] = [];
  const capabilityResolutions: CapabilityResolution[] = [];
  const primaryTermClassifications: string[] = [];

  for (const term of input.capabilityTerms) {
    const canonical = canonicalizeCapabilityQueryLookupTermV1(
      term.originalTerm,
    );
    if (!canonical.ok) {
      primaryTermClassifications.push('unknown');
      addUnknownTerm(
        'capability-term',
        term.termId,
        null,
        canonicalizationReason(canonical.reason),
        true,
        unresolved,
        clarifications,
      );
      continue;
    }
    const lookup = lookupCapabilityTaxonomyTerm(taxonomy, canonical.value);
    switch (lookup.kind) {
      case 'resolved': {
        primaryTermClassifications.push('resolved');
        const concept = concepts.get(lookup.conceptId);
        if (concept === undefined) {
          addIssue(
            issues,
            'query.normalization',
            `capabilityTerms.${term.termId}`,
          );
          break;
        }
        capabilityResolutions.push({
          concept,
          sourceTermId: term.termId,
          ruleId:
            lookup.aliasStatus === 'deprecated'
              ? 'taxonomy-deprecated-alias'
              : 'taxonomy-active-alias',
        });
        if (
          lookup.aliasStatus === 'deprecated' &&
          lookup.replacementAliasKey !== null
        ) {
          notices.push({
            reasonCode: 'deprecated-taxonomy-alias',
            sourceIds: [term.termId],
            replacementAliasKey: lookup.replacementAliasKey,
          });
        }
        break;
      }
      case 'ambiguous':
        primaryTermClassifications.push('ambiguous');
        unresolved.push({
          sourceKind: 'capability-term',
          sourceIds: [term.termId],
          canonicalTerm: canonical.value,
          reasonCode: lookup.clarificationReasonCode,
          blocking: true,
        });
        clarifications.push({
          reasonCode: lookup.clarificationReasonCode,
          sourceIds: [term.termId],
          possibleConceptIds: [...lookup.possibleConceptIds],
          context: lookup.clarificationContext,
        });
        break;
      case 'excluded': {
        primaryTermClassifications.push(
          lookup.exclusionReasonCode === 'subjective-term'
            ? 'subjective'
            : 'excluded',
        );
        const blocking = true;
        unresolved.push({
          sourceKind: 'capability-term',
          sourceIds: [term.termId],
          canonicalTerm: canonical.value,
          reasonCode: lookup.exclusionReasonCode,
          blocking,
        });
        if (lookup.exclusionReasonCode === 'subjective-term') {
          clarifications.push({
            reasonCode: lookup.exclusionReasonCode,
            sourceIds: [term.termId],
            possibleConceptIds: [],
            context: lookup.explanation,
          });
        }
        break;
      }
      case 'unknown':
        primaryTermClassifications.push('unknown');
        addUnknownTerm(
          'capability-term',
          term.termId,
          canonical.value,
          'unknown-primary-capability',
          true,
          unresolved,
          clarifications,
        );
        break;
    }
  }

  const preservedDeclarations = input.draftConstraints.map((constraint) => ({
    constraintId: constraint.constraintId,
    modality: constraint.modality,
    statement: constraint.statement,
    originalTerm: constraint.originalTerm,
    facet: constraint.facetHint,
    reasonCode: constraint.reasonCode,
  }));
  const constraintDrafts = normalizeConstraints(
    input.draftConstraints,
    taxonomy,
    concepts,
    unresolved,
    clarifications,
    notices,
  );

  const resolvedCandidateReferences: ResolvedCapabilityQueryCandidateReference[] =
    [];
  const candidateFamilySources: {
    readonly family: CapabilityFamily;
    readonly sourceId: string;
  }[] = [];
  if (input.candidateReferences.length > 0) {
    if (candidateAuthority === undefined) {
      const sourceIds = input.candidateReferences.map(
        ({ referenceId }) => referenceId,
      );
      clarifications.push({
        reasonCode: 'candidate-authority-required',
        sourceIds,
        possibleConceptIds: [],
        context:
          'Exact candidate references require a bounded catalog authority.',
      });
      for (const reference of input.candidateReferences) {
        unresolved.push({
          sourceKind: 'candidate-reference',
          sourceIds: [reference.referenceId],
          canonicalTerm: null,
          reasonCode: 'candidate-authority-required',
          blocking: true,
        });
      }
    } else {
      const indexes = candidateIndexes(candidateAuthority);
      for (const reference of input.candidateReferences) {
        const candidate = indexes[reference.kind].get(reference.value);
        if (candidate === undefined) {
          unresolved.push({
            sourceKind: 'candidate-reference',
            sourceIds: [reference.referenceId],
            canonicalTerm: null,
            reasonCode: 'unknown-candidate-reference',
            blocking: true,
          });
          clarifications.push({
            reasonCode: 'unknown-candidate-reference',
            sourceIds: [reference.referenceId],
            possibleConceptIds: [],
            context: 'Provide an exact candidate, repository, or npm identity.',
          });
          continue;
        }
        resolvedCandidateReferences.push({
          referenceId: reference.referenceId,
          referenceKind: reference.kind,
          intent: reference.intent,
          candidateId: candidate.candidateId,
          capabilityFamily: candidate.capabilityFamily,
          ruleId: `candidate-reference-${reference.kind}`,
        });
        candidateFamilySources.push({
          family: candidate.capabilityFamily,
          sourceId: reference.referenceId,
        });
      }
    }
  }

  const family = resolvePrimaryFamily(
    capabilityResolutions,
    candidateFamilySources,
    clarifications,
  );
  const allAdjacentExcluded =
    input.candidateReferences.length === 0 &&
    primaryTermClassifications.length > 0 &&
    primaryTermClassifications.every(
      (classification) => classification === 'excluded',
    );
  if (!allAdjacentExcluded) {
    for (const term of input.capabilityTerms) {
      const unresolvedTerm = unresolved.find(
        (entry) =>
          entry.sourceKind === 'capability-term' &&
          entry.sourceIds.includes(term.termId),
      );
      if (
        unresolvedTerm?.reasonCode === 'adjacent-capability' &&
        !clarifications.some(({ sourceIds }) => sourceIds.includes(term.termId))
      ) {
        clarifications.push({
          reasonCode: 'excluded-capability-term',
          sourceIds: [term.termId],
          possibleConceptIds: [],
          context:
            'Remove the adjacent term or state an exact supported capability.',
        });
      }
    }
  }
  if (
    family === null &&
    !allAdjacentExcluded &&
    !clarifications.some(({ reasonCode }) =>
      [
        'cross-family-capability',
        'cross-family-candidate-reference',
        'candidate-family-conflict',
      ].includes(reasonCode),
    )
  ) {
    clarifications.push({
      reasonCode: 'primary-family-not-established',
      sourceIds: [
        ...input.capabilityTerms.map(({ termId }) => termId),
        ...input.candidateReferences.map(({ referenceId }) => referenceId),
      ].sort(compareText),
      possibleConceptIds: [],
      context:
        'Specify one capability family within the controlled five-family boundary.',
    });
  }

  if (issues.length > 0) {
    return resultFromIssues(emptyCore(input), issues);
  }

  const normalizedCapabilityConcepts = groupCapabilityConcepts(
    capabilityResolutions,
  );
  const normalizedConstraints = finalizeConstraints(constraintDrafts);
  const finalizedUnresolved = finalizeUnresolved(unresolved);
  const finalizedClarifications = finalizeClarifications(clarifications);
  const finalizedNotices = finalizeNotices(notices);
  const outcome: CapabilityQueryOutcome =
    allAdjacentExcluded && finalizedClarifications.length === 0
      ? 'unsupported'
      : finalizedClarifications.length > 0 || family === null
        ? 'clarification-required'
        : 'normalized';
  const coreWithoutSteps = {
    outcome,
    primaryFamilyId: family,
    normalizedCapabilityConcepts,
    normalizedConstraints,
    preservedDeclarations,
    resolvedCandidateReferences: [...resolvedCandidateReferences].sort(
      (left, right) => compareText(left.referenceId, right.referenceId),
    ),
    unresolvedTerms: finalizedUnresolved,
    clarifications: finalizedClarifications,
    notices: finalizedNotices,
    repositoryFingerprintReference:
      input.repositoryFingerprintReference === null
        ? null
        : { ...input.repositoryFingerprintReference },
    candidateAuthorityUsed: input.candidateReferences.length > 0,
  };
  const normalizationSteps = buildNormalizationSteps(input, coreWithoutSteps);
  if (
    normalizationSteps.length > CAPABILITY_QUERY_LIMITS.normalizationSteps ||
    finalizedClarifications.length > CAPABILITY_QUERY_LIMITS.clarifications
  ) {
    addIssue(issues, 'query.normalization', 'normalizationSteps');
  }
  return resultFromIssues({ ...coreWithoutSteps, normalizationSteps }, issues);
}

function normalizeConstraints(
  constraints: readonly CapabilityQueryDraftConstraint[],
  taxonomy: CapabilityTaxonomy,
  concepts: ReadonlyMap<string, CapabilityTaxonomyConcept>,
  unresolved: UnresolvedDraft[],
  clarifications: ClarificationDraft[],
  notices: NoticeDraft[],
): ConstraintDraft[] {
  const drafts: ConstraintDraft[] = [];
  for (const constraint of constraints) {
    if (!TAXONOMY_FACETS.has(constraint.facetHint)) {
      drafts.push({
        sourceConstraintIds: [constraint.constraintId],
        modality: constraint.modality,
        facet: constraint.facetHint,
        resolutionBasis: 'preserved-declaration',
        ruleId: 'preserve-explicit-declaration',
        conceptId: null,
        canonicalTerm: null,
      });
      continue;
    }
    const canonical = canonicalizeCapabilityQueryLookupTermV1(
      constraint.originalTerm,
    );
    if (!canonical.ok) {
      addConstraintUnresolved(
        constraint,
        null,
        canonicalizationReason(canonical.reason),
        'unresolved',
        unresolved,
        clarifications,
        drafts,
      );
      continue;
    }
    const lookup = lookupCapabilityTaxonomyTerm(taxonomy, canonical.value);
    switch (lookup.kind) {
      case 'resolved': {
        const concept = concepts.get(lookup.conceptId);
        if (
          concept === undefined ||
          !facetAcceptsConcept(constraint.facetHint, concept)
        ) {
          addConstraintUnresolved(
            constraint,
            canonical.value,
            'taxonomy-facet-mismatch',
            'unresolved',
            unresolved,
            clarifications,
            drafts,
          );
          break;
        }
        drafts.push({
          sourceConstraintIds: [constraint.constraintId],
          modality: constraint.modality,
          facet: constraint.facetHint,
          resolutionBasis: 'controlled-taxonomy',
          ruleId:
            lookup.aliasStatus === 'deprecated'
              ? 'taxonomy-deprecated-alias'
              : 'taxonomy-active-alias',
          conceptId: concept.conceptId,
          canonicalTerm: canonical.value,
        });
        if (
          lookup.aliasStatus === 'deprecated' &&
          lookup.replacementAliasKey !== null
        ) {
          notices.push({
            reasonCode: 'deprecated-taxonomy-alias',
            sourceIds: [constraint.constraintId],
            replacementAliasKey: lookup.replacementAliasKey,
          });
        }
        break;
      }
      case 'ambiguous':
        drafts.push({
          sourceConstraintIds: [constraint.constraintId],
          modality: constraint.modality,
          facet: constraint.facetHint,
          resolutionBasis: 'ambiguity',
          ruleId: 'taxonomy-intentional-ambiguity',
          conceptId: null,
          canonicalTerm: canonical.value,
        });
        unresolved.push({
          sourceKind: 'constraint',
          sourceIds: [constraint.constraintId],
          canonicalTerm: canonical.value,
          reasonCode: lookup.clarificationReasonCode,
          blocking: true,
        });
        clarifications.push({
          reasonCode: lookup.clarificationReasonCode,
          sourceIds: [constraint.constraintId],
          possibleConceptIds: [...lookup.possibleConceptIds],
          context: lookup.clarificationContext,
        });
        break;
      case 'excluded': {
        const blocking =
          lookup.exclusionReasonCode === 'subjective-term' ||
          constraint.modality !== 'preferred';
        drafts.push({
          sourceConstraintIds: [constraint.constraintId],
          modality: constraint.modality,
          facet: constraint.facetHint,
          resolutionBasis: 'exclusion',
          ruleId: 'taxonomy-excluded-term',
          conceptId: null,
          canonicalTerm: canonical.value,
        });
        unresolved.push({
          sourceKind: 'constraint',
          sourceIds: [constraint.constraintId],
          canonicalTerm: canonical.value,
          reasonCode: lookup.exclusionReasonCode,
          blocking,
        });
        if (blocking) {
          clarifications.push({
            reasonCode: lookup.exclusionReasonCode,
            sourceIds: [constraint.constraintId],
            possibleConceptIds: [],
            context: lookup.explanation,
          });
        }
        break;
      }
      case 'unknown':
        addConstraintUnresolved(
          constraint,
          canonical.value,
          constraint.modality === 'preferred'
            ? 'unknown-preferred-term'
            : 'unknown-hard-constraint',
          'unresolved',
          unresolved,
          clarifications,
          drafts,
        );
        break;
    }
  }
  return mergeAndMarkContradictions(drafts, clarifications);
}

function addConstraintUnresolved(
  constraint: CapabilityQueryDraftConstraint,
  canonicalTerm: string | null,
  reasonCode: string,
  basis: CapabilityQueryConstraintResolutionBasis,
  unresolved: UnresolvedDraft[],
  clarifications: ClarificationDraft[],
  drafts: ConstraintDraft[],
): void {
  const blocking = constraint.modality !== 'preferred';
  drafts.push({
    sourceConstraintIds: [constraint.constraintId],
    modality: constraint.modality,
    facet: constraint.facetHint,
    resolutionBasis: basis,
    ruleId: 'preserve-unresolved-declaration',
    conceptId: null,
    canonicalTerm,
  });
  unresolved.push({
    sourceKind: 'constraint',
    sourceIds: [constraint.constraintId],
    canonicalTerm,
    reasonCode,
    blocking,
  });
  if (blocking) {
    clarifications.push({
      reasonCode,
      sourceIds: [constraint.constraintId],
      possibleConceptIds: [],
      context:
        'Confirm one exact controlled meaning for this hard declaration.',
    });
  }
}

function mergeAndMarkContradictions(
  drafts: readonly ConstraintDraft[],
  clarifications: ClarificationDraft[],
): ConstraintDraft[] {
  const merged = new Map<string, ConstraintDraft>();
  for (const draft of drafts) {
    const key = JSON.stringify([
      draft.modality,
      draft.facet,
      draft.resolutionBasis,
      draft.ruleId,
      draft.conceptId,
      draft.canonicalTerm,
    ]);
    const previous = merged.get(key);
    merged.set(
      key,
      previous === undefined
        ? { ...draft, sourceConstraintIds: [...draft.sourceConstraintIds] }
        : {
            ...previous,
            sourceConstraintIds: [
              ...previous.sourceConstraintIds,
              ...draft.sourceConstraintIds,
            ].sort(compareText),
          },
    );
  }
  const byConcept = new Map<string, ConstraintDraft[]>();
  for (const draft of merged.values()) {
    if (draft.conceptId === null) continue;
    const key = `${draft.facet}\u0000${draft.conceptId}`;
    const values = byConcept.get(key) ?? [];
    values.push(draft);
    byConcept.set(key, values);
  }
  const contradictoryKeys = new Set<string>();
  for (const [key, values] of byConcept) {
    const modalities = new Set(values.map(({ modality }) => modality));
    if (modalities.has('required') && modalities.has('prohibited')) {
      contradictoryKeys.add(key);
      clarifications.push({
        reasonCode: 'constraint-modality-conflict',
        sourceIds: values
          .flatMap(({ sourceConstraintIds }) => sourceConstraintIds)
          .sort(compareText),
        possibleConceptIds: [values[0]?.conceptId ?? ''].filter(Boolean),
        context:
          'The same controlled concept cannot be both required and prohibited.',
      });
    }
  }
  return [...merged.values()].map((draft) => {
    const key =
      draft.conceptId === null ? '' : `${draft.facet}\u0000${draft.conceptId}`;
    return contradictoryKeys.has(key)
      ? {
          ...draft,
          resolutionBasis: 'contradiction',
          ruleId: 'constraint-modality-conflict',
        }
      : draft;
  });
}

function resolvePrimaryFamily(
  resolutions: readonly CapabilityResolution[],
  candidateSources: readonly {
    readonly family: CapabilityFamily;
    readonly sourceId: string;
  }[],
  clarifications: ClarificationDraft[],
): CapabilityFamily | null {
  const explicitSources = resolutions.map(({ concept, sourceTermId }) => ({
    families: new Set(concept.applicableFamilyIds),
    sourceId: sourceTermId,
  }));
  const candidateFamilies = new Set(
    candidateSources.map(({ family }) => family),
  );
  if (candidateFamilies.size > 1) {
    clarifications.push({
      reasonCode: 'cross-family-candidate-reference',
      sourceIds: candidateSources
        .map(({ sourceId }) => sourceId)
        .sort(compareText),
      possibleConceptIds: [],
      context: 'Named candidates span multiple capability families.',
    });
  }
  const sources = [
    ...explicitSources,
    ...candidateSources.map(({ family, sourceId }) => ({
      families: new Set([family]),
      sourceId,
    })),
  ];
  if (sources.length === 0) return null;
  let intersection = new Set(sources[0]?.families ?? []);
  for (const source of sources.slice(1)) {
    intersection = new Set(
      [...intersection].filter((family) => source.families.has(family)),
    );
  }
  if (intersection.size === 1) {
    return [...intersection][0] ?? null;
  }
  if (intersection.size === 0) {
    const hasExplicit = explicitSources.length > 0;
    const hasCandidate = candidateSources.length > 0;
    clarifications.push({
      reasonCode:
        hasExplicit && hasCandidate
          ? 'candidate-family-conflict'
          : hasCandidate
            ? 'cross-family-candidate-reference'
            : 'cross-family-capability',
      sourceIds: sources.map(({ sourceId }) => sourceId).sort(compareText),
      possibleConceptIds: [],
      context:
        'Explicit sources do not identify one compatible capability family.',
    });
  }
  return null;
}

function groupCapabilityConcepts(
  resolutions: readonly CapabilityResolution[],
): readonly NormalizedCapabilityConcept[] {
  const grouped = new Map<string, NormalizedCapabilityConcept>();
  for (const resolution of resolutions) {
    const previous = grouped.get(resolution.concept.conceptId);
    grouped.set(resolution.concept.conceptId, {
      conceptId: resolution.concept.conceptId,
      sourceTermIds: [
        ...(previous?.sourceTermIds ?? []),
        resolution.sourceTermId,
      ].sort(compareText),
      ruleId:
        previous?.ruleId === 'taxonomy-deprecated-alias' ||
        resolution.ruleId === 'taxonomy-deprecated-alias'
          ? 'taxonomy-deprecated-alias'
          : 'taxonomy-active-alias',
    });
  }
  return [...grouped.values()].sort((left, right) =>
    compareText(left.conceptId, right.conceptId),
  );
}

function finalizeConstraints(
  drafts: readonly ConstraintDraft[],
): readonly NormalizedCapabilityConstraint[] {
  return [...drafts]
    .sort((left, right) =>
      compareText(constraintSortKey(left), constraintSortKey(right)),
    )
    .map((draft, index) => ({
      normalizedConstraintId: sequenceId('normalized-constraint', index),
      ...draft,
      sourceConstraintIds: [...draft.sourceConstraintIds].sort(compareText),
    }));
}

function finalizeUnresolved(
  drafts: readonly UnresolvedDraft[],
): readonly CapabilityQueryUnresolvedTerm[] {
  return deduplicateBySemanticKey(drafts, unresolvedSortKey)
    .sort((left, right) =>
      compareText(unresolvedSortKey(left), unresolvedSortKey(right)),
    )
    .map((draft, index) => ({
      unresolvedId: sequenceId('unresolved', index),
      ...draft,
      sourceIds: [...draft.sourceIds].sort(compareText),
    }));
}

function finalizeClarifications(
  drafts: readonly ClarificationDraft[],
): readonly CapabilityQueryClarification[] {
  return deduplicateBySemanticKey(drafts, clarificationSortKey)
    .sort((left, right) =>
      compareText(clarificationSortKey(left), clarificationSortKey(right)),
    )
    .map((draft, index) => ({
      clarificationId: sequenceId('clarification', index),
      ...draft,
      sourceIds: [...draft.sourceIds].sort(compareText),
      possibleConceptIds: [...draft.possibleConceptIds].sort(compareText),
    }));
}

function finalizeNotices(
  drafts: readonly NoticeDraft[],
): readonly CapabilityQueryNormalizationNotice[] {
  return deduplicateBySemanticKey(drafts, noticeSortKey)
    .sort((left, right) =>
      compareText(noticeSortKey(left), noticeSortKey(right)),
    )
    .map((draft, index) => ({
      noticeId: sequenceId('notice', index),
      ...draft,
      sourceIds: [...draft.sourceIds].sort(compareText),
    }));
}

function buildNormalizationSteps(
  input: CapabilityQueryInput,
  core: Omit<CapabilityQueryNormalizationCore, 'normalizationSteps'>,
): readonly CapabilityQueryNormalizationStep[] {
  const sourceIds = [
    ...input.capabilityTerms.map(({ termId }) => termId),
    ...input.draftConstraints.map(({ constraintId }) => constraintId),
    ...input.candidateReferences.map(({ referenceId }) => referenceId),
  ].sort(compareText);
  const steps = sourceIds.map((sourceId, index) => {
    const outputs: string[] = [];
    let ruleId = 'preserve-explicit-source';
    for (const concept of core.normalizedCapabilityConcepts) {
      if (concept.sourceTermIds.includes(sourceId)) {
        outputs.push(concept.conceptId);
        ruleId = concept.ruleId;
      }
    }
    for (const constraint of core.normalizedConstraints) {
      if (constraint.sourceConstraintIds.includes(sourceId)) {
        outputs.push(constraint.normalizedConstraintId);
        ruleId = constraint.ruleId;
      }
    }
    for (const reference of core.resolvedCandidateReferences) {
      if (reference.referenceId === sourceId) {
        outputs.push(reference.candidateId);
        ruleId = reference.ruleId;
      }
    }
    for (const entry of core.unresolvedTerms) {
      if (entry.sourceIds.includes(sourceId)) {
        outputs.push(entry.unresolvedId);
        ruleId = 'preserve-unresolved-source';
      }
    }
    for (const clarification of core.clarifications) {
      if (clarification.sourceIds.includes(sourceId)) {
        outputs.push(clarification.clarificationId);
        ruleId = 'require-explicit-clarification';
      }
    }
    for (const notice of core.notices) {
      if (notice.sourceIds.includes(sourceId)) {
        outputs.push(notice.noticeId);
      }
    }
    return {
      stepId: sequenceId('step', index),
      ruleId,
      inputSourceIds: [sourceId],
      outputIds: [...new Set(outputs)].sort(compareText),
    };
  });
  return [
    ...steps,
    {
      stepId: sequenceId('step', steps.length),
      ruleId: 'derive-normalization-outcome',
      inputSourceIds: sourceIds,
      outputIds: [core.outcome],
    },
  ];
}

function candidateIndexes(
  authority: CandidateReferenceAuthority,
): Readonly<
  Record<
    CapabilityQueryCandidateReference['kind'],
    ReadonlyMap<string, CandidateReferenceAuthority['candidates'][number]>
  >
> {
  return {
    'candidate-id': new Map(
      authority.candidates.map((candidate) => [
        candidate.candidateKey,
        candidate,
      ]),
    ),
    repository: new Map(
      authority.candidates.map((candidate) => [
        candidate.repositoryKey,
        candidate,
      ]),
    ),
    'npm-package': new Map(
      authority.candidates.flatMap((candidate) =>
        candidate.npmPackageKey === null
          ? []
          : [[candidate.npmPackageKey, candidate] as const],
      ),
    ),
  };
}

function facetAcceptsConcept(
  facet: CapabilityQueryConstraintFacet,
  concept: CapabilityTaxonomyConcept,
): boolean {
  return facet === 'capability'
    ? concept.kind === 'family'
    : facet === concept.kind;
}

function addUnknownTerm(
  sourceKind: CapabilityQueryUnresolvedTerm['sourceKind'],
  sourceId: string,
  canonicalTerm: string | null,
  reasonCode: string,
  blocking: boolean,
  unresolved: UnresolvedDraft[],
  clarifications: ClarificationDraft[],
): void {
  unresolved.push({
    sourceKind,
    sourceIds: [sourceId],
    canonicalTerm,
    reasonCode,
    blocking,
  });
  if (blocking) {
    clarifications.push({
      reasonCode,
      sourceIds: [sourceId],
      possibleConceptIds: [],
      context:
        'Provide one exact controlled term using supported ASCII syntax.',
    });
  }
}

function canonicalizationReason(
  reason: Exclude<
    CapabilityQueryTermCanonicalizationResult,
    { ok: true }
  >['reason'],
): string {
  return reason === 'non-ascii' || reason === 'unsupported-character'
    ? 'unsupported-term-characters'
    : reason === 'empty'
      ? 'empty-term'
      : 'term-outside-bounds';
}

function constraintSortKey(value: ConstraintDraft): string {
  return JSON.stringify([
    value.facet,
    value.conceptId,
    value.canonicalTerm,
    value.modality,
    value.resolutionBasis,
    [...value.sourceConstraintIds].sort(compareText),
  ]);
}

function unresolvedSortKey(value: UnresolvedDraft): string {
  return JSON.stringify([
    value.sourceKind,
    [...value.sourceIds].sort(compareText),
    value.canonicalTerm,
    value.reasonCode,
    value.blocking,
  ]);
}

function clarificationSortKey(value: ClarificationDraft): string {
  return JSON.stringify([
    value.reasonCode,
    [...value.sourceIds].sort(compareText),
    [...value.possibleConceptIds].sort(compareText),
    value.context,
  ]);
}

function noticeSortKey(value: NoticeDraft): string {
  return JSON.stringify([
    value.reasonCode,
    [...value.sourceIds].sort(compareText),
    value.replacementAliasKey,
  ]);
}

function deduplicateBySemanticKey<Value>(
  values: readonly Value[],
  key: (value: Value) => string,
): Value[] {
  return [...new Map(values.map((value) => [key(value), value])).values()];
}

function sequenceId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
}

function emptyCore(
  input: CapabilityQueryInput,
): CapabilityQueryNormalizationCore {
  return {
    outcome: 'clarification-required',
    primaryFamilyId: null,
    normalizedCapabilityConcepts: [],
    normalizedConstraints: [],
    preservedDeclarations: [],
    resolvedCandidateReferences: [],
    unresolvedTerms: [],
    clarifications: [],
    notices: [],
    normalizationSteps: [],
    repositoryFingerprintReference: input.repositoryFingerprintReference,
    candidateAuthorityUsed: input.candidateReferences.length > 0,
  };
}
