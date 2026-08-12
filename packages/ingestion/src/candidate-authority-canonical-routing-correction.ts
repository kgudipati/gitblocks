import {
  parseCandidateRetrievalMetadataAuthorityV1,
  type CandidateRetrievalMetadataAuthorityV1,
} from '@gitblocks/contracts';

import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_VERSION,
  type CandidateAuthorityFieldPlanV6Runtime,
} from './candidate-authority-npm-source-correction.ts';
import type { CandidateAuthoritySuccessorRuntimeSourcePolicy } from './candidate-authority-provider-contract.ts';
import {
  qualifiesPlannedDeterministicExtraction,
  type CandidateAuthorityFieldPlanEntryV4,
} from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_AUTHORITY_V6_EXECUTION_HEAD =
  '895980891665e373ccf72e63a6b12cf4f09b63c1' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_VERSION =
  'candidate-authority-live-failure-record/3.0.0' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST =
  'd5e21bfcfc5ecef6b99639bc86947b87c8e31ab31cfe300929a6479c270be526' as const;
export const CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_PATH =
  'catalog/public-v1/candidate-authority-live-failure-record-v3.json' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION =
  'candidate-authority-field-plan/7.0.0' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST =
  '650f7e1b335c0d5d919e69cc8619573a7b8322779ca8686e768be7a4284d95ec' as const;
export const CANDIDATE_AUTHORITY_FIELD_PLAN_V7_PATH =
  'catalog/public-v1/candidate-authority-field-plan-v7.json' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION =
  'candidate-authority-provider-contract/4.0.0' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST =
  'e2a6103dfb24996e7cb617911175d19b5ad78c56f4bf77bff4ac0bab80319a38' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_PATH =
  'catalog/public-v1/candidate-authority-provider-contract-v4.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION =
  'candidate-authority-source-policy/9.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST =
  'c1ad428afdf3412c072259a4426b57f5e61e6d781d7dd4e7f3535431f8ad4498' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v9.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V6_VERSION =
  'candidate-authority-pure-replay/6.0.0' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST =
  'e6b8e88ecf81884b6129a36284d9d13aa257d0f72b42b0277f0172a6a5fd32b1' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V6_PATH =
  'catalog/public-v1/candidate-authority-replay-algorithm-v6.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION =
  'candidate-authority-live-authorization/7.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST =
  '6623f59f33ab0e391c95b29e67ca79f337e3750028d6f4ca2cdef5a4e74ae94e' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v7.json' as const;

export const CANDIDATE_AUTHORITY_ROUTING_PATH =
  'catalog/public-v1/candidate-retrieval-metadata-authority.json' as const;
export const CANDIDATE_AUTHORITY_ROUTING_VERSION =
  'candidate-retrieval-metadata-authority/1.1.0' as const;
export const CANDIDATE_AUTHORITY_ROUTING_SNAPSHOT_ID =
  'retrieval-metadata-snapshot-23c38be5e5b117c74832049ae58f455f' as const;
export const CANDIDATE_AUTHORITY_ROUTING_DIGEST =
  '23c38be5e5b117c74832049ae58f455f4fd1731e167cf170038da516c44e5ef1' as const;
export const CANDIDATE_AUTHORITY_ROUTING_PROVIDER_POLICY_VERSION =
  'candidate-retrieval-metadata-provider-policy/1.1.0' as const;
export const CANDIDATE_AUTHORITY_ROUTING_PROVIDER_POLICY_DIGEST =
  'b8cd159d895d4af91f92563b199c0e9beea9bddcb87b869e33429201bd9a5f2e' as const;
export const CANDIDATE_AUTHORITY_ROUTING_SOURCE_POLICY_VERSION =
  'profile-materialization-provider-policy/1.0.0' as const;
export const CANDIDATE_AUTHORITY_ROUTING_SOURCE_POLICY_DIGEST =
  '0945ebd862d0a1b5f622c4f10f60b2c0e713fb127cc5dea5668be5cc40c96ede' as const;

export interface CandidateAuthorityProviderRoute {
  readonly candidateId: string;
  readonly catalogOwner: string;
  readonly catalogRepository: string;
  readonly providerCanonicalOwner: string;
  readonly providerCanonicalRepository: string;
  readonly repositoryIdentityState: 'unchanged' | 'redirected';
  readonly routingAuthoritySourceRecordDigest: string;
}

export interface CandidateAuthorityProviderRoutes {
  readonly authority: CandidateRetrievalMetadataAuthorityV1;
  readonly routes: readonly CandidateAuthorityProviderRoute[];
  readonly byCandidateId: ReadonlyMap<string, CandidateAuthorityProviderRoute>;
  readonly unchangedCount: number;
  readonly redirectedCount: number;
}

