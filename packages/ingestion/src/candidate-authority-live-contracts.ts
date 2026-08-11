/* eslint-disable @typescript-eslint/no-unnecessary-condition -- This module validates committed trust-boundary authorities. */

import { canonicalizeJson } from './canonical-json.ts';
import {
  isCandidateAuthorityGitObjectSha,
  isSafeCandidateAuthorityRepositoryRelativePath,
} from './candidate-authority-license-provenance.ts';
import { ingestionError } from './errors.ts';
import {
  requireExactKeys,
  requireRecord,
} from './profile-materialization-contracts.ts';

export const CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD =
  '47397ce92ee500c011fe39820053ba22fd6b397b' as const;
export const CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD =
  'a1c141e87c96187c8edb5779709fa5ef04089390' as const;
export const CANDIDATE_AUTHORITY_PRIOR_REPLAY_OPERATOR_HEAD =
  '4152fb744086bb13ad581b461044a0e2670df1f4' as const;
export const CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_VERSION =
  'candidate-authority-live-authorization/2.0.0' as const;
export const CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v2.json' as const;
export const CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_DIGEST =
  '9184ce87d1e74e10d2dcfa91f7b4302292d7f92fa5e1e5bb8378d97339074129' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION =
  'candidate-authority-live-authorization/3.0.0' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_PATH =
  'catalog/public-v1/candidate-authority-live-authorization-v3.json' as const;
export const CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST =
  '3d39801eeabef0e09be54875216a99ff3e864296f0f682c3029010fa9fbe793f' as const;
export const CANDIDATE_AUTHORITY_LIVE_OPERATOR_VERSION =
  'candidate-authority-live-operator/3.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION =
  'candidate-authority-source-authority/1.0.0' as const;
export const CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v1.json' as const;
export const CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH =
  'catalog/public-v1/candidate-authority-source-authority-v1.staging.json' as const;
export const CANDIDATE_AUTHORITY_ROOT_INSTANCE_PATH =
  'catalog/public-v1/candidate-authority-root-v4.json' as const;
export const CANDIDATE_AUTHORITY_READINESS_REPORT_PATH =
  'catalog/public-v1/candidate-authority-readiness-report-v1.json' as const;
export const CANDIDATE_AUTHORITY_PROFILE_AUTHORITY_PATH =
  'catalog/public-v1/candidate-authority-profiles-v1.json' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_AUTHORITY_PATH =
  'catalog/public-v1/candidate-authority-partial-evidence-v1.json' as const;
export const CANDIDATE_AUTHORITY_EVIDENCE_AUTHORITY_PATH =
  'catalog/public-v1/candidate-authority-evidence-v1.json' as const;
export const CANDIDATE_AUTHORITY_DOSSIER_AUTHORITY_PATH =
  'catalog/public-v1/candidate-authority-dossiers-v1.json' as const;
export const CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_AUTHORITY_PATH =
  'catalog/public-v1/candidate-authority-dossier-projection-v1.json' as const;
export const CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH =
  'catalog/public-v1/candidate-authority-profiles-v1.staging.json' as const;
export const CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH =
  'catalog/public-v1/candidate-authority-partial-evidence-v1.staging.json' as const;
export const CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH =
  'catalog/public-v1/candidate-authority-evidence-v1.staging.json' as const;
export const CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH =
  'catalog/public-v1/candidate-authority-dossiers-v1.staging.json' as const;
export const CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH =
  'catalog/public-v1/candidate-authority-dossier-projection-v1.staging.json' as const;
export const CANDIDATE_AUTHORITY_READINESS_STAGING_PATH =
  'catalog/public-v1/candidate-authority-readiness-report-v1.staging.json' as const;
export const CANDIDATE_AUTHORITY_ROOT_STAGING_PATH =
  'catalog/public-v1/candidate-authority-root-v4.staging.json' as const;
export const CANDIDATE_AUTHORITY_GITHUB_TOKEN_ENVIRONMENT =
  'GITBLOCKS_CANDIDATE_AUTHORITY_GITHUB_TOKEN' as const;
export const CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES =
  268_435_456 as const;

export const CANDIDATE_AUTHORITY_OPERATION_IDS = [
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
  'github-root-tree',
  'github-compose-json-blob',
  'github-dockerfile-blob',
] as const;

