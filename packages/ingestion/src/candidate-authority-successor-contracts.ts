/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Successor authorities are trust-boundary inputs. */

import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V7_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS,
  createCandidateAuthoritySuccessorSourceAuthority,
  createCandidateAuthoritySuccessorSourceCandidate,
  materializeCandidateAuthoritySuccessorRuntimeSourcePolicyV8,
  type CandidateAuthoritySuccessorOperationId,
  type CandidateAuthoritySuccessorRuntimeSourcePolicy,
  type CandidateAuthoritySuccessorSourceAuthority,
  type CandidateAuthoritySuccessorSourceCandidate,
  type CandidateAuthoritySuccessorSourceDatum,
} from './candidate-authority-provider-contract.ts';
import {
  CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST,
  CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_VERSION,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST,
  CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION,
  CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST,
  CANDIDATE_AUTHORITY_REPLAY_V6_VERSION,
  CANDIDATE_AUTHORITY_ROUTING_DIGEST,
  CANDIDATE_AUTHORITY_ROUTING_PROVIDER_POLICY_DIGEST,
  CANDIDATE_AUTHORITY_ROUTING_PROVIDER_POLICY_VERSION,
  CANDIDATE_AUTHORITY_ROUTING_SNAPSHOT_ID,
  CANDIDATE_AUTHORITY_ROUTING_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION,
  CANDIDATE_AUTHORITY_V6_EXECUTION_HEAD,
  materializeCandidateAuthoritySourcePolicyV9,
  type CandidateAuthorityProviderRoutes,
} from './candidate-authority-canonical-routing-correction.ts';
import {
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_DIGEST,
  CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_VERSION,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_DIGEST,
  CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_VERSION,
} from './candidate-authority-npm-source-correction.ts';
import type {
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST,
  CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION,
} from './candidate-authority-npm-source-correction.ts';
import {
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_DIGEST,
  CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION,
} from './candidate-authority-partial-semantics.ts';
import { CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION } from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_AUTHORITY_ACCEPTED_CORRECTION_PARENT =
  CANDIDATE_AUTHORITY_V6_EXECUTION_HEAD;

// Published v5 identities remain available only for immutable historical
// diagnostics and disabled consumed runners. Current parsing returns v7.
export const CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD =
  'acca908a98b09e2263252f3bcd861b7c4f9a27ee' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION =
  'candidate-authority-live-authorization/5.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST =
  '5b2dc1d60ae7ae052547a7f31e6a903fe9b693cc77a16ec2bfba8a137d1fb78d' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v5.json' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_VERSION =
  'candidate-authority-provider-contract/2.0.0' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST =
  'edfd7ebcd8d42cbb65de4e79307ab91df81bd104b4039179082e1ff22686187b' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH =
  'catalog/public-v1/candidate-authority-provider-contract-v2.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V4_VERSION =
  'candidate-authority-pure-replay/4.0.0' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V4_DIGEST =
  '4bf82a790299a8373b2a2f75552842fe69847a2e362ebadec08776a8e69db84c' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V4_PATH =
  'catalog/public-v1/candidate-authority-replay-algorithm-v4.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_VERSION =
  'candidate-authority-source-policy/7.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST =
  '237b707fce608b4518ae09fcd07f7e08c315f7f323e56fb338990e1102fd29d7' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v7.json' as const;

export const CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION =
  'candidate-authority-source-authority/4.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v4.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v4.staging.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_VERSION =
  'candidate-authority-deterministic-profile-authority/4.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_PATH =
  'catalog/public-v1/candidate-authority-profiles-v4.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_VERSION =
  'candidate-authority-partial-field-evidence-authority/4.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_PATH =
  'catalog/public-v1/candidate-authority-partial-evidence-v4.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_VERSION =
  'candidate-authority-fit-consumable-evidence-authority/4.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_PATH =
  'catalog/public-v1/candidate-authority-evidence-v4.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_VERSION =
  'candidate-authority-dossier-authority/4.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_PATH =
  'catalog/public-v1/candidate-authority-dossiers-v4.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_VERSION =
  'candidate-authority-dossier-projection/4.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_PATH =
  'catalog/public-v1/candidate-authority-dossier-projection-v4.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_VERSION =
  'candidate-authority-realized-readiness-report/4.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_PATH =
  'catalog/public-v1/candidate-authority-readiness-report-v4.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_VERSION =
  'candidate-authority-root/7.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_PATH =
  'catalog/public-v1/candidate-authority-root-v7.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_TOKEN_ENVIRONMENT =
  'GITBLOCKS_CANDIDATE_AUTHORITY_GITHUB_TOKEN' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES =
  268_435_456 as const;

