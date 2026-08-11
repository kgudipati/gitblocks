/* eslint-disable @typescript-eslint/no-unnecessary-condition -- These checks validate committed trust-boundary data. */

import { canonicalizeJson } from './canonical-json.ts';
import {
  RANKING_DECISION_FIELD_IDS,
  type CandidateAuthorityBreadthGroup,
  type CandidateAuthorityDecisionFieldId,
  type CandidateAuthorityEvidenceDimension,
  type CandidateAuthoritySourceOperation,
} from './candidate-authority-contracts.ts';
import { ingestionError } from './errors.ts';
import {
  requireExactKeys,
  requireRecord,
} from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_READINESS_POLICY_DIGEST =
  'db8536cd44cc11a8c86458f0d998dbf0daa98487bd3d936a0ba6e4b5385dbf5f' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V2_VERSION =
  'candidate-authority-field-plan/2.0.0' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V2_DIGEST =
  '249d7f33be5039c2418b71ecf02fbaf73d01da0a03f2779fae9091e32536adae' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_VERSION =
  'candidate-authority-source-policy/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_DIGEST =
  '99ef0fd9631eede0548e3f1a3ae32a1f17be0f9ecb95ef9b29e3a831bf053e50' as const;
export const CANDIDATE_AUTHORITY_ROOT_V2_VERSION =
  'candidate-authority-root/2.0.0' as const;
export const CANDIDATE_AUTHORITY_READINESS_POLICY_PATH =
  'catalog/public-v1/candidate-authority-readiness-policy.json' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V2_PATH =
  'catalog/public-v1/candidate-authority-field-plan-v2.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v2.json' as const;
export const CANDIDATE_AUTHORITY_EXTRACTION_ELIGIBLE_COUNT = 14 as const;
export const CANDIDATE_AUTHORITY_FULL_CLOSURE_COUNT = 6 as const;

export type CandidateAuthorityFieldPostureV2 =
  | 'deterministic-complete-path'
  | 'deterministic-partial-path'
  | 'human-reviewed-structured-only'
  | 'not-responsibly-extractable-in-v1';
export type CandidateAuthorityCellOrigin =
  | 'conflict'
  | 'deterministic-known'
  | 'deterministic-not-applicable'
  | 'deterministic-partial-direct-evidence'
  | 'human-reviewed-structured'
  | 'model-derived'
  | 'unknown';

export interface CandidateAuthorityFieldPlanEntryV2 {
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly posture: CandidateAuthorityFieldPostureV2;
  readonly sourceAuthorityVersion: string;
  readonly extractionRuleVersion: string;
  readonly sourceKind: string;
  readonly versionScope: string;
  readonly positiveFacts: readonly string[];
  readonly negativeAbsenceSemantics: string;
  readonly unresolvedRemainder: string;
  readonly completenessRequirement: string;
  readonly freshnessRequirement: string;
  readonly notApplicableRule: string;
  readonly evidenceTopic: string;
  readonly evidenceDimension: CandidateAuthorityEvidenceDimension;
  readonly evidenceProvenanceKind:
    | 'approved-validation'
    | 'git-commit'
    | 'package-version'
    | 'structured-provider-snapshot';
  readonly generationOrigin:
    'deterministic' | 'human-reviewed' | 'model-derived';
  readonly canEmitMeaningfulNonUnknownFact: boolean;
  readonly incompleteAuthorityOutcome: 'explicit-unknown-or-partial';
  readonly negativeClaimsRequireCompleteSource: boolean;
  readonly provenanceAndFieldBindingRetained: boolean;
  readonly prohibitedExtractionInputs: readonly string[];
  readonly evidenceBridgeWithoutProseInterpretation: boolean;
  readonly deterministicExtractionEligible: boolean;
  readonly deterministicFullClosureCandidate: boolean;
  readonly breadthGroup: CandidateAuthorityBreadthGroup;
  readonly providerOperations: readonly string[];
  readonly reusesPhase8Rule: boolean;
  readonly requiresSuccessorRule: boolean;
  readonly rationale: string;
}

