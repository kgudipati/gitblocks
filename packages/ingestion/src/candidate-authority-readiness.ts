/* eslint-disable @typescript-eslint/no-unnecessary-condition -- These checks validate committed trust-boundary data. */

import { canonicalizeJson } from './canonical-json.ts';
import {
  RANKING_DECISION_FIELD_IDS,
  type CandidateAuthorityBreadthGroup,
  type CandidateAuthorityDecisionFieldId,
  type CandidateAuthorityEvidenceDimension,
  type CandidateAuthoritySourceOperation,
} from './candidate-authority-contracts.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION,
  parseCandidateAuthorityPartialSemanticRegistry,
  partialFactDefinition,
  type CandidateAuthorityPartialFactCode,
  type CandidateAuthorityPartialSemanticRegistry,
} from './candidate-authority-partial-semantics.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION,
} from './candidate-authority-partial-evidence.ts';
import { ingestionError } from './errors.ts';
import {
  requireExactKeys,
  requireRecord,
} from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION =
  'ranking-v1-deterministic-readiness-policy/3.0.0' as const;
export const CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST =
  '9460725d84404616b045d2039251a4df28a4bd8ca7c7863487cb88c091899c4c' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V3_VERSION =
  'candidate-authority-field-plan/3.0.0' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V3_DIGEST =
  'd054dd81f945aefa9707df5c77be96bfba8f26bb87474bde5bf9c950f9405e1b' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V3_VERSION =
  'candidate-authority-source-policy/3.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V3_DIGEST =
  '946862b5b9291023f11d3bb7d37bf3d99a84d40d8846a361dba87ebc0b8614bb' as const;
export const CANDIDATE_AUTHORITY_ROOT_V3_VERSION =
  'candidate-authority-root/3.0.0' as const;
export const CANDIDATE_AUTHORITY_READINESS_POLICY_V3_PATH =
  'catalog/public-v1/candidate-authority-readiness-policy-v3.json' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V3_PATH =
  'catalog/public-v1/candidate-authority-field-plan-v3.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V3_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v3.json' as const;
export const CANDIDATE_AUTHORITY_PLANNED_CAPABLE_COUNT = 13 as const;
export const CANDIDATE_AUTHORITY_PLANNED_FULL_CLOSURE_COUNT = 6 as const;

export type CandidateAuthorityFieldPostureV3 =
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

export type CandidateAuthorityCellOriginCounts = Readonly<
  Record<CandidateAuthorityCellOrigin, number>
>;

export interface CandidateAuthorityFieldPlanEntryV3 {
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly posture: CandidateAuthorityFieldPostureV3;
  readonly sourceAuthorityVersion: string;
  readonly extractionRuleVersion: string;
  readonly sourceKind: string;
  readonly versionScope: string;
  readonly positiveFacts: readonly string[];
  readonly partialFactCodes: readonly CandidateAuthorityPartialFactCode[];
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
  readonly plannedExtractionCapable: boolean;
  readonly deterministicFullClosureCandidate: boolean;
  readonly breadthGroup: CandidateAuthorityBreadthGroup;
  readonly providerOperations: readonly string[];
  readonly reusesPhase8Rule: boolean;
  readonly requiresSuccessorRule: boolean;
  readonly rationale: string;
}

export interface CandidateAuthorityReadinessPolicyV3 {
  readonly policyVersion: typeof CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION;
  readonly status: 'proposed-independent-review-required';
  readonly supersedes: Readonly<Record<string, string>>;
  readonly unchangedGate: {
    readonly denominatorVersion: 'ranking-decision-denominator/1.0.0';
    readonly denominatorSize: 18;
    readonly minimumRealizedReadyFields: 13;
    readonly exactPercentage: 72.222222;
  };
  readonly plannedDeterministicExtractionCapabilityDefinition: readonly string[];
  readonly realizedDeterministicReadinessDefinition: readonly string[];
  readonly deterministicFullClosureDefinition: string;
  readonly breadthGroups: Readonly<
    Record<
      CandidateAuthorityBreadthGroup,
      readonly CandidateAuthorityDecisionFieldId[]
    >
  >;
  readonly breadthQualification: {
    readonly preLive: string;
    readonly finalM3: string;
  };
  readonly postCollectionFailurePolicy: readonly string[];
  readonly perCellOrigins: readonly CandidateAuthorityCellOrigin[];
  readonly numeratorExclusions: readonly string[];
  readonly changeControl: string;
  readonly policySemanticDigest: string;
}

