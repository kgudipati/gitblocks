import { canonicalizeJson } from './canonical-json.ts';
import {
  partialFactDefinition,
  type CandidateAuthorityPartialSemanticRegistry,
} from './candidate-authority-partial-semantics.ts';
import type { CandidateAuthorityFieldPlanV5Runtime } from './candidate-authority-postmortem.ts';
import {
  qualifiesPlannedDeterministicExtraction,
  type CandidateAuthorityFieldPlanEntryV4,
} from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_V5_EXECUTION_HEAD =
  '799f88735885c656de0ad25bc42ca3a90adbe082' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_VERSION =
  'candidate-authority-live-failure-record/2.0.0' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_DIGEST =
  'ebfd078f675c4ce33bba2c9edb7eac1c9cd967bbe6a6a5a35614b77f893dc0a5' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_PATH =
  'catalog/public-v1/candidate-authority-live-failure-record-v2.json' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V6_VERSION =
  'candidate-authority-field-plan/6.0.0' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V6_DIGEST =
  '104a8c5ee46aa42dc4fd5ef0b558500809636c38d36f78bcd4f24c284f586409' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V6_PATH =
  'catalog/public-v1/candidate-authority-field-plan-v6.json' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_VERSION =
  'candidate-authority-provider-contract/3.0.0' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_DIGEST =
  '37ac4bf0fa5aa7045737f262b34a21f910ca67f20cadac2dbf915dbb8b7abe57' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_PATH =
  'catalog/public-v1/candidate-authority-provider-contract-v3.json' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST =
  'edfd7ebcd8d42cbb65de4e79307ab91df81bd104b4039179082e1ff22686187b' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH =
  'catalog/public-v1/candidate-authority-provider-contract-v2.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_VERSION =
  'candidate-authority-source-policy/8.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_DIGEST =
  'd043c6b1842791a2348b6f4eeb8644ac0a366f48aa8f585aab45aefdd97563ca' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v8.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST =
  '237b707fce608b4518ae09fcd07f7e08c315f7f323e56fb338990e1102fd29d7' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v7.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V5_VERSION =
  'candidate-authority-pure-replay/5.0.0' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V5_DIGEST =
  '71215716755000ea5d0705df5b41e92dee0b8b9178268745a7c536c89128bfc8' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V5_PATH =
  'catalog/public-v1/candidate-authority-replay-algorithm-v5.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION =
  'candidate-authority-live-authorization/6.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST =
  'ecfc1cd5e1096049f0fb3aef1adc019b9aad920e639fa3e95cebc40b26c77418' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v6.json' as const;

export interface CandidateAuthorityFieldPlanV6Runtime extends Omit<
  CandidateAuthorityFieldPlanV5Runtime,
  | 'fields'
  | 'planSemanticDigest'
  | 'planVersion'
  | 'plannedDeterministicFullClosureFieldCount'
  | 'status'
> {
  readonly planVersion: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V6_VERSION;
  readonly status: 'inactive-pending-independent-exact-head-acceptance';
  readonly plannedDeterministicFullClosureFieldCount: 4;
  readonly fields: readonly CandidateAuthorityFieldPlanEntryV4[];
  readonly planSemanticDigest: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V6_DIGEST;
}