export interface CandidateAuthorityReadinessPolicyV2 {
  readonly policyVersion: string;
  readonly status: 'proposed-independent-review-required';
  readonly supersedes: Readonly<Record<string, string>>;
  readonly unchangedGate: {
    readonly denominatorVersion: 'ranking-decision-denominator/1.0.0';
    readonly denominatorSize: 18;
    readonly minimumEligibleFields: 13;
    readonly exactPercentage: 72.222222;
  };
  readonly deterministicExtractionEligibilityDefinition: readonly string[];
  readonly deterministicFullClosureDefinition: string;
  readonly breadthGroups: Readonly<
    Record<
      CandidateAuthorityBreadthGroup,
      readonly CandidateAuthorityDecisionFieldId[]
    >
  >;
  readonly perCellOrigins: readonly CandidateAuthorityCellOrigin[];
  readonly numeratorExclusions: readonly string[];
  readonly changeControl: string;
  readonly policySemanticDigest: string;
}

export interface CandidateAuthorityFieldPlanV2 {
  readonly planVersion: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V2_VERSION;
  readonly status: 'pre-live-go-pending-independent-review';
  readonly bindings: Readonly<Record<string, string>>;
  readonly frozenGate: {
    readonly denominatorSize: 18;
    readonly minimumEligibleFields: 13;
    readonly exactPercentage: 72.222222;
    readonly minimumEligibleFieldPerBreadthGroup: 1;
  };
  readonly plannedDeterministicExtractionEligibleFieldCount: 14;
  readonly plannedDeterministicFullClosureFieldCount: 6;
  readonly goDecision: 'go-pending-independent-review';
  readonly goDecisionReasons: readonly string[];
  readonly fields: readonly CandidateAuthorityFieldPlanEntryV2[];
  readonly planSemanticDigest: string;
}

export interface CandidateAuthoritySourcePolicyV2 {
  readonly policyVersion: typeof CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_VERSION;
  readonly status: 'pre-live-not-authorized';
  readonly bindings: Readonly<Record<string, string>>;
  readonly authorization: Readonly<Record<string, false>>;
  readonly requestBudget: {
    readonly candidateCount: 150;
    readonly mappedPackageCount: 80;
    readonly githubLogicalRequests: 1510;
    readonly npmLogicalRequests: 80;
    readonly totalLogicalRequests: 1590;
    readonly githubWorstCaseAttempts: 4530;
    readonly npmWorstCaseAttempts: 240;
    readonly totalWorstCaseAttempts: 4770;
  };
  readonly operations: readonly CandidateAuthoritySourceOperation[];
  readonly failurePolicy: Readonly<Record<string, unknown>>;
  readonly freshnessPolicy: Readonly<Record<string, unknown>>;
  readonly publicationFlow: readonly string[];
  readonly policySemanticDigest: string;
}

export interface CandidateAuthorityRootV2 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_ROOT_V2_VERSION;
  readonly catalogBinding: Readonly<Record<string, string>>;
  readonly taxonomyBinding: Readonly<Record<string, string>>;
  readonly deterministicProfileBinding: Readonly<Record<string, string>>;
  readonly rankingDecisionBinding: Readonly<Record<string, string>>;
  readonly fieldPlanBinding: Readonly<Record<string, string>>;
  readonly sourcePolicyBinding: Readonly<Record<string, string>>;
  readonly collection: {
    readonly cutoff: string;
    readonly candidateCount: 150;
    readonly orderedCandidateIds: readonly string[];
    readonly orderedCandidateIdentitiesDigest: string;
  };
  readonly authorityDigests: Readonly<Record<string, string>>;
  readonly fieldReadinessCounts: {
    readonly deterministicExtractionEligible: number;
    readonly deterministicFullClosure: number;
  };
  readonly cellOriginCounts: Readonly<
    Record<CandidateAuthorityCellOrigin, number>
  >;
  readonly canonicalAuthorityDigest: string;
}