export type CandidateAuthorityOperationId =
  (typeof CANDIDATE_AUTHORITY_OPERATION_IDS)[number];
export type CandidateAuthoritySourceOutcome =
  | 'established-absence'
  | 'established-value'
  | 'not-applicable'
  | 'qualified-unknown';

export interface CandidateAuthorityLiveAuthorizationV3 {
  readonly authorizationVersion: typeof CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION;
  readonly status: 'authorized-after-independent-exact-head-acceptance';
  readonly bindings: Readonly<Record<string, string>>;
  readonly executionHead: {
    readonly branch: 'feat/32-codebase-conditioned-ranking';
    readonly acceptedPreLiveHead: typeof CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD;
    readonly priorOperatorHead: typeof CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD;
    readonly priorReplayOperatorHead: typeof CANDIDATE_AUTHORITY_PRIOR_REPLAY_OPERATOR_HEAD;
    readonly requiredRelationship: 'accepted-pre-live-to-prior-operator-to-prior-replay-operator-to-exactly-one-ordinary-additive-provenance-correction';
    readonly allowedAdditiveProvenanceCorrectionCommits: 1;
    readonly independentReviewRequiredBeforeCredentialInspection: true;
  };
  readonly priorAuthorization: {
    readonly version: typeof CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_VERSION;
    readonly digest: typeof CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_DIGEST;
    readonly path: typeof CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_PATH;
  };
  readonly priorInvocationDisposition: {
    readonly executionHead: typeof CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD;
    readonly disposition: 'pre-effect-credential-gate-failure';
    readonly credentialAvailable: false;
    readonly collectionCutoff: null;
    readonly githubLogicalRequests: 0;
    readonly npmLogicalRequests: 0;
    readonly candidateProviderCalls: 0;
    readonly providerEffectCollectionsConsumed: 0;
    readonly sourceAuthoritiesProduced: 0;
    readonly sourceAuthority: 'absent';
    readonly stagingAuthority: 'absent';
    readonly allCandidateProjections: 0;
    readonly coverageReadinessCalculations: 0;
  };
  readonly collection: {
    readonly candidateCount: 150;
    readonly mappedNpmCount: 80;
    readonly collectionAuthorizations: 1;
    readonly providerEffectCollectionsPreviouslyConsumed: 0;
    readonly remainingProviderEffectCollections: 1;
    readonly automaticRerun: false;
    readonly fatalFailureDisposition: 'stop-no-automatic-rerun';
    readonly githubLogicalRequestCeiling: 1810;
    readonly npmLogicalRequestCeiling: 80;
    readonly totalLogicalRequestCeiling: 1890;
    readonly githubAttemptCeiling: 5430;
    readonly npmAttemptCeiling: 240;
    readonly totalAttemptCeiling: 5670;
  };
  readonly effects: {
    readonly database: false;
    readonly docker: false;
    readonly model: false;
    readonly ranking: false;
  };
  readonly paths: {
    readonly sourceAuthority: typeof CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH;
    readonly ownedStaging: typeof CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH;
    readonly root: typeof CANDIDATE_AUTHORITY_ROOT_INSTANCE_PATH;
    readonly readiness: typeof CANDIDATE_AUTHORITY_READINESS_REPORT_PATH;
    readonly deterministicProfiles: typeof CANDIDATE_AUTHORITY_PROFILE_AUTHORITY_PATH;
    readonly partialFieldEvidence: typeof CANDIDATE_AUTHORITY_PARTIAL_AUTHORITY_PATH;
    readonly fitConsumableEvidence: typeof CANDIDATE_AUTHORITY_EVIDENCE_AUTHORITY_PATH;
    readonly dossiers: typeof CANDIDATE_AUTHORITY_DOSSIER_AUTHORITY_PATH;
    readonly dossierProjection: typeof CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_AUTHORITY_PATH;
    readonly replayStaging: {
      readonly deterministicProfiles: typeof CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH;
      readonly partialFieldEvidence: typeof CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH;
      readonly fitConsumableEvidence: typeof CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH;
      readonly dossiers: typeof CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH;
      readonly dossierProjection: typeof CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH;
      readonly readiness: typeof CANDIDATE_AUTHORITY_READINESS_STAGING_PATH;
      readonly root: typeof CANDIDATE_AUTHORITY_ROOT_STAGING_PATH;
    };
  };
  readonly credentialEnvironmentName: typeof CANDIDATE_AUTHORITY_GITHUB_TOKEN_ENVIRONMENT;
  readonly operatorVersion: typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_VERSION;
  readonly sourceAuthorityVersion: typeof CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION;
  readonly maximumSerializedSourceAuthorityBytes: typeof CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES;
  readonly authorizationSemanticDigest: string;
}