export function materializeCandidateAuthorityFieldPlanV6(input: {
  readonly predecessor: CandidateAuthorityFieldPlanV5Runtime;
  readonly successorAuthority: unknown;
  readonly partialSemanticRegistry: CandidateAuthorityPartialSemanticRegistry;
}): CandidateAuthorityFieldPlanV6Runtime {
  const successor = validateAuthorityDigest(
    input.successorAuthority,
    'planVersion',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V6_VERSION,
    'planSemanticDigest',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V6_DIGEST,
  );
  const overrides = successor['fieldOverrides'];
  if (!Array.isArray(overrides) || overrides.length !== 5) invalid();
  const overrideById = new Map(
    overrides.map((value) => {
      const field = value as CandidateAuthorityFieldPlanEntryV4;
      if (!qualifiesPlannedDeterministicExtraction(field)) invalid();
      return [field.fieldId, field] as const;
    }),
  );
  const expected: readonly CandidateAuthorityFieldPlanEntryV4['fieldId'][] = [
    'adoption-unit-type',
    'package-publication-version',
    'runtime-package-format',
    'framework-compatibility',
    'package-repository-linkage',
  ];
  if (
    overrideById.size !== expected.length ||
    expected.some((fieldId) => !overrideById.has(fieldId))
  )
    invalid();
  const fields = input.predecessor.fields.map(
    (field) => overrideById.get(field.fieldId) ?? field,
  );
  const publication = fields.find(
    (field) => field.fieldId === 'package-publication-version',
  );
  if (
    publication?.posture !== 'deterministic-partial-path' ||
    publication.deterministicFullClosureCandidate ||
    publication.partialFactCodes.length !== 1 ||
    publication.partialFactCodes[0] !== 'registry-resolved-package-version' ||
    fields.filter((field) => field.plannedExtractionCapable).length !== 13 ||
    fields.filter((field) => field.deterministicFullClosureCandidate).length !==
      4 ||
    fields
      .filter((field) => expected.includes(field.fieldId))
      .some(
        (field) =>
          field.evidenceProvenanceKind !== 'structured-provider-snapshot' ||
          !field.providerOperations.includes('npm-selected-version-metadata') ||
          field.providerOperations.includes('npm-package-metadata'),
      )
  )
    invalid();
  const definition = partialFactDefinition(
    input.partialSemanticRegistry,
    'registry-resolved-package-version',
  );
  if (
    definition.fieldId !== 'package-publication-version' ||
    definition.extractionRuleVersion !== publication.extractionRuleVersion ||
    !definition.qualifiesPlannedExtractionCapability
  )
    invalid();
  return deepFreeze({
    ...input.predecessor,
    planVersion: CANDIDATE_AUTHORITY_FIELD_PLAN_V6_VERSION,
    status: 'inactive-pending-independent-exact-head-acceptance',
    plannedDeterministicFullClosureFieldCount: 4,
    fields,
    planSemanticDigest: CANDIDATE_AUTHORITY_FIELD_PLAN_V6_DIGEST,
  });
}

export function validateCandidateAuthorityNpmCorrectionAuthorities(input: {
  readonly failureRecordV2: unknown;
  readonly fieldPlanV6: unknown;
  readonly providerContractV3: unknown;
  readonly sourcePolicyV8: unknown;
  readonly replayV5: unknown;
  readonly authorizationV6: unknown;
}): void {
  const failure = validateAuthorityDigest(
    input.failureRecordV2,
    'recordVersion',
    CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_VERSION,
    'canonicalFailureDigest',
    CANDIDATE_AUTHORITY_FAILURE_RECORD_V2_DIGEST,
  );
  const authorization = validateAuthorityDigest(
    input.authorizationV6,
    'authorizationVersion',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
    'authorizationSemanticDigest',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
  );
  validateAuthorityDigest(
    input.fieldPlanV6,
    'planVersion',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V6_VERSION,
    'planSemanticDigest',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V6_DIGEST,
  );
  validateAuthorityDigest(
    input.providerContractV3,
    'contractVersion',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_VERSION,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_DIGEST,
  );
  validateAuthorityDigest(
    input.sourcePolicyV8,
    'policyVersion',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_VERSION,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_DIGEST,
  );
  validateAuthorityDigest(
    input.replayV5,
    'algorithmVersion',
    CANDIDATE_AUTHORITY_REPLAY_V5_VERSION,
    'canonicalAlgorithmDigest',
    CANDIDATE_AUTHORITY_REPLAY_V5_DIGEST,
  );
  const facts = requireRecord(failure['observedExecutionFacts']);
  const historical = requireRecord(authorization['historicalExperiments']);
  const v5 = requireRecord(historical['authorizationV5']);
  const successor = requireRecord(authorization['successorExperiment']);
  if (
    failure['executionHead'] !== CANDIDATE_AUTHORITY_V5_EXECUTION_HEAD ||
    facts['safeErrorCode'] !== 'ingestion.body-too-large' ||
    facts['firstFatalOperationId'] !== 'npm-package-metadata' ||
    facts['sourceAuthorityPublished'] !== false ||
    v5['providerEffectCollectionsConsumed'] !== 1 ||
    v5['remainingProviderEffectCollections'] !== 0 ||
    v5['rerunPermitted'] !== false ||
    successor['conditionallyAuthorizedProviderEffectCollections'] !== 1 ||
    successor['activeProviderEffectCollections'] !== 0 ||
    successor['automaticRerun'] !== false
  )
    invalid();
}

function validateAuthorityDigest(
  value: unknown,
  versionKey: string,
  version: string,
  digestKey: string,
  digest: string,
): Readonly<Record<string, unknown>> {
  const record = requireRecord(value);
  const without = Object.fromEntries(
    Object.entries(record).filter(([key]) => key !== digestKey),
  );
  if (
    record[versionKey] !== version ||
    record[digestKey] !== digest ||
    canonicalizeJson(without).digest !== digest
  )
    invalid();
  return record;
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-manifest');
}
