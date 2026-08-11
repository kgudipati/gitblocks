/* eslint-disable @typescript-eslint/no-unnecessary-condition -- These checks validate committed trust-boundary data. */

import type { DeterministicProfileFieldId } from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import { ingestionError } from './errors.ts';
import {
  requireExactKeys,
  requireRecord,
} from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_FIELD_PLAN_VERSION =
  'candidate-authority-field-plan/1.0.0' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_DIGEST =
  'ac643d102cb7e20a711b5c0a59508608e30ad7d0f1b7446d345237c53289607a' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_VERSION =
  'candidate-authority-source-policy/1.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_DIGEST =
  'b0f22107190995b64f81851f8d88b8da6539643868ee93ba9977b262b0bc3699' as const;
export const CANDIDATE_AUTHORITY_ROOT_VERSION =
  'candidate-authority-root/1.0.0' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_PATH =
  'catalog/public-v1/candidate-authority-field-plan.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_PATH =
  'catalog/public-v1/candidate-authority-source-policy.json' as const;
export const CANDIDATE_AUTHORITY_EVENTUAL_ROOT_PATH =
  'catalog/public-v1/candidate-authority-root.json' as const;
export const CANDIDATE_AUTHORITY_CANDIDATE_COUNT = 150 as const;
export const CANDIDATE_AUTHORITY_READY_MINIMUM = 13 as const;
export const CANDIDATE_AUTHORITY_READY_PERCENTAGE = 72.222222 as const;
export const CANDIDATE_AUTHORITY_PLANNED_READY_COUNT = 6 as const;

export const RANKING_DECISION_FIELD_IDS = Object.freeze([
  'adoption-unit-type',
  'capability-variants-features',
  'language-ecosystem',
  'package-publication-version',
  'runtime-package-format',
  'framework-compatibility',
  'datastore-requirements',
  'package-repository-linkage',
  'required-infrastructure',
  'optional-infrastructure',
  'deployment-self-hosting',
  'operational-complexity-primitives',
  'license-identity',
  'archived-state',
  'maintenance-activity',
  'release-state-recency',
  'security-advisory-state',
  'security-policy-presence',
] as const satisfies readonly DeterministicProfileFieldId[]);

export type CandidateAuthorityDecisionFieldId =
  (typeof RANKING_DECISION_FIELD_IDS)[number];
export type CandidateAuthorityFieldPosture =
  | 'deterministic-ready-candidate'
  | 'deterministic-partial-only'
  | 'human-reviewed-structured-only'
  | 'not-responsibly-extractable-in-v1';
export type CandidateAuthorityBreadthGroup =
  | 'capability-adoption'
  | 'infrastructure-deployment'
  | 'policy-risk'
  | 'stack-package';
export type CandidateAuthorityEvidenceDimension =
  | 'capability-family'
  | 'data-store'
  | 'deployment'
  | 'freshness'
  | 'identity'
  | 'integration'
  | 'license'
  | 'limitation'
  | 'maintenance'
  | 'provenance'
  | 'repository-package'
  | 'runtime-framework'
  | 'security'
  | 'version-release';

export interface CandidateAuthorityFieldPlanEntry {
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly posture: CandidateAuthorityFieldPosture;
  readonly sourceAuthorityVersion: string;
  readonly extractionRuleVersion: string;
  readonly sourceKind: string;
  readonly versionScope: string;
  readonly negativeAbsenceSemantics: string;
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
  readonly deterministicReadinessEligible: boolean;
  readonly breadthGroup: CandidateAuthorityBreadthGroup;
  readonly providerOperations: readonly string[];
  readonly reusesPhase8Rule: boolean;
  readonly requiresSuccessorRule: boolean;
  readonly rationale: string;
}

export interface CandidateAuthorityFieldPlan {
  readonly planVersion: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_VERSION;
  readonly status: 'pre-live-no-go';
  readonly bindings: Readonly<Record<string, string>>;
  readonly frozenGate: {
    readonly denominatorSize: 18;
    readonly minimumReadyFields: 13;
    readonly exactPercentage: 72.222222;
    readonly minimumReadyFieldPerBreadthGroup: 1;
  };
  readonly plannedDeterministicReadinessEligibleFieldCount: 6;
  readonly goDecision: 'no-go';
  readonly goDecisionReasons: readonly string[];
  readonly fields: readonly CandidateAuthorityFieldPlanEntry[];
  readonly planSemanticDigest: string;
}