export type CandidateAuthorityLiveAuthorization =
  CandidateAuthorityLiveAuthorizationV3;

export interface CandidateAuthoritySourceDatum {
  readonly operationId: CandidateAuthorityOperationId;
  readonly outcome: CandidateAuthoritySourceOutcome;
  readonly completeness: 'complete' | 'partial' | 'not-applicable';
  readonly limitationCode: string | null;
  readonly value: unknown;
}

export interface CandidateAuthoritySourceCandidateV1 {
  readonly candidateId: string;
  readonly github: { readonly owner: string; readonly repository: string };
  readonly npmPackage: string | null;
  readonly sources: readonly CandidateAuthoritySourceDatum[];
  readonly candidateSourceDigest: string;
}

export interface CandidateAuthorityOperationReceiptV1 {
  readonly operationId: CandidateAuthorityOperationId;
  readonly logicalRequests: number;
  readonly attempts: number;
  readonly establishedAbsences: number;
  readonly qualifiedUnknowns: number;
}

export interface CandidateAuthoritySourceAuthorityV1 {
  readonly authorityVersion: typeof CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION;
  readonly operatorVersion: typeof CANDIDATE_AUTHORITY_LIVE_OPERATOR_VERSION;
  readonly bindings: Readonly<Record<string, string>>;
  readonly collectionCutoff: string;
  readonly candidateCount: 150;
  readonly orderedCandidateIds: readonly string[];
  readonly candidates: readonly CandidateAuthoritySourceCandidateV1[];
  readonly effectReceipt: {
    readonly collectionExecutions: 1;
    readonly githubLogicalRequests: number;
    readonly npmLogicalRequests: number;
    readonly totalLogicalRequests: number;
    readonly githubAttempts: number;
    readonly npmAttempts: number;
    readonly totalAttempts: number;
    readonly retries: number;
    readonly perOperation: readonly CandidateAuthorityOperationReceiptV1[];
    readonly controlledOptionalSourceFailures: Readonly<Record<string, number>>;
    readonly credentialAvailable: true;
    readonly databaseCalls: 0;
    readonly dockerCalls: 0;
    readonly modelCalls: 0;
    readonly candidateExecutions: 0;
    readonly allCandidateProjections: 0;
    readonly coverageCalculations: 0;
  };
  readonly canonicalAuthorityDigest: string;
}

const AUTHORIZATION_KEYS = [
  'authorizationSemanticDigest',
  'authorizationVersion',
  'bindings',
  'collection',
  'credentialEnvironmentName',
  'effects',
  'executionHead',
  'maximumSerializedSourceAuthorityBytes',
  'operatorVersion',
  'paths',
  'priorAuthorization',
  'priorInvocationDisposition',
  'sourceAuthorityVersion',
  'status',
] as const;
const SOURCE_AUTHORITY_KEYS = [
  'authorityVersion',
  'bindings',
  'candidateCount',
  'candidates',
  'canonicalAuthorityDigest',
  'collectionCutoff',
  'effectReceipt',
  'operatorVersion',
  'orderedCandidateIds',
] as const;
const SOURCE_CANDIDATE_KEYS = [
  'candidateId',
  'candidateSourceDigest',
  'github',
  'npmPackage',
  'sources',
] as const;
const SOURCE_DATUM_KEYS = [
  'completeness',
  'limitationCode',
  'operationId',
  'outcome',
  'value',
] as const;
const EFFECT_RECEIPT_KEYS = [
  'allCandidateProjections',
  'candidateExecutions',
  'collectionExecutions',
  'controlledOptionalSourceFailures',
  'coverageCalculations',
  'credentialAvailable',
  'databaseCalls',
  'dockerCalls',
  'githubAttempts',
  'githubLogicalRequests',
  'modelCalls',
  'npmAttempts',
  'npmLogicalRequests',
  'perOperation',
  'retries',
  'totalAttempts',
  'totalLogicalRequests',
] as const;
const OPERATION_RECEIPT_KEYS = [
  'attempts',
  'establishedAbsences',
  'logicalRequests',
  'operationId',
  'qualifiedUnknowns',
] as const;
const LOGICAL_REQUEST_CEILINGS: Readonly<
  Record<CandidateAuthorityOperationId, number>
