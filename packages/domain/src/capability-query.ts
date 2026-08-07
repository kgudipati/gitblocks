import {
  addIssue,
  addStableIdIssues,
  compareText,
  resultFromIssues,
  type DomainIssue,
  type DomainResult,
} from './issues.ts';
import { isSupportedCapabilityFamily, type CapabilityFamily } from './model.ts';

export const CAPABILITY_QUERY_NORMALIZER_VERSION = '1.0.0' as const;

const MAX_CAPABILITY_QUERY_TERMS = 8;
const MAX_CAPABILITY_QUERY_CONSTRAINTS = 32;
const MAX_CAPABILITY_QUERY_CANDIDATE_REFERENCES = 10;

export const CAPABILITY_QUERY_MAX_UNRESOLVED_TERMS =
  MAX_CAPABILITY_QUERY_TERMS +
  MAX_CAPABILITY_QUERY_CONSTRAINTS +
  MAX_CAPABILITY_QUERY_CANDIDATE_REFERENCES;

export const CAPABILITY_QUERY_LIMITS = Object.freeze({
  summaryCodeUnits: 1_000,
  capabilityTerms: MAX_CAPABILITY_QUERY_TERMS,
  termCodeUnits: 120,
  successConditions: 20,
  statementCodeUnits: 500,
  draftConstraints: MAX_CAPABILITY_QUERY_CONSTRAINTS,
  candidateReferences: MAX_CAPABILITY_QUERY_CANDIDATE_REFERENCES,
  candidateAuthorityCandidates: 200,
  normalizedCapabilityConcepts: 8,
  normalizedConstraints: 32,
  unresolvedTerms: CAPABILITY_QUERY_MAX_UNRESOLVED_TERMS,
  clarifications: 64,
  notices: 40,
  normalizationSteps: 64,
} as const);

export const CAPABILITY_QUERY_CONSTRAINT_FACETS = Object.freeze([
  'capability',
  'architecture',
  'feature',
  'infrastructure',
  'deployment',
  'ecosystem',
  'runtime',
  'framework',
  'datastore',
  'license',
  'repository-state',
  'maintenance',
  'release',
  'security',
  'other',
] as const);

export type CapabilityQueryConstraintFacet =
  (typeof CAPABILITY_QUERY_CONSTRAINT_FACETS)[number];
export type CapabilityQueryConstraintModality =
  'preferred' | 'prohibited' | 'required';
export type CapabilityQueryOutcome =
  'clarification-required' | 'normalized' | 'unsupported';

export interface CapabilityQueryTerm {
  readonly termId: string;
  readonly originalTerm: string;
}

export interface CapabilityQuerySuccessCondition {
  readonly conditionId: string;
  readonly statement: string;
}

export interface CapabilityQueryDraftConstraint {
  readonly constraintId: string;
  readonly modality: CapabilityQueryConstraintModality;
  readonly statement: string;
  readonly originalTerm: string;
  readonly facetHint: CapabilityQueryConstraintFacet;
  readonly reasonCode: string | null;
}

export type CapabilityQueryCandidateReferenceKind =
  'candidate-id' | 'npm-package' | 'repository';

export interface CapabilityQueryCandidateReference {
  readonly referenceId: string;
  readonly kind: CapabilityQueryCandidateReferenceKind;
  readonly value: string;
  readonly intent: 'compare' | 'named-candidate';
}

export interface CapabilityQueryRepositoryFingerprintReference {
  readonly fingerprintId: string;
  readonly fingerprintDigest: string;
}

export interface CapabilityQueryInput {
  readonly contractVersion: '1.0.0';
  readonly queryInputId: string;
  readonly scope: 'local-pre-approval';
  readonly summary: string;
  readonly capabilityTerms: readonly CapabilityQueryTerm[];
  readonly successConditions: readonly CapabilityQuerySuccessCondition[];
  readonly draftConstraints: readonly CapabilityQueryDraftConstraint[];
  readonly candidateReferences: readonly CapabilityQueryCandidateReference[];
  readonly repositoryFingerprintReference: CapabilityQueryRepositoryFingerprintReference | null;
}

export interface CandidateReferenceAuthorityEntry {
  readonly candidateId: string;
  readonly capabilityFamily: CapabilityFamily;
  readonly repositoryKey: string;
  readonly npmPackageKey: string | null;
}

export interface CandidateReferenceAuthority {
  readonly catalogVersion: string;
  readonly catalogDigest: string;
  readonly candidates: readonly CandidateReferenceAuthorityEntry[];
}

const DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const CATALOG_VERSION_PATTERN = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/u;
const REPOSITORY_KEY_PATTERN =
  /^[a-z0-9](?:[a-z0-9_.-]{0,99})\/[a-z0-9](?:[a-z0-9_.-]{0,99})$/u;