const SUCCESSOR_OPERATION_LOGICAL_REQUEST_CEILINGS = Object.freeze([
  150, 150, 150, 150, 150, 150, 160, 80, 150, 150, 150, 150, 150,
] as const);

export const CANDIDATE_AUTHORITY_SUCCESSOR_OUTPUT_PATHS = Object.freeze([
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_PATH,
  CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_PATH,
] as const);

export const CANDIDATE_AUTHORITY_SUCCESSOR_STAGING_PATHS = Object.freeze([
  CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH,
  ...CANDIDATE_AUTHORITY_SUCCESSOR_OUTPUT_PATHS.slice(1).map((path) =>
    path.replace(/\.json$/u, '.staging.json'),
  ),
]);

export interface CandidateAuthoritySuccessorAuthorization {
  readonly version:
    | typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION
    | typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_VERSION
    | typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION;
  readonly digest:
    | typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST
    | typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V6_DIGEST
    | typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST;
  readonly bindings: Readonly<Record<string, string>>;
  readonly conditionalCollections: 1;
  readonly activeCollections: 0;
  readonly automaticRerun: false;
}

export function parseCandidateAuthoritySuccessorFixedAuthorities(input: {
  readonly providerContractV1: string;
  readonly providerContractV2: string;
  readonly providerContractV3: string;
  readonly providerContractV4: string;
  readonly sourcePolicyV6: string;
  readonly sourcePolicyV7: string;
  readonly sourcePolicyV8: string;
  readonly sourcePolicyV9: string;
  readonly replayV6: string;
  readonly authorizationV7: string;
}): {
  readonly sourcePolicy: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly authorization: CandidateAuthoritySuccessorAuthorization;
} {
  const providerV1 = parseJson(input.providerContractV1);
  const providerV2 = parseJson(input.providerContractV2);
  const providerV3 = parseAuthority(
    input.providerContractV3,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_DIGEST,
  );
  const providerV4 = parseAuthority(
    input.providerContractV4,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST,
  );
  const sourceV6 = parseJson(input.sourcePolicyV6);
  const sourceV7 = parseJson(input.sourcePolicyV7);
  const sourceV8 = parseAuthority(
    input.sourcePolicyV8,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_DIGEST,
  );
  const sourceV9 = parseAuthority(
    input.sourcePolicyV9,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST,
  );
  const replay = parseAuthority(
    input.replayV6,
    'canonicalAlgorithmDigest',
    CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST,
  );
  const authorization = parseAuthority(
    input.authorizationV7,
    'authorizationSemanticDigest',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST,
  );
  if (
    providerV3['contractVersion'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_VERSION ||
    sourceV8['policyVersion'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V8_VERSION ||
    requireRecord(sourceV8['bindings'])['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V3_DIGEST ||
    providerV4['contractVersion'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION ||
    sourceV9['policyVersion'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION ||
    replay['algorithmVersion'] !== CANDIDATE_AUTHORITY_REPLAY_V6_VERSION ||
    requireRecord(replay['bindings'])['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST ||
    authorization['authorizationVersion'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION
  )
    invalid();
  const successor = requireRecord(authorization['successorExperiment']);
  const bindings = stringRecord(authorization['bindings']);
  if (
    successor['conditionallyAuthorizedProviderEffectCollections'] !== 1 ||
    successor['activeProviderEffectCollections'] !== 0 ||
    successor['automaticRerun'] !== false ||
    successor['candidateCount'] !== 150 ||
    successor['mappedNpmCount'] !== 80 ||
    successor['githubLogicalRequestCeiling'] !== 1810 ||
    successor['npmLogicalRequestCeiling'] !== 80 ||
    successor['totalLogicalRequestCeiling'] !== 1890 ||
    successor['githubAttemptCeiling'] !== 5430 ||
    successor['npmAttemptCeiling'] !== 240 ||
    successor['totalAttemptCeiling'] !== 5670 ||
    bindings['catalogVersion'] !== 'public-v1' ||
    bindings['catalogDigest'] !==
      '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634' ||
    bindings['taxonomyVersion'] !== '1.0.0' ||
    bindings['taxonomyDigest'] !==
      '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9' ||
    bindings['readinessPolicyDigest'] !==
      'f0095da4e9932cf93ce5cde6fecea1a2480aeb7b055d4b5917420303d8575752' ||
    bindings['partialSemanticRegistryDigest'] !==
      CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_DIGEST ||
    bindings['partialEvidenceDigest'] !==
      '6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e' ||
    bindings['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST ||
    bindings['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST ||
    bindings['replayAlgorithmDigest'] !==
      CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST ||
    bindings['failureRecordDigest'] !==
      CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST ||
    bindings['fieldPlanDigest'] !== CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST ||
    bindings['routingAuthorityDigest'] !== CANDIDATE_AUTHORITY_ROUTING_DIGEST
  )
    invalid();
  const sourcePolicy = materializeCandidateAuthoritySourcePolicyV9({
    predecessor: materializeCandidateAuthoritySuccessorRuntimeSourcePolicyV8({
      sourcePolicyV6: sourceV6,
      providerContractV1: providerV1,
      sourcePolicyV7: sourceV7,
      providerContractV2: providerV2,
      sourcePolicyV8: sourceV8,
      providerContractV3: providerV3,
    }),
    sourcePolicyV9: sourceV9,
    providerContractV4: providerV4,
  });
  return Object.freeze({
    sourcePolicy,
    authorization: Object.freeze({
      version: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION,
      digest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST,
      bindings,
      conditionalCollections: 1,
      activeCollections: 0,
      automaticRerun: false,
    }),
  });
}

export function parseCandidateAuthoritySuccessorSourceAuthority(input: {
  readonly text: string;
  readonly catalog: PublicCatalog;
  readonly providerRoutes?: CandidateAuthorityProviderRoutes;
  readonly acceptedExecutionHead?: string;
}): CandidateAuthoritySuccessorSourceAuthority {
  if (
    Buffer.byteLength(input.text, 'utf8') >
    CANDIDATE_AUTHORITY_SUCCESSOR_MAXIMUM_SOURCE_BYTES
  )
    invalid();
  const raw = parseJson(input.text);
  const authority =
    raw as unknown as CandidateAuthoritySuccessorSourceAuthority;
  const bindings = stringRecord(raw['bindings']);
  const providerRoutes = input.providerRoutes;
  if (
    authority.authorityVersion !==
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION ||
    authority.operatorVersion !==
      CANDIDATE_AUTHORITY_LIVE_OPERATOR_V7_VERSION ||
    authority.candidateCount !== 150 ||
    !Array.isArray(authority.orderedCandidateIds) ||
    !Array.isArray(authority.candidates) ||
    authority.orderedCandidateIds.length !== 150 ||
    authority.candidates.length !== 150 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(
      authority.collectionCutoff,
    ) ||
    !Number.isFinite(Date.parse(authority.collectionCutoff)) ||
    bindings['catalogVersion'] !== input.catalog.catalogVersion ||
    bindings['catalogDigest'] !== input.catalog.manifestDigest ||
    bindings['taxonomyVersion'] !== '1.0.0' ||
    bindings['taxonomyDigest'] !==
      '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9' ||
    bindings['consumedV6ExecutionHead'] !==
      CANDIDATE_AUTHORITY_V6_EXECUTION_HEAD ||
    bindings['failureRecordDigest'] !==
      CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_DIGEST ||
    bindings['failureRecordVersion'] !==
      CANDIDATE_AUTHORITY_FAILURE_RECORD_V3_VERSION ||
    bindings['fieldPlanVersion'] !==
      CANDIDATE_AUTHORITY_FIELD_PLAN_V7_VERSION ||
    bindings['fieldPlanDigest'] !== CANDIDATE_AUTHORITY_FIELD_PLAN_V7_DIGEST ||
    bindings['providerContractVersion'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_VERSION ||
    bindings['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V4_DIGEST ||
    bindings['replayAlgorithmVersion'] !==
      CANDIDATE_AUTHORITY_REPLAY_V6_VERSION ||
    bindings['replayAlgorithmDigest'] !==
      CANDIDATE_AUTHORITY_REPLAY_V6_DIGEST ||
    bindings['routingAuthorityVersion'] !==
      CANDIDATE_AUTHORITY_ROUTING_VERSION ||
    bindings['routingAuthoritySnapshotId'] !==
      CANDIDATE_AUTHORITY_ROUTING_SNAPSHOT_ID ||
    bindings['routingAuthorityDigest'] !== CANDIDATE_AUTHORITY_ROUTING_DIGEST ||
    bindings['routingProviderPolicyVersion'] !==
      CANDIDATE_AUTHORITY_ROUTING_PROVIDER_POLICY_VERSION ||
    bindings['routingProviderPolicyDigest'] !==
      CANDIDATE_AUTHORITY_ROUTING_PROVIDER_POLICY_DIGEST ||
    bindings['readinessPolicyVersion'] !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION ||
    bindings['readinessPolicyDigest'] !==
      'f0095da4e9932cf93ce5cde6fecea1a2480aeb7b055d4b5917420303d8575752' ||
    bindings['partialSemanticRegistryVersion'] !==
      CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_VERSION ||
    bindings['partialSemanticRegistryDigest'] !==
      CANDIDATE_AUTHORITY_PARTIAL_SEMANTIC_REGISTRY_V3_DIGEST ||
    bindings['partialEvidenceVersion'] !==
      'candidate-authority-partial-field-evidence/3.0.0' ||
    bindings['partialEvidenceDigest'] !==
      '6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e' ||
    bindings['architectureDecisions'] !==
      'ADR-0014-accepted;ADR-0015-proposed-no-provider-effect' ||
    bindings['sourcePolicyVersion'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_VERSION ||
    bindings['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V9_DIGEST ||
    bindings['liveAuthorizationVersion'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_VERSION ||
    bindings['liveAuthorizationDigest'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V7_DIGEST ||
    (input.acceptedExecutionHead !== undefined &&
      bindings['collectionExecutionHead'] !== input.acceptedExecutionHead) ||
    !/^[a-f0-9]{40}$/u.test(bindings['collectionExecutionHead'] ?? '') ||
    input.catalog.candidates.length !== 150
  )
    invalid();
  if (providerRoutes === undefined) invalid();
  const orderedIds = input.catalog.candidates.map(
    ({ candidateId }) => candidateId,
  );
  if (
    authority.orderedCandidateIds.some((id, index) => id !== orderedIds[index])
  )
    invalid();
  authority.candidates.forEach(
    (candidate: CandidateAuthoritySuccessorSourceCandidate, index: number) => {
      const expected = input.catalog.candidates[index] ?? invalid();
      const route = providerRoutes.byCandidateId.get(expected.candidateId);
      if (
        route === undefined ||
        candidate.candidateId !== expected.candidateId ||
        candidate.github.owner !== expected.github.owner ||
        candidate.github.repository !== expected.github.repository ||
        candidate.npmPackage !== expected.npmPackage ||
        !Array.isArray(candidate.sources) ||
        candidate.sources.length !==
          CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.length
      )
        invalid();
      const sources = candidate.sources.map(
        (datum: CandidateAuthoritySuccessorSourceDatum, sourceIndex: number) =>
          validateDatum(
            datum,
            CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS[sourceIndex],
          ),
      );
      validateRepositoryRoute(candidate, sources, route);
      validateNpmScope(candidate, sources);
      const recreated = createCandidateAuthoritySuccessorSourceCandidate({
        candidateId: candidate.candidateId,
        github: candidate.github,
        npmPackage: candidate.npmPackage,
        sources,
      });
      if (recreated.candidateSourceDigest !== candidate.candidateSourceDigest)
        invalid();
    },
  );
  validateEffectReceipt(authority);
  forbidUnsafeKeys(raw);
  const recreated = createCandidateAuthoritySuccessorSourceAuthority({
    authorityVersion: authority.authorityVersion,
    operatorVersion: authority.operatorVersion,
    bindings: authority.bindings,
    collectionCutoff: authority.collectionCutoff,
    candidateCount: 150,
    orderedCandidateIds: authority.orderedCandidateIds,
    candidates: authority.candidates,
    effectReceipt: authority.effectReceipt,
  });
  if (
    recreated.canonicalAuthorityDigest !== authority.canonicalAuthorityDigest ||
    `${canonicalizeJson(authority).text}\n` !== input.text
  )
    invalid();
  return Object.freeze(authority);
}

function validateNpmScope(
  candidate: CandidateAuthoritySuccessorSourceCandidate,
  sources: readonly CandidateAuthoritySuccessorSourceDatum[],
): void {
  const npm = sources.find(
    ({ operationId }) => operationId === 'npm-selected-version-metadata',
  );
  const advisory = sources.find(
    ({ operationId }) => operationId === 'github-advisories',
  );
  if (npm === undefined || advisory === undefined) invalid();
  if (candidate.npmPackage === null) {
    if (
      npm.outcome !== 'not-applicable' ||
      advisory.outcome !== 'not-applicable'
    )
      invalid();
    return;
  }
  if (npm.outcome === 'not-applicable') invalid();
  if (npm.outcome !== 'established-value') {
    if (
      advisory.outcome !== 'qualified-unknown' ||
      advisory.limitationCode !== 'npm-version-scope-unavailable'
    )
      invalid();
    return;
  }
  if (npm.completeness !== 'complete') invalid();
  const value = requireRecord(npm.value);
  const allowedKeys = new Set([
    'packageName',
    'resolvedVersion',
    'selector',
    'repositoryIdentity',
    'nodeEngine',
    'exportsValue',
    'exportsDeclared',
    'main',
    'module',
    'peerDependencies',
    'type',
    'optionalPropertyStates',
    'partialFacts',
  ]);
  if (
    Object.keys(value).some((key) => !allowedKeys.has(key)) ||
    value['packageName'] !== candidate.npmPackage ||
    typeof value['resolvedVersion'] !== 'string' ||
    !/^v?[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
      value['resolvedVersion'],
    ) ||
    value['selector'] !== 'latest' ||
    typeof value['exportsDeclared'] !== 'boolean' ||
    !Array.isArray(value['partialFacts']) ||
    value['partialFacts'].length > 202
  )
    invalid();
  const states = requireRecord(value['optionalPropertyStates']);
  const stateKeys = [
    'nodeEngine',
    'exports',
    'main',
    'module',
    'peerDependencies',
    'type',
    'repository',
  ];
  if (
    Object.keys(states).length !== stateKeys.length ||
    stateKeys.some(
      (key) =>
        !['absent', 'supported', 'unsupported'].includes(String(states[key])),
    )
  )
    invalid();
}

function validateRepositoryRoute(
  candidate: CandidateAuthoritySuccessorSourceCandidate,
  sources: readonly CandidateAuthoritySuccessorSourceDatum[],
  route: CandidateAuthorityProviderRoutes['routes'][number],
): void {
  const metadata = sources.find(
    ({ operationId }) => operationId === 'github-repository-metadata',
  );
  if (metadata?.outcome !== 'established-value') invalid();
  const value = requireRecord(metadata.value);
  const catalog = requireRecord(value['catalogRepositoryIdentity']);
  const canonical = requireRecord(value['providerCanonicalRepositoryIdentity']);
  if (
    candidate.candidateId !== route.candidateId ||
    candidate.github.owner !== route.catalogOwner ||
    candidate.github.repository !== route.catalogRepository ||
    catalog['owner'] !== route.catalogOwner ||
    catalog['repository'] !== route.catalogRepository ||
    canonical['owner'] !== route.providerCanonicalOwner ||
    canonical['repository'] !== route.providerCanonicalRepository ||
    value['repositoryIdentityState'] !== route.repositoryIdentityState ||
    value['canonicalOwner'] !== route.providerCanonicalOwner ||
    value['canonicalRepository'] !== route.providerCanonicalRepository
  )
    invalid();
}

export function serializeCandidateAuthoritySuccessorSourceAuthority(
  authority: CandidateAuthoritySuccessorSourceAuthority,
): string {
  return `${canonicalizeJson(authority).text}\n`;
}

function validateEffectReceipt(
  authority: CandidateAuthoritySuccessorSourceAuthority,
): void {
  const receipt = authority.effectReceipt;
  const optionalFailures = requireRecord(
    receipt.controlledOptionalSourceFailures,
  );
  if (
    receipt.collectionExecutions !== 1 ||
    !receipt.credentialAvailable ||
    receipt.databaseCalls !== 0 ||
    receipt.dockerCalls !== 0 ||
    receipt.modelCalls !== 0 ||
    receipt.candidateExecutions !== 0 ||
    receipt.allCandidateProjections !== 0 ||
    receipt.coverageCalculations !== 0 ||
    receipt.githubLogicalRequests > 1810 ||
    receipt.npmLogicalRequests > 80 ||
    receipt.totalLogicalRequests !==
      receipt.githubLogicalRequests + receipt.npmLogicalRequests ||
    receipt.githubAttempts > 5430 ||
    receipt.npmAttempts > 240 ||
    receipt.totalAttempts !== receipt.githubAttempts + receipt.npmAttempts ||
    receipt.retries !== receipt.totalAttempts - receipt.totalLogicalRequests ||
    receipt.perOperation.length !==
      CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.length ||
    Object.entries(optionalFailures).some(
      ([key, value]) =>
        key.length < 1 || key.length > 300 || !nonnegative(value),
    )
  )
    invalid();
  receipt.perOperation.forEach((row, index) => {
    const requestCeiling = SUCCESSOR_OPERATION_LOGICAL_REQUEST_CEILINGS[index];
    if (
      row.operationId !== CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS[index] ||
      requestCeiling === undefined ||
      !nonnegative(row.logicalRequests) ||
      row.logicalRequests > requestCeiling ||
      !nonnegative(row.attempts) ||
      row.attempts < row.logicalRequests ||
      row.attempts > row.logicalRequests * 3 ||
      !nonnegative(row.establishedAbsences) ||
      row.establishedAbsences > 150 ||
      !nonnegative(row.qualifiedUnknowns) ||
      row.qualifiedUnknowns > 150
    )
      invalid();
  });
  const npmIndex = CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS.indexOf(
    'npm-selected-version-metadata',
  );
  const npm = receipt.perOperation[npmIndex];
  const github = receipt.perOperation.filter((_, index) => index !== npmIndex);
  if (
    npm?.logicalRequests !== receipt.npmLogicalRequests ||
    npm?.attempts !== receipt.npmAttempts ||
    github.reduce((sum, row) => sum + row.logicalRequests, 0) !==
      receipt.githubLogicalRequests ||
    github.reduce((sum, row) => sum + row.attempts, 0) !==
      receipt.githubAttempts
  )
    invalid();
}

function validateDatum(
  value: CandidateAuthoritySuccessorSourceDatum,
  expectedOperation: CandidateAuthoritySuccessorOperationId | undefined,
): CandidateAuthoritySuccessorSourceDatum {
  if (
    expectedOperation === undefined ||
    value.operationId !== expectedOperation ||
    ![
      'established-absence',
      'established-value',
      'not-applicable',
      'qualified-unknown',
    ].includes(value.outcome) ||
    !['complete', 'partial', 'not-applicable'].includes(value.completeness) ||
    (value.limitationCode !== null &&
      (typeof value.limitationCode !== 'string' ||
        value.limitationCode.length < 1 ||
        value.limitationCode.length > 200)) ||
    (value.outcome === 'qualified-unknown' &&
      (value.completeness !== 'partial' ||
        value.limitationCode === null ||
        value.value !== null)) ||
    (value.outcome === 'established-absence' &&
      (value.completeness !== 'complete' ||
        value.limitationCode !== null ||
        value.value !== null)) ||
    (value.outcome === 'not-applicable' &&
      (value.completeness !== 'not-applicable' ||
        value.limitationCode !== null ||
        value.value !== null)) ||
    (value.outcome === 'established-value' &&
      (value.value === null || value.limitationCode !== null))
  )
    invalid();
  return value;
}

function parseAuthority(text: string, digestKey: string, digest: string) {
  const value = parseJson(text);
  if (value[digestKey] !== digest) invalid();
  const without = Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== digestKey),
  );
  if (canonicalizeJson(without).digest !== digest) invalid();
  return value;
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return requireRecord(value);
  } catch {
    return invalid();
  }
}

function stringRecord(value: unknown): Readonly<Record<string, string>> {
  const record = requireRecord(value);
  if (Object.values(record).some((item) => typeof item !== 'string')) invalid();
  return record as Readonly<Record<string, string>>;
}

function forbidUnsafeKeys(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(forbidUnsafeKeys);
    return;
  }
  if (typeof value !== 'object' || value === null) return;
  for (const [key, item] of Object.entries(value)) {
    if (
      /token|authorization|credential|headers?|responsebody|rawbody/iu.test(key)
    ) {
      if (
        ![
          'credentialAvailable',
          'liveAuthorizationVersion',
          'liveAuthorizationDigest',
        ].includes(key)
      )
        invalid();
    }
    forbidUnsafeKeys(item);
  }
}

function nonnegative(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