export interface CandidateAuthoritySourceOperation {
  readonly operationId: string;
  readonly provider: 'github' | 'npm';
  readonly host: 'api.github.com' | 'registry.npmjs.org';
  readonly method: 'GET';
  readonly endpointShape: string;
  readonly authentication: string;
  readonly sourceMutability: string;
  readonly maximumRequestsPerCandidate: number;
  readonly paginationRule: string;
  readonly maximumResponseBytes: number;
  readonly maximumJsonNodes: number;
  readonly timeoutMilliseconds: number;
  readonly maximumAttempts: number;
  readonly redirectPolicy: 'zero redirects';
  readonly controlledAbsence: string;
  readonly temporaryUnavailability: string;
  readonly retainedStructuredProperties: readonly string[];
  readonly fieldsSupplied: readonly CandidateAuthorityDecisionFieldId[];
  readonly privacySecurity: string;
  readonly evidenceProvenance: string;
  readonly completenessSemantics: string;
  readonly maximumTotalLogicalRequests: number;
}

export interface CandidateAuthoritySourcePolicy {
  readonly policyVersion: typeof CANDIDATE_AUTHORITY_SOURCE_POLICY_VERSION;
  readonly status: 'pre-live-not-authorized';
  readonly bindings: Readonly<Record<string, string>>;
  readonly authorization: Readonly<Record<string, false>>;
  readonly requestBudget: {
    readonly candidateCount: 150;
    readonly mappedPackageCount: 80;
    readonly githubLogicalRequests: 1060;
    readonly npmLogicalRequests: 80;
    readonly totalLogicalRequests: 1140;
    readonly githubWorstCaseAttempts: 3180;
    readonly npmWorstCaseAttempts: 240;
    readonly totalWorstCaseAttempts: 3420;
  };
  readonly operations: readonly CandidateAuthoritySourceOperation[];
  readonly failurePolicy: Readonly<Record<string, unknown>>;
  readonly freshnessPolicy: Readonly<Record<string, unknown>>;
  readonly publicationFlow: readonly string[];
  readonly policySemanticDigest: string;
}

export interface CandidateAuthorityRootV1 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_ROOT_VERSION;
  readonly catalogBinding: {
    readonly version: 'public-v1';
    readonly digest: string;
  };
  readonly taxonomyBinding: {
    readonly version: '1.0.0';
    readonly digest: string;
  };
  readonly deterministicProfileBinding: {
    readonly denominatorVersion: string;
    readonly rulesVersion: string;
  };
  readonly rankingDecisionBinding: {
    readonly denominatorVersion: 'ranking-decision-denominator/1.0.0';
    readonly readinessPolicyDigest: string;
  };
  readonly fieldPlanBinding: {
    readonly version: string;
    readonly digest: string;
  };
  readonly sourcePolicyBinding: {
    readonly version: string;
    readonly digest: string;
  };
  readonly collection: {
    readonly cutoff: string;
    readonly candidateCount: 150;
    readonly orderedCandidateIds: readonly string[];
    readonly orderedCandidateIdentitiesDigest: string;
  };
  readonly authorityDigests: {
    readonly source: string;
    readonly deterministicProfiles: string;
    readonly evidence: string;
    readonly dossiers: string;
    readonly dossierProjection: string;
    readonly coverageReadinessReport: string;
  };
  readonly qualificationCounts: {
    readonly known: number;
    readonly notApplicable: number;
    readonly unknown: number;
    readonly conflict: number;
  };
  readonly canonicalAuthorityDigest: string;
}

const FIELD_KEYS = [
  'breadthGroup',
  'completenessRequirement',
  'deterministicReadinessEligible',
  'evidenceDimension',
  'evidenceProvenanceKind',
  'evidenceTopic',
  'extractionRuleVersion',
  'fieldId',
  'freshnessRequirement',
  'negativeAbsenceSemantics',
  'notApplicableRule',
  'posture',
  'providerOperations',
  'rationale',
  'requiresSuccessorRule',
  'reusesPhase8Rule',
  'sourceAuthorityVersion',
  'sourceKind',
  'versionScope',
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
] as const);
const FIELD_POSTURES = new Set<CandidateAuthorityFieldPosture>([
  'deterministic-ready-candidate',
  'deterministic-partial-only',
  'human-reviewed-structured-only',
  'not-responsibly-extractable-in-v1',
]);
const BREADTH_GROUPS = new Set<CandidateAuthorityBreadthGroup>([
  'capability-adoption',
  'infrastructure-deployment',
  'policy-risk',
  'stack-package',
]);
const EVIDENCE_DIMENSIONS = new Set<CandidateAuthorityEvidenceDimension>([
  'capability-family',
  'data-store',
  'deployment',
  'freshness',
  'identity',
  'integration',
  'license',
  'limitation',
  'maintenance',
  'provenance',
  'repository-package',
  'runtime-framework',
  'security',
  'version-release',
]);
const PROVENANCE_KINDS = new Set([
  'approved-validation',
  'git-commit',
  'package-version',
  'structured-provider-snapshot',
]);
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