const PACKAGE_KEY_PATTERN =
  /^(?:@[a-z0-9][a-z0-9._-]{0,99}\/)?[a-z0-9][a-z0-9._-]{0,99}$/u;

export function canonicalizeCapabilityQueryInput<
  Value extends CapabilityQueryInput,
>(value: Value): Value {
  return {
    ...value,
    capabilityTerms: sortById(value.capabilityTerms, ({ termId }) => termId),
    successConditions: sortById(
      value.successConditions,
      ({ conditionId }) => conditionId,
    ),
    draftConstraints: sortById(
      value.draftConstraints,
      ({ constraintId }) => constraintId,
    ),
    candidateReferences: sortById(
      value.candidateReferences,
      ({ referenceId }) => referenceId,
    ),
    repositoryFingerprintReference:
      value.repositoryFingerprintReference === null
        ? null
        : { ...value.repositoryFingerprintReference },
  };
}

export function validateCapabilityQueryInput(
  value: CapabilityQueryInput,
): DomainResult<CapabilityQueryInput> {
  const issues: DomainIssue[] = [];
  addStableIdIssues(issues, value.queryInputId, 'queryInputId');
  validateBoundedText(
    value.summary,
    'summary',
    CAPABILITY_QUERY_LIMITS.summaryCodeUnits,
    issues,
  );
  validateArrayBounds(
    value.capabilityTerms.length,
    1,
    CAPABILITY_QUERY_LIMITS.capabilityTerms,
    'capabilityTerms',
    issues,
  );
  validateArrayBounds(
    value.successConditions.length,
    1,
    CAPABILITY_QUERY_LIMITS.successConditions,
    'successConditions',
    issues,
  );
  validateArrayBounds(
    value.draftConstraints.length,
    0,
    CAPABILITY_QUERY_LIMITS.draftConstraints,
    'draftConstraints',
    issues,
  );
  validateArrayBounds(
    value.candidateReferences.length,
    0,
    CAPABILITY_QUERY_LIMITS.candidateReferences,
    'candidateReferences',
    issues,
  );

  const sourceIds = new Set<string>();
  for (const [index, term] of value.capabilityTerms.entries()) {
    const path = `capabilityTerms.${String(index)}`;
    validateSourceId(term.termId, `${path}.termId`, sourceIds, issues);
    validateBoundedText(
      term.originalTerm,
      `${path}.originalTerm`,
      CAPABILITY_QUERY_LIMITS.termCodeUnits,
      issues,
    );
  }
  for (const [index, condition] of value.successConditions.entries()) {
    const path = `successConditions.${String(index)}`;
    validateSourceId(
      condition.conditionId,
      `${path}.conditionId`,
      sourceIds,
      issues,
    );
    validateBoundedText(
      condition.statement,
      `${path}.statement`,
      CAPABILITY_QUERY_LIMITS.statementCodeUnits,
      issues,
    );
  }
  for (const [index, constraint] of value.draftConstraints.entries()) {
    const path = `draftConstraints.${String(index)}`;
    validateSourceId(
      constraint.constraintId,
      `${path}.constraintId`,
      sourceIds,
      issues,
    );
    validateBoundedText(
      constraint.statement,
      `${path}.statement`,
      CAPABILITY_QUERY_LIMITS.statementCodeUnits,
      issues,
    );
    validateBoundedText(
      constraint.originalTerm,
      `${path}.originalTerm`,
      CAPABILITY_QUERY_LIMITS.termCodeUnits,
      issues,
    );
    if (!CAPABILITY_QUERY_CONSTRAINT_FACETS.includes(constraint.facetHint)) {
      addIssue(issues, 'query.input', `${path}.facetHint`);
    }
    if (
      (constraint.modality === 'required' ||
        constraint.modality === 'prohibited') &&
      constraint.reasonCode === null
    ) {
      addIssue(issues, 'query.input', `${path}.reasonCode`);
    }
    if (constraint.reasonCode !== null) {
      addStableIdIssues(issues, constraint.reasonCode, `${path}.reasonCode`);
    }
  }
  for (const [index, reference] of value.candidateReferences.entries()) {
    const path = `candidateReferences.${String(index)}`;
    validateSourceId(
      reference.referenceId,
      `${path}.referenceId`,
      sourceIds,
      issues,
    );
    validateCandidateReferenceValue(reference, `${path}.value`, issues);
  }
  if (value.repositoryFingerprintReference !== null) {
    addStableIdIssues(
      issues,
      value.repositoryFingerprintReference.fingerprintId,
      'repositoryFingerprintReference.fingerprintId',
    );
    if (
      !DIGEST_PATTERN.test(
        value.repositoryFingerprintReference.fingerprintDigest,
      )
    ) {
      addIssue(
        issues,
        'query.input',
        'repositoryFingerprintReference.fingerprintDigest',
      );
    }
  }
  return resultFromIssues(canonicalizeCapabilityQueryInput(value), issues);
}