export function candidateAuthorityProviderRouteFromRecord(
  record: Pick<
    CandidateRetrievalMetadataAuthorityV1['candidates'][number],
    | 'candidateId'
    | 'catalogOwner'
    | 'catalogRepository'
    | 'providerCanonicalOwner'
    | 'providerCanonicalRepository'
    | 'repositoryIdentityState'
    | 'sourceRecordDigest'
  >,
): CandidateAuthorityProviderRoute {
  return Object.freeze({
    candidateId: record.candidateId,
    catalogOwner: record.catalogOwner,
    catalogRepository: record.catalogRepository,
    providerCanonicalOwner: record.providerCanonicalOwner,
    providerCanonicalRepository: record.providerCanonicalRepository,
    repositoryIdentityState: record.repositoryIdentityState,
    routingAuthoritySourceRecordDigest: record.sourceRecordDigest,
  });
}

export interface CandidateAuthorityFieldPlanV7Runtime extends Omit<
  CandidateAuthorityFieldPlanV6Runtime,
  'fields' | 'planSemanticDigest' | 'planVersion' | 'status'
> {
  readonly planVersion: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION;
  readonly status: 'inactive-pending-independent-exact-head-acceptance';
  readonly fields: readonly CandidateAuthorityFieldPlanEntryV4[];
  readonly planSemanticDigest: typeof CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST;
}

export function parseCandidateAuthorityProviderRoutes(input: {
  readonly catalog: PublicCatalog;
  readonly authority: unknown;
}): CandidateAuthorityProviderRoutes {
  const parsed = parseCandidateRetrievalMetadataAuthorityV1(input.authority);
  if (!parsed.ok) invalid();
  const authority = parsed.value;
  if (
    authority.snapshotId !== CANDIDATE_AUTHORITY_ROUTING_SNAPSHOT_ID ||
    authority.authoritySemanticDigest !== CANDIDATE_AUTHORITY_ROUTING_DIGEST ||
    authority.catalogVersion !== input.catalog.catalogVersion ||
    authority.catalogDigest !== input.catalog.manifestDigest ||
    authority.providerPolicyDigest !==
      CANDIDATE_AUTHORITY_ROUTING_PROVIDER_POLICY_DIGEST ||
    authority.sourceProviderPolicyDigest !==
      CANDIDATE_AUTHORITY_ROUTING_SOURCE_POLICY_DIGEST ||
    authority.candidates.length !== 150 ||
    input.catalog.candidates.length !== 150
  )
    invalid();
  const records = new Map(
    authority.candidates.map((record) => [record.candidateId, record]),
  );
  const routes = input.catalog.candidates.map((candidate) => {
    const record = records.get(candidate.candidateId);
    if (
      record?.catalogOwner !== candidate.github.owner ||
      record.catalogRepository !== candidate.github.repository
    )
      invalid();
    return candidateAuthorityProviderRouteFromRecord(record);
  });
  if (records.size !== routes.length) invalid();
  const byCandidateId = new Map(
    routes.map((route) => [route.candidateId, route] as const),
  );
  return Object.freeze({
    authority,
    routes: Object.freeze(routes),
    byCandidateId,
    unchangedCount: routes.filter(
      ({ repositoryIdentityState }) => repositoryIdentityState === 'unchanged',
    ).length,
    redirectedCount: routes.filter(
      ({ repositoryIdentityState }) => repositoryIdentityState === 'redirected',
    ).length,
  });
}

export function materializeCandidateAuthorityFieldPlanV7(input: {
  readonly predecessor: CandidateAuthorityFieldPlanV6Runtime;
  readonly successorAuthority: unknown;
}): CandidateAuthorityFieldPlanV7Runtime {
  const successor = validateAuthorityDigest(
    input.successorAuthority,
    'planVersion',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
    'planSemanticDigest',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
  );
  const overrides = successor['fieldOverrides'];
  if (!Array.isArray(overrides) || overrides.length !== 1) invalid();
  const override = overrides[0] as CandidateAuthorityFieldPlanEntryV4;
  if (
    override.fieldId !== 'package-repository-linkage' ||
    override.extractionRuleVersion !==
      'profile-materialization-package-linkage/2.0.0' ||
    override.posture !== 'deterministic-complete-path' ||
    !override.deterministicFullClosureCandidate ||
    !qualifiesPlannedDeterministicExtraction(override)
  )
    invalid();
  const fields = input.predecessor.fields.map((field) =>
    field.fieldId === override.fieldId ? override : field,
  );
  if (
    fields.filter((field) => field.plannedExtractionCapable).length !== 13 ||
    fields.filter((field) => field.deterministicFullClosureCandidate).length !==
      4
  )
    invalid();
  return deepFreeze({
    ...input.predecessor,
    planVersion: CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
    status: 'inactive-pending-independent-exact-head-acceptance',
    fields,
    planSemanticDigest: CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
  });
}

