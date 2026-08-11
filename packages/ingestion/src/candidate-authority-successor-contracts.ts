/* eslint-disable @typescript-eslint/no-unnecessary-condition -- Successor authorities are trust-boundary inputs. */

import { canonicalizeJson } from './canonical-json.ts';
import {
  CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION,
  CANDIDATE_AUTHORITY_SUCCESSOR_OPERATION_IDS,
  createCandidateAuthoritySuccessorSourceAuthority,
  createCandidateAuthoritySuccessorSourceCandidate,
  materializeCandidateAuthoritySuccessorRuntimeSourcePolicy,
  type CandidateAuthoritySuccessorOperationId,
  type CandidateAuthoritySuccessorRuntimeSourcePolicy,
  type CandidateAuthoritySuccessorSourceAuthority,
  type CandidateAuthoritySuccessorSourceCandidate,
  type CandidateAuthoritySuccessorSourceDatum,
} from './candidate-authority-provider-contract.ts';
import { CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION } from './candidate-authority-readiness.ts';
import { ingestionError } from './errors.ts';
import { requireRecord } from './profile-materialization-contracts.ts';
import type { PublicCatalog } from './types.ts';

export const CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD =
  'acca908a98b09e2263252f3bcd861b7c4f9a27ee' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_VERSION =
  'candidate-authority-provider-contract/2.0.0' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_PATH =
  'catalog/public-v1/candidate-authority-provider-contract-v2.json' as const;
export const CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST =
  'edfd7ebcd8d42cbb65de4e79307ab91df81bd104b4039179082e1ff22686187b' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_VERSION =
  'candidate-authority-source-policy/7.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_PATH =
  'catalog/public-v1/candidate-authority-source-policy-v7.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST =
  '237b707fce608b4518ae09fcd07f7e08c315f7f323e56fb338990e1102fd29d7' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V4_VERSION =
  'candidate-authority-pure-replay/4.0.0' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V4_PATH =
  'catalog/public-v1/candidate-authority-replay-algorithm-v4.json' as const;
export const CANDIDATE_AUTHORITY_REPLAY_V4_DIGEST =
  '4bf82a790299a8373b2a2f75552842fe69847a2e362ebadec08776a8e69db84c' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION =
  'candidate-authority-live-authorization/5.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v5.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST =
  '5b2dc1d60ae7ae052547a7f31e6a903fe9b693cc77a16ec2bfba8a137d1fb78d' as const;

export const CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION =
  'candidate-authority-source-authority/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_STAGING_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v2.staging.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_VERSION =
  'candidate-authority-deterministic-profile-authority/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROFILE_PATH =
  'catalog/public-v1/candidate-authority-profiles-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_VERSION =
  'candidate-authority-partial-field-evidence-authority/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PARTIAL_PATH =
  'catalog/public-v1/candidate-authority-partial-evidence-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_VERSION =
  'candidate-authority-fit-consumable-evidence-authority/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_EVIDENCE_PATH =
  'catalog/public-v1/candidate-authority-evidence-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_VERSION =
  'candidate-authority-dossier-authority/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_DOSSIER_PATH =
  'catalog/public-v1/candidate-authority-dossiers-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_VERSION =
  'candidate-authority-dossier-projection/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_PROJECTION_PATH =
  'catalog/public-v1/candidate-authority-dossier-projection-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_VERSION =
  'candidate-authority-realized-readiness-report/2.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_READINESS_PATH =
  'catalog/public-v1/candidate-authority-readiness-report-v2.json' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_VERSION =
  'candidate-authority-root/5.0.0' as const;
export const CANDIDATE_AUTHORITY_SUCCESSOR_ROOT_PATH =
  'catalog/public-v1/candidate-authority-root-v5.json' as const;
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
  readonly version: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION;
  readonly digest: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST;
  readonly bindings: Readonly<Record<string, string>>;
  readonly conditionalCollections: 1;
  readonly activeCollections: 0;
  readonly automaticRerun: false;
}