export function validateCandidateReferenceAuthority(
  authority: CandidateReferenceAuthority,
): DomainResult<CandidateReferenceAuthority> {
  const issues: DomainIssue[] = [];
  if (!CATALOG_VERSION_PATTERN.test(authority.catalogVersion)) {
    addIssue(issues, 'query.authority', 'catalogVersion');
  }
  if (!DIGEST_PATTERN.test(authority.catalogDigest)) {
    addIssue(issues, 'query.authority', 'catalogDigest');
  }
  validateArrayBounds(
    authority.candidates.length,
    1,
    CAPABILITY_QUERY_LIMITS.candidateAuthorityCandidates,
    'candidates',
    issues,
  );
  const candidateIds = new Set<string>();
  const repositoryKeys = new Set<string>();
  const npmPackageKeys = new Set<string>();
  for (const [index, candidate] of authority.candidates.entries()) {
    const path = `candidates.${String(index)}`;
    addStableIdIssues(issues, candidate.candidateId, `${path}.candidateId`);
    validateUnique(
      candidate.candidateId,
      candidateIds,
      `${path}.candidateId`,
      issues,
      'query.authority',
    );
    if (!REPOSITORY_KEY_PATTERN.test(candidate.repositoryKey)) {
      addIssue(issues, 'query.authority', `${path}.repositoryKey`);
    }
    validateUnique(
      candidate.repositoryKey,
      repositoryKeys,
      `${path}.repositoryKey`,
      issues,
      'query.authority',
    );
    if (candidate.npmPackageKey !== null) {
      if (!PACKAGE_KEY_PATTERN.test(candidate.npmPackageKey)) {
        addIssue(issues, 'query.authority', `${path}.npmPackageKey`);
      }
      validateUnique(
        candidate.npmPackageKey,
        npmPackageKeys,
        `${path}.npmPackageKey`,
        issues,
        'query.authority',
      );
    }
    if (!isSupportedCapabilityFamily(candidate.capabilityFamily)) {
      addIssue(issues, 'query.authority', `${path}.capabilityFamily`);
    }
  }
  const canonical = {
    catalogVersion: authority.catalogVersion,
    catalogDigest: authority.catalogDigest,
    candidates: [...authority.candidates]
      .map((candidate) => ({ ...candidate }))
      .sort((left, right) => compareText(left.candidateId, right.candidateId)),
  };
  return resultFromIssues(canonical, issues);
}

function validateCandidateReferenceValue(
  reference: CapabilityQueryCandidateReference,
  path: string,
  issues: DomainIssue[],
): void {
  const valid =
    reference.kind === 'candidate-id'
      ? /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/u.test(reference.value)
      : reference.kind === 'repository'
        ? REPOSITORY_KEY_PATTERN.test(reference.value)
        : PACKAGE_KEY_PATTERN.test(reference.value);
  if (!valid) {
    addIssue(issues, 'query.input', path);
  }
}

function validateSourceId(
  value: string,
  path: string,
  sourceIds: Set<string>,
  issues: DomainIssue[],
): void {
  addStableIdIssues(issues, value, path);
  validateUnique(value, sourceIds, path, issues);
}

function validateUnique(
  value: string,
  values: Set<string>,
  path: string,
  issues: DomainIssue[],
  code: 'query.authority' | 'query.input' = 'query.input',
): void {
  if (values.has(value)) {
    addIssue(issues, code, path);
  }
  values.add(value);
}

function validateBoundedText(
  value: string,
  path: string,
  maximum: number,
  issues: DomainIssue[],
): void {
  if (value.length < 1 || value.length > maximum) {
    addIssue(issues, 'query.input', path);
  }
  if (containsUnsafeControls(value) || containsUrl(value)) {
    addIssue(issues, 'query.input', path);
  }
}

function containsUnsafeControls(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (
      code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      code === 0xad ||
      code === 0x61c ||
      code === 0x180e ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x2028 && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x206f) ||
      code === 0xfeff ||
      (code >= 0xfff9 && code <= 0xfffb)
    ) {
      return true;
    }
  }
  return false;
}

function containsUrl(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('://') || /(?:^|\s)www\./u.test(lower);
}

function validateArrayBounds(
  actual: number,
  minimum: number,
  maximum: number,
  path: string,
  issues: DomainIssue[],
): void {
  if (actual < minimum || actual > maximum) {
    addIssue(issues, 'query.input', path);
  }
}

function sortById<Value>(
  values: readonly Value[],
  id: (value: Value) => string,
): readonly Value[] {
  return [...values]
    .map((value) => ({ ...value }))
    .sort((left, right) => compareText(id(left), id(right)));
}