export interface CandidateAuthorityFieldPlanV3 {
  readonly planVersion: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V3_VERSION;
  readonly status: 'pre-live-go-pending-independent-rereview';
  readonly bindings: Readonly<Record<string, string>>;
  readonly frozenGate: {
    readonly denominatorSize: 18;
    readonly minimumRealizedReadyFields: 13;
    readonly exactPercentage: 72.222222;
    readonly minimumFieldPerBreadthGroup: 1;
  };
  readonly plannedDeterministicExtractionCapableFieldCount: 13;
  readonly plannedDeterministicFullClosureFieldCount: 6;
  readonly goDecision: 'go-pending-independent-rereview';
  readonly goDecisionReasons: readonly string[];
  readonly fields: readonly CandidateAuthorityFieldPlanEntryV3[];
  readonly planSemanticDigest: string;
}

export interface CandidateAuthoritySourcePolicyV3 {
  readonly policyVersion: typeof CANDIDATE_AUTHORITY_SOURCE_POLICY_V3_VERSION;
  readonly status: 'pre-live-not-authorized';
  readonly bindings: Readonly<Record<string, string>>;
  readonly authorization: Readonly<Record<string, false>>;
  readonly requestBudget: {
    readonly candidateCount: 150;
    readonly mappedPackageCount: 80;
    readonly githubLogicalRequests: 1660;
    readonly npmLogicalRequests: 80;
    readonly totalLogicalRequests: 1740;
    readonly githubWorstCaseAttempts: 4980;
    readonly npmWorstCaseAttempts: 240;
    readonly totalWorstCaseAttempts: 5220;
  };
  readonly operations: readonly CandidateAuthoritySourceOperation[];
  readonly failurePolicy: Readonly<Record<string, unknown>>;
  readonly freshnessPolicy: Readonly<Record<string, unknown>>;
  readonly publicationFlow: readonly string[];
  readonly policySemanticDigest: string;
}

export interface CandidateAuthorityRootV3 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_ROOT_V3_VERSION;
  readonly catalogBinding: Readonly<Record<string, string>>;
  readonly taxonomyBinding: Readonly<Record<string, string>>;
  readonly deterministicProfileBinding: Readonly<Record<string, string>>;
  readonly rankingDecisionBinding: Readonly<Record<string, string>>;
  readonly readinessPolicyBinding: Readonly<Record<string, string>>;
  readonly fieldPlanBinding: Readonly<Record<string, string>>;
  readonly sourcePolicyBinding: Readonly<Record<string, string>>;
  readonly partialSemanticRegistryBinding: Readonly<Record<string, string>>;
  readonly partialEvidenceContractBinding: Readonly<Record<string, string>>;
  readonly collection: {
    readonly cutoff: string;
    readonly candidateCount: 150;
    readonly orderedCandidateIds: readonly string[];
    readonly orderedCandidateIdentitiesDigest: string;
  };
  readonly authorityDigests: {
    readonly source: string;
    readonly deterministicProfiles: string;
    readonly partialFieldEvidence: string;
    readonly evidence: string;
    readonly dossiers: string;
    readonly dossierProjection: string;
    readonly coverageReadinessReport: string;
  };
  readonly fieldReadinessCounts: {
    readonly plannedDeterministicExtractionCapable: number;
    readonly realizedDeterministicReady: number;
    readonly deterministicFullClosure: number;
  };
  readonly plannedBreadthGroups: Readonly<
    Record<
      CandidateAuthorityBreadthGroup,
      readonly CandidateAuthorityDecisionFieldId[]
    >
  >;
  readonly realizedBreadthGroups: Readonly<
    Record<
      CandidateAuthorityBreadthGroup,
      readonly CandidateAuthorityDecisionFieldId[]
    >
  >;
  readonly cellOriginCounts: CandidateAuthorityCellOriginCounts;
  readonly readinessDecision: 'go' | 'no-go';
  readonly canonicalAuthorityDigest: string;
}

export interface CandidateAuthorityFieldRealization {
  readonly fieldId: CandidateAuthorityDecisionFieldId;
  readonly origins: CandidateAuthorityCellOriginCounts;
  /** Cells whose partial evidence passed the frozen registry at the dossier boundary. */
  readonly validatedPartialEvidenceCellCount: number;
}