export function parseCandidateAuthorityFieldPlan(
  supplied: unknown,
): CandidateAuthorityFieldPlan {
  const plan = requireRecord(supplied);
  requireExactKeys(plan, [
    'bindings',
    'fields',
    'frozenGate',
    'goDecision',
    'goDecisionReasons',
    'planSemanticDigest',
    'planVersion',
    'plannedDeterministicReadinessEligibleFieldCount',
    'status',
  ]);
  if (!Array.isArray(plan['fields'])) invalid();
  const fields = plan['fields'].map((value, index) => {
    const field = requireRecord(value);
    requireExactKeys(field, FIELD_KEYS);
    if (
      field['fieldId'] !== RANKING_DECISION_FIELD_IDS[index] ||
      !FIELD_POSTURES.has(field['posture'] as CandidateAuthorityFieldPosture) ||
      !BREADTH_GROUPS.has(
        field['breadthGroup'] as CandidateAuthorityBreadthGroup,
      ) ||
      !EVIDENCE_DIMENSIONS.has(
        field['evidenceDimension'] as CandidateAuthorityEvidenceDimension,
      ) ||
      !PROVENANCE_KINDS.has(String(field['evidenceProvenanceKind'])) ||
      typeof field['deterministicReadinessEligible'] !== 'boolean' ||
      typeof field['reusesPhase8Rule'] !== 'boolean' ||
      typeof field['requiresSuccessorRule'] !== 'boolean' ||
      [
        'completenessRequirement',
        'evidenceTopic',
        'extractionRuleVersion',
        'freshnessRequirement',
        'negativeAbsenceSemantics',
        'notApplicableRule',
        'rationale',
        'sourceAuthorityVersion',
        'sourceKind',
        'versionScope',
      ].some((key) => !isNonemptyString(field[key])) ||
      !Array.isArray(field['providerOperations']) ||
      field['providerOperations'].some(
        (operation) => typeof operation !== 'string',
      )
    ) {
      invalid();
    }
    return field as unknown as CandidateAuthorityFieldPlanEntry;
  });
  const candidate = {
    ...plan,
    fields,
  } as unknown as CandidateAuthorityFieldPlan;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['planSemanticDigest'];
  const bindings = requireRecord(candidate.bindings);
  requireExactKeys(bindings, [
    'catalogDigest',
    'catalogVersion',
    'decisionDenominatorVersion',
    'readinessPolicyDigest',
    'readinessPolicyVersion',
    'taxonomyDigest',
    'taxonomyVersion',
  ]);
  const ready = fields.filter((field) => field.deterministicReadinessEligible);
  if (
    candidate.planVersion !== CANDIDATE_AUTHORITY_FIELD_PLAN_VERSION ||
    candidate.status !== 'pre-live-no-go' ||
    candidate.goDecision !== 'no-go' ||
    candidate.frozenGate.denominatorSize !==
      RANKING_DECISION_FIELD_IDS.length ||
    candidate.frozenGate.minimumReadyFields !==
      CANDIDATE_AUTHORITY_READY_MINIMUM ||
    candidate.frozenGate.exactPercentage !==
      CANDIDATE_AUTHORITY_READY_PERCENTAGE ||
    candidate.frozenGate.minimumReadyFieldPerBreadthGroup !== 1 ||
    candidate.plannedDeterministicReadinessEligibleFieldCount !==
      CANDIDATE_AUTHORITY_PLANNED_READY_COUNT ||
    bindings['catalogVersion'] !== 'public-v1' ||
    bindings['catalogDigest'] !==
      '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634' ||
    bindings['taxonomyVersion'] !== '1.0.0' ||
    bindings['taxonomyDigest'] !==
      '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9' ||
    bindings['decisionDenominatorVersion'] !==
      'ranking-decision-denominator/1.0.0' ||
    ready.length !== CANDIDATE_AUTHORITY_PLANNED_READY_COUNT ||
    ready.some((field) => field.posture !== 'deterministic-ready-candidate') ||
    fields.some(
      (field) =>
        (field.posture === 'deterministic-ready-candidate') !==
        field.deterministicReadinessEligible,
    ) ||
    // The semantic digest binds the recorded M2 policy reference without
    // importing or interpreting evaluation authority in product code.
    candidate.planSemanticDigest !== CANDIDATE_AUTHORITY_FIELD_PLAN_DIGEST ||
    candidate.planSemanticDigest !== canonicalizeJson(withoutDigest).digest
  ) {
    invalid();
  }
  return deepFreeze(candidate);
}