const POLICY_KEYS = [
  'breadthGroups',
  'changeControl',
  'deterministicExtractionEligibilityDefinition',
  'deterministicFullClosureDefinition',
  'numeratorExclusions',
  'perCellOrigins',
  'policySemanticDigest',
  'policyVersion',
  'status',
  'supersedes',
  'unchangedGate',
] as const;
const PLAN_KEYS = [
  'bindings',
  'fields',
  'frozenGate',
  'goDecision',
  'goDecisionReasons',
  'planSemanticDigest',
  'planVersion',
  'plannedDeterministicExtractionEligibleFieldCount',
  'plannedDeterministicFullClosureFieldCount',
  'status',
] as const;
const FIELD_KEYS = [
  'breadthGroup',
  'canEmitMeaningfulNonUnknownFact',
  'completenessRequirement',
  'deterministicExtractionEligible',
  'deterministicFullClosureCandidate',
  'evidenceBridgeWithoutProseInterpretation',
  'evidenceDimension',
  'evidenceProvenanceKind',
  'evidenceTopic',
  'extractionRuleVersion',
  'fieldId',
  'freshnessRequirement',
  'generationOrigin',
  'incompleteAuthorityOutcome',
  'negativeAbsenceSemantics',
  'negativeClaimsRequireCompleteSource',
  'notApplicableRule',
  'positiveFacts',
  'posture',
  'prohibitedExtractionInputs',
  'provenanceAndFieldBindingRetained',
  'providerOperations',
  'rationale',
  'requiresSuccessorRule',
  'reusesPhase8Rule',
  'sourceAuthorityVersion',
  'sourceKind',
  'unresolvedRemainder',
  'versionScope',
] as const;
const SOURCE_POLICY_KEYS = [
  'authorization',
  'bindings',
  'failurePolicy',
  'freshnessPolicy',
  'operations',
  'policySemanticDigest',
  'policyVersion',
  'publicationFlow',
  'requestBudget',
  'status',
] as const;
const OPERATION_KEYS = [
  'authentication',
  'completenessSemantics',
  'controlledAbsence',
  'endpointShape',
  'evidenceProvenance',
  'fieldsSupplied',
  'host',
  'maximumAttempts',
  'maximumJsonNodes',
  'maximumRequestsPerCandidate',
  'maximumResponseBytes',
  'maximumTotalLogicalRequests',
  'method',
  'operationId',
  'paginationRule',
  'privacySecurity',
  'provider',
  'redirectPolicy',
  'retainedStructuredProperties',
  'sourceMutability',
  'temporaryUnavailability',
  'timeoutMilliseconds',
] as const;
const OPERATION_IDS = Object.freeze([
  'github-repository-metadata',
  'github-default-branch-head',
  'github-maintenance-window',
  'github-license',
  'github-community-profile',
  'github-release-window',
  'github-advisories',
  'npm-package-metadata',
  'github-compose-json-content',
  'github-compose-json-root-tree',
  'github-compose-json-blob',
]);

export function qualifiesDeterministicExtraction(
  field: CandidateAuthorityFieldPlanEntryV2,
): boolean {
  const prohibited = new Set(field.prohibitedExtractionInputs);
  return (
    field.generationOrigin === 'deterministic' &&
    field.extractionRuleVersion.length > 0 &&
    field.sourceAuthorityVersion.length > 0 &&
    field.providerOperations.length > 0 &&
    field.canEmitMeaningfulNonUnknownFact &&
    field.positiveFacts.length > 0 &&
    field.incompleteAuthorityOutcome === 'explicit-unknown-or-partial' &&
    field.negativeClaimsRequireCompleteSource &&
    field.provenanceAndFieldBindingRetained &&
    field.evidenceBridgeWithoutProseInterpretation &&
    prohibited.has('candidate-id-as-fit-fact') &&
    prohibited.has('model-output') &&
    prohibited.has('popularity') &&
    prohibited.has('scorer-output') &&
    [...prohibited].some((value) =>
      value.endsWith('evaluation-classification'),
    ) &&
    [...prohibited].some((value) => value.endsWith('gold'))
  );
}

