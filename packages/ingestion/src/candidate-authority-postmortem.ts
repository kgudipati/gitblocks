import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_VERSION,
  CANDIDATE_AUTHORITY_REPLAY_V3_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS,
} from './candidate-authority-provider-contract.ts';
import {
  qualifiesPlannedDeterministicExtraction,
  type CandidateAuthorityFieldPlanEntryV4,
  type CandidateAuthorityFieldPlanV4,
} from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_FAILED_EXECUTION_HEAD =
  '2cfe0682617fb303ebbb2deb7dd7bd34a383c912' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_VERSION =
  'candidate-authority-live-failure-record/1.0.0' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_DIGEST =
  '48fa5cfe14cb579b254892cf69bede27bd96a802c8bfde6da9f7f4a4ab5595c7' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V5_VERSION =
  'candidate-authority-field-plan/5.0.0' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V5_DIGEST =
  '858385239dcecf78e35cb204740c817b01f51db2aa3bc750bf9df49848a8a160' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_VERSION =
  'candidate-authority-source-policy/6.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_DIGEST =
  'c972e3c3ea25a8d0e456e759b2898ca2837bcd82e701cfc1f3a0caaba1753510' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_DIGEST =
  '06495281a2642ca3bc3ba5dec07ea1ddd0c541130f294f5d6bea62c525abfd0c' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V3_DIGEST =
  '59f57f1faef68a3ab140e8a13483350f5d93735474564f141aa1a220a927bf5b' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION =
  'candidate-authority-live-authorization/4.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST =
  'c999cf79c52d0e902de1541aae66940c43690b6560311a4c5a17c60112028367' as const;

export const CANDIDATE_AUTHORITY_FAILURE_RECORD_PATH =
  'catalog/public-v1/candidate-authority-live-failure-record-v1.json' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V5_PATH =
  'catalog/public-v1/candidate-authority-field-plan-v5.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v6.json' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_PATH =
  'catalog/public-v1/candidate-authority-provider-contract-v1.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V3_PATH =
  'catalog/public-v1/candidate-authority-replay-algorithm-v3.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v4.json' as const;

export interface CandidateAuthorityPostmortemAuthorities {
  readonly failureRecord: Readonly<Record<string, unknown>>;
  readonly providerContract: Readonly<Record<string, unknown>>;
  readonly fieldPlan: Readonly<Record<string, unknown>>;
  readonly sourcePolicy: Readonly<Record<string, unknown>>;
  readonly replay: Readonly<Record<string, unknown>>;
  readonly authorization: Readonly<Record<string, unknown>>;
}

export interface CandidateAuthorityFieldPlanV5Runtime extends Omit<
  CandidateAuthorityFieldPlanV4,
  | 'fields'
  | 'planSemanticDigest'
  | 'planVersion'
  | 'plannedDeterministicFullClosureFieldCount'
  | 'status'
> {
  readonly planVersion: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V5_VERSION;
  readonly status: 'proposed-for-independent-postmortem-acceptance';
  readonly plannedDeterministicFullClosureFieldCount: 5;
  readonly fields: readonly CandidateAuthorityFieldPlanEntryV4[];
  readonly planSemanticDigest: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V5_DIGEST;
}

export function materializeCandidateAuthorityFieldPlanV5(input: {
  readonly predecessor: CandidateAuthorityFieldPlanV4;
  readonly successorAuthority: unknown;
}): CandidateAuthorityFieldPlanV5Runtime {
  const successor = validateDigest(
    input.successorAuthority,
    'planVersion',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V5_VERSION,
    'planSemanticDigest',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V5_DIGEST,
  );
  validateFieldPlan(successor);
  const overrides = successor['fieldOverrides'];
  if (!Array.isArray(overrides) || overrides.length !== 1) invalid();
  const security = overrides[0] as CandidateAuthorityFieldPlanEntryV4;
  if (!qualifiesPlannedDeterministicExtraction(security)) invalid();
  const fields = input.predecessor.fields.map((field) =>
    field.fieldId === 'security-policy-presence' ? security : field,
  );
  if (
    fields.filter((field) => field.plannedExtractionCapable).length !== 13 ||
    fields.filter((field) => field.deterministicFullClosureCandidate).length !==
      5
  )
    invalid();
  return deepFreeze({
    ...input.predecessor,
    planVersion: CANDIDATE_AUTHORITY_FIELD_PLAN_V5_VERSION,
    status: 'proposed-for-independent-postmortem-acceptance',
    plannedDeterministicFullClosureFieldCount: 5,
    fields,
    planSemanticDigest: CANDIDATE_AUTHORITY_FIELD_PLAN_V5_DIGEST,
  });
}