export function materializeCandidateAuthoritySourcePolicyV9(input: {
  readonly predecessor: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly sourcePolicyV9: unknown;
  readonly providerContractV4: unknown;
}): CandidateAuthoritySuccessorRuntimeSourcePolicy {
  const source = validateAuthorityDigest(
    input.sourcePolicyV9,
    'policyVersion',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
  );
  const contract = validateAuthorityDigest(
    input.providerContractV4,
    'contractVersion',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST,
  );
  const sourceBindings = requireRecord(source['bindings']);
  const routing = requireRecord(contract['routingAuthority']);
  const matrix = requireRecord(contract['operationMatrix']);
  if (
    sourceBindings['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST ||
    sourceBindings['fieldPlanDigest'] !==
      CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST ||
    sourceBindings['failureRecordDigest'] !==
      CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST ||
    sourceBindings['routingAuthorityDigest'] !==
      CANDIDATE_AUTHORITY_ROUTING_DIGEST ||
    routing['authoritySemanticDigest'] !== CANDIDATE_AUTHORITY_ROUTING_DIGEST ||
    matrix['operationCount'] !== 13 ||
    matrix['addedIdentityProbeRequests'] !== 0 ||
    matrix['addedRedirectRequests'] !== 0 ||
    input.predecessor.policyVersion !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_VERSION ||
    input.predecessor.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_DIGEST
  )
    invalid();
  return Object.freeze({
    ...input.predecessor,
    policyVersion: CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION,
    policySemanticDigest: CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
  });
}

export function validateCandidateAuthorityCanonicalRoutingAuthorities(input: {
  readonly failureRecordV3: unknown;
  readonly fieldPlanV7: unknown;
  readonly providerContractV4: unknown;
  readonly sourcePolicyV9: unknown;
  readonly replayV6: unknown;
  readonly authorizationV7: unknown;
}): void {
  const failure = validateAuthorityDigest(
    input.failureRecordV3,
    'recordVersion',
    CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_VERSION,
    'canonicalFailureDigest',
    CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST,
  );
  validateAuthorityDigest(
    input.fieldPlanV7,
    'planVersion',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
    'planSemanticDigest',
    CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
  );
  validateAuthorityDigest(
    input.providerContractV4,
    'contractVersion',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST,
  );
  validateAuthorityDigest(
    input.sourcePolicyV9,
    'policyVersion',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
  );
  validateAuthorityDigest(
    input.replayV6,
    'algorithmVersion',
    CANDIDATE_AUTHORITY_REPLAY_V6_VERSION,
    'canonicalAlgorithmDigest',
    CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST,
  );
  const authorization = validateAuthorityDigest(
    input.authorizationV7,
    'authorizationVersion',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION,
    'authorizationSemanticDigest',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST,
  );
  const facts = requireRecord(failure['observedExecutionFacts']);
  const prohibited = requireRecord(
    failure['prohibitedHistoricalReconstruction'],
  );
  const historical = requireRecord(authorization['historicalExperiments']);
  const v6 = requireRecord(historical['authorizationV6']);
  const successor = requireRecord(authorization['successorExperiment']);
  if (
    failure['executionHead'] !== CANDIDATE_AUTHORITY_V6_EXECUTION_HEAD ||
    facts['safeErrorCode'] !== 'ingestion.redirect' ||
    facts['firstFatalOperationId'] !== 'github-repository-metadata' ||
    facts['sourceAuthorityPublished'] !== false ||
    prohibited['redirectLocationHeaderRetained'] !== false ||
    prohibited['redirectLocationHeaderInspected'] !== false ||
    prohibited['redirectTargetObserved'] !== false ||
    v6['providerEffectCollectionsConsumed'] !== 1 ||
    v6['remainingProviderEffectCollections'] !== 0 ||
    v6['rerunPermitted'] !== false ||
    successor['conditionallyAuthorizedProviderEffectCollections'] !== 1 ||
    successor['activeProviderEffectCollections'] !== 0 ||
    successor['automaticRerun'] !== false
  )
    invalid();
}

export function validateAuthorityDigest(
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