> = Object.freeze({
  'github-repository-metadata': 150,
  'github-default-branch-ref': 150,
  'github-head-commit-object': 150,
  'github-maintenance-window': 150,
  'github-license': 150,
  'github-community-profile': 150,
  'github-release-window': 150,
  'github-advisories': 160,
  'npm-package-metadata': 80,
  'github-compose-json-content': 150,
  'github-root-tree': 150,
  'github-compose-json-blob': 150,
  'github-dockerfile-blob': 150,
});

export function parseCandidateAuthorityLiveAuthorization(
  supplied: unknown,
): CandidateAuthorityLiveAuthorizationV3 {
  const record = requireRecord(supplied);
  requireExactKeys(record, AUTHORIZATION_KEYS);
  const candidate = record as unknown as CandidateAuthorityLiveAuthorizationV3;
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['authorizationSemanticDigest'];
  if (
    candidate.authorizationVersion !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION ||
    candidate.status !== 'authorized-after-independent-exact-head-acceptance' ||
    candidate.bindings['acceptedPreLiveHead'] !==
      CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD ||
    candidate.bindings['priorOperatorHead'] !==
      CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD ||
    candidate.bindings['priorReplayOperatorHead'] !==
      CANDIDATE_AUTHORITY_PRIOR_REPLAY_OPERATOR_HEAD ||
    candidate.bindings['priorLiveAuthorizationVersion'] !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_VERSION ||
    candidate.bindings['priorLiveAuthorizationDigest'] !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_DIGEST ||
    candidate.bindings['sourcePolicyVersion'] !==
      'candidate-authority-source-policy/5.0.0' ||
    candidate.bindings['sourcePolicyDigest'] !==
      'f1fb17132e42769385e0c4b8e9bb555dd31cdb1fccec3bc93f9c173f6bab725b' ||
    candidate.bindings['replayAlgorithmVersion'] !==
      'candidate-authority-pure-replay/2.0.0' ||
    candidate.executionHead.branch !== 'feat/32-codebase-conditioned-ranking' ||
    candidate.executionHead.acceptedPreLiveHead !==
      CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD ||
    candidate.executionHead.priorOperatorHead !==
      CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD ||
    candidate.executionHead.priorReplayOperatorHead !==
      CANDIDATE_AUTHORITY_PRIOR_REPLAY_OPERATOR_HEAD ||
    candidate.executionHead.requiredRelationship !==
      'accepted-pre-live-to-prior-operator-to-prior-replay-operator-to-exactly-one-ordinary-additive-provenance-correction' ||
    candidate.executionHead.allowedAdditiveProvenanceCorrectionCommits !== 1 ||
    !candidate.executionHead
      .independentReviewRequiredBeforeCredentialInspection ||
    candidate.priorAuthorization.version !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_VERSION ||
    candidate.priorAuthorization.digest !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_DIGEST ||
    candidate.priorAuthorization.path !==
      CANDIDATE_AUTHORITY_PRIOR_LIVE_AUTHORIZATION_PATH ||
    candidate.priorInvocationDisposition.executionHead !==
      CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD ||
    candidate.priorInvocationDisposition.disposition !==
      'pre-effect-credential-gate-failure' ||
    candidate.priorInvocationDisposition.credentialAvailable ||
    candidate.priorInvocationDisposition.collectionCutoff !== null ||
    candidate.priorInvocationDisposition.githubLogicalRequests !== 0 ||
    candidate.priorInvocationDisposition.npmLogicalRequests !== 0 ||
    candidate.priorInvocationDisposition.candidateProviderCalls !== 0 ||
    candidate.priorInvocationDisposition.providerEffectCollectionsConsumed !==
      0 ||
    candidate.priorInvocationDisposition.sourceAuthoritiesProduced !== 0 ||
    candidate.priorInvocationDisposition.sourceAuthority !== 'absent' ||
    candidate.priorInvocationDisposition.stagingAuthority !== 'absent' ||
    candidate.priorInvocationDisposition.allCandidateProjections !== 0 ||
    candidate.priorInvocationDisposition.coverageReadinessCalculations !== 0 ||
    candidate.collection.candidateCount !== 150 ||
    candidate.collection.mappedNpmCount !== 80 ||
    candidate.collection.collectionAuthorizations !== 1 ||
    candidate.collection.providerEffectCollectionsPreviouslyConsumed !== 0 ||
    candidate.collection.remainingProviderEffectCollections !== 1 ||
    candidate.collection.automaticRerun ||
    candidate.collection.fatalFailureDisposition !==
      'stop-no-automatic-rerun' ||
    candidate.collection.githubLogicalRequestCeiling !== 1810 ||
    candidate.collection.npmLogicalRequestCeiling !== 80 ||
    candidate.collection.totalLogicalRequestCeiling !== 1890 ||
    candidate.collection.githubAttemptCeiling !== 5430 ||
    candidate.collection.npmAttemptCeiling !== 240 ||
    candidate.collection.totalAttemptCeiling !== 5670 ||
    Object.values(candidate.effects).some(Boolean) ||
    candidate.paths.sourceAuthority !==
      CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_PATH ||
    candidate.paths.ownedStaging !== CANDIDATE_AUTHORITY_SOURCE_STAGING_PATH ||
    candidate.paths.root !== CANDIDATE_AUTHORITY_ROOT_INSTANCE_PATH ||
    candidate.paths.readiness !== CANDIDATE_AUTHORITY_READINESS_REPORT_PATH ||
    candidate.paths.deterministicProfiles !==
      CANDIDATE_AUTHORITY_PROFILE_AUTHORITY_PATH ||
    candidate.paths.partialFieldEvidence !==
      CANDIDATE_AUTHORITY_PARTIAL_AUTHORITY_PATH ||
    candidate.paths.fitConsumableEvidence !==
      CANDIDATE_AUTHORITY_EVIDENCE_AUTHORITY_PATH ||
    candidate.paths.dossiers !== CANDIDATE_AUTHORITY_DOSSIER_AUTHORITY_PATH ||
    candidate.paths.dossierProjection !==
      CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_AUTHORITY_PATH ||
    candidate.paths.replayStaging.deterministicProfiles !==
      CANDIDATE_AUTHORITY_PROFILE_STAGING_PATH ||
    candidate.paths.replayStaging.partialFieldEvidence !==
      CANDIDATE_AUTHORITY_PARTIAL_STAGING_PATH ||
    candidate.paths.replayStaging.fitConsumableEvidence !==
      CANDIDATE_AUTHORITY_EVIDENCE_STAGING_PATH ||
    candidate.paths.replayStaging.dossiers !==
      CANDIDATE_AUTHORITY_DOSSIER_STAGING_PATH ||
    candidate.paths.replayStaging.dossierProjection !==
      CANDIDATE_AUTHORITY_DOSSIER_PROJECTION_STAGING_PATH ||
    candidate.paths.replayStaging.readiness !==
      CANDIDATE_AUTHORITY_READINESS_STAGING_PATH ||
    candidate.paths.replayStaging.root !==
      CANDIDATE_AUTHORITY_ROOT_STAGING_PATH ||
    candidate.credentialEnvironmentName !==
      CANDIDATE_AUTHORITY_GITHUB_TOKEN_ENVIRONMENT ||
    candidate.operatorVersion !== CANDIDATE_AUTHORITY_LIVE_OPERATOR_VERSION ||
    candidate.sourceAuthorityVersion !==
      CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION ||
    candidate.maximumSerializedSourceAuthorityBytes !==
      CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES ||
    candidate.authorizationSemanticDigest !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST ||
    candidate.authorizationSemanticDigest !==
      canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(candidate);
}

export function createCandidateAuthoritySourceCandidate(
  input: Omit<CandidateAuthoritySourceCandidateV1, 'candidateSourceDigest'>,
): CandidateAuthoritySourceCandidateV1 {
  const ordered = {
    ...input,
    sources: [...input.sources].sort(
      (left, right) =>
        CANDIDATE_AUTHORITY_OPERATION_IDS.indexOf(left.operationId) -
        CANDIDATE_AUTHORITY_OPERATION_IDS.indexOf(right.operationId),
    ),
  };
  return deepFreeze({
    ...ordered,
    candidateSourceDigest: canonicalizeJson(ordered).digest,
  });
}

export function createCandidateAuthoritySourceAuthority(
  input: Omit<CandidateAuthoritySourceAuthorityV1, 'canonicalAuthorityDigest'>,
): CandidateAuthoritySourceAuthorityV1 {
  const normalized = deepFreeze({ ...input });
  return deepFreeze({
    ...normalized,
    canonicalAuthorityDigest: canonicalizeJson(normalized).digest,
  });
}

export function serializeCandidateAuthoritySourceAuthority(
  authority: CandidateAuthoritySourceAuthorityV1,
): string {
  const validated = parseCandidateAuthoritySourceAuthority(authority);
  const text = `${canonicalizeJson(validated).text}\n`;
  if (
    Buffer.byteLength(text, 'utf8') >
    CANDIDATE_AUTHORITY_SOURCE_MAXIMUM_SERIALIZED_BYTES
  )
    invalid();
  return text;
}

export function parseCandidateAuthoritySourceAuthority(
  supplied: unknown,
): CandidateAuthoritySourceAuthorityV1 {
  const record = requireRecord(supplied);
  requireExactKeys(record, SOURCE_AUTHORITY_KEYS);
  const authority = record as unknown as CandidateAuthoritySourceAuthorityV1;
  const effectReceipt = requireRecord(record['effectReceipt']);
  requireExactKeys(effectReceipt, EFFECT_RECEIPT_KEYS);
  if (
    authority.authorityVersion !==
      CANDIDATE_AUTHORITY_SOURCE_AUTHORITY_VERSION ||
    authority.operatorVersion !== CANDIDATE_AUTHORITY_LIVE_OPERATOR_VERSION ||
    !isTimestamp(authority.collectionCutoff) ||
    authority.candidateCount !== 150 ||
    !Array.isArray(authority.orderedCandidateIds) ||
    authority.orderedCandidateIds.length !== 150 ||
    !Array.isArray(authority.candidates) ||
    authority.candidates.length !== 150 ||
    !Array.isArray(authority.effectReceipt.perOperation) ||
    authority.effectReceipt.collectionExecutions !== 1 ||
    !authority.effectReceipt.credentialAvailable ||
    authority.effectReceipt.databaseCalls !== 0 ||
    authority.effectReceipt.dockerCalls !== 0 ||
    authority.effectReceipt.modelCalls !== 0 ||
    authority.effectReceipt.candidateExecutions !== 0 ||
    authority.effectReceipt.allCandidateProjections !== 0 ||
    authority.effectReceipt.coverageCalculations !== 0
  )
    invalid();
  if (
    authority.bindings['catalogVersion'] !== 'public-v1' ||
    authority.bindings['catalogDigest'] !==
      '4819dd94cb1bbe5e27c31ca5ca55976da1442987a792bf438d96681021cb8634' ||
    authority.bindings['taxonomyVersion'] !== '1.0.0' ||
    authority.bindings['taxonomyDigest'] !==
      '838fa85b2e6937866854b6f733fe7045cf49d5f811cb5e4a8d503bfbd76a61c9' ||
    authority.bindings['acceptedPreLiveHead'] !==
      CANDIDATE_AUTHORITY_ACCEPTED_PRELIVE_HEAD ||
    authority.bindings['priorOperatorHead'] !==
      CANDIDATE_AUTHORITY_PRIOR_OPERATOR_HEAD ||
    authority.bindings['priorReplayOperatorHead'] !==
      CANDIDATE_AUTHORITY_PRIOR_REPLAY_OPERATOR_HEAD ||
    !isCommitSha(authority.bindings['collectionExecutionHead']) ||
    authority.bindings['adr0012'] !== 'accepted' ||
    authority.bindings['sourcePolicyVersion'] !==
      'candidate-authority-source-policy/5.0.0' ||
    authority.bindings['sourcePolicyDigest'] !==
      'f1fb17132e42769385e0c4b8e9bb555dd31cdb1fccec3bc93f9c173f6bab725b' ||
    authority.bindings['liveAuthorizationVersion'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_VERSION ||
    authority.bindings['liveAuthorizationDigest'] !==
      CANDIDATE_AUTHORITY_LIVE_AUTHORIZATION_DIGEST
  )
    invalid();
  const candidates: readonly CandidateAuthoritySourceCandidateV1[] =
    authority.candidates;
  const orderedCandidateIds: readonly string[] = authority.orderedCandidateIds;
  const ids = candidates.map((candidate) => candidate.candidateId);
  if (
    !arraysEqual(ids, orderedCandidateIds) ||
    new Set(ids).size !== 150 ||
    authority.effectReceipt.githubLogicalRequests > 1810 ||
    authority.effectReceipt.npmLogicalRequests > 80 ||
    authority.effectReceipt.totalLogicalRequests !==
      authority.effectReceipt.githubLogicalRequests +
        authority.effectReceipt.npmLogicalRequests ||
    authority.effectReceipt.totalLogicalRequests > 1890 ||
    authority.effectReceipt.githubAttempts > 5430 ||
    authority.effectReceipt.npmAttempts > 240 ||
    authority.effectReceipt.totalAttempts !==
      authority.effectReceipt.githubAttempts +
        authority.effectReceipt.npmAttempts ||
    authority.effectReceipt.totalAttempts > 5670 ||
    authority.effectReceipt.retries !==
      authority.effectReceipt.totalAttempts -
        authority.effectReceipt.totalLogicalRequests
  )
    invalid();
  const operationReceipts: readonly CandidateAuthorityOperationReceiptV1[] =
    authority.effectReceipt.perOperation;
  if (operationReceipts.length !== CANDIDATE_AUTHORITY_OPERATION_IDS.length)
    invalid();
  for (const [index, receipt] of operationReceipts.entries()) {
    requireExactKeys(requireRecord(receipt), OPERATION_RECEIPT_KEYS);
    const expectedOperation = CANDIDATE_AUTHORITY_OPERATION_IDS[index];
    if (
      expectedOperation === undefined ||
      receipt.operationId !== expectedOperation ||
      !isCount(receipt.logicalRequests) ||
      !isCount(receipt.attempts) ||
      !isCount(receipt.establishedAbsences) ||
      !isCount(receipt.qualifiedUnknowns) ||
      receipt.logicalRequests > LOGICAL_REQUEST_CEILINGS[expectedOperation] ||
      receipt.attempts < receipt.logicalRequests ||
      receipt.attempts > LOGICAL_REQUEST_CEILINGS[expectedOperation] * 3
    )
      invalid();
  }
  const githubReceipts = operationReceipts.filter(
    (receipt) => receipt.operationId !== 'npm-package-metadata',
  );
  const npmReceipt = operationReceipts.find(
    (receipt) => receipt.operationId === 'npm-package-metadata',
  );
  if (
    npmReceipt === undefined ||
    githubReceipts.reduce(
      (sum, receipt) => sum + receipt.logicalRequests,
      0,
    ) !== authority.effectReceipt.githubLogicalRequests ||
    githubReceipts.reduce((sum, receipt) => sum + receipt.attempts, 0) !==
      authority.effectReceipt.githubAttempts ||
    npmReceipt.logicalRequests !== authority.effectReceipt.npmLogicalRequests ||
    npmReceipt.attempts !== authority.effectReceipt.npmAttempts
  )
    invalid();
  for (const [index, candidate] of candidates.entries()) {
    validateSourceCandidate(candidate, orderedCandidateIds[index]);
  }
  const withoutDigest = { ...authority } as Record<string, unknown>;
  delete withoutDigest['canonicalAuthorityDigest'];
  if (
    authority.canonicalAuthorityDigest !==
    canonicalizeJson(withoutDigest).digest
  )
    invalid();
  return deepFreeze(authority);
}

function validateSourceCandidate(
  candidate: CandidateAuthoritySourceCandidateV1,
  expectedId: string | undefined,
): void {
  requireExactKeys(requireRecord(candidate), SOURCE_CANDIDATE_KEYS);
  requireExactKeys(requireRecord(candidate.github), ['owner', 'repository']);
  if (
    candidate.candidateId !== expectedId ||
    !isSafeToken(candidate.candidateId, 100) ||
    !isSafeToken(candidate.github.owner, 100) ||
    !isSafeToken(candidate.github.repository, 100) ||
    !Array.isArray(candidate.sources)
  )
    invalid();
  const sources: readonly CandidateAuthoritySourceDatum[] = candidate.sources;
  const operationIds = sources.map((source) => source.operationId);
  if (
    operationIds.length !== CANDIDATE_AUTHORITY_OPERATION_IDS.length ||
    new Set(operationIds).size !== operationIds.length ||
    !operationIds.every(
      (id, index) => id === CANDIDATE_AUTHORITY_OPERATION_IDS[index],
    )
  )
    invalid();
  for (const source of sources) {
    requireExactKeys(requireRecord(source), SOURCE_DATUM_KEYS);
    if (
      (source.outcome !== 'established-absence' &&
        source.outcome !== 'established-value' &&
        source.outcome !== 'not-applicable' &&
        source.outcome !== 'qualified-unknown') ||
      (source.completeness !== 'complete' &&
        source.completeness !== 'partial' &&
        source.completeness !== 'not-applicable') ||
      (source.limitationCode !== null &&
        !isSafeToken(source.limitationCode, 200)) ||
      (source.outcome === 'qualified-unknown' &&
        (source.completeness !== 'partial' ||
          source.limitationCode === null ||
          source.value !== null)) ||
      (source.outcome === 'established-absence' &&
        (source.completeness !== 'complete' || source.value !== null)) ||
      (source.outcome === 'not-applicable' &&
        (source.completeness !== 'not-applicable' || source.value !== null)) ||
      (source.outcome === 'established-value' && source.value === null)
    )
      invalid();
  }
  validateLicenseSource(candidate, sources);
  const withoutDigest = { ...candidate } as Record<string, unknown>;
  delete withoutDigest['candidateSourceDigest'];
  if (
    candidate.candidateSourceDigest !== canonicalizeJson(withoutDigest).digest
  )
    invalid();
}

function validateLicenseSource(
  candidate: CandidateAuthoritySourceCandidateV1,
  sources: readonly CandidateAuthoritySourceDatum[],
): void {
  const license = sources.find(
    (source) => source.operationId === 'github-license',
  );
  if (license?.outcome !== 'established-value') return;
  const value = requireRecord(license.value);
  requireExactKeys(value, [
    'blobSha',
    'headSha',
    'partialFacts',
    'path',
    'repositoryIdentity',
    'spdxId',
  ]);
  const repositoryIdentity = requireRecord(value['repositoryIdentity']);
  requireExactKeys(repositoryIdentity, ['owner', 'repository']);
  const metadata = requireEstablishedSourceValue(
    sources,
    'github-repository-metadata',
  );
  const commit = requireEstablishedSourceValue(
    sources,
    'github-head-commit-object',
  );
  const owner = repositoryIdentity['owner'];
  const repository = repositoryIdentity['repository'];
  const spdxId = value['spdxId'];
  if (
    !isSafeToken(owner, 100) ||
    !isSafeToken(repository, 100) ||
    owner !== metadata['canonicalOwner'] ||
    repository !== metadata['canonicalRepository'] ||
    owner.toLowerCase() !== candidate.github.owner.toLowerCase() ||
    repository.toLowerCase() !== candidate.github.repository.toLowerCase() ||
    !isCandidateAuthorityGitObjectSha(value['headSha']) ||
    value['headSha'] !== commit['headSha'] ||
    !isCandidateAuthorityGitObjectSha(value['blobSha']) ||
    !isSafeCandidateAuthorityRepositoryRelativePath(value['path']) ||
    (spdxId !== null && !isSafeToken(spdxId, 64)) ||
    !Array.isArray(value['partialFacts']) ||
    value['partialFacts'].length > 1
  )
    invalid();
}

function requireEstablishedSourceValue(
  sources: readonly CandidateAuthoritySourceDatum[],
  operationId: CandidateAuthorityOperationId,
): Record<string, unknown> {
  const source = sources.find(
    (candidate) => candidate.operationId === operationId,
  );
  if (source?.outcome !== 'established-value') invalid();
  return requireRecord(source.value);
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isSafeToken(value: unknown, maximum: number): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 1 &&
    value.length <= maximum &&
    !hasControlCharacter(value)
  );
}

function isTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isCommitSha(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value);
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 31 || code === 127) return true;
  }
  return false;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value))
    return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function invalid(): never {
  throw ingestionError('ingestion.invalid-input');
}