export function parseCandidateAuthorityReadinessPolicyV2(
  supplied: unknown,
): CandidateAuthorityReadinessPolicyV2 {
  const record = requireRecord(supplied);
  requireExactKeys(record, POLICY_KEYS);
  const candidate = record as unknown as CandidateAuthorityReadinessPolicyV2;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['policySemanticDigest'];
  if (
    candidate.policyVersion.length === 0 ||
    candidate.status !== 'proposed-independent-review-required' ||
    candidate.unchangedGate.denominatorSize !== 18 ||
    candidate.unchangedGate.minimumEligibleFields !== 13 ||
    candidate.unchangedGate.exactPercentage !== 72.222222 ||
    !arraysEqual(candidate.perCellOrigins, [
      'deterministic-known',
      'deterministic-not-applicable',
      'deterministic-partial-direct-evidence',
      'human-reviewed-structured',
      'model-derived',
      'unknown',
      'conflict',
    ]) ||
    candidate.policySemanticDigest !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_DIGEST ||
    candidate.policySemanticDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function parseCandidateAuthorityFieldPlanV2(
  supplied: unknown,
  policy: CandidateAuthorityReadinessPolicyV2,
): CandidateAuthorityFieldPlanV2 {
  const record = requireRecord(supplied);
  requireExactKeys(record, PLAN_KEYS);
  if (!Array.isArray(record['fields'])) invalid();
  const fields = record['fields'].map((value, index) => {
    const field = requireRecord(value);
    requireExactKeys(field, FIELD_KEYS);
    if (
      field['fieldId'] !== RANKING_DECISION_FIELD_IDS[index] ||
      !Array.isArray(field['positiveFacts']) ||
      !Array.isArray(field['prohibitedExtractionInputs']) ||
      !Array.isArray(field['providerOperations'])
    )
      invalid();
    const candidate = field as unknown as CandidateAuthorityFieldPlanEntryV2;
    if (
      candidate.deterministicExtractionEligible !==
      qualifiesDeterministicExtraction(candidate)
    )
      invalid();
    if (
      candidate.deterministicFullClosureCandidate &&
      candidate.posture !== 'deterministic-complete-path'
    )
      invalid();
    if (
      !candidate.deterministicExtractionEligible &&
      candidate.posture.startsWith('deterministic-')
    )
      invalid();
    return candidate;
  });
  const candidate = {
    ...record,
    fields,
  } as unknown as CandidateAuthorityFieldPlanV2;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['planSemanticDigest'];
  const eligible = fields.filter(
    (field) => field.deterministicExtractionEligible,
  );
  const fullClosure = fields.filter(
    (field) => field.deterministicFullClosureCandidate,
  );
  const breadthPass = Object.keys(policy.breadthGroups).every((group) =>
    eligible.some((field) => field.breadthGroup === group),
  );
  if (
    candidate.planVersion !== CANDIDATE_AUTHORITY_FIELD_PLAN_V2_VERSION ||
    candidate.status !== 'pre-live-go-pending-independent-review' ||
    candidate.goDecision !== 'go-pending-independent-review' ||
    candidate.frozenGate.denominatorSize !== 18 ||
    candidate.frozenGate.minimumEligibleFields !== 13 ||
    candidate.frozenGate.exactPercentage !== 72.222222 ||
    candidate.frozenGate.minimumEligibleFieldPerBreadthGroup !== 1 ||
    candidate.plannedDeterministicExtractionEligibleFieldCount !==
      CANDIDATE_AUTHORITY_EXTRACTION_ELIGIBLE_COUNT ||
    candidate.plannedDeterministicFullClosureFieldCount !==
      CANDIDATE_AUTHORITY_FULL_CLOSURE_COUNT ||
    eligible.length !== CANDIDATE_AUTHORITY_EXTRACTION_ELIGIBLE_COUNT ||
    fullClosure.length !== CANDIDATE_AUTHORITY_FULL_CLOSURE_COUNT ||
    !breadthPass ||
    candidate.bindings['readinessPolicyVersion'] !== policy.policyVersion ||
    candidate.bindings['readinessPolicyDigest'] !==
      policy.policySemanticDigest ||
    candidate.planSemanticDigest !== CANDIDATE_AUTHORITY_FIELD_PLAN_V2_DIGEST ||
    candidate.planSemanticDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function parseCandidateAuthoritySourcePolicyV2(
  supplied: unknown,
  plan: CandidateAuthorityFieldPlanV2,
): CandidateAuthoritySourcePolicyV2 {
  const record = requireRecord(supplied);
  requireExactKeys(record, SOURCE_POLICY_KEYS);
  if (!Array.isArray(record['operations'])) invalid();
  const operations = record['operations'].map((value, index) => {
    const operation = requireRecord(value);
    requireExactKeys(operation, OPERATION_KEYS);
    const candidate = operation as unknown as CandidateAuthoritySourceOperation;
    if (
      candidate.operationId !== OPERATION_IDS[index] ||
      candidate.method !== 'GET' ||
      candidate.maximumAttempts !== 3 ||
      candidate.redirectPolicy !== 'zero redirects' ||
      candidate.maximumResponseBytes !== 2_097_152 ||
      candidate.maximumJsonNodes !== 100_000 ||
      candidate.timeoutMilliseconds !== 15_000 ||
      candidate.maximumRequestsPerCandidate < 1 ||
      candidate.maximumRequestsPerCandidate > 2 ||
      !Array.isArray(candidate.retainedStructuredProperties) ||
      !Array.isArray(candidate.fieldsSupplied)
    )
      invalid();
    return candidate;
  });
  const candidate = {
    ...record,
    operations,
  } as unknown as CandidateAuthoritySourcePolicyV2;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['policySemanticDigest'];
  const github = operations
    .filter((operation) => operation.provider === 'github')
    .reduce((sum, operation) => sum + operation.maximumTotalLogicalRequests, 0);
  const npm = operations
    .filter((operation) => operation.provider === 'npm')
    .reduce((sum, operation) => sum + operation.maximumTotalLogicalRequests, 0);
  const operationIds = new Set(
    operations.map((operation) => operation.operationId),
  );
  if (
    candidate.policyVersion !== CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_VERSION ||
    candidate.status !== 'pre-live-not-authorized' ||
    candidate.bindings['fieldPlanVersion'] !== plan.planVersion ||
    candidate.bindings['fieldPlanDigest'] !== plan.planSemanticDigest ||
    Object.values(candidate.authorization).some((value) => value) ||
    candidate.requestBudget.githubLogicalRequests !== github ||
    candidate.requestBudget.npmLogicalRequests !== npm ||
    candidate.requestBudget.totalLogicalRequests !== github + npm ||
    candidate.requestBudget.githubWorstCaseAttempts !== github * 3 ||
    candidate.requestBudget.npmWorstCaseAttempts !== npm * 3 ||
    candidate.requestBudget.totalWorstCaseAttempts !== (github + npm) * 3 ||
    plan.fields.some((field) =>
      field.providerOperations.some(
        (operation) => !operationIds.has(operation),
      ),
    ) ||
    candidate.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V2_DIGEST ||
    candidate.policySemanticDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function candidateAuthorityRootV2SemanticDigest(
  root: Omit<CandidateAuthorityRootV2, 'canonicalAuthorityDigest'>,
): string {
  return canonicalizeJson(root).digest;
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-manifest');
}