export function parseCandidateAuthorityPostmortemAuthorities(input: {
  readonly failureRecord: unknown;
  readonly providerContract: unknown;
  readonly fieldPlan: unknown;
  readonly sourcePolicy: unknown;
  readonly replay: unknown;
  readonly authorization: unknown;
}): CandidateAuthorityPostmortemAuthorities {
  const failureRecord = validateDigest(
    input.failureRecord,
    'recordVersion',
    CANDIDATE_AUTHORITY_FAILURE_RECORD_VERSION,
    'canonicalFailureDigest',
    CANDIDATE_AUTHORITY_FAILURE_RECORD_DIGEST,
  );
  const providerContract = validateDigest(
    input.providerContract,
    'contractVersion',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_VERSION,
    'canonicalContractDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_DIGEST,
  );
  const fieldPlan = validateDigest(
    input.fieldPlan,
    'planVersion',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V5_VERSION,
    'planSemanticDigest',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V5_DIGEST,
  );
  const sourcePolicy = validateDigest(
    input.sourcePolicy,
    'policyVersion',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_VERSION,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V6_DIGEST,
  );
  const replay = validateDigest(
    input.replay,
    'algorithmVersion',
    CANDIDATE_AUTHORITY_REPLAY_V3_VERSION,
    'canonicalAlgorithmDigest',
    CANDIDATE_AUTHORITY_REPLAY_V3_DIGEST,
  );
  const authorization = validateDigest(
    input.authorization,
    'authorizationVersion',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_VERSION,
    'authorizationSemanticDigest',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V4_DIGEST,
  );
  validateFailureRecord(failureRecord);
  validateFieldPlan(fieldPlan);
  validateProviderContract(providerContract);
  validateSourcePolicy(sourcePolicy);
  validateReplay(replay);
  validateAuthorization(authorization);
  return deepFreeze({
    failureRecord,
    providerContract,
    fieldPlan,
    sourcePolicy,
    replay,
    authorization,
  });
}

function validateFailureRecord(
  record: Readonly<Record<string, unknown>>,
): void {
  const facts = requireRecord(record['observedExecutionFacts']);
  const cutoff = requireRecord(facts['collectionCutoff']);
  const metrics = requireRecord(facts['metrics']);
  if (
    record['executionHead'] !== CANDIDATE_AUTHORITY_FAILED_EXECUTION_HEAD ||
    facts['credentialGate'] !== 'passed' ||
    cutoff['createdInProcess'] !== true ||
    cutoff['emitted'] !== false ||
    cutoff['persisted'] !== false ||
    cutoff['exactValue'] !== 'unavailable' ||
    facts['candidateProviderEffectsReached'] !== true ||
    facts['providerEffectCollectionsConsumed'] !== 1 ||
    facts['failureStage'] !== 'candidate-authority-live-collect' ||
    facts['safeErrorCode'] !== 'ingestion.provider-response' ||
    facts['candidateId'] !== 'unknown' ||
    facts['operationId'] !== 'unknown' ||
    Object.values(metrics).some((value) => value !== 'unavailable') ||
    facts['sourceReceipt'] !== 'absent' ||
    facts['sourceStagingAfterFailure'] !== 'absent' ||
    facts['sourceAuthority'] !== 'absent' ||
    facts['allCandidateProjection'] !== 'not-performed' ||
    facts['readinessMeasurement'] !== 'not-performed' ||
    facts['milestone4'] !== 'not-started' ||
    facts['automaticRerun'] !== false
  )
    invalid();
}

function validateFieldPlan(record: Readonly<Record<string, unknown>>): void {
  const gate = requireRecord(record['unchangedGate']);
  const overrides = record['fieldOverrides'];
  if (!Array.isArray(overrides) || overrides.length !== 1) invalid();
  const security = requireRecord(overrides[0]);
  if (
    record['plannedDeterministicExtractionCapableFieldCount'] !== 13 ||
    record['plannedDeterministicFullClosureFieldCount'] !== 5 ||
    gate['denominatorSize'] !== 18 ||
    gate['minimumRealizedReadyFields'] !== 13 ||
    gate['exactPercentage'] !== 72.222222 ||
    gate['minimumFieldPerBreadthGroup'] !== 1 ||
    security['fieldId'] !== 'security-policy-presence' ||
    security['posture'] !== 'deterministic-partial-path' ||
    security['plannedExtractionCapable'] !== true ||
    security['deterministicFullClosureCandidate'] !== false ||
    !arrayEquals(security['providerOperations'], [
      'github-root-tree',
      'github-security-dot-github-tree',
      'github-security-docs-tree',
    ]) ||
    !arrayEquals(record['plannedFullClosureFields'], [
      'package-publication-version',
      'runtime-package-format',
      'package-repository-linkage',
      'archived-state',
      'maintenance-activity',
    ])
  )
    invalid();
}