export function parseCandidateAuthoritySuccessorFixedAuthorities(input: {
  readonly providerContractV1: string;
  readonly providerContractV2: string;
  readonly sourcePolicyV6: string;
  readonly sourcePolicyV7: string;
  readonly replayV4: string;
  readonly authorizationV5: string;
}): {
  readonly sourcePolicy: CandidateAuthoritySuccessorRuntimeSourcePolicy;
  readonly authorization: CandidateAuthoritySuccessorAuthorization;
} {
  const providerV1 = parseJson(input.providerContractV1);
  const providerV2 = parseAuthority(
    input.providerContractV2,
    'contractSemanticDigest',
    CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST,
  );
  const sourceV6 = parseJson(input.sourcePolicyV6);
  const sourceV7 = parseAuthority(
    input.sourcePolicyV7,
    'policySemanticDigest',
    CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST,
  );
  const replay = parseAuthority(
    input.replayV4,
    'canonicalAlgorithmDigest',
    CANDIDATE_AUTHORITY_REPLAY_V4_DIGEST,
  );
  const authorization = parseAuthority(
    input.authorizationV5,
    'authorizationSemanticDigest',
    CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST,
  );
  if (
    providerV2['contractVersion'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_VERSION ||
    requireRecord(providerV2['supersedesBeforeActivation'])['digest'] !==
      '06495281a2642ca3bc3ba5dec07ea1ddd0c541130f294f5d6bea62c525abfd0c' ||
    sourceV7['policyVersion'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_VERSION ||
    requireRecord(sourceV7['bindings'])['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST ||
    replay['algorithmVersion'] !== CANDIDATE_AUTHORITY_REPLAY_V4_VERSION ||
    requireRecord(replay['bindings'])['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST ||
    authorization['authorizationVersion'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION
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
      'baf99884171e6407dcfe173ff6ab80b5d30719d5cd1babd5aa310ef44ef9243e' ||
    bindings['partialEvidenceDigest'] !==
      '6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e' ||
    bindings['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST ||
    bindings['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST ||
    bindings['replayAlgorithmDigest'] !== CANDIDATE_AUTHORITY_REPLAY_V4_DIGEST
  )
    invalid();
  const base = materializeCandidateAuthoritySuccessorRuntimeSourcePolicy(
    sourceV6,
    providerV1,
  );
  return Object.freeze({
    sourcePolicy: Object.freeze({
      ...base,
      policyVersion: CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_VERSION,
      policySemanticDigest: CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST,
    }),
    authorization: Object.freeze({
      version: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION,
      digest: CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST,
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
  if (
    authority.authorityVersion !==
      CANDIDATE_AUTHORITY_SUCCESSOR_SOURCE_VERSION ||
    authority.operatorVersion !==
      CANDIDATE_AUTHORITY_LIVE_OPERATOR_V5_VERSION ||
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
    bindings['acceptedPostmortemHead'] !==
      CANDIDATE_AUTHORITY_ACCEPTED_POSTMORTEM_HEAD ||
    bindings['failedExecutionHead'] !==
      '2cfe0682617fb303ebbb2deb7dd7bd34a383c912' ||
    bindings['failureRecordDigest'] !==
      '48fa5cfe14cb579b254892cf69bede27bd96a802c8bfde6da9f7f4a4ab5595c7' ||
    bindings['failureRecordVersion'] !==
      'candidate-authority-live-failure-record/1.0.0' ||
    bindings['fieldPlanVersion'] !== 'candidate-authority-field-plan/5.0.0' ||
    bindings['fieldPlanDigest'] !==
      '858385239dcecf78e35cb204740c817b01f51db2aa3bc750bf9df49848a8a160' ||
    bindings['providerContractVersion'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_VERSION ||
    bindings['providerContractDigest'] !==
      CANDIDATE_AUTHORITY_PROVIDER_CONTRACT_V2_DIGEST ||
    bindings['replayAlgorithmVersion'] !==
      CANDIDATE_AUTHORITY_REPLAY_V4_VERSION ||
    bindings['replayAlgorithmDigest'] !==
      CANDIDATE_AUTHORITY_REPLAY_V4_DIGEST ||
    bindings['readinessPolicyVersion'] !==
      CANDIDATE_AUTHORITY_READINESS_POLICY_V3_VERSION ||
    bindings['readinessPolicyDigest'] !==
      'f0095da4e9932cf93ce5cde6fecea1a2480aeb7b055d4b5917420303d8575752' ||
    bindings['partialSemanticRegistryVersion'] !==
      'candidate-authority-partial-field-semantics/2.0.0' ||
    bindings['partialSemanticRegistryDigest'] !==
      'baf99884171e6407dcfe173ff6ab80b5d30719d5cd1babd5aa310ef44ef9243e' ||
    bindings['partialEvidenceVersion'] !==
      'candidate-authority-partial-field-evidence/3.0.0' ||
    bindings['partialEvidenceDigest'] !==
      '6020d9ec109e73242cf110aad468beca29b3aed79838f419c5e23d0f714b4e8e' ||
    bindings['architectureDecision'] !==
      'ADR-0013-accepted-without-provider-effect' ||
    bindings['sourcePolicyVersion'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_VERSION ||
    bindings['sourcePolicyDigest'] !==
      CANDIDATE_AUTHORITY_SOURCE_POLICY_V7_DIGEST ||
    bindings['liveAuthorizationVersion'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_VERSION ||
    bindings['liveAuthorizationDigest'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_V5_DIGEST ||
    (input.acceptedExecutionHead !== undefined &&
      bindings['collectionExecutionHead'] !== input.acceptedExecutionHead) ||
    !/^[a-f0-9]{40}$/u.test(bindings['collectionExecutionHead'] ?? '') ||
    input.catalog.candidates.length !== 150
  )
    invalid();
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
      if (
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
    'npm-package-metadata',
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