export function parseCandidateAuthoritySourcePolicy(
  supplied: unknown,
  fieldPlan: CandidateAuthorityFieldPlan,
): CandidateAuthoritySourcePolicy {
  const policy = requireRecord(supplied);
  requireExactKeys(policy, [
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
  ]);
  if (!Array.isArray(policy['operations'])) invalid();
  const operations = policy['operations'].map((value, index) => {
    const operationRecord = requireRecord(value);
    requireExactKeys(operationRecord, OPERATION_KEYS);
    const operation =
      operationRecord as unknown as CandidateAuthoritySourceOperation;
    if (
      operation.operationId !== OPERATION_IDS[index] ||
      operation.method !== 'GET' ||
      operation.maximumAttempts !== 3 ||
      operation.redirectPolicy !== 'zero redirects' ||
      operation.maximumResponseBytes !== 2_097_152 ||
      operation.maximumJsonNodes !== 100_000 ||
      operation.timeoutMilliseconds !== 15_000 ||
      operation.maximumRequestsPerCandidate < 1 ||
      operation.maximumRequestsPerCandidate > 2 ||
      operation.maximumTotalLogicalRequests < 1 ||
      (operation.provider === 'github' &&
        operation.host !== 'api.github.com') ||
      (operation.provider === 'npm' &&
        operation.host !== 'registry.npmjs.org') ||
      !Array.isArray(operation.retainedStructuredProperties) ||
      !Array.isArray(operation.fieldsSupplied)
    ) {
      invalid();
    }
    return operation;
  });
  const candidate = {
    ...policy,
    operations,
  } as unknown as CandidateAuthoritySourcePolicy;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['policySemanticDigest'];
  const budget = candidate.requestBudget;
  const authorization = requireRecord(candidate.authorization);
  requireExactKeys(authorization, [
    'allCandidateProjectionAuthorized',
    'automaticRerunAuthorized',
    'coverageCalculationAuthorized',
    'credentialReadAuthorized',
    'liveCollectionAuthorized',
    'providerCallAuthorized',
  ]);
  const bindings = requireRecord(candidate.bindings);
  requireExactKeys(bindings, [
    'catalogDigest',
    'catalogVersion',
    'fieldPlanVersion',
    'phase8ProviderPolicyDigest',
    'phase8ProviderPolicyVersion',
  ]);
  const githubLogicalRequests = operations
    .filter((operation) => operation.provider === 'github')
    .reduce(
      (total, operation) => total + operation.maximumTotalLogicalRequests,
      0,
    );
  const npmLogicalRequests = operations
    .filter((operation) => operation.provider === 'npm')
    .reduce(
      (total, operation) => total + operation.maximumTotalLogicalRequests,
      0,
    );
  if (
    candidate.policyVersion !== CANDIDATE_AUTHORITY_SOURCE_POLICY_VERSION ||
    candidate.status !== 'pre-live-not-authorized' ||
    bindings['fieldPlanVersion'] !== fieldPlan.planVersion ||
    bindings['catalogVersion'] !== 'public-v1' ||
    bindings['catalogDigest'] !==
      '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634' ||
    bindings['phase8ProviderPolicyVersion'] !==
      'profile-materialization-provider-policy/1.0.0' ||
    bindings['phase8ProviderPolicyDigest'] !==
      '0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede' ||
    Object.values(authorization).some((value) => value !== false) ||
    budget.candidateCount !== CANDIDATE_AUTHORITY_CANDIDATE_COUNT ||
    budget.githubLogicalRequests + budget.npmLogicalRequests !==
      budget.totalLogicalRequests ||
    budget.githubWorstCaseAttempts + budget.npmWorstCaseAttempts !==
      budget.totalWorstCaseAttempts ||
    budget.githubWorstCaseAttempts !== budget.githubLogicalRequests * 3 ||
    budget.npmWorstCaseAttempts !== budget.npmLogicalRequests * 3 ||
    budget.githubLogicalRequests !== githubLogicalRequests ||
    budget.npmLogicalRequests !== npmLogicalRequests ||
    candidate.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_DIGEST ||
    candidate.policySemanticDigest !== canonicalizeJson(withoutDigest).digest
  ) {
    invalid();
  }
  const operationIds = new Set(
    operations.map((operation) => operation.operationId),
  );
  if (
    fieldPlan.fields.some((field) =>
      field.providerOperations.some(
        (operation) => !operationIds.has(operation),
      ),
    )
  ) {
    invalid();
  }
  return deepFreeze(candidate);
}

export function candidateAuthorityRootSemanticDigest(
  root: Omit<CandidateAuthorityRootV1, 'canonicalAuthorityDigest'>,
): string {
  return canonicalizeJson(root).digest;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-manifest');
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}