function validateProviderContract(
  record: Readonly<Record<string, unknown>>,
): void {
  const operations = record['operations'];
  if (!Array.isArray(operations)) invalid();
  const ids = operations.map((value) => requireRecord(value)['operationId']);
  if (!arrayEquals(ids, CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS)) invalid();
  const budget = requireRecord(record['requestCeilings']);
  const github = operations
    .map(requireRecord)
    .filter((operation) => operation['provider'] === 'github')
    .reduce((sum, operation) => sum + count(operation['requestCeiling']), 0);
  const npm = operations
    .map(requireRecord)
    .filter((operation) => operation['provider'] === 'npm')
    .reduce((sum, operation) => sum + count(operation['requestCeiling']), 0);
  if (
    github !== 1810 ||
    npm !== 80 ||
    budget['githubLogicalRequests'] !== github ||
    budget['npmLogicalRequests'] !== npm ||
    budget['totalLogicalRequests'] !== github + npm ||
    budget['githubAttempts'] !== github * 3 ||
    budget['npmAttempts'] !== npm * 3 ||
    budget['totalAttempts'] !== (github + npm) * 3
  )
    invalid();
}

function validateSourcePolicy(record: Readonly<Record<string, unknown>>): void {
  const inventory = record['operationInventory'];
  if (!Array.isArray(inventory)) invalid();
  const ids = inventory.map((value) => requireRecord(value)['operationId']);
  const budget = requireRecord(record['requestBudget']);
  const changes = requireRecord(record['operationChanges']);
  const removed = changes['removed'];
  if (
    !arrayEquals(ids, CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS) ||
    budget['githubLogicalRequests'] !== 1810 ||
    budget['npmLogicalRequests'] !== 80 ||
    budget['totalLogicalRequests'] !== 1890 ||
    budget['githubWorstCaseAttempts'] !== 5430 ||
    budget['npmWorstCaseAttempts'] !== 240 ||
    budget['totalWorstCaseAttempts'] !== 5670 ||
    !Array.isArray(removed) ||
    !arrayEquals(
      removed.map((value) => requireRecord(value)['operationId']),
      ['github-community-profile', 'github-compose-json-content'],
    )
  )
    invalid();
}

function validateReplay(record: Readonly<Record<string, unknown>>): void {
  const security = requireRecord(record['securityPolicyProjection']);
  const advisory = requireRecord(record['advisoryProjection']);
  if (
    security['registeredLocalPolicy'] !== 'known present true' ||
    security['noEstablishedLocalPolicy'] !== 'profile field unknown' ||
    security['presentFalsePermitted'] !== false ||
    advisory['providerMedium'] !== 'product moderate' ||
    advisory['providerUnknown'] !== 'unresolved severity; never fabricated'
  )
    invalid();
}

function validateAuthorization(
  record: Readonly<Record<string, unknown>>,
): void {
  const prior = requireRecord(record['priorConsumedExperiment']);
  const successor = requireRecord(record['successorExperiment']);
  const lineage = requireRecord(record['executionLineage']);
  if (
    record['status'] !==
      'proposed-inactive-pending-independent-exact-head-acceptance' ||
    prior['providerEffectCollectionsConsumed'] !== 1 ||
    prior['remainingProviderEffectCollections'] !== 0 ||
    prior['rerunPermitted'] !== false ||
    successor['conditionallyAuthorizedProviderEffectCollections'] !== 1 ||
    successor['activeProviderEffectCollections'] !== 0 ||
    successor['automaticRerun'] !== false ||
    lineage['acceptedCorrectionHead'] !==
      'pending-independent-exact-head-acceptance' ||
    lineage['independentReviewRequiredBeforeCredentialInspection'] !== true ||
    record['credentialEnvironmentName'] !==
      'GITBLOCKS_CANDIDATE_AUTHORITY_GITHUB_TOKEN' ||
    record['operatorVersion'] !== 'candidate-authority-live-operator/4.0.0'
  )
    invalid();
}

function validateDigest(
  supplied: unknown,
  versionKey: string,
  expectedVersion: string,
  digestKey: string,
  expectedDigest: string,
): Readonly<Record<string, unknown>> {
  const record = requireRecord(supplied);
  const withoutDigest = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== digestKey),
  );
  if (
    record[versionKey] !== expectedVersion ||
    record[digestKey] !== expectedDigest ||
    canonicalizeJson(withoutDigest).digest !== expectedDigest
  )
    invalid();
  return record;
}

function arrayEquals(supplied: unknown, expected: readonly unknown[]): boolean {
  return (
    Array.isArray(supplied) &&
    supplied.length === expected.length &&
    supplied.every((value, index) => value === expected[index])
  );
}

function count(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) invalid();
  return Number(value);
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