export interface CandidateAuthorityRealizedReadinessResult {
  readonly plannedDeterministicExtractionCapableFieldCount: number;
  readonly realizedDeterministicReadyFieldCount: number;
  readonly deterministicFullClosureFieldCount: number;
  readonly plannedBreadthGroups: Readonly<
    Record<
      CandidateAuthorityBreadthGroup,
      readonly CandidateAuthorityDecisionFieldId[]
    >
  >;
  readonly realizedBreadthGroups: Readonly<
    Record<
      CandidateAuthorityBreadthGroup,
      readonly CandidateAuthorityDecisionFieldId[]
    >
  >;
  readonly realizedDeterministicReadyFields: readonly CandidateAuthorityDecisionFieldId[];
  readonly deterministicFullClosureFields: readonly CandidateAuthorityDecisionFieldId[];
  readonly decision: 'go' | 'no-go';
}

const POLICY_KEYS = [
  'breadthGroups',
  'breadthQualification',
  'changeControl',
  'deterministicFullClosureDefinition',
  'numeratorExclusions',
  'perCellOrigins',
  'plannedDeterministicExtractionCapabilityDefinition',
  'policySemanticDigest',
  'policyVersion',
  'postCollectionFailurePolicy',
  'realizedDeterministicReadinessDefinition',
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
  'plannedDeterministicExtractionCapableFieldCount',
  'plannedDeterministicFullClosureFieldCount',
  'status',
] as const;
const FIELD_KEYS = [
  'breadthGroup',
  'canEmitMeaningfulNonUnknownFact',
  'completenessRequirement',
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
  'partialFactCodes',
  'plannedExtractionCapable',
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
  'github-default-branch-ref',
  'github-head-commit-object',
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
const BREADTH_GROUPS = Object.freeze([
  'capability-adoption',
  'stack-package',
  'infrastructure-deployment',
  'policy-risk',
] as const);
const CELL_ORIGINS = Object.freeze([
  'deterministic-known',
  'deterministic-not-applicable',
  'deterministic-partial-direct-evidence',
  'human-reviewed-structured',
  'model-derived',
  'unknown',
  'conflict',
] as const);

export function qualifiesPlannedDeterministicExtraction(
  field: CandidateAuthorityFieldPlanEntryV3,
): boolean {
  const prohibited = new Set(field.prohibitedExtractionInputs);
  const partialBindingValid =
    field.posture !== 'deterministic-partial-path' ||
    field.partialFactCodes.length > 0;
  return (
    field.generationOrigin === 'deterministic' &&
    field.extractionRuleVersion.length > 0 &&
    field.sourceAuthorityVersion.length > 0 &&
    field.providerOperations.length > 0 &&
    field.canEmitMeaningfulNonUnknownFact &&
    field.positiveFacts.length > 0 &&
    partialBindingValid &&
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

export function evaluateCandidateAuthorityRealizedReadiness(input: {
  readonly candidateCount: number;
  readonly fieldPlan: CandidateAuthorityFieldPlanV3;
  readonly fields: readonly CandidateAuthorityFieldRealization[];
}): CandidateAuthorityRealizedReadinessResult {
  if (
    !Number.isSafeInteger(input.candidateCount) ||
    input.candidateCount < 1 ||
    input.fields.length !== RANKING_DECISION_FIELD_IDS.length
  )
    invalid();
  const planByField = new Map(
    input.fieldPlan.fields.map((field) => [field.fieldId, field]),
  );
  const seen = new Set<CandidateAuthorityDecisionFieldId>();
  const realized: CandidateAuthorityDecisionFieldId[] = [];
  const fullClosure: CandidateAuthorityDecisionFieldId[] = [];
  for (const field of input.fields) {
    const plan = planByField.get(field.fieldId);
    if (plan === undefined || seen.has(field.fieldId)) invalid();
    seen.add(field.fieldId);
    const counts = CELL_ORIGINS.map((origin) => field.origins[origin]);
    if (
      counts.some((count) => !Number.isSafeInteger(count) || count < 0) ||
      counts.reduce((sum, count) => sum + count, 0) !== input.candidateCount ||
      !Number.isSafeInteger(field.validatedPartialEvidenceCellCount) ||
      field.validatedPartialEvidenceCellCount < 0 ||
      field.validatedPartialEvidenceCellCount !==
        field.origins['deterministic-partial-direct-evidence']
    )
      invalid();
    const meaningfulNonNotApplicable =
      field.origins['deterministic-known'] +
      field.origins['deterministic-partial-direct-evidence'];
    if (plan.plannedExtractionCapable && meaningfulNonNotApplicable > 0) {
      realized.push(field.fieldId);
    }
    if (
      plan.plannedExtractionCapable &&
      field.origins['deterministic-known'] +
        field.origins['deterministic-not-applicable'] ===
        input.candidateCount
    ) {
      fullClosure.push(field.fieldId);
    }
  }
  const plannedBreadthGroups = breadthFields(
    input.fieldPlan.fields.filter((field) => field.plannedExtractionCapable),
  );
  const realizedSet = new Set(realized);
  const realizedBreadthGroups = breadthFields(
    input.fieldPlan.fields.filter((field) => realizedSet.has(field.fieldId)),
  );
  const breadthPass = BREADTH_GROUPS.every(
    (group) => realizedBreadthGroups[group].length > 0,
  );
  return Object.freeze({
    plannedDeterministicExtractionCapableFieldCount:
      input.fieldPlan.plannedDeterministicExtractionCapableFieldCount,
    realizedDeterministicReadyFieldCount: realized.length,
    deterministicFullClosureFieldCount: fullClosure.length,
    plannedBreadthGroups,
    realizedBreadthGroups,
    realizedDeterministicReadyFields: Object.freeze(realized),
    deterministicFullClosureFields: Object.freeze(fullClosure),
    decision:
      realized.length >=
        input.fieldPlan.frozenGate.minimumRealizedReadyFields && breadthPass
        ? 'go'
        : 'no-go',
  });
}

export function parseCandidateAuthorityReadinessPolicyV3(
  supplied: unknown,
): CandidateAuthorityReadinessPolicyV3 {
  const record = requireRecord(supplied);
  requireExactKeys(record, POLICY_KEYS);
  const candidate = record as unknown as CandidateAuthorityReadinessPolicyV3;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['policySemanticDigest'];
  if (
    candidate.policyVersion !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION ||
    candidate.status !== 'proposed-independent-review-required' ||
    candidate.unchangedGate.denominatorSize !== 18 ||
    candidate.unchangedGate.minimumRealizedReadyFields !== 13 ||
    candidate.unchangedGate.exactPercentage !== 72.222222 ||
    !arraysEqual(candidate.perCellOrigins, CELL_ORIGINS) ||
    candidate.policySemanticDigest !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_DIGEST ||
    candidate.policySemanticDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function parseCandidateAuthorityFieldPlanV3(
  supplied: unknown,
  policy: CandidateAuthorityReadinessPolicyV3,
  registry: CandidateAuthorityPartialSemanticRegistry,
): CandidateAuthorityFieldPlanV3 {
  const validatedRegistry =
    parseCandidateAuthorityPartialSemanticRegistry(registry);
  const record = requireRecord(supplied);
  requireExactKeys(record, PLAN_KEYS);
  if (!Array.isArray(record['fields'])) invalid();
  const fields = record['fields'].map((value, index) => {
    const field = requireRecord(value);
    requireExactKeys(field, FIELD_KEYS);
    if (
      field['fieldId'] !== RANKING_DECISION_FIELD_IDS[index] ||
      !Array.isArray(field['positiveFacts']) ||
      !Array.isArray(field['partialFactCodes']) ||
      !Array.isArray(field['prohibitedExtractionInputs']) ||
      !Array.isArray(field['providerOperations'])
    )
      invalid();
    const candidate = field as unknown as CandidateAuthorityFieldPlanEntryV3;
    if (
      candidate.plannedExtractionCapable !==
      qualifiesPlannedDeterministicExtraction(candidate)
    )
      invalid();
    if (
      candidate.deterministicFullClosureCandidate &&
      candidate.posture !== 'deterministic-complete-path'
    )
      invalid();
    if (
      !candidate.plannedExtractionCapable &&
      candidate.posture.startsWith('deterministic-')
    )
      invalid();
    for (const factCode of candidate.partialFactCodes) {
      const definition = partialFactDefinition(validatedRegistry, factCode);
      if (
        definition.fieldId !== candidate.fieldId ||
        definition.extractionRuleVersion !== candidate.extractionRuleVersion ||
        !definition.qualifiesPlannedExtractionCapability
      )
        invalid();
    }
    return candidate;
  });
  const candidate = {
    ...record,
    fields,
  } as unknown as CandidateAuthorityFieldPlanV3;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['planSemanticDigest'];
  const capable = fields.filter((field) => field.plannedExtractionCapable);
  const fullClosure = fields.filter(
    (field) => field.deterministicFullClosureCandidate,
  );
  const breadthPass = BREADTH_GROUPS.every((group) =>
    capable.some((field) => field.breadthGroup === group),
  );
  if (
    candidate.planVersion !== CANDIDATE_AUTHORITY_FIELD_PLAN_V3_VERSION ||
    candidate.status !== 'pre-live-go-pending-independent-rereview' ||
    candidate.goDecision !== 'go-pending-independent-rereview' ||
    candidate.frozenGate.denominatorSize !== 18 ||
    candidate.frozenGate.minimumRealizedReadyFields !== 13 ||
    candidate.frozenGate.exactPercentage !== 72.222222 ||
    candidate.frozenGate.minimumFieldPerBreadthGroup !== 1 ||
    candidate.plannedDeterministicExtractionCapableFieldCount !==
      CANDIDATE_AUTHORITY_PLANNED_CAPABLE_COUNT ||
    candidate.plannedDeterministicFullClosureFieldCount !==
      CANDIDATE_AUTHORITY_PLANNED_FULL_CLOSURE_COUNT ||
    capable.length !== CANDIDATE_AUTHORITY_PLANNED_CAPABLE_COUNT ||
    fullClosure.length !== CANDIDATE_AUTHORITY_PLANNED_FULL_CLOSURE_COUNT ||
    !breadthPass ||
    candidate.bindings['readinessPolicyVersion'] !== policy.policyVersion ||
    candidate.bindings['readinessPolicyDigest'] !==
      policy.policySemanticDigest ||
    candidate.bindings['partialSemanticRegistryVersion'] !==
      CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_VERSION ||
    candidate.bindings['partialSemanticRegistryDigest'] !==
      CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_DIGEST ||
    candidate.bindings['partialEvidenceContractVersion'] !==
      CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_VERSION ||
    candidate.bindings['partialEvidenceContractDigest'] !==
      CANDIDATE_AUTHORITY_PARTIAL_EVIDENCE_CONTRACT_DIGEST ||
    candidate.planSemanticDigest !== CANDIDATE_AUTHORITY_FIELD_PLAN_V3_DIGEST ||
    candidate.planSemanticDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function parseCandidateAuthoritySourcePolicyV3(
  supplied: unknown,
  plan: CandidateAuthorityFieldPlanV3,
): CandidateAuthoritySourcePolicyV3 {
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
      candidate.maximumResponseBytes < 1 ||
      candidate.maximumResponseBytes > 2_097_152 ||
      candidate.maximumJsonNodes < 1 ||
      candidate.maximumJsonNodes > 100_000 ||
      candidate.timeoutMilliseconds < 1 ||
      candidate.timeoutMilliseconds > 15_000 ||
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
  } as unknown as CandidateAuthoritySourcePolicyV3;
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
  const endpointByOperation = new Map(
    operations.map((operation) => [
      operation.operationId,
      operation.endpointShape,
    ]),
  );
  if (
    candidate.policyVersion !== CANDIDATE_AUTHORITY_SOURCE_POLICY_V3_VERSION ||
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
    endpointByOperation.get('github-default-branch-ref') !==
      '/repos/{owner}/{repository}/git/ref/heads/{urlEncodedDefaultBranch}' ||
    endpointByOperation.get('github-head-commit-object') !==
      '/repos/{owner}/{repository}/git/commits/{exactCommitObjectId}' ||
    operations.some(
      (operation) =>
        operation.endpointShape ===
        '/repos/{owner}/{repository}/commits/{defaultBranch}',
    ) ||
    plan.fields.some((field) =>
      field.providerOperations.some(
        (operation) => !operationIds.has(operation),
      ),
    ) ||
    candidate.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V3_DIGEST ||
    candidate.policySemanticDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function candidateAuthorityRootV3SemanticDigest(
  root: Omit<CandidateAuthorityRootV3, 'canonicalAuthorityDigest'>,
): string {
  return canonicalizeJson(root).digest;
}

function breadthFields(
  fields: readonly CandidateAuthorityFieldPlanEntryV3[],
): Readonly<
  Record<
    CandidateAuthorityBreadthGroup,
    readonly CandidateAuthorityDecisionFieldId[]
  >
> {
  return Object.freeze(
    Object.fromEntries(
      BREADTH_GROUPS.map((group) => [
        group,
        Object.freeze(
          fields
            .filter((field) => field.breadthGroup === group)
            .map((field) => field.fieldId),
        ),
      ]),
    ) as Record<
      CandidateAuthorityBreadthGroup,
      readonly CandidateAuthorityDecisionFieldId[]
    >,
  );
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
