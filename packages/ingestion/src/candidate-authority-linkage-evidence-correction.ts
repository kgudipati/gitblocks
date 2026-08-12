import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
  CANDIDATE_AUTHORITY_ROUTING_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION,
  materializeCandidateAuthoritySourcePolicyV9,
} from './candidate-authority-canonical-routing-correction.ts';
import type { CandidateAuthoritySuccessorRuntimeSourcePolicy } from './candidate-authority-provider-contract.ts';
import { ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_ACCEPTED_ROUTING_HEAD =
  '2be3d5950cc69572b5b45fc641848fed112fc112' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_VERSION =
  'candidate-authority-provider-contract/5.0.0' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_DIGEST =
  '980a34aa6643cf136744b079415cb13ff0fdedd1587bc5345419700017785ea7' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_PATH =
  'catalog/public-v1/candidate-authority-provider-contract-v5.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_VERSION =
  'candidate-authority-source-policy/10.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST =
  '82a10a75be6676464112357794872f293518b261a9c7b58f35fccd209eed84f0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v10.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V7_VERSION =
  'candidate-authority-pure-replay/7.0.0' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V7_DIGEST =
  '4857d465c43384445f1305520334bee4a8ef27355a4a122925f3aaed3eb5c58f' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V7_PATH =
  'catalog/public-v1/candidate-authority-replay-algorithm-v7.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_VERSION =
  'candidate-authority-live-authorization/8.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST =
  '1b220e9703e83d012a42b607f475f8290c95ddcc3765eb247e9c26098d701863' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v8.json' as const;

export function materializeCandidateAuthoritySourcePolicyV10(input: {
  readonly predecessor: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly sourcePolicyV10: unknown;
  readonly providerContractV5: unknown;
}): CandidateAuthoritySuccessorRuntimeSourcePolicy {
  const source = validateAuthorityDigest(
    input.sourcePolicyV10,
    'policyVersion',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_VERSION,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST,
  );
  const provider = validateAuthorityDigest(
    input.providerContractV5,
    'contractVersion',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_VERSION,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_DIGEST,
  );
  const bindings = requireRecord(source['bindings']);
  const evidence = requireRecord(source['evidenceBridge']);
  const unchanged = requireRecord(
    provider['unchangedProviderOperationContract'],
  );
  if (
    input.predecessor.policyVersion !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION ||
    input.predecessor.policySemanticDigest !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST ||
    bindings['fieldPlanVersion'] !==
      CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION ||
    bindings['fieldPlanDigest'] !== CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST ||
    bindings['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_DIGEST ||
    bindings['routingAuthorityDigest'] !== CANDIDATE_AUTHORITY_ROUTING_DIGEST ||
    evidence['maximumCompleteSourcesPerKnownField'] !== 2 ||
    evidence['ordinaryKnownFieldSourceCount'] !== 1 ||
    unchanged['operationCount'] !== 13 ||
    unchanged['maximumRedirects'] !== 0 ||
    unchanged['addedEvidenceRequests'] !== 0
  )
    invalid();
  return Object.freeze({
    ...input.predecessor,
    policyVersion: CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_VERSION,
    policySemanticDigest: CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST,
  });
}

export function validateCandidateAuthorityLinkageEvidenceAuthorities(input: {
  readonly providerContractV5: unknown;
  readonly sourcePolicyV10: unknown;
  readonly replayV7: unknown;
  readonly authorizationV8: unknown;
}): void {
  validateAuthorityDigest(
    input.providerContractV5,
    'contractVersion',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_VERSION,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_DIGEST,
  );
  validateAuthorityDigest(
    input.sourcePolicyV10,
    'policyVersion',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_VERSION,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST,
  );
  const replay = validateAuthorityDigest(
    input.replayV7,
    'algorithmVersion',
    CANDIDATE_AUTHORITY_REPLAY_V7_VERSION,
    'canonicalAlgorithmDigest',
    CANDIDATE_AUTHORITY_REPLAY_V7_DIGEST,
  );
  const authorization = validateAuthorityDigest(
    input.authorizationV8,
    'authorizationVersion',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_VERSION,
    'authorizationSemanticDigest',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V8_DIGEST,
  );
  const replayBindings = requireRecord(replay['bindings']);
  const authBindings = requireRecord(authorization['bindings']);
  const history = requireRecord(authorization['historicalExperiments']);
  const v7 = requireRecord(history['authorizationV7']);
  const successor = requireRecord(authorization['successorExperiment']);
  if (
    replayBindings['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V10_DIGEST ||
    replayBindings['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V5_DIGEST ||
    authBindings['acceptedRoutingHead'] !==
      CANDIDATE_AUTHORITY_ACCEPTED_ROUTING_HEAD ||
    authBindings['replayAlgorithmDigest'] !==
      CANDIDATE_AUTHORITY_REPLAY_V7_DIGEST ||
    v7['state'] !==
      'inactive-never-provider-effect-activated-superseded-before-activation' ||
    v7['providerEffectCollectionsConsumed'] !== 0 ||
    v7['remainingProviderEffectCollections'] !== 0 ||
    successor['conditionallyAuthorizedProviderEffectCollections'] !== 1 ||
    successor['activeProviderEffectCollections'] !== 0 ||
    successor['automaticRerun'] !== false
  )
    invalid();
}

export function materializeCandidateAuthoritySourcePolicyV10FromAuthorities(input: {
  readonly predecessorV8: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly sourcePolicyV9: unknown;
  readonly providerContractV4: unknown;
  readonly sourcePolicyV10: unknown;
  readonly providerContractV5: unknown;
}): CandidateAuthoritySuccessorRuntimeSourcePolicy {
  return materializeCandidateAuthoritySourcePolicyV10({
    predecessor: materializeCandidateAuthoritySourcePolicyV9({
      predecessor: input.predecessorV8,
      sourcePolicyV9: input.sourcePolicyV9,
      providerContractV4: input.providerContractV4,
    }),
    sourcePolicyV10: input.sourcePolicyV10,
    providerContractV5: input.providerContractV5,
  });
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

function invalid(): never {
  throw ingestionError('ingestion.invalid-manifest');
}
